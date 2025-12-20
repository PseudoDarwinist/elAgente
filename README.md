# 🤖 el Agénte - AI-Powered SRE Agent

> **Autonomous Incident Response System with Topology-Aware Investigation**

[![Demo](https://img.shields.io/badge/Demo-Live-brightgreen)](http://localhost:3001)
[![Claude SDK](https://img.shields.io/badge/Claude-Agent%20SDK-purple)](https://docs.anthropic.com/claude/claude-agent-sdk)
[![MCP](https://img.shields.io/badge/MCP-Model%20Context%20Protocol-blue)](https://github.com/modelcontextprotocol)

---

## 🌟 What is el Agénte?

**el Agénte** is an AI-powered SRE (Site Reliability Engineering) agent that **automatically detects production errors, investigates root causes, and creates actionable documentation—all in under 2 minutes**.

### The Problem We Solve

> "Every minute of downtime costs $5,600. Traditional monitoring tells you WHAT failed, not WHY."

When something breaks at 3 AM:
- Engineers spend **70% of incident time** just gathering context
- Average MTTR (Mean Time To Recovery) is **60+ minutes**
- Multiple services affected—but which one is the root cause?

### Our Solution

el Agénte investigates like a **senior SRE engineer**:
1. 🗺️ **Discovers Topology** - Understands service dependencies before investigating
2. 🔍 **Gathers Targeted Evidence** - Only queries affected services, not the entire system
3. 🧠 **Forms Hypotheses** - Uses AI reasoning to identify root cause
4. ⚡ **Takes Action** - Posts to Slack, creates GitHub issues, generates runbooks

**Result**: MTTR from hours to minutes. Complete RCA documentation. No more 3 AM wake-up calls.

---

## 🎥 Quick Demo

![SRE Dashboard Demo](docs/imgs/dashboard_demo.gif)

1. **Inject a fault** into the demo e-commerce app
2. **Watch the agent** detect the error, discover topology, and investigate
3. **See the diagnosis** with root cause, confidence level, and runbook

---

## 🏗️ Architecture Overview

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                            YOUR BROWSER                                      │
│  ┌─────────────────────┐     ┌─────────────────────┐                        │
│  │   Aura E-Commerce   │     │    SRE Dashboard    │                        │
│  │   localhost:8080    │     │   localhost:3001    │                        │
│  └─────────────────────┘     └─────────────────────┘                        │
└─────────────────────────────────────────────────────────────────────────────┘
                │                           │
                ▼                           ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                         DOCKER CONTAINERS                                    │
│  ┌───────────────────────────────────────────────────────────────────────┐  │
│  │                     OBSERVABILITY STACK                                │  │
│  │   Loki (3100)  │  Grafana (3000)  │  Prometheus (9090)  │  Tempo       │  │
│  │   Log Storage     Alerting          Metrics               Tracing      │  │
│  └───────────────────────────────────────────────────────────────────────┘  │
│                                                                              │
│  ┌───────────────────────────────────────────────────────────────────────┐  │
│  │                        MCP SERVERS                                     │  │
│  │   Loki MCP (3103)  │  Slack (3101)  │  GitHub (3102)  │  Topology    │  │
│  │   Log Queries         Notifications    Issue Creation    Discovery    │  │
│  └───────────────────────────────────────────────────────────────────────┘  │
│                                                                              │
│  ┌───────────────────────────────────────────────────────────────────────┐  │
│  │                        ORCHESTRATOR                                    │  │
│  │                        localhost:8003                                  │  │
│  │                   Receives alerts, coordinates agent                   │  │
│  └───────────────────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                    LOCAL (NOT DOCKER)                                        │
│  ┌───────────────────────────────────────────────────────────────────────┐  │
│  │                     AGENT WORKER (localhost:3005)                      │  │
│  │     Claude Agent SDK + Pro Subscription via ~/.claude/ credentials     │  │
│  │     AI-powered investigation, multi-step reasoning, tool orchestration │  │
│  └───────────────────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────────────────┘
```

> ⚠️ **Important**: The Agent Worker MUST run locally (not in Docker) to access Claude CLI credentials from `~/.claude/`

---

## 📋 Prerequisites

Before you begin, make sure you have:

| Requirement | Version | Check Command |
|-------------|---------|---------------|
| **Docker Desktop** | Latest | `docker --version` |
| **Node.js** | 20+ | `node --version` |
| **npm** | 10+ | `npm --version` |
| **Claude CLI** | Latest | `claude --version` |

### Setting up Claude CLI

The agent uses your Claude Pro subscription via the CLI. If you haven't set it up:

```bash
# Install Claude CLI (if not installed)
npm install -g @anthropic-ai/claude-cli

# Authenticate (opens browser)
claude auth login

# Verify credentials exist
ls ~/.claude/
```

---

## 🚀 Quick Start (5 Minutes)

### Step 1: Clone and Navigate

```bash
git clone https://github.com/PseudoDarwinist/elAgente.git
cd elAgente
```

### Step 2: Start Docker Services

```bash
# Start all infrastructure containers
docker compose -f compose.local.yaml up -d
```

Wait for all containers to be healthy (~30 seconds):
```bash
docker compose -f compose.local.yaml ps
```

### Step 3: Start Agent Worker (LOCAL - Required!)

Open a **new terminal** and run:

```bash
cd sre_agent/agent-worker

# Install dependencies (first time only)
npm install

# Start the agent worker
LOKI_MCP_URL=http://localhost:3103/sse \
SLACK_MCP_URL=http://localhost:3101/sse \
GITHUB_MCP_URL=http://localhost:3102/sse \
PORT=3005 npx tsx src/index.ts
```

You should see:
```
[Agent Worker] Claude Agent SDK worker listening on port 3005
[Agent Worker] MCP Servers (Topology-Aware):
  - Loki: http://localhost:3103/sse
  - Slack: http://localhost:3101/sse
  - GitHub: http://localhost:3102/sse
```

### Step 4: Start SRE Dashboard

Open **another terminal** and run:

```bash
cd sre-dashboard

# Install dependencies (first time only)
npm install

# Start the dashboard
npm run dev
```

### Step 5: Access the Applications

| Application | URL | Purpose |
|-------------|-----|---------|
| **SRE Dashboard** | http://localhost:3001 | Agent visualization & investigation UI |
| **Aura E-Commerce** | http://localhost:8080 | Demo app with fault injection |
| **Grafana** | http://localhost:3000 | Alerting & log dashboards |
| **Prometheus** | http://localhost:9090 | Metrics explorer |

---

## 🧪 Running a Demo

### Option 1: Use the Dashboard Button

1. Open http://localhost:3001
2. Click **"START DEMO - Inject fault & open shop"** button
3. Watch the investigation unfold in real-time!

### Option 2: Manual Fault Injection

```bash
# Inject 100% checkout error rate
curl -X POST http://localhost:4000/api/admin/fault \
  -H "Content-Type: application/json" \
  -d '{"error_rate": 1.0}'

# The agent will automatically detect and investigate the fault!

# Clear the fault when done
curl -X POST http://localhost:4000/api/admin/fault \
  -H "Content-Type: application/json" \
  -d '{"error_rate": 0}'
```

### What Happens During Investigation

1. **ERROR** → Aura backend starts generating 503 errors
2. **LOGS** → Promtail ships error logs to Loki
3. **ALERT** → Grafana detects errors and fires webhook to orchestrator
4. **BRAIN** → Agent Worker investigates:
   - Discovers service topology
   - Gathers targeted logs
   - Forms hypothesis
   - Generates runbook
5. **DONE** → Results posted to Slack and GitHub

---

## 📊 Service Architecture

### Docker Services (`compose.local.yaml`)

| Container | Port | Purpose | Health Check |
|-----------|------|---------|--------------|
| `aura-backend` | 4000 | E-commerce API with fault injection | ✅ |
| `aura-frontend` | 8080 | React storefront | ✅ |
| `loki` | 3100 | Log storage database | ✅ |
| `promtail` | - | Ships logs to Loki | ✅ |
| `grafana` | 3000 | Alerting & dashboards | ✅ |
| `orchestrator` | 8003 | SRE Agent API | ✅ |
| `loki-mcp` | 3103 | MCP server for log queries | ✅ |
| `slack` | 3101 | MCP server for Slack posts | ✅ |
| `github` | 3102 | MCP server for GitHub issues | ✅ |
| `prometheus` | 9090 | Metrics collection | ✅ |
| `tempo` | 3200 | Distributed tracing | ⚠️ Optional |

### Local Services (Must Run Manually)

| Service | Port | Purpose |
|---------|------|---------|
| `agent-worker` | 3005 | Claude Agent SDK (uses ~/.claude/) |
| `sre-dashboard` | 3001 | Next.js real-time dashboard |

---

## 🔧 Configuration

### Environment Variables

Create a `.env` file in the project root (optional, has defaults):

```bash
# Slack Integration
SLACK_BOT_TOKEN=xoxb-your-bot-token
SLACK_TEAM_ID=T0123456789
SLACK_CHANNEL_ID=C0123456789

# GitHub Integration
GITHUB_PERSONAL_ACCESS_TOKEN=ghp_xxxxxxxxxxxx
GITHUB_ORGANISATION=your-org
GITHUB_REPO_NAME=your-repo

# LLM Configuration (optional - uses Claude CLI by default)
PROVIDER=anthropic
MODEL=claude-4-0-sonnet-latest
ANTHROPIC_API_KEY=sk-ant-api-key  # Only if not using CLI auth
```

### MCP Server URLs

The agent-worker connects to MCP servers via SSE. When running locally:

```bash
LOKI_MCP_URL=http://localhost:3103/sse
SLACK_MCP_URL=http://localhost:3101/sse
GITHUB_MCP_URL=http://localhost:3102/sse
TOPOLOGY_MCP_URL=http://localhost:3104/sse      # Optional
PROMETHEUS_MCP_URL=http://localhost:3105/sse    # Optional
```

---

## 📁 Project Structure

```
sre-agent/
├── README.md                  # This file
├── compose.local.yaml         # Docker Compose for local development
│
├── aura-quiet-living/         # Demo E-Commerce Application
│   ├── backend/
│   │   ├── server.js          # Express API with fault injection
│   │   └── logger.js          # Winston logging
│   └── src/                   # React frontend
│
├── sre_agent/
│   ├── client/
│   │   └── client.py          # Orchestrator (FastAPI)
│   │
│   ├── agent-worker/          # 🧠 Claude Agent SDK Worker
│   │   ├── src/index.ts       # Main agent logic
│   │   └── package.json
│   │
│   └── servers/               # MCP Tool Servers
│       ├── loki/              # Log queries
│       ├── slack/             # Notifications
│       ├── github/            # Issue creation
│       ├── topology-server/   # Service dependencies
│       └── prometheus-server/ # Health metrics
│
├── sre-dashboard/             # Real-time Dashboard (Next.js)
│   └── src/app/
│       ├── page.tsx           # Main page + SSE handling
│       └── components/
│           ├── PipelineFlow.tsx         # Investigation pipeline
│           ├── ChainOfThought.tsx       # Agent reasoning steps
│           ├── HypothesisPanel.tsx      # Diagnosis + Runbook
│           ├── FaultPropagationChain.tsx # Fault impact visualization
│           └── ServiceDependencyGraph.tsx # Topology map
│
├── observability/             # Monitoring Configuration
│   ├── grafana/provisioning/  # Dashboards + Alert rules
│   ├── loki/                  # Log aggregation config
│   ├── prometheus/            # Metrics config
│   └── promtail/              # Log shipping config
│
└── docs/                      # Documentation
    ├── SYSTEM_DOCUMENTATION.md
    ├── ARCHITECTURE.md
    └── imgs/
```

---

## 🩺 Health Checks

### Check All Services

```bash
# Docker containers
docker compose -f compose.local.yaml ps

# Orchestrator health
curl http://localhost:8003/health

# Agent worker health
curl http://localhost:3005/health

# Loki (logs)
curl http://localhost:3100/ready

# Grafana
curl http://localhost:3000/api/health
```

### Common Issues

| Issue | Solution |
|-------|----------|
| Port already in use | `lsof -i :PORT` → `kill -9 PID` |
| Agent worker won't start | Check if `~/.claude/` exists (run `claude auth login`) |
| No logs in Loki | Restart promtail: `docker compose restart promtail` |
| Dashboard shows old data | Refresh browser + click "STOP" then "START DEMO" |
| Tempo unhealthy | Non-critical, demo works without it |

---

## 🔌 API Endpoints

### Orchestrator API (localhost:8003)

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/health` | GET | Service health check |
| `/diagnose` | POST | Start manual diagnosis |
| `/alerts` | POST | Receive Grafana webhooks |
| `/events/{run_id}` | GET | SSE event stream |
| `/latest-run` | GET | Get current run status |

### Agent Worker API (localhost:3005)

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/health` | GET | Worker health check |
| `/diagnose` | POST | Execute AI diagnosis |

### Aura Backend API (localhost:4000)

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/api/admin/fault` | POST | Inject/clear faults |
| `/api/products` | GET | List products |
| `/api/checkout` | POST | Process checkout (fault-injectable) |

---

## 🛠️ Development

### Rebuild Docker Images

```bash
docker compose -f compose.local.yaml build --no-cache
docker compose -f compose.local.yaml up -d
```

### View Logs

```bash
# All containers
docker compose -f compose.local.yaml logs -f

# Specific container
docker compose -f compose.local.yaml logs -f orchestrator
```

### Restart Services

```bash
# Single service
docker compose -f compose.local.yaml restart orchestrator

# All services
docker compose -f compose.local.yaml restart
```

### Stop Everything

```bash
# Stop containers (preserve data)
docker compose -f compose.local.yaml stop

# Stop and remove containers + volumes
docker compose -f compose.local.yaml down -v
```

---

## 📚 Additional Documentation

| Document | Description |
|----------|-------------|
| [System Documentation](docs/SYSTEM_DOCUMENTATION.md) | Complete architecture & design decisions |
| [Architecture](docs/ARCHITECTURE.md) | Detailed component breakdown |
| [Agent Architecture](docs/agent-architecture.md) | How the AI agent works |
| [Production Journey](docs/production-journey.md) | Lessons learned |

---

## ✨ Features

- 🕵️ **Root Cause Analysis** - AI-powered investigation that finds the real cause
- 🗺️ **Topology Discovery** - Understands service dependencies before investigating
- 📊 **Real-time Dashboard** - Watch the agent think and investigate
- 💬 **Slack Integration** - Automatic incident reports to your team
- 🐛 **GitHub Issues** - Creates detailed incident issues with runbooks
- 📈 **Metrics & Logs** - Full observability with Prometheus, Loki, Grafana
- ⚡ **Fast Response** - From detection to diagnosis in under 2 minutes

---

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch: `git checkout -b feature/amazing-feature`
3. Commit changes: `git commit -m 'Add amazing feature'`
4. Push to branch: `git push origin feature/amazing-feature`
5. Open a Pull Request

---

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

---

## 🙏 Acknowledgments

- [Anthropic](https://anthropic.com) - Claude Agent SDK
- [Model Context Protocol](https://github.com/modelcontextprotocol) - MCP standard
- [Grafana Labs](https://grafana.com) - Loki, Tempo, Grafana
- [Prometheus](https://prometheus.io) - Metrics collection

---

**Built with 💜 by the el Agénte Team**
