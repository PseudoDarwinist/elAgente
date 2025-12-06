# SRE Agent - Production Grade Upgrade Progress

> **Purpose**: Complete context for continuing development of the production-grade SRE Agent
> **Last Updated**: 2025-12-06T09:20:50+05:30
> **Branch**: `feature/production-grade-agent`

---

## 🎯 High-Level Goal

Transform the SRE Agent from a basic log-fetching tool into a **production-grade incident response system** based on ideal system design principles from industry best practices.

### The Vision (From Transcript Analysis)
An ideal SRE AI agent should have:
1. **Context Curation** - Topology-aware correlation, not brute-force data dumping
2. **MELT Integration** - Metrics + Events + Logs + Traces (we're focusing on Logs first)
3. **Causal AI / Hypothesis Refinement** - Iterative investigation, not one-shot
4. **Explainability** - Chain of thought + evidence + confidence scores
5. **Resolution Assistance** - Validation steps, runbooks, automation scripts

---

## 📊 Current Architecture Overview

```
┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐
│   Demo App      │     │   Promtail      │     │     Loki        │
│ (writes logs)   │────▶│ (ships logs)    │────▶│ (stores logs)   │
└─────────────────┘     └─────────────────┘     └────────┬────────┘
                                                         │
┌─────────────────┐     ┌─────────────────┐              │
│    Grafana      │────▶│   SRE Agent     │◀─────────────┘
│ (alerts)        │     │  (orchestrator) │       (via Loki MCP)
└─────────────────┘     └────────┬────────┘
                                 │
         ┌───────────────────────┼───────────────────────┐
         ▼                       ▼                       ▼
┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐
│   Loki MCP      │     │   GitHub MCP    │     │   Slack MCP     │
│ (query logs)    │     │ (search code)   │     │ (post message)  │
└─────────────────┘     └─────────────────┘     └─────────────────┘
```

---

## 🔑 Key Decisions Made

### Decision 1: Use Loki MCP Instead of Kubernetes MCP
**Why**: User doesn't use/understand Kubernetes. Already has Loki + Promtail for file-based logging.
**How**: Created new TypeScript MCP server that queries Loki HTTP API directly.
**Files**: `sre_agent/servers/loki/`

### Decision 2: Smart Structured Logs Instead of Full MELT
**Why**: Adding Prometheus/Tempo would take too long for hackathon.
**How**: Demo app writes JSON logs with embedded "metrics" like `db_pool_used`, `latency_ms`, `cache_hit_rate`.
**Result**: LLM can reason about performance issues from log data alone.

### Decision 3: Hypothesis-Driven Prompt
**Why**: Original prompt was too simple - just "diagnose and post to Slack".
**How**: Rewrote prompt with structured investigation workflow, evidence tables, runbooks.
**Files**: `sre_agent/servers/prompt_server/server.py`

### Decision 4: Demo App with Fault Injection
**Why**: Need a controlled way to test the agent's diagnostic capabilities.
**How**: Python script that simulates DB, cache, memory, and code issues with realistic logs.
**Files**: `demo-app/demo_app.py`

---

## ✅ Completed Work

### Phase 1: Loki MCP Server ✅

| File | Description |
|------|-------------|
| `sre_agent/servers/loki/index.ts` | Main MCP server with SSE transport |
| `sre_agent/servers/loki/operations/logs.ts` | Loki API client functions |
| `sre_agent/servers/loki/package.json` | Dependencies |
| `sre_agent/servers/loki/tsconfig.json` | TypeScript config |
| `sre_agent/servers/loki/Dockerfile` | Container build |

**Tools implemented:**
- `query_logs` - Raw LogQL query
- `query_logs_by_service` - Service + level filter
- `get_error_logs` - Error-level shortcut
- `get_available_services` - List services in Loki
- `get_log_labels` - List available labels

### Phase 2: Enhanced Prompt ✅

Rewrote `sre_agent/servers/prompt_server/server.py` with:
- Step-by-step investigation workflow
- Hypothesis formation with confidence scoring
- Evidence table format
- Runbook generation (Immediate → Fix → Verify → Prevent)
- Validation commands

### Phase 3: Demo App ✅

Created `demo-app/demo_app.py`:
```bash
python demo_app.py --fault db      # DB pool exhaustion
python demo_app.py --fault cache   # Cache miss issues
python demo_app.py --fault memory  # OOM simulation
python demo_app.py --fault code    # NullPointer bug
```

### Configuration Updates ✅

| File | Change |
|------|--------|
| `sre_agent/client/utils/schemas.py` | Changed `MCPServer.KUBERNETES` → `MCPServer.LOKI = "loki-mcp"` |
| `compose.local.yaml` | Added `loki-mcp` service with depends_on loki |
| `observability/promtail/config.yaml` | Added demo-app log scraping |
| `docs/env.demo.template` | New .env template with LOKI config |

---

## ⏳ Not Yet Started

### Phase 4: Service Topology (Optional)
- Create `topology.py` with hardcoded service dependencies
- Allow agent to check related services when investigating

### Phase 5: Dashboard Enhancements
- Display chain of thought reasoning
- Show runbook steps
- Show validation commands
- Show confidence scores

### Phase 6: Prometheus Integration (Future)
- Add Prometheus for real metrics
- Create Prometheus MCP server
- Query CPU, memory, latency metrics

---

## 🔧 Current Status: Ready to Test

The code is committed and ready, but **not yet tested**. Next steps:

### Step 1: Build Loki MCP
```bash
cd sre_agent/servers/loki
npm run build
```

### Step 2: Start All Services
```bash
docker compose -f compose.local.yaml up --build
```

### Step 3: Test Demo App
```bash
python demo-app/demo_app.py --fault db
```

### Step 4: Trigger Diagnosis
```bash
curl -X POST http://localhost:8003/diagnose -d "text=payment-service"
```

---

## 📁 Project Structure (Key Files)

```
sre-agent/
├── compose.local.yaml           # Docker compose (updated with loki-mcp)
├── demo-app/
│   └── demo_app.py              # NEW: Fault injection demo
├── docs/
│   ├── ARCHITECTURE_DIAGRAMS.md # NEW: 8 architecture diagrams
│   ├── GAP_ANALYSIS.md          # NEW: Current vs Ideal comparison
│   └── env.demo.template        # NEW: Example .env
├── observability/
│   └── promtail/
│       └── config.yaml          # MODIFIED: Added demo-app logs
├── sre_agent/
│   ├── client/
│   │   ├── client.py            # Orchestrator (unchanged)
│   │   └── utils/
│   │       └── schemas.py       # MODIFIED: MCPServer.LOKI
│   └── servers/
│       ├── loki/                # NEW: Entire directory
│       │   ├── index.ts
│       │   ├── operations/logs.ts
│       │   ├── package.json
│       │   └── Dockerfile
│       └── prompt_server/
│           └── server.py        # MODIFIED: Enhanced prompt
└── sre-dashboard/               # Next.js dashboard (unchanged)
```

---

## 🐛 Known Issues / Potential Problems

1. **Loki MCP not tested yet** - Need to build TypeScript and verify connectivity
2. **Docker networking** - Service name is `loki-mcp` to match MCPServer enum
3. **Promtail paths** - Demo app logs go to `./demo-app/logs/app.log`
4. **ENABLED_SERVERS env var** - Must include `loki-mcp` in the JSON array

---

## 📝 Environment Variables Needed

```bash
# Required
GEMINI_API_KEY=your-key
DEV_BEARER_TOKEN=your-token
GITHUB_PERSONAL_ACCESS_TOKEN=your-pat
SLACK_BOT_TOKEN=xoxb-your-token
SLACK_CHANNEL_ID=C00000000

# For Loki MCP (set automatically in compose)
LOKI_URL=http://loki:3100

# Enable Loki MCP
ENABLED_SERVERS=["slack", "github", "loki-mcp", "prompt-server"]
```

---

## 🔗 Related Documentation

- `/docs/ARCHITECTURE_DIAGRAMS.md` - Visual diagrams of the system
- `/docs/GAP_ANALYSIS.md` - Current vs Ideal comparison
- `/docs/EXECUTIVE_OVERVIEW.md` - Original project overview
- `/README.md` - Main project README

---

## 💡 Context for Next Chat

When continuing this work:

1. **Branch**: You're on `feature/production-grade-agent`
2. **Last commit**: "feat: Add Loki MCP server and production-grade prompt"
3. **Next task**: Build and test the Loki MCP, then run end-to-end test
4. **Optional**: Add service topology, enhance dashboard, add Prometheus

The core architecture is complete - we replaced Kubernetes with Loki, enhanced the prompt for chain-of-thought reasoning, and created a demo app for testing. Just needs verification.
