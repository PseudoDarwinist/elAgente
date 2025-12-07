# SRE Agent - Production Grade Upgrade Progress

> **Purpose**: Complete context for continuing development of the production-grade SRE Agent
> **Last Updated**: 2025-12-07T12:55:00+05:30
> **Session**: Claude Agent SDK Integration

---

## 🎯 High-Level Goal

Transform the SRE Agent from a basic log-fetching tool into a **production-grade incident response system** that:
1. Automatically detects errors via Grafana alerts
2. Investigates using an AI agent with multi-step reasoning
3. Posts RCA documents to Slack
4. Creates GitHub issues for tracking
5. Provides real-time visibility via SSE dashboard

---

## 📊 Current Architecture (Updated Dec 7, 2025)

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                         UPDATED ARCHITECTURE                                 │
└─────────────────────────────────────────────────────────────────────────────┘

ERROR SOURCE                    LOG PIPELINE                    ALERTING
┌─────────────┐                ┌───────────┐                   ┌──────────┐
│ Aura Shop   │───────────────▶│ Promtail  │──────────────────▶│ Grafana  │
│ (React +    │  HTTP 500      │           │   Push to Loki    │ Loki     │
│ Node.js)    │  Error         └───────────┘                   │ Alerts   │
└─────────────┘                       │                        └────┬─────┘
                                      ▼                             │
                               ┌───────────┐                        │
                               │   Loki    │                        │
                               │ (Logs DB) │                        │
                               └───────────┘                        │
                                                          Webhook   │
                                                          POST      ▼
                               ┌────────────────────────────────────────────┐
                               │     Python Orchestrator (client.py)        │
                               │     - FastAPI /alerts endpoint             │
                               │     - SSE event streaming                  │
                               │     - ReAct loop coordination              │
                               └────────────────────┬───────────────────────┘
                                                    │
                    ┌───────────────────────────────┼───────────────────────────┐
                    │                               │                           │
                    ▼                               ▼                           ▼
          ┌─────────────────┐            ┌─────────────────┐          ┌─────────────────┐
          │  Loki MCP       │            │  Slack MCP      │          │  GitHub MCP     │
          │  (TypeScript)   │            │  (TypeScript)   │          │  (TypeScript)   │
          │  get_error_logs │            │  slack_post_msg │          │  create_issue   │
          └─────────────────┘            └─────────────────┘          └─────────────────┘
                    │                               │                           │
                    └───────────────────────────────┼───────────────────────────┘
                                                    │
                                                    ▼
                    ┌────────────────────────────────────────────────────────────┐
                    │                  🆕 Claude Agent SDK Worker                │
                    │                    (TypeScript - NEW!)                     │
                    │  - Uses Pro subscription via ~/.claude/ OAuth              │
                    │  - Native MCP support                                      │
                    │  - Built-in agent loop (gather → act → verify)             │
                    │  - Replaces self-hosted LLM that was stuck in loops        │
                    └────────────────────────────────────────────────────────────┘
                                                    │
                         ┌──────────────────────────┼──────────────────────────┐
                         ▼                          ▼                          ▼
                   ┌───────────┐            ┌─────────────┐            ┌─────────────┐
                   │   Slack   │            │   GitHub    │            │ Dashboard   │
                   │  Channel  │            │   Issues    │            │   (SSE)     │
                   └───────────┘            └─────────────┘            └─────────────┘
```

---

## 🔑 Key Decisions Made (Complete History)

### Decision 1: Use Loki MCP Instead of Kubernetes MCP
**Date**: November 2024
**Why**: User doesn't use Kubernetes. Already has Loki + Promtail.
**Files**: `sre_agent/servers/loki/`

### Decision 2: Demo App with Fault Injection
**Date**: November 2024
**Why**: Need controlled testing of agent diagnostics.
**Files**: `aura-quiet-living/backend/` (Node.js with fault injection endpoints)

### Decision 3: Self-Hosted LLM Integration
**Date**: December 5, 2025
**Why**: User has company LLM endpoint at `quasarmarket.coforge.com`
**Files**: `sre_agent/llm/utils/clients.py` - Added `SelfHostedClient`
**Result**: LLM responded but got stuck in tool loops (see Issue #1 below)

### Decision 4: 🆕 Claude Agent SDK Integration
**Date**: December 7, 2025
**Why**: Self-hosted LLM was stuck calling `get_error_logs` 20+ times without progressing
**Approach**: Use Claude Agent SDK with Pro subscription via OAuth token
**Files Created**:
- `sre_agent/agent-worker/package.json`
- `sre_agent/agent-worker/tsconfig.json`
- `sre_agent/agent-worker/src/index.ts`
- `sre_agent/agent-worker/Dockerfile`
- Updated `compose.local.yaml`

**Result**: ✅ SDK works! Successfully completed with `subtype: success`

---

## ✅ Completed Work (December 7, 2025 Session)

### Fix 1: SelfHostedClient Tool Detection
**Problem**: Agent stopped after 1 tool call because `stop_reason` wasn't set correctly
**Solution**: Fixed `clients.py` to check for actual `tool_calls` in response
```python
# Before: Only checked finish_reason
# After: Explicit check for tool_calls presence
if response_json.get("choices", [{}])[0].get("message", {}).get("tool_calls"):
    stop_reason = "tool_use"
```
**File**: `sre_agent/llm/utils/clients.py` lines 382-389

### Fix 2: Enhanced Fallback Prompt
**Problem**: LLM not following multi-step investigation workflow
**Solution**: Rewrote prompt with explicit numbered STEPS and MANDATORY actions
**Key additions**:
- `**STEP 1: GATHER LOGS (Do this ONCE)**`
- `**STEP 4: POST TO SLACK (MANDATORY)**`
- `**STEP 5: CREATE GITHUB ISSUE (MANDATORY)**`
**File**: `sre_agent/client/client.py` lines 207-269

### Fix 3: Debug Logging
**Added**: `logger.info(f"LLM stop_reason: {self.stop_reason}, content types: ...")`
**File**: `sre_agent/client/client.py` lines 392-393

### Created: Claude Agent SDK Worker
**Purpose**: Replace self-hosted LLM with Claude using Pro subscription
**Endpoints**:
- `POST /diagnose` - Full investigation with MCP tools
- `POST /generate` - Drop-in LLM replacement
- `GET /health` - Health check

**Key Features**:
- Uses `~/.claude/` credentials (Pro subscription, no API costs)
- Native MCP server support via SSE
- `permissionMode: 'bypassPermissions'` for automation
- AsyncGenerator handling for streaming responses

### Created: Architecture Documentation
**Files**:
- `docs/ARCHITECTURE.md` - Comprehensive walkthrough with diagrams
- `docs/sre_agent_architecture_*.png` - High-level architecture diagram
- `docs/sre_agent_code_flow_*.png` - Technical code flow diagram

---

## 🔴 Current Blocker: MCP Server Connectivity

### Issue Description
The Claude Agent SDK running **locally** works perfectly:
```
[Agent Worker] Query completed with subtype: success
```

However, when running in **Docker**, the SDK can't access Claude credentials properly (the container crashes when calling the SDK).

### Root Cause Analysis
1. Claude Agent SDK needs access to `~/.claude/` for Pro subscription authentication
2. Docker volume mount `~/.claude:/root/.claude:ro` may not work correctly
3. SDK spawns internal Claude Code process that needs proper environment

### Attempted Solutions
1. ✅ Built Docker container successfully
2. ✅ Container starts and responds to `/health`
3. ❌ Container crashes when calling Claude SDK

### Workaround (Currently Working)
Run agent-worker **locally** (not in Docker):
```bash
cd sre_agent/agent-worker
LOKI_MCP_URL=http://localhost:3101/sse \
SLACK_MCP_URL=http://localhost:3102/sse \
GITHUB_MCP_URL=http://localhost:3103/sse \
npx tsx src/index.ts
```

---

## 🛤️ Next Steps (For New Chat Session)

### Immediate Priority
1. ✅ **Add port mappings for MCP servers** - So local agent-worker can connect (done in `compose.local.yaml`)
2. **Test full diagnosis flow** with local agent-worker + Docker MCP servers
3. ✅ **Integrate agent-worker with orchestrator** - `USE_AGENT_WORKER=true` makes `client.py` call agent-worker `/diagnose` (falls back to legacy loop if disabled)

### Local agent-worker runbook (with mapped ports)
```bash
# 1) Bring up core services (Grafana/Loki/Promtail + MCP servers)
docker compose -f compose.local.yaml up -d loki promtail grafana slack github loki-mcp

# 2) Run agent-worker locally using the mapped MCP ports
cd sre_agent/agent-worker
LOKI_MCP_URL=http://localhost:3103/sse \
SLACK_MCP_URL=http://localhost:3101/sse \
GITHUB_MCP_URL=http://localhost:3102/sse \
PORT=3005 \
npx tsx src/index.ts

# 3) Trigger a fault and verify outputs (Slack, GitHub, SSE)
```

### Future Enhancements
- [ ] Service topology awareness (fetch related service logs)
- [ ] Prometheus metrics integration
- [ ] Enhanced dashboard with chain-of-thought display
- [ ] Automated remediation scripts

---

## 📁 Project Structure (Updated)

```
sre-agent/
├── .env                          # Environment config
├── compose.local.yaml            # Docker services (updated with agent-worker)
├── aura-quiet-living/            # Demo e-commerce app
│   ├── backend/                  # Node.js with fault injection
│   └── frontend/                 # React storefront
├── sre_agent/
│   ├── client/
│   │   ├── client.py             # Orchestrator (enhanced prompt, debug logging)
│   │   └── utils/schemas.py      # MCP server configuration
│   ├── llm/
│   │   └── utils/clients.py      # LLM clients (fixed tool_calls detection)
│   ├── agent-worker/             # 🆕 Claude Agent SDK worker
│   │   ├── package.json
│   │   ├── tsconfig.json
│   │   ├── src/index.ts          # Main worker with /diagnose endpoint
│   │   └── Dockerfile
│   └── servers/
│       ├── loki/                 # Loki MCP (working)
│       ├── slack/                # Slack MCP (working)
│       └── github/               # GitHub MCP (working)
├── sre-dashboard/                # Next.js real-time dashboard
├── observability/
│   ├── grafana/provisioning/alerting/  # Alert rules
│   ├── promtail/config.yaml      # Log shipping config
│   └── loki/                     # Loki config
└── docs/
    ├── ARCHITECTURE.md           # 🆕 Comprehensive architecture docs
    ├── GAP_ANALYSIS.md           # Current vs ideal comparison
    └── progress.md               # This file
```

---

## 📝 Environment Variables

```bash
# LLM Configuration
PROVIDER=self-hosted                    # or "anthropic" for direct API
LLM_API_URL=https://quasarmarket.coforge.com/qag/llmrouter-api/v2/chat/completions
LLM_API_KEY=<your-key>
MODEL=claude-sonnet-4

# MCP Servers to enable
ENABLED_SERVERS=["slack","github","loki-mcp"]

# Slack
SLACK_BOT_TOKEN=xoxb-...
SLACK_CHANNEL_ID=C095JV8PV0F

# GitHub
GITHUB_PERSONAL_ACCESS_TOKEN=ghp_...

# Agent Worker (new)
AGENT_WORKER_URL=http://agent-worker:3005
```

---

## 🔗 Related Documentation

| Document | Description |
|----------|-------------|
| [ARCHITECTURE.md](./ARCHITECTURE.md) | Visual diagrams + phase-by-phase walkthrough |
| [GAP_ANALYSIS.md](./GAP_ANALYSIS.md) | Current vs ideal system comparison |
| [EXECUTIVE_OVERVIEW.md](./EXECUTIVE_OVERVIEW.md) | Original project overview |

---

## 💡 Context Summary for New Chat

**What We Built**:
1. SRE Agent with Grafana → Loki → Orchestrator → MCP tools flow
2. Claude Agent SDK worker to replace broken self-hosted LLM
3. Comprehensive architecture documentation

**What Works**:
- Fault injection in aura-backend
- Log pipeline (Promtail → Loki → Grafana alerts)
- MCP servers (Loki, Slack, GitHub)
- Claude Agent SDK locally (completes successfully)

**What Needs Work**:
- Connect local agent-worker to Docker MCP servers (port mapping)
- Full end-to-end test with all components
- Dashboard showing real-time investigation

**Key Insight**:
The self-hosted LLM (`quasarmarket.coforge.com`) gets stuck in tool loops. Claude via Agent SDK solves this with proper multi-step reasoning.
