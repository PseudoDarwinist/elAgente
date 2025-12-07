"""A collection of clients for performing text generation."""

import os
from abc import ABC, abstractmethod
from typing import Any, cast

from anthropic import Anthropic
from anthropic.types import MessageParam as AnthropicMessageBlock
from anthropic.types import ToolParam
from google import genai
from google.genai import types
from pydantic import BaseModel
from shared.logger import logger  # type: ignore
from shared.schemas import (  # type: ignore
    Content,
    Message,
    TextBlock,
    TextGenerationPayload,
    Usage,
)
from utils.adapters import (  # type: ignore[import-not-found]
    AnthropicTextGenerationPayloadAdapter,
    AnthropicToMCPAdapter,
    GeminiTextGenerationPayloadAdapter,
    GeminiToMCPAdapter,
)
from utils.schemas import (  # type: ignore
    LLMSettings,
)


class BaseClient(ABC):
    """A base client for LLM clients to implement."""

    def __init__(self, settings: LLMSettings = LLMSettings()) -> None:
        """The constructor for the base client."""
        self.settings = settings

    @abstractmethod
    def generate(self, payload: TextGenerationPayload) -> Message:
        """An abstract method for generating text using an LLM."""
        pass


class DummyClient(BaseClient):
    """A dummy client for mocking responses from an LLM."""

    def generate(self, payload: TextGenerationPayload) -> Message:
        """A concrete generate method which returns a mocked response."""
        msg = "This is a template response from a dummy model."
        content: Content = [TextBlock(text=msg, type="text")]

        response = Message(
            id="0",
            model=self.settings.model,
            content=content,
            role="assistant",
            stop_reason="end_turn",
            usage=None,
        )

        # No token usage for dummy client
        logger.info("Dummy LLM response generated")
        return response


class AnthropicClient(BaseClient):
    """A client for performing text generation using the Anthropic client."""

    def __init__(self, settings: LLMSettings = LLMSettings()) -> None:
        """The constructor for the Anthropic client."""
        super().__init__(settings)
        self.client = Anthropic()

    @staticmethod
    def _add_cache_to_final_block(
        result: Any,
    ) -> list[Content]:
        """Convert a tool result to a list of text blocks.

        Args:
            result: The result to convert to a list of text blocks.

        Returns:
            The list of text blocks.
        """
        blocks = []
        for content in list(result):
            if isinstance(content, BaseModel):
                blocks.append(content.model_dump())
            else:
                blocks.append(content)

        # Add cache control to the blocks
        blocks[-1]["cache_control"] = {"type": "ephemeral"}

        return cast(list[Content], blocks)

    @staticmethod
    def cache_tools(tools: list[ToolParam]) -> list[ToolParam]:
        """A method for adding a cache block to tools."""
        tools[-1]["cache_control"] = {"type": "ephemeral"}
        return tools

    def cache_messages(
        self, messages: list[AnthropicMessageBlock]
    ) -> list[AnthropicMessageBlock]:
        """A method for adding a cache block to messages."""
        cached_messages = messages
        if len(messages) > 1:
            cached_messages[-1]["content"] = self._add_cache_to_final_block(
                messages[-1]["content"]
            )
        return cached_messages

    def generate(self, payload: TextGenerationPayload) -> Message:
        """A method for generating text using the Anthropic API.

        This method implements prompt caching for the Anthropic API.
        """
        adapter = AnthropicTextGenerationPayloadAdapter(payload)

        messages, tools = adapter.adapt()

        cached_tools = self.cache_tools(tools)
        cached_messages = self.cache_messages(messages)

        if not self.settings.max_tokens:
            raise ValueError("Max tokens configuration has not been set.")

        response = self.client.messages.create(
            model=self.settings.model,
            max_tokens=self.settings.max_tokens,
            messages=cached_messages,
            tools=cached_tools,
        )

        logger.info(
            f"Token usage - Input: {response.usage.input_tokens}, "
            f"Output: {response.usage.output_tokens}, "
            f"Cache Creation: {response.usage.cache_creation_input_tokens}, "
            f"Cache Read: {response.usage.cache_read_input_tokens}"
        )

        adapter = AnthropicToMCPAdapter(response.content)
        content = adapter.adapt()

        return Message(
            id=response.id,
            model=response.model,
            content=content,
            role=response.role,
            stop_reason=response.stop_reason,
            usage=Usage(
                input_tokens=response.usage.input_tokens,
                output_tokens=response.usage.output_tokens,
                cache_creation_input_tokens=response.usage.cache_creation_input_tokens,
                cache_read_input_tokens=response.usage.cache_read_input_tokens,
            ),
        )


class OpenAIClient(BaseClient):
    """A client for performing text generation using the OpenAI client."""

    def generate(self, payload: TextGenerationPayload) -> Message:
        """A method for generating text using the OpenAI API."""
        raise NotImplementedError


class GeminiClient(BaseClient):
    """A client for performing text generation using the Gemini client."""

    def __init__(self, settings: LLMSettings = LLMSettings()) -> None:
        """The constructor for the Gemini client."""
        super().__init__(settings)
        self.client = genai.Client(api_key=os.getenv("GEMINI_API_KEY"))

    def generate(self, payload: TextGenerationPayload) -> Message:
        """A method for generating text using the Gemini API."""
        adapter = GeminiTextGenerationPayloadAdapter(payload)

        messages, tools = adapter.adapt()

        if not self.settings.max_tokens:
            raise ValueError("Max tokens configuration has not been set.")

        response = self.client.models.generate_content(
            model=self.settings.model,
            contents=messages,
            config=types.GenerateContentConfig(
                tools=tools,
                max_output_tokens=self.settings.max_tokens,
                tool_config=types.ToolConfig(
                    function_calling_config=types.FunctionCallingConfig(
                        mode="AUTO",
                    )
                ),
            ),
        )

        if response.usage_metadata:
            logger.info(
                f"Token usage - Input: {response.usage_metadata.prompt_token_count}, "
                f"Output: {response.usage_metadata.candidates_token_count}, "
                f"Cache: {response.usage_metadata.cached_content_token_count}, "
                f"Tools: {response.usage_metadata.tool_use_prompt_token_count}, "
                f"Total: {response.usage_metadata.total_token_count}"
            )

        adapter = GeminiToMCPAdapter(response.candidates)
        content = adapter.adapt()

        # Map Gemini finish_reason to MCP stop_reason
        # Gemini: STOP, MAX_TOKENS, SAFETY, RECITATION, OTHER
        # MCP expects: end_turn, tool_use, max_tokens, stop_sequence
        gemini_finish = (
            response.candidates[0].finish_reason if response.candidates else "STOP"
        )
        if gemini_finish == "STOP":
            # Check if there are function calls - if so, it's tool_use
            has_tool_call = any(
                part.function_call
                for c in response.candidates
                if c.content and c.content.parts
                for part in c.content.parts
            )
            stop_reason = "tool_use" if has_tool_call else "end_turn"
        elif gemini_finish == "MAX_TOKENS":
            stop_reason = "max_tokens"
        else:
            stop_reason = "end_turn"

        return Message(
            id=response.response_id or f"gemini_{hash(str(response))}",
            model=response.model_version,
            content=content,
            role="assistant",
            stop_reason=stop_reason,
            usage=Usage(
                input_tokens=response.usage_metadata.prompt_token_count or 0,
                output_tokens=response.usage_metadata.candidates_token_count or 0,
                cache_creation_input_tokens=None,
                cache_read_input_tokens=response.usage_metadata.cached_content_token_count,
            )
            if response.usage_metadata
            else Usage(input_tokens=0, output_tokens=0),
        )


class SelfHostedClient(BaseClient):
    """A client for performing text generation using a self-hosted/custom OpenAI-compatible API.
    
    Supports OpenAI-compatible endpoints with custom authentication headers.
    Environment variables:
        - LLM_API_URL: The API endpoint URL (e.g., https://company.com/v1/chat/completions)
        - LLM_API_KEY: The API key for authentication
    """

    def __init__(self, settings: LLMSettings = LLMSettings()) -> None:
        """The constructor for the SelfHostedClient."""
        super().__init__(settings)
        self.api_url = os.getenv("LLM_API_URL", "")
        self.api_key = os.getenv("LLM_API_KEY", "")
        
        if not self.api_url:
            logger.warning("LLM_API_URL not set for self-hosted client")

    def generate(self, payload: TextGenerationPayload) -> Message:
        """Generate text using an OpenAI-compatible API endpoint."""
        import requests
        
        if not self.api_url:
            raise ValueError("LLM_API_URL environment variable not set")
        
        # Convert MCP format to OpenAI format
        messages = []
        for msg in payload.messages:
            content_text = ""
            if isinstance(msg.content, list):
                for block in msg.content:
                    if hasattr(block, "text"):
                        content_text += block.text
                    elif isinstance(block, dict) and "text" in block:
                        content_text += block["text"]
            elif isinstance(msg.content, str):
                content_text = msg.content
            
            messages.append({
                "role": msg.role,
                "content": content_text
            })
        
        # Convert tools to OpenAI format
        tools = []
        for tool in payload.tools:
            tool_dict = tool.model_dump() if hasattr(tool, "model_dump") else tool
            # Get input schema and ensure it has the required 'type' field
            input_schema = tool_dict.get("input_schema", tool_dict.get("parameters", {}))
            if isinstance(input_schema, dict) and "type" not in input_schema:
                input_schema = {"type": "object", **input_schema}
            
            tools.append({
                "type": "function",
                "function": {
                    "name": tool_dict.get("name", ""),
                    "description": tool_dict.get("description", ""),
                    "parameters": input_schema
                }
            })
        
        # Build request payload
        request_payload = {
            "model": self.settings.model,
            "messages": messages,
            "temperature": 0.7,
            "max_tokens": self.settings.max_tokens or 4000,
        }
        
        if tools:
            request_payload["tools"] = tools
            request_payload["tool_choice"] = "auto"
        
        headers = {
            "Content-Type": "application/json",
            "X-API-KEY": self.api_key,
        }
        
        logger.info(f"Sending request to self-hosted LLM: {self.api_url}")
        logger.debug(f"Model: {self.settings.model}, Messages: {len(messages)}, Tools: {len(tools)}")
        
        try:
            response = requests.post(
                self.api_url,
                headers=headers,
                json=request_payload,
                timeout=120
            )
            # Log error response body before raising
            if not response.ok:
                logger.error(f"LLM API error {response.status_code}: {response.text[:500]}")
            response.raise_for_status()
            data = response.json()
        except requests.exceptions.HTTPError as e:
            logger.error(f"Self-hosted LLM request failed: {e}")
            logger.error(f"Response body: {e.response.text[:1000] if e.response else 'No response'}")
            raise
        except requests.exceptions.RequestException as e:
            logger.error(f"Self-hosted LLM request failed: {e}")
            raise
        
        # Parse OpenAI response format
        choice = data.get("choices", [{}])[0]
        message_data = choice.get("message", {})
        
        # Build content from response
        content: Content = []
        
        # Handle text content
        if message_data.get("content"):
            content.append(TextBlock(text=message_data["content"], type="text"))
        
        # Handle tool calls
        tool_calls = message_data.get("tool_calls", [])
        for tc in tool_calls:
            if tc.get("type") == "function":
                func = tc.get("function", {})
                import json
                try:
                    args = json.loads(func.get("arguments", "{}"))
                except json.JSONDecodeError:
                    args = {}
                
                from shared.schemas import ToolUseBlock  # type: ignore
                content.append(ToolUseBlock(
                    id=tc.get("id", f"tool_{hash(func.get('name', ''))}"),
                    name=func.get("name", ""),
                    arguments=args,
                    type="tool_use"
                ))
        
        # Determine stop reason
        finish_reason = choice.get("finish_reason", "stop")
        # Check for tool calls - if we have tool calls, it's tool_use regardless of finish_reason
        # Many OpenAI-compatible APIs return "stop" even when there are tool_calls
        if tool_calls:
            stop_reason = "tool_use"
        elif finish_reason == "tool_calls":
            stop_reason = "tool_use"
        elif finish_reason == "length":
            stop_reason = "max_tokens"
        else:
            stop_reason = "end_turn"
        
        # Parse usage
        usage_data = data.get("usage", {})
        
        logger.info(
            f"Token usage - Input: {usage_data.get('prompt_tokens', 0)}, "
            f"Output: {usage_data.get('completion_tokens', 0)}"
        )
        
        return Message(
            id=data.get("id", f"selfhosted_{hash(str(data))}"),
            model=data.get("model", self.settings.model),
            content=content,
            role="assistant",
            stop_reason=stop_reason,
            usage=Usage(
                input_tokens=usage_data.get("prompt_tokens", 0),
                output_tokens=usage_data.get("completion_tokens", 0),
                cache_creation_input_tokens=None,
                cache_read_input_tokens=None,
            ),
        )

