"""Schemas for the client."""
from __future__ import annotations

import json
import os
from dataclasses import dataclass, field, fields
from enum import StrEnum
from typing import TYPE_CHECKING

from dotenv import load_dotenv

if TYPE_CHECKING:
    from _typeshed import DataclassInstance
from mcp import ClientSession
from mcp.types import Tool
from shared.logger import logger  # type: ignore[import-not-found]

DEFAULT_QUERY_TIMEOUT = 300

load_dotenv()


def _validate_fields(self: DataclassInstance) -> None:
    for config in fields(self):
        attr = getattr(self, config.name)

        if not attr:
            msg = f"Environment variable {config.name.upper()} is not set."
            logger.error(msg)
            raise ValueError(msg)


@dataclass
class ServerSession:
    """A dataclass to hold the session and tools for a server."""

    tools: list[Tool]
    session: ClientSession


class MCPServer(StrEnum):
    """The service names for the MCP servers."""

    SLACK = "slack"
    GITHUB = "github"
    KUBERNETES = "kubernetes"
    PROMPT = "prompt-server"
    SALESFORCE = "salesforce"


def get_enabled_servers() -> list["MCPServer"]:
    """Return the list of enabled MCP servers based on env var ENABLED_SERVERS.

    If ENABLED_SERVERS is not set or empty/invalid, default to all servers
    defined in MCPServer.
    """
    raw = os.getenv("ENABLED_SERVERS", "")
    if not raw:
        return list(MCPServer)

    try:
        names: list[str] = json.loads(raw)
        enabled: list[MCPServer] = []
        for name in names:
            try:
                enabled.append(MCPServer(name))
            except ValueError:
                logger.warning("Ignoring unknown MCP server '%s' in ENABLED_SERVERS", name)
        return enabled or list(MCPServer)
    except Exception as exc:  # noqa: BLE001
        logger.error("Failed to parse ENABLED_SERVERS: %s", exc)
        return list(MCPServer)


@dataclass(frozen=True)
class AuthConfig:
    """A config class containing authorisation environment variables."""

    slack_signing_secret: str = os.getenv("SLACK_SIGNING_SECRET", "")
    dev_bearer_token: str = os.getenv("DEV_BEARER_TOKEN", "")
    alert_webhook_secret: str = os.getenv("ALERT_WEBHOOK_SECRET", "")

    def __post_init__(self) -> None:
        """A post-constructor method for the dataclass."""
        _validate_fields(self)


@dataclass(frozen=True)
class ClientConfig:
    """A client config storing parsed env variables."""

    slack_channel_id: str = os.getenv("SLACK_CHANNEL_ID", "")
    tools: list[str] = field(
        default_factory=lambda: json.loads(os.getenv("TOOLS", "[]"))
    )
    model: str = os.getenv("LLM_MODEL", "claude-3-7-sonnet-latest")
    max_tokens: int = 1000
    max_tool_retries: int = 3
    query_timeout: int = int(
        os.getenv("QUERY_TIMEOUT", DEFAULT_QUERY_TIMEOUT) or DEFAULT_QUERY_TIMEOUT
    )
    services: list[str] = field(
        default_factory=lambda: json.loads(os.getenv("SERVICES", "[]"))
    )

    def __post_init__(self) -> None:
        """A post-constructor method for the dataclass."""
        _validate_fields(self)
