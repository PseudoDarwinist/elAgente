"""An MCP SSE Client for interacting with a server using the MCP protocol.

ARCHITECTURE OVERVIEW (For Technical Panel):
--------------------------------------------
This is the "Brain" (Orchestrator) of the Event-Driven SRE Agent.
It implements a Cognitive Architecture based on the Model Context Protocol (MCP).

Key Components:
1.  **FastAPI Server**: Handles incoming Webhooks (Grafana) and Diagnosis Requests.
2.  **MCP Client**: Connects to "Tool Servers" (GitHub, Slack, etc.) dynamically.
    -   Decouples "Thinking" (LLM) from "Doing" (Tools).
    -   Tools run as separate microservices for security and scalability.
3.  **ReAct Loop**: Manually implements the Reason -> Act -> Observe loop.
    -   See `process_query()` for the core agentic logic.
4.  **RAG Engine**: Injects "Long-Term Memory" from Qdrant (Vector DB) to solve repetitive incidents.
5.  **Event Stream**: Uses Server-Sent Events (SSE) to push real-time "thoughts" to the Dashboard.
"""

import asyncio
import json
import time
import uuid
from asyncio import TimeoutError, wait_for
from contextlib import AsyncExitStack
from dataclasses import dataclass, field, asdict
from functools import lru_cache
from http import HTTPStatus
from typing import Annotated, Any, cast

import os
import requests
from dotenv import load_dotenv
from fastapi import BackgroundTasks, Depends, FastAPI, HTTPException, Request, status
from fastapi.responses import JSONResponse, StreamingResponse
from mcp import ClientSession
from mcp.client.sse import sse_client
from mcp.shared.exceptions import McpError
from mcp.types import GetPromptResult, TextContent
from shared.logger import logger  # type: ignore[import-not-found]
from shared.schemas import (  # type: ignore[import-not-found]
    Message,
    MessageBlock,
    TextBlock,
    TextGenerationPayload,
)
from utils.auth import is_request_valid  # type: ignore
from utils.schemas import (  # type: ignore
    ClientConfig,
    MCPServer,
    ServerSession,
    get_enabled_servers,
)
from utils.rag import query_similar, upsert_summary  # type: ignore
from utils.topology import TopologyManager  # type: ignore

load_dotenv()

PORT = 3001
AGENT_WORKER_URL = os.getenv("AGENT_WORKER_URL", "").rstrip("/")
USE_AGENT_WORKER = os.getenv("USE_AGENT_WORKER", "false").lower() in ("1", "true", "yes")
END_TURN = "end_turn"
LAST_RUNS: dict[str, float] = {}

# Latest run tracking for dashboard auto-subscription
LATEST_RUN: dict[str, str | float | None] = {"run_id": None, "service": None, "timestamp": 0}

# ============================================================================
# Event Streaming Infrastructure for Real-Time Dashboard
#
# WHY THIS MATTERS:
# Instead of polling a database (slow, resource-heavy), we use an
# in-memory event buffer and Server-Sent Events (SSE).
# This allows the Dashboard to show the Agent's "Thought Process" in
# sub-second real-time, creating a "Glass Box" AI experience.
# ============================================================================

@dataclass
class DiagnosisEvent:
    """Represents an event during diagnosis for streaming to the dashboard."""
    event_type: str
    timestamp: float = field(default_factory=time.time)
    data: dict[str, Any] = field(default_factory=dict)


# In-memory store for diagnosis events, keyed by run_id
DIAGNOSIS_EVENTS: dict[str, list[DiagnosisEvent]] = {}
DIAGNOSIS_COMPLETE: dict[str, bool] = {}


def emit_event(run_id: str, event_type: str, data: dict[str, Any] | None = None) -> None:
    """Emit a diagnosis event for streaming to the dashboard."""
    if run_id not in DIAGNOSIS_EVENTS:
        DIAGNOSIS_EVENTS[run_id] = []
    event = DiagnosisEvent(event_type=event_type, data=data or {})
    DIAGNOSIS_EVENTS[run_id].append(event)
    logger.info(f"[Event:{run_id[:8]}] {event_type}: {data}")
    if event_type == "complete":
        DIAGNOSIS_COMPLETE[run_id] = True


@lru_cache
def _get_client_config() -> ClientConfig:
    return ClientConfig()


class MCPClient:
    """An MCP client for connecting to a server using SSE transport.
    
    TECHNICAL NOTE:
    This client demonstrates the "Tool-Use" pattern without LangChain.
    It manually manages the connection to MCP servers (GitHub, Slack, etc.),
    discovers their capabilities (`list_tools`), and binds them to the LLM.
    """

    def __init__(self) -> None:
        """Initialise the MCP client and set up the LLM API client."""
        self.sessions: dict[MCPServer, ServerSession] = {}
        self.messages: list[dict[str, Any]] = []
        self.stop_reason: str | None = None

    async def __aenter__(self) -> "MCPClient":
        """Set up AsyncExitStack when entering the context manager."""
        logger.debug("Entering MCP client context")
        self.exit_stack = AsyncExitStack()
        await self.exit_stack.__aenter__()
        return self

    async def __aexit__(
        self,
        exc_type: type | None,
        exc_val: Exception | None,
        exc_tb: Any | None,
    ) -> None:
        """Clean up resources when exiting the context manager."""
        logger.debug("Exiting MCP client context")
        await self.exit_stack.__aexit__(exc_type, exc_val, exc_tb)

    async def _run_firewall_check(self, text: str, is_tool: bool = False) -> bool:
        """Check text against the Llama Firewall and update messages if blocked.

        Args:
            text: The text to check.
            is_tool: Whether this is a tool-related check.

        Returns:
            True if the input is blocked, False otherwise.
        """
        # Allow disabling the firewall for environments without HF token/models
        if os.getenv("FIREWALL_ENABLED", "true").lower() not in ("1", "true", "yes"):  # nosec B105
            return False

        logger.info("Running text through Llama Firewall")

        try:
            response = requests.post(
                "http://llama-firewall:8000/check",
                json={"content": text, "is_tool": is_tool},
                timeout=60,
            )
            response.raise_for_status()
            response = response.json()
        except Exception as e:  # noqa: BLE001
            logger.warning(f"Llama Firewall unavailable, continuing without it: {e}")
            return False

        result, block = response["result"], cast(bool, response["block"])

        logger.info("Llama Firewall result: %s", "BLOCKED" if block else "ALLOWED")

        if block:
            self.messages.append({"role": "assistant", "content": result["reason"]})
            self.stop_reason = END_TURN
        return block

    async def connect_to_sse_server(self, service: MCPServer) -> None:
        """Connect to an MCP server running with SSE transport."""
        server_url = f"http://{service}:{PORT}/sse"
        logger.info(f"Connecting to SSE server: {server_url}")

        logger.info("Creating SSE client context")
        stream_ctx = sse_client(url=server_url)
        streams = await self.exit_stack.enter_async_context(stream_ctx)

        logger.info("Creating MCP client session")
        session = ClientSession(*streams)
        session = await self.exit_stack.enter_async_context(session)

        logger.info(f"Initialising session for {server_url}")
        await session.initialize()

        logger.info(f"Initialised SSE client for {server_url}")
        logger.debug("Listing available tools")
        response = await session.list_tools()
        tools = response.tools
        logger.info(
            f"Connected to {server_url} with tools: {[tool.name for tool in tools]}"
        )

        self.sessions[service] = ServerSession(tools=tools, session=session)

    async def _get_prompt(self, service: str, slack_channel_id: str) -> MessageBlock:
        """A helper method for retrieving the prompt from the prompt server.
        
        Falls back to inline prompt if prompt-server is not connected.
        """
        # Fallback prompt if prompt-server not available
        if MCPServer.PROMPT not in self.sessions:
            logger.info("Prompt server not available, using fallback prompt")
            fallback_prompt = f"""## 🔍 INCIDENT INVESTIGATION: {service}

You are an expert SRE investigating a production incident for the `{service}` service.

### INVESTIGATION WORKFLOW (Follow these steps IN ORDER):

**STEP 1: GATHER LOGS (Do this ONCE)**
- Call `get_error_logs` with service="{service}" to see recent errors
- Review the log output carefully for error patterns

**STEP 2: ANALYZE & FORM HYPOTHESIS**
Based on the logs, identify:
- Error type (database, network, memory, code bug, etc.)
- Error message details
- Affected components

**STEP 3: GENERATE DIAGNOSIS**
Write your analysis in this exact format:

---
## 🧠 Chain of Thought

1. **Initial Observation**: [What the error logs showed]
2. **Hypothesis**: [Your theory about root cause]
3. **Evidence**: [Log entries that support this]
4. **Conclusion**: [Clear statement of root cause]

## 📊 Evidence Table

| Evidence | Source | Finding |
|----------|--------|---------|
| [Log entry] | Loki | [What it indicates] |

## 🎯 Root Cause

**[Clear, specific statement of the root cause]**

Confidence: [X]%

## 📋 Runbook

### Immediate Mitigation
1. [First action to stop the problem]

### Fix Root Cause
2. [Action to fix underlying issue]

### Verify Fix
3. [How to confirm the fix worked]
---

**STEP 4: POST TO SLACK (MANDATORY)**
Call `slack_post_message` with:
- channel: "{slack_channel_id}"
- text: Your complete diagnosis from Step 3

**STEP 5: CREATE GITHUB ISSUE (MANDATORY)**
Call `create_issue` with:
- title: "[Incident] {service}: [Root cause summary]"
- body: Your complete diagnosis from Step 3

IMPORTANT: You MUST complete steps 4 and 5 after your analysis. Do not stop early."""
            return MessageBlock(
                role="user",
                content=[TextBlock(type="text", text=fallback_prompt)],
            )
        
        # Use prompt server if available
        prompt: GetPromptResult = await self.sessions[
            MCPServer.PROMPT
        ].session.get_prompt(
            "diagnose",
            arguments={"service": service, "slack_channel_id": slack_channel_id},
        )

        if isinstance(prompt.messages[0].content, TextContent):
            return MessageBlock(
                role=prompt.messages[0].role,
                content=[TextBlock(**prompt.messages[0].content.model_dump())],
            )
        else:
            raise TypeError(
                f"{type(prompt.messages[0].content)} is invalid for this agent."
            )

    async def process_query(  # noqa: C901, PLR0912, PLR0915
        self, service: str, slack_channel_id: str, extra_context: str | None = None, run_id: str | None = None
    ) -> dict[str, Any]:
        """Process a query using Claude and available tools.
        
        THE COGNITIVE LOOP (ReAct):
        ---------------------------
        This function implements the core "Reasoning Loop" of the agent:
        1.  **Context Injection**: Combines User Query + Alert Logs + RAG History.
        2.  **LLM Call**: Sends everything to Claude (Anthropic).
        3.  **Tool Decision**: If Claude wants to use a tool (e.g., `get_logs`), we execute it via MCP.
        4.  **Feedback**: The tool result is fed back into the context window.
        5.  **Repeat**: The loop continues until Claude says "I'm done" or solves the problem.
        """
        query = await self._get_prompt(service, slack_channel_id)
        logger.info(f"Processing query: {query}...")
        start_time = time.perf_counter()
        
        if run_id:
            emit_event(run_id, "analyzing", {"message": "Preparing diagnosis prompt", "service": service})

        _ = await self._run_firewall_check(str(query.content[0].model_dump()))

        self.messages = [{"role": query.role, "content": query.content}]

        # Inject RAG context and alert context if available
        # -------------------------------------------------
        # RAG (Retrieval Augmented Generation):
        # We query Qdrant (Vector DB) for "Relevant prior incidents".
        # This gives the agent "Experience" - it knows how similar bugs were fixed in the past.
        if extra_context:
            try:
                rag_snippets = [s for s in query_similar(extra_context) if s]
            except Exception as e:  # noqa: BLE001
                logger.warning(f"RAG query failed: {e}")
                rag_snippets = []

            if rag_snippets:
                rag_text = "\n\n".join([f"- {s}" for s in rag_snippets[:5]])
                self.messages.append(
                    {
                        "role": "user",
                        "content": [
                            {
                                "type": "text",
                                "text": f"Relevant prior incidents (most similar first):\n{rag_text}",
                            }
                        ],
                    }
                )

            self.messages.append(
                {
                    "role": "user",
                    "content": [
                        {
                            "type": "text",
                            "text": f"Alert context (logs/summary):\n{extra_context[:4000]}",
                        }
                    ],
                }
            )

        # Inject service topology context
        # --------------------------------
        # This helps the LLM understand service relationships and guides it
        # to investigate related services when diagnosing issues.
        topology = TopologyManager()
        related_services = topology.get_related_services(service)
        
        if related_services:
            topology_context = topology.get_topology_context(service)
            if run_id:
                emit_event(run_id, "topology_check", {
                    "primary_service": service,
                    "related_services": related_services,
                    "message": f"Related services: {', '.join(related_services)}"
                })
            self.messages.append(
                {
                    "role": "user",
                    "content": [
                        {
                            "type": "text",
                            "text": topology_context,
                        }
                    ],
                }
            )
            logger.info(f"Injected topology context for {service}: {related_services}")
        else:
            logger.info(f"No topology information available for {service}")

        available_tools = []
        configured_tools = _get_client_config().tools

        for service, session in self.sessions.items():
            for tool in session.tools:
                # If TOOLS config is empty, use ALL tools; otherwise filter to configured list
                if not configured_tools or tool.name in configured_tools:
                    available_tools.append(tool.model_dump())

        final_text = []

        # Track token usage
        total_input_tokens = 0
        total_output_tokens = 0
        total_cache_creation_tokens = 0
        total_cache_read_tokens = 0

        tool_retries = 0

        while (
            self.stop_reason != END_TURN
            and tool_retries < _get_client_config().max_tool_retries
        ):
            logger.info("Sending request to the LLM")
            if run_id:
                emit_event(run_id, "llm_request", {"message": "Sending request to LLM for analysis"})
            llm_start_time = time.perf_counter()

            payload = TextGenerationPayload(
                messages=self.messages, tools=available_tools
            ).model_dump(mode="json")

            logger.debug(payload)

            response = requests.post(
                "http://llm-server:8000/generate", json=payload, timeout=60
            )

            response.raise_for_status()

            llm_response = Message(**response.json())

            logger.debug(llm_response)

            llm_duration = time.perf_counter() - llm_start_time
            logger.info(f"LLM request took {llm_duration:.2f} seconds")
            if run_id:
                emit_event(run_id, "llm_response", {"message": f"LLM responded in {llm_duration:.2f}s", "duration": llm_duration})
            self.stop_reason = llm_response.stop_reason
            logger.info(f"LLM stop_reason: {self.stop_reason}, content types: {[c.type for c in llm_response.content]}")

            # Track token usage from this response
            if llm_response.usage:
                total_input_tokens += llm_response.usage.input_tokens
                total_output_tokens += llm_response.usage.output_tokens
                if llm_response.usage.cache_creation_input_tokens:
                    total_cache_creation_tokens += (
                        llm_response.usage.cache_creation_input_tokens
                    )
                if llm_response.usage.cache_read_input_tokens:
                    total_cache_read_tokens += (
                        llm_response.usage.cache_read_input_tokens
                    )

            assistant_message_content = []

            for content in llm_response.content:
                if content.type == "text":
                    final_text.append(content.text)
                    logger.debug(f"LLM response: {content.text}")
                elif content.type == "tool_use":
                    tool_name = content.name
                    tool_args = content.arguments
                    logger.info(f"LLM requested to use tool: {tool_name}")

                    if await self._run_firewall_check(
                        f"Calling tool {tool_name} with args: {tool_args}", is_tool=True
                    ):
                        break

                    for service, session in self.sessions.items():
                        if tool_name in [tool.name for tool in session.tools]:
                            logger.info(
                                f"Calling tool {tool_name} with args: {tool_args}"
                            )
                            if run_id:
                                emit_event(run_id, "tool_call", {
                                    "tool": tool_name,
                                    "args": tool_args,
                                    "message": f"Calling {tool_name}"
                                })
                            try:
                                tool_start_time = time.perf_counter()
                                result = await session.session.call_tool(
                                    tool_name, cast(dict[str, str], tool_args)
                                )
                                tool_duration = time.perf_counter() - tool_start_time
                                logger.info(
                                    f"Tool {tool_name} call took "
                                    f"{tool_duration:.2f} seconds"
                                )
                                result_content = result.content
                                is_error = result.isError
                                
                                # Emit tool result event
                                if run_id:
                                    result_preview = str(result_content)[:500] if result_content else ""
                                    emit_event(run_id, "tool_result", {
                                        "tool": tool_name,
                                        "duration": tool_duration,
                                        "is_error": is_error,
                                        "preview": result_preview,
                                        "message": f"{tool_name} completed in {tool_duration:.2f}s"
                                    })

                                if await self._run_firewall_check(
                                    str(result_content), is_tool=True
                                ):
                                    break

                                tool_retries = 0

                            except McpError as e:
                                error_msg = f"Tool '{tool_name}' failed with error: {str(e)}. Tool args were: {tool_args}. Check the arguments and try again fixing the error."  # noqa: E501
                                logger.info(error_msg)
                                result_content = [
                                    TextBlock(type="text", text=error_msg)
                                ]
                                is_error = True
                                tool_retries += 1
                            break
                    else:
                        logger.error(f"Tool {tool_name} not found in available tools")
                        raise ValueError(
                            f"Tool {tool_name} not found in available tools."
                        )

                    final_text.append(
                        f"[Calling tool {tool_name} with args {tool_args}]"
                    )

                    assistant_message_content.append(content)
                    self.messages.append(
                        {"role": "assistant", "content": assistant_message_content}
                    )

                    self.messages.append(
                        {
                            "role": "user",
                            "content": [
                                {
                                    "type": "tool_result",
                                    "tool_use_id": content.id,
                                    "name": tool_name,
                                    "content": [i.model_dump() for i in result_content],
                                    "is_error": is_error,
                                }
                            ],
                        }
                    )

        total_duration = time.perf_counter() - start_time
        logger.info(f"Total process_query execution took {total_duration:.2f} seconds")

        logger.info("Query processing completed")
        return {
            "response": "\n".join(final_text),
            "token_usage": {
                "input_tokens": total_input_tokens,
                "output_tokens": total_output_tokens,
                "cache_creation_tokens": total_cache_creation_tokens,
                "cache_read_tokens": total_cache_read_tokens,
                "total_tokens": total_input_tokens + total_output_tokens,
            },
            "timing": {
                "total_duration": total_duration,
            },
        }


app: FastAPI = FastAPI(
    description="A REST API for the SRE Agent orchestration service."
)

from fastapi.middleware.cors import CORSMiddleware

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "http://localhost:3001", "http://localhost:3002"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


async def run_diagnosis_and_post(service: str, alert_context: str | None = None, run_id: str | None = None) -> None:
    """Run diagnosis for a service and post results back to Slack.

    Args:
        service: The name of the service to diagnose.
        alert_context: Optional context from the alert.
        run_id: Optional run ID for event streaming.
    """
    timeout = _get_client_config().query_timeout
    
    if USE_AGENT_WORKER and AGENT_WORKER_URL:
        if run_id:
            emit_event(run_id, "agent_worker_start", {
                "message": "Using agent-worker (Claude SDK) for diagnosis",
                "service": service,
            })
        logger.info(f"Running diagnosis via agent-worker for service: {service}")
        try:
            payload = {
                "service": service,
                "alertContext": alert_context,
                "slackChannelId": _get_client_config().slack_channel_id,
            }
            resp = requests.post(
                f"{AGENT_WORKER_URL}/diagnose",
                json=payload,
                timeout=timeout,
            )
            resp.raise_for_status()
            data = resp.json()
            if not data.get("success"):
                raise RuntimeError(data.get("error") or "agent-worker returned failure")

            report = data.get("report", "")
            if run_id:
                emit_event(run_id, "complete", {
                    "status": "success",
                    "message": "Diagnosis completed via agent-worker",
                    "response": report[:2000],
                })

            try:
                upsert_summary(
                    doc_id=f"{service}-{int(time.time())}",
                    text=report[:4000],
                    labels={"service": service},
                )
            except Exception as e:  # noqa: BLE001
                logger.warning(f"Failed to upsert RAG summary: {e}")
            return
        except Exception as e:  # noqa: BLE001
            logger.exception(f"Agent-worker diagnosis failed for {service}: {e}")
            if run_id:
                emit_event(run_id, "error", {
                    "message": f"agent-worker failed: {e}",
                    "service": service,
                })
            # Fall back to legacy loop below

    if run_id:
        emit_event(run_id, "connecting_servers", {"message": "Connecting to MCP servers..."})
    
    try:
        async with MCPClient() as client:
            logger.info(f"Creating MCPClient for service: {service}")
            try:
                servers_list = list(get_enabled_servers())
                for i, server in enumerate(servers_list):
                    if run_id:
                        emit_event(run_id, "server_connecting", {
                            "server": server.name,
                            "message": f"Connecting to {server.name}...",
                            "progress": f"{i+1}/{len(servers_list)}"
                        })
                    await client.connect_to_sse_server(service=server)

                if not all(server in client.sessions for server in get_enabled_servers()):
                    missing = [
                        s.name for s in get_enabled_servers() if s not in client.sessions
                    ]
                    logger.error(
                        "MCP Client failed to establish required server sessions: "
                        f"{', '.join(missing)}"
                    )
                    if run_id:
                        emit_event(run_id, "error", {"message": f"Failed to connect: {', '.join(missing)}"})
                        emit_event(run_id, "complete", {"status": "error", "message": "Connection failed"})
                    return

                logger.info("MCPClient connections established successfully.")
                if run_id:
                    emit_event(run_id, "servers_connected", {
                        "message": "All MCP servers connected",
                        "servers": [s.name for s in servers_list]
                    })

            except Exception as conn_err:
                logger.exception(f"Failed to connect MCPClient sessions: {conn_err}")
                if run_id:
                    emit_event(run_id, "error", {"message": str(conn_err)})
                    emit_event(run_id, "complete", {"status": "error", "message": "Connection failed"})
                return

            async def _run_diagnosis(mcp_client: MCPClient) -> dict[str, Any]:
                """Inner function to run the actual diagnosis query."""
                result = await mcp_client.process_query(
                    service=service,
                    slack_channel_id=_get_client_config().slack_channel_id,
                    extra_context=alert_context,
                    run_id=run_id,
                )

                logger.info(
                    f"Token usage - Input: {result['token_usage']['input_tokens']}, "
                    f"Output: {result['token_usage']['output_tokens']}, "
                    f"Cache Creation:"
                    f" {result['token_usage']['cache_creation_tokens']}, "
                    f"Cache Read: {result['token_usage']['cache_read_tokens']}, "
                    f"Total: {result['token_usage']['total_tokens']}"
                )
                logger.info("Query processed successfully")
                logger.info(f"Diagnosis result for {service}: {result['response']}")
                
                # Emit completion event with the response
                if run_id:
                    emit_event(run_id, "complete", {
                        "status": "success",
                        "message": "Diagnosis completed",
                        "response": result["response"][:2000],
                        "token_usage": result["token_usage"],
                        "duration": result["timing"]["total_duration"]
                    })
                
                try:
                    upsert_summary(
                        doc_id=f"{service}-{int(time.time())}",
                        text=result["response"][:4000],
                        labels={"service": service},
                    )
                except Exception as e:  # noqa: BLE001
                    logger.warning(f"Failed to upsert RAG summary: {e}")
                return result

            await wait_for(_run_diagnosis(client), timeout=timeout)

    except TimeoutError:
        logger.error(
            f"Diagnosis duration exceeded maximum timeout of {timeout} seconds for "
            f"service {service}"
        )
        if run_id:
            emit_event(run_id, "complete", {"status": "timeout", "message": f"Timeout after {timeout}s"})
    except Exception as e:
        logger.exception(f"Error during background diagnosis for {service}: {e}")
        if run_id:
            emit_event(run_id, "complete", {"status": "error", "message": str(e)})


@app.post("/diagnose")
async def diagnose(
    request: Request,
    background_tasks: BackgroundTasks,
) -> JSONResponse:
    """Handle incoming Slack slash command requests for service diagnosis.

    Args:
        request: The FastAPI request object containing form data.
        background_tasks: FastAPI background tasks handler.

    Returns:
        JSONResponse: indicating the diagnosis has started with run_id for event streaming.
    """
    form_data = await request.form()
    text_data = form_data.get("text", "")
    text = text_data.strip() if isinstance(text_data, str) else ""
    service = text or "cartservice"

    if service not in _get_client_config().services:
        return JSONResponse(
            status_code=HTTPStatus.BAD_REQUEST,
            content={
                "text": f"Service `{service}` is not supported. Supported services are"
                f": {', '.join(_get_client_config().services)}.",
            },
        )

    # Generate run_id for event streaming
    run_id = str(uuid.uuid4())
    DIAGNOSIS_EVENTS[run_id] = []
    DIAGNOSIS_COMPLETE[run_id] = False
    
    logger.info(f"Received diagnose request for service: {service}, run_id: {run_id}")
    
    emit_event(run_id, "diagnosis_started", {
        "service": service,
        "message": f"Starting diagnosis for {service}"
    })

    background_tasks.add_task(run_diagnosis_and_post, service, None, run_id)

    return JSONResponse(
        status_code=HTTPStatus.OK,
        content={
            "response_type": "ephemeral",
            "text": f"🔍 Running diagnosis for `{service}`...",
            "run_id": run_id,
        },
    )


@app.post("/alerts")
async def alerts(request: Request, background_tasks: BackgroundTasks) -> JSONResponse:
    """Webhook endpoint for Grafana (or any alert source).

    THE TRIGGER:
    ------------
    1.  Receives a JSON payload from Grafana (via Webhook).
    2.  Extracts the `service` name and `alert_context`.
    3.  Updates `LATEST_RUN` so the Dashboard knows there's a new incident.
    4.  Spins up a `background_task` to run the diagnosis (Async processing).
    """
    secret = os.getenv("ALERT_WEBHOOK_SECRET", "")
    # Check X-Alert-Secret header first
    provided = request.headers.get("X-Alert-Secret", "")
    # Also check Authorization header (Grafana sends: "Authorization: X-Alert-Secret <secret>")
    auth_header = request.headers.get("Authorization", "")
    if auth_header.startswith("X-Alert-Secret "):
        provided = auth_header.split(" ", 1)[1] if " " in auth_header else ""
    if secret and provided != secret:
        logger.warning(f"Alert auth failed. Expected secret, got X-Alert-Secret={request.headers.get('X-Alert-Secret', '')}, Auth={auth_header[:30]}...")
        raise HTTPException(status_code=HTTPStatus.UNAUTHORIZED, detail="Invalid secret")

    payload = await request.json()

    # Best-effort service detection
    service = (
        payload.get("labels", {}).get("service")
        or payload.get("service")
        or (_get_client_config().services[0] if _get_client_config().services else "salesforce")
    )

    # Compact context string
    title = payload.get("title") or payload.get("alertname") or "Alert"
    samples = payload.get("samples") or payload.get("values") or []
    summary = payload.get("annotations", {}).get("summary") or ""
    context_lines = [f"Title: {title}", f"Summary: {summary}"]
    if isinstance(samples, list) and samples:
        context_lines.append("Samples:")
        for s in samples[:5]:
            context_lines.append(str(s))
    alert_context = "\n".join(context_lines)

    logger.info(f"Received alert for service={service}. Triggering diagnosis.")
    # Simple cooldown to avoid incident storms
    cooldown = int(os.getenv("ALERT_COOLDOWN_SECONDS", "120") or "120")
    now = time.time()
    last = LAST_RUNS.get(service, 0)
    if now - last < cooldown:
        logger.info(
            f"Cooldown active for service={service}. Skipping (last={last:.0f}, now={now:.0f})."
        )
        return JSONResponse(
            status_code=HTTPStatus.ACCEPTED,
            content={"status": "cooldown", "service": service},
        )

    # Generate run_id for event streaming
    run_id = str(uuid.uuid4())
    DIAGNOSIS_EVENTS[run_id] = []
    DIAGNOSIS_COMPLETE[run_id] = False
    
    # Emit initial alert event with all context
    emit_event(run_id, "alert_received", {
        "service": service,
        "title": title,
        "summary": summary,
        "alert_context": alert_context,
        "message": f"Alert received: {title}"
    })

    LAST_RUNS[service] = now
    
    # Update latest run for dashboard auto-subscription
    LATEST_RUN.update({"run_id": run_id, "service": service, "timestamp": now})
    
    background_tasks.add_task(run_diagnosis_and_post, service, alert_context, run_id)

    return JSONResponse(
        status_code=HTTPStatus.OK,
        content={"status": "accepted", "service": service, "run_id": run_id},
    )


@app.get("/latest-run")
async def get_latest_run() -> JSONResponse:
    """Get the latest alert-triggered run for dashboard auto-subscription.
    
    Returns the most recent run_id, service, and timestamp from Grafana alerts.
    The dashboard can poll this endpoint to detect new alerts and auto-subscribe.
    """
    return JSONResponse(
        status_code=HTTPStatus.OK,
        content=LATEST_RUN,
    )


@app.get("/events/{run_id}")
async def stream_events(run_id: str) -> StreamingResponse:
    """Stream diagnosis events for a given run_id using Server-Sent Events.
    
    The frontend can subscribe to this endpoint to receive real-time updates
    about the diagnosis progress.
    """
    if run_id not in DIAGNOSIS_EVENTS:
        raise HTTPException(
            status_code=HTTPStatus.NOT_FOUND,
            detail=f"Run ID {run_id} not found"
        )
    
    async def event_generator():
        """Generate SSE events for the diagnosis run."""
        last_index = 0
        
        while True:
            # Get new events since last check
            events = DIAGNOSIS_EVENTS.get(run_id, [])
            
            while last_index < len(events):
                event = events[last_index]
                event_data = {
                    "event_type": event.event_type,
                    "timestamp": event.timestamp,
                    "data": event.data
                }
                yield f"data: {json.dumps(event_data)}\n\n"
                last_index += 1
            
            # Check if diagnosis is complete
            if DIAGNOSIS_COMPLETE.get(run_id, False):
                break
            
            # Wait a bit before checking for new events
            await asyncio.sleep(0.1)
        
        # Clean up old events after a delay (keep for 5 minutes for late subscribers)
        # This is done in a non-blocking way
        await asyncio.sleep(300)
        DIAGNOSIS_EVENTS.pop(run_id, None)
        DIAGNOSIS_COMPLETE.pop(run_id, None)
    
    return StreamingResponse(
        event_generator(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no",
        }
    )


@app.get("/runs/{run_id}")
async def get_run_events(run_id: str) -> JSONResponse:
    """Get all events for a run (non-streaming, for debugging or late joins)."""
    if run_id not in DIAGNOSIS_EVENTS:
        raise HTTPException(
            status_code=HTTPStatus.NOT_FOUND,
            detail=f"Run ID {run_id} not found"
        )
    
    events = [
        {
            "event_type": e.event_type,
            "timestamp": e.timestamp,
            "data": e.data
        }
        for e in DIAGNOSIS_EVENTS[run_id]
    ]
    
    return JSONResponse(
        status_code=HTTPStatus.OK,
        content={
            "run_id": run_id,
            "complete": DIAGNOSIS_COMPLETE.get(run_id, False),
            "events": events
        }
    )


@app.get("/health")
async def health() -> JSONResponse:
    """Check if connections to all required MCP servers can be established."""
    failed_checks: list[str] = []
    healthy_connections: list[str] = []
    all_servers = list(get_enabled_servers())

    logger.info("Performing health check by attempting temporary connections...")

    try:
        async with MCPClient() as client:
            for server in all_servers:
                server_name = server.name
                try:
                    logger.debug(
                        f"Health check: Attempting connection to {server_name}"
                    )
                    await client.connect_to_sse_server(service=server)
                    await client.sessions[server].session.list_tools()
                    logger.debug(
                        f"Health check connection successful for {server_name}"
                    )
                    healthy_connections.append(server_name)
                except Exception as e:
                    msg = (
                        f"Health check connection failed for {server_name}: "
                        f"{type(e).__name__} - {e}"
                    )
                    logger.error(msg)
                    failed_checks.append(msg)

    except Exception as client_err:
        msg = (
            "Health check failed: Could not initialise or manage MCPClient context: "
            f"{type(client_err).__name__} - {client_err}"
        )
        logger.error(msg)

        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail={
                "status": "Unavailable",
                "detail": msg,
                "errors": [msg],
            },
        )

    if failed_checks:
        status_code = status.HTTP_503_SERVICE_UNAVAILABLE
        response_detail = {
            "status": "Partially Available" if healthy_connections else "Unavailable",
            "detail": "One or more MCP server connections failed health checks.",
            "healthy_connections": sorted(healthy_connections),
            "errors": failed_checks,
        }
        logger.warning(
            f"Health check completed with failures. Healthy: "
            f"{len(healthy_connections)}, "
            f"Failed: {len(failed_checks)}. Errors: {failed_checks}"
        )
    else:
        status_code = status.HTTP_200_OK
        response_detail = {
            "status": "OK",
            "detail": "All required MCP server connections are healthy.",
            "checked_servers": sorted([s.name for s in all_servers]),
        }
        logger.info(
            "Health check completed successfully. All connections healthy: "
            f"{sorted([s.name for s in all_servers])}"
        )

    return JSONResponse(content=response_detail, status_code=status_code)
