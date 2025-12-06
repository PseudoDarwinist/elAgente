"""A server containing a prompt to trigger the agent.

PRODUCTION-GRADE PROMPT:
This enhanced prompt implements the ideal SRE agent design patterns:
1. Chain of Thought reasoning
2. Hypothesis-driven investigation
3. Runbook generation
4. Validation steps
5. Confidence scoring
"""

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
    """Prompt the agent to perform a production-grade SRE investigation."""
    config = _get_prompt_server_config()
    
    return f"""## 🔍 INCIDENT INVESTIGATION: {service}

You are an expert Site Reliability Engineer investigating a production incident.
Follow this structured, hypothesis-driven approach:

---

### STEP 1: GATHER INITIAL DATA

1. Query error logs for `{service}` from the last 30 minutes using the Loki MCP tools
2. Look specifically for:
   - ERROR and WARN level logs
   - Stack traces or exception messages
   - Timing/latency information in logs
   - Any metrics embedded in structured logs (e.g., db_pool_used, latency_ms)

---

### STEP 2: FORM HYPOTHESES

Based on the logs, form 2-3 hypotheses about the root cause.
Consider these common patterns:

| Pattern | Log Indicators |
|---------|----------------|
| Database issue | "connection pool", "timeout", "query slow", db_pool metrics |
| Memory issue | "OOM", "heap", "memory", gc_pause metrics |
| External dependency | "connection refused", "timeout", service names |
| Code bug | Stack traces, specific file:line references |
| Configuration | "config", "env", recent timestamps near deploy |

For each hypothesis:
- State it clearly
- Identify what evidence would confirm or refute it
- Rate initial confidence (0-100%)

---

### STEP 3: INVESTIGATE HYPOTHESES

For your top hypothesis:
1. If logs reference specific files → Use GitHub MCP to fetch those files
2. If logs show dependency issues → Query logs for related services
3. If timing correlates with changes → Use GitHub to check recent commits

Search the codebase at `{config.organisation}/{config.repo_name}` under `{config.project_root}`.

---

### STEP 4: SYNTHESIZE FINDINGS

Update your hypothesis confidence based on evidence gathered.
Identify the most likely root cause.

---

### STEP 5: GENERATE OUTPUT

Structure your final response in this EXACT format:

---

## 🧠 Chain of Thought

1. **Initial Observation**: [What the logs showed]
2. **Hypothesis 1**: [Your first guess]
   - Evidence: [What you found]
   - Verdict: ✅ Confirmed / ❌ Refuted
3. **Hypothesis 2**: [Alternative explanation]
   - Evidence: [What you found]
   - Verdict: ✅ Confirmed / ❌ Refuted
4. **Conclusion**: [How you arrived at root cause]

## 📊 Evidence Table

| Evidence | Source | Finding |
|----------|--------|---------|
| [Log entry or metric] | [Loki/GitHub] | [What it shows] |
| [Code snippet] | [File path] | [Why it's relevant] |

## 🎯 Root Cause

**[Clear, specific statement of the root cause]**

**Confidence: [X]%**

## ✅ Validation Steps

```bash
# Commands to verify this diagnosis
[kubectl/curl/query command 1]
[kubectl/curl/query command 2]
```

## 📋 Runbook

### Immediate Mitigation
1. [First action to stop the bleeding]

### Fix Root Cause  
2. [Action to fix the underlying issue]
3. [Any code/config changes needed]

### Verify Fix
4. [How to confirm the fix worked]

### Prevent Recurrence
5. [What to add/change to prevent this in future]

---

## 📝 FINAL ACTIONS

1. **Post to Slack**: Send the complete diagnosis above to channel `{slack_channel_id}`
2. **Create GitHub Issue**: Create an issue in `{config.organisation}/{config.repo_name}` with:
   - Title: `[Incident] {service}: [Root cause summary]`
   - Body: The full diagnosis including runbook

**IMPORTANT CONSTRAINTS:**
- Use ONLY the tools available to you
- Query Loki for logs (not Kubernetes)
- Be specific in your diagnosis - avoid vague statements
- Include actual log snippets and code references as evidence
- Create only ONE Slack message and ONE GitHub issue when ready
"""


app = FastAPI()


@app.get("/health")
def healthcheck() -> dict[str, str]:
    """Health check endpoint for the firewall."""
    return {"status": "healthy"}


app.mount("/", mcp.sse_app())
