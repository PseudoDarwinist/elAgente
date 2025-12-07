"""A server for making requests to an LLM."""

from collections.abc import AsyncGenerator
from contextlib import asynccontextmanager
from typing import Any, cast

from dotenv import load_dotenv
from fastapi import FastAPI
from shared.logger import logger  # type: ignore
from shared.schemas import Message, TextGenerationPayload  # type: ignore
from utils.clients import (  # type: ignore
    AnthropicClient,
    BaseClient,
    DummyClient,
    GeminiClient,
    OpenAIClient,
    SelfHostedClient,
)
from utils.schemas import (  # type: ignore
    LLMSettings,
    Provider,
)

load_dotenv()


STATE: dict[str, BaseClient] = {}


# Use class types for lazy initialization - only instantiate when needed
LLM_CLIENT_CLASS_MAP: dict[Provider, type[BaseClient]] = {
    Provider.ANTHROPIC: AnthropicClient,
    Provider.MOCK: DummyClient,
    Provider.OPENAI: OpenAIClient,
    Provider.GEMINI: GeminiClient,
    Provider.SELF_HOSTED: SelfHostedClient,
}


@asynccontextmanager
async def lifespan(app: FastAPI) -> AsyncGenerator[Any, Any]:
    """A context manager for the REST application.

    On start-up the application will establish an LLM function and settings.
    """
    settings = LLMSettings()
    client_class = LLM_CLIENT_CLASS_MAP.get(settings.provider, DummyClient)
    
    # Instantiate the client class
    STATE["client"] = client_class(settings)

    if STATE["client"] is None:
        raise ValueError(
            f"Unknown LLM provider. Supported providers are: {", ".join(Provider)}"
        )

    yield
    STATE.clear()


app = FastAPI(lifespan=lifespan)


@app.post("/generate")
def generate(payload: TextGenerationPayload) -> Message:
    """An endpoint for generating text from messages and tools."""
    logger.debug(f"Payload: {payload}")

    return cast(Message, STATE["client"].generate(payload))


@app.get("/health")
def healthcheck() -> dict[str, str]:
    """Health check endpoint for the firewall."""
    return {"status": "healthy"}
