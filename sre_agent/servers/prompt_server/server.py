"""A server containing a prompt to trigger the agent."""

from functools import lru_cache

from fastapi import FastAPI
from mcp.server.fastmcp import FastMCP
from utils.schemas import PromptServerConfig  # type: ignore

mcp = FastMCP("sre-agent-prompt")

mcp.settings.host = "127.0.0.1"  # nosec B104
mcp.settings.port = 3001


@lru_cache
def _get_prompt_server_config() -> PromptServerConfig:
    return PromptServerConfig()


@mcp.prompt()
def diagnose(service: str, slack_channel_id: str) -> str:
    """Prompt the agent to perform a task."""
    return f"""There is a suspected issue with the `{service}` service. Using the
available tools, do the following once:

1) Retrieve the most recent 1000 operational signals (e.g., logs, error events,
   incidents, or relevant records) you can access for `{service}`. Identify any
   concrete error messages that reference source files or components.

2) Using GitHub access, navigate within
   `{_get_prompt_server_config().organisation}/{_get_prompt_server_config().repo_name}`
   under `{_get_prompt_server_config().project_root}` to find the referenced file(s)
   and fetch their contents. If exact files aren’t referenced, inspect likely modules
   based on the error context.

3) Diagnose the root cause. Propose a specific fix. Then create a GitHub issue with:
   - Title: concise summary of the root cause
   - Body: steps to reproduce (if applicable), impacted area, and proposed fix

4) Post a single summary message to Slack channel `{slack_channel_id}` with the
   diagnosis, the created issue URL, and any immediate mitigations.

Important constraints:
- Use only the tools available.
- Do not create multiple issues or multiple Slack messages; do it once when ready.
- If signals aren’t available, focus on code inspection aligned to the error context."""


app = FastAPI()


@app.get("/health")
def healthcheck() -> dict[str, str]:
    """Health check endpoint for the firewall."""
    return {"status": "healthy"}


app.mount("/", mcp.sse_app())
