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

---

## 📅 December 7-8, 2025 Session — Downtime Cost Feature

### New Feature: Revenue Impact Split-View (Aura App)

Created a dramatic split-view UI that shows real-time business impact when checkout errors occur:

**Left Panel (60%)**: Dimmed checkout with error overlay
**Right Panel (40%)**: Revenue Impact Dashboard showing:
- 💰 Revenue loss counter ($93.33/sec based on ITIC $5,600/min stat)
- ⏱️ Elapsed time timer
- 📈 Live revenue loss graph
- 📊 Industry benchmark callout
- 🤖 SRE Agent pipeline status

**Files Created**:
| File | Purpose |
|------|---------|
| `aura-quiet-living/components/RevenueImpactDashboard.tsx` | Dashboard with animated counter, timer, graph |
| `aura-quiet-living/components/ErrorSplitView.tsx` | Split-view layout wrapper |

**Files Modified**:
| File | Change |
|------|--------|
| `aura-quiet-living/components/Checkout.tsx` | Error state handling, retry logic, SRE status simulation |
| `aura-quiet-living/index.html` | CSS animations (slide-in-right, pulse-glow) |

### Fixed: Alert Storm / Slack Spam

**Problem**: Grafana alerts triggered repeated diagnoses, spamming Slack.

**Fixes Applied**:
| Change | File | Before → After |
|--------|------|----------------|
| Cooldown | `.env` | 60s → **600s (10 min)** |
| Skip RESOLVED | `client.py` | Added filter for `[RESOLVED]` alerts |
| Group interval | `policies.yaml` | 30s → **5 min** |
| Repeat interval | `policies.yaml` | 1h → **4 hours** |

### Docker Rebuilds
- `sre-agent-aura-frontend-1` — With split-view feature
- `sre-agent-orchestrator-1` — With RESOLVED skip + 10min cooldown

### Quick Commands
```bash
# Inject fault
curl -X POST http://localhost:4000/api/admin/fault -H "Content-Type: application/json" -d '{"error_rate": 1.0}'

# Clear fault
curl -X POST http://localhost:4000/api/admin/fault -H "Content-Type: application/json" -d '{"error_rate": 0}'

# Rebuild aura frontend
docker compose -f compose.local.yaml build aura-frontend --no-cache && docker compose -f compose.local.yaml up -d aura-frontend

# Start SRE Dashboard
cd sre-dashboard && npm run dev
```

### Key URLs
| Service | URL |
|---------|-----|
| Aura E-Commerce | http://localhost:8080 |
| SRE Dashboard | http://localhost:3001 |
| Grafana | http://localhost:3000 |
| Orchestrator | http://localhost:8003 |

### Next: UI/UX Improvements for Hackathon
- Make SRE Dashboard more visually dramatic
- Add real-time log streaming visualization
- Add progress animations for chain of thought
- Create "demo mode" for one-click full flow

---

## 📅 December 8, 2025 Session — Dashboard Fixes + Semi-Finals Prep

### 🎉 REACHED SEMI-FINALS!

**Presentation Date**: December 12, 2025 (Online)
**Time Limit**: 12 minutes (strict)

---

### Fixes Applied This Session

#### 1. Agent-Worker Event Streaming
**Problem**: Dashboard only showed 2 steps (init/complete), no intermediate events.

**Solution**: Updated `agent-worker/src/index.ts` to emit granular events:
- `connecting_servers` / `servers_connected`
- `tool_call` (with tool name and args)
- `tool_result` (with preview)
- `llm_response` (with analysis preview)
- `analysis_complete` (with tool count)
- `complete` (with full report)

**File Changed**: `sre_agent/agent-worker/src/index.ts`

#### 2. Orchestrator Event Forwarding
**Problem**: Orchestrator didn't forward agent-worker events to dashboard.

**Solution**: Added code to forward events from agent-worker response to SSE stream.

**File Changed**: `sre_agent/client/client.py` (lines 618-621)
```python
worker_events = data.get("events", [])
for event in worker_events:
    if run_id and event.get("event_type"):
        emit_event(run_id, event["event_type"], event.get("data", {}))
```

#### 3. RCA Report Truncation Fix
**Problem**: Report was cut off at 2000 characters.

**Solution**: Increased limit from 2000 → 10000 in three places:
- `agent-worker/src/index.ts` line 238
- `client.py` line 626
- `client.py` line 716

#### 4. Terminal Log Fix
**Problem**: Terminal showed "Waiting for logs..." even when logs existed.

**Solution**: Updated `page.tsx` to use `preview` field:
```typescript
const logData = lastEvent.data.response || lastEvent.data.preview;
```

**File Changed**: `sre-dashboard/src/app/page.tsx` (lines 54-56)

#### 5. Claude Agent SDK Connection
**Problem**: Docker orchestrator couldn't reach local agent-worker.

**Solution**: Changed `.env`:
```
AGENT_WORKER_URL=http://host.docker.internal:3005
```

---

### How to Run the Current Setup

```bash
# 1. Start Docker services
cd /Users/chetansingh/Documents/Hackathon/sre-agent
docker compose -f compose.local.yaml up -d

# 2. Start Agent Worker (LOCAL - required!)
cd sre_agent/agent-worker
LOKI_MCP_URL=http://localhost:3103/sse \
SLACK_MCP_URL=http://localhost:3101/sse \
GITHUB_MCP_URL=http://localhost:3102/sse \
PORT=3005 npx tsx src/index.ts

# 3. Start SRE Dashboard (separate terminal)
cd sre-dashboard
npm run dev

# 4. Test the demo
curl -X POST http://localhost:4000/api/admin/fault \
  -H "Content-Type: application/json" -d '{"error_rate": 1.0}'

# 5. Go to http://localhost:8080 and trigger checkout error
# 6. Watch http://localhost:3001 for real-time diagnosis

# 7. Clear fault when done
curl -X POST http://localhost:4000/api/admin/fault \
  -H "Content-Type: application/json" -d '{"error_rate": 0}'
```

---

## 🏆 Semi-Finals Enhancement Plan

### Your Story (Hero's Journey)

| Stage | Script |
|-------|--------|
| **Hook** | "Every minute of downtime costs $5,600. What if AI could fix issues before your team wakes up?" |
| **Context** | "Modern enterprises run complex microservices. When something breaks at 3 AM, SREs scramble to find the needle in a haystack." |
| **Challenge** | "Traditional monitoring shows WHAT failed, not WHY. Engineers spend 70% of incident time gathering context." |
| **Response** | "Our SRE Agent investigates like a senior engineer—gathering logs, forming hypotheses, generating runbooks." |
| **Result** | "MTTR from hours to minutes. Complete RCA documentation. No more 3 AM wake-up calls." |

### 12-Minute Demo Script

```
0:00-0:30   Hook + Problem Statement
0:30-1:30   Pain Point Demo (fault injection, split-view)
1:30-2:00   Introduce the Solution
2:00-6:00   Live Agent Demo (dashboard streaming)
6:00-8:00   Walkthrough RCA Report
8:00-9:30   Technical Deep-Dive (30%)
9:30-11:00  Business Impact
11:00-12:00 Closing + Q&A Setup
```

### UI/UX Enhancements To Implement

#### Priority 1: Demo Mode Button
- [ ] Add one-click "START DEMO" button to SRE Dashboard
- [ ] Auto-inject fault
- [ ] Auto-trigger checkout error
- [ ] Auto-focus on diagnosis stream

#### Priority 2: RCA Report Fix
- [ ] Make report scrollable
- [ ] Add Markdown rendering
- [ ] Collapsible sections
- [ ] Copy-to-clipboard button

#### Priority 3: Pipeline Animations
- [ ] Animated flow lines between stages
- [ ] Particle effects
- [ ] Pulsing glow on active stage
- [ ] Connection animation

#### Priority 4: Terminal Enhancement
- [ ] Typing animation effect
- [ ] Syntax highlighting for log levels
- [ ] Error lines in red
- [ ] Auto-scroll with tail effect

#### Priority 5: Metrics Dashboard
- [ ] Real-time MTTR counter
- [ ] Cost saved calculator
- [ ] Before/After comparison

#### Priority 6: Sound Effects (Optional)
- [ ] Alert sound on incident
- [ ] "Ding" on resolution

---

### Key Talking Points for Judges

> "Traditional monitoring tells you WHAT failed. Our agent tells you WHY."

> "From alert to RCA in under 2 minutes, not 2 hours."

> "$5,600/minute × 60 min average MTTR = $336,000 per incident saved."

> "Agent creates GitHub issues and Slack posts—team wakes up to solutions, not problems."

---

### Files Modified This Session

| File | Change |
|------|--------|
| `sre_agent/agent-worker/src/index.ts` | Granular event emission, 10000 char limit |
| `sre_agent/client/client.py` | Event forwarding, 10000 char limit |
| `sre-dashboard/src/app/page.tsx` | Use `preview` field for terminal logs |
| `.env` | `AGENT_WORKER_URL=http://host.docker.internal:3005` |

---

## 📅 December 8, 2025 Afternoon Session — Semi-Finals Enhancements

### ✅ Priority 1: Demo Mode Button (COMPLETED)

Created one-click demo button for the SRE Dashboard:

**New Component**: `sre-dashboard/src/app/components/DemoModeButton.tsx`

| State | Label | Action |
|-------|-------|--------|
| `idle` | 🚀 START DEMO | Click to inject fault and open Aura shop |
| `injecting` | ⚡ INJECTING... | Calling `/api/admin/fault` |
| `active` | 🔴 FAULT ACTIVE | Fault injected, opens Aura shop in new tab |
| `diagnosing` | 🔍 AI ANALYZING | Dashboard detected diagnosis, Claude working |
| `done` | ✅ COMPLETE | Fault auto-cleared after diagnosis |

**Demo Flow**:
```
Click START DEMO → Aura opens in new tab → User checkouts → Error! → 
Grafana fires alert → Dashboard auto-subscribes → AI diagnoses → 
Posted to Slack → GitHub issue created → COMPLETE
```

**Files Created/Modified**:
| File | Change |
|------|--------|
| `sre-dashboard/src/app/components/DemoModeButton.tsx` | **[NEW]** Neo-Brutalism styled button component |
| `sre-dashboard/src/app/page.tsx` | Import and add button to header |

---

### ✅ GitHub Integration Fixed

**Problem**: Claude was trying to create issues on `anthropics/oncall` instead of user's repo.

**Solution**: Added environment variables and updated prompt with explicit `owner` and `repo` parameters.

**Changes to `agent-worker/src/index.ts`**:
```typescript
// Added env vars
const GITHUB_OWNER = process.env.GITHUB_ORGANISATION || 'PseudoDarwinist';
const GITHUB_REPO = process.env.GITHUB_REPO_NAME || 'elAgente';

// Updated prompt STEP 5:
// Call \`create_issue\` with EXACTLY these parameters:
// - owner: "${GITHUB_OWNER}"
// - repo: "${GITHUB_REPO}"
```

**Verification**: Successfully created [Issue #2](https://github.com/PseudoDarwinist/elAgente/issues/2) on user's repo!

---

### ✅ Grafana Alerting Speedup

**Problem**: `group_interval: 5m` caused alerts to only fire every 5 minutes.

**Solution**: Updated `observability/grafana/provisioning/alerting/policies.yaml`:

| Setting | Before | After |
|---------|--------|-------|
| `group_wait` | 30s | 10s |
| `group_interval` | 5m | 30s |
| `repeat_interval` | 4h | 2m |

**Result**: Demo cycles are now faster (~30 seconds instead of 5 minutes).

---

### ✅ End-to-End Flow Verified

Successfully tested the complete flow:

1. **Demo Button clicked** → Fault injected (error_rate=1.0)
2. **Aura Shop opened** → User triggers checkout
3. **Error logged** → GatewayTimeout errors in Loki
4. **Grafana alert fires** → Webhook to orchestrator
5. **Orchestrator calls agent-worker** → Claude SDK starts
6. **Claude analyzes real logs** → Identified 21 GatewayTimeout errors
7. **RCA generated** with 95% confidence
8. **Posted to Slack** (Channel C095S2NQQMV)
9. **GitHub Issue #2 created** on PseudoDarwinist/elAgente
10. **Dashboard shows complete flow** with Chain of Thought

**Proof of Real AI Analysis** (not hardcoded):
- Claude counted **21 GatewayTimeout errors** in logs
- Identified **Stripe provider** as the failing component
- Generated **unique timestamps and transaction IDs** from actual logs
- Created **custom runbook** based on error pattern

---

### Quick Commands (Updated)

```bash
# Start all Docker services
cd /Users/chetansingh/Documents/Hackathon/sre-agent
docker compose -f compose.local.yaml up -d

# Start Agent Worker (LOCAL - required!)
cd sre_agent/agent-worker
LOKI_MCP_URL=http://localhost:3103/sse \
SLACK_MCP_URL=http://localhost:3101/sse \
GITHUB_MCP_URL=http://localhost:3102/sse \
GITHUB_ORGANISATION=PseudoDarwinist \
GITHUB_REPO_NAME=elAgente \
PORT=3005 npx tsx src/index.ts

# Start SRE Dashboard
cd sre-dashboard && npm run dev

# Open Dashboard at http://localhost:3001
# Click "START DEMO" button
# Go to Aura shop (opens automatically) and checkout
# Watch the magic happen!
```

---

### Remaining Priorities

#### Priority 2: RCA Report Fix
- [ ] Make report scrollable
- [ ] Add Markdown rendering
- [ ] Collapsible sections
- [ ] Copy-to-clipboard button

#### Priority 3: Pipeline Animations
- [ ] Animated flow lines between stages
- [ ] Particle effects
- [ ] Pulsing glow on active stage

#### Priority 4: Terminal Enhancement
- [ ] Typing animation effect
- [ ] Syntax highlighting for log levels
- [ ] Error lines in red
- [ ] Auto-scroll with tail effect

#### Priority 5: Metrics Dashboard
- [ ] Real-time MTTR counter
- [ ] Cost saved calculator

#### Priority 6: Sound Effects (Optional)
- [ ] Alert sound on incident
- [ ] "Ding" on resolution

---

### Key Talking Points for Judges

> "Traditional monitoring tells you WHAT failed. Our agent tells you WHY."

> "From alert to RCA in under 2 minutes, not 2 hours."

> "$5,600/minute × 60 min average MTTR = $336,000 per incident saved."

> "Agent creates GitHub issues and Slack posts—team wakes up to solutions, not problems."

---

**Last Updated**: 2025-12-08T18:32:00+05:30
**Status**: Priority 1 (Demo Mode Button) ✅ COMPLETED

