# SRE Agent - Executive Overview & Technical Documentation

## Table of Contents
1. [Executive Summary](#executive-summary)
2. [The Problem We're Solving](#the-problem-were-solving)
3. [Our Solution](#our-solution)
4. [Architecture Overview](#architecture-overview)
5. [System Design](#system-design)
6. [Key Features](#key-features)
7. [How It Works](#how-it-works)
8. [Technology Stack](#technology-stack)
9. [PoC Testing Guide](#poc-testing-guide)
10. [Business Value](#business-value)
11. [Roadmap](#roadmap)

---

## Executive Summary

**SRE Agent** is an AI-powered Site Reliability Engineering assistant that automatically detects, diagnoses, and reports production incidents. It reduces Mean Time To Resolution (MTTR) from hours to minutes by combining:

- **Real-time log monitoring** via Grafana/Loki
- **AI-powered root cause analysis** using LLMs (Gemini/Claude)
- **Automated code inspection** via GitHub integration
- **Instant team notification** via Slack
- **Learning from past incidents** via RAG (Retrieval-Augmented Generation)

### Key Value Proposition
| Metric | Before | After SRE Agent |
|--------|--------|-----------------|
| Incident Detection | Manual monitoring | Automated (< 1 min) |
| Initial Diagnosis | 30-60 minutes | 2-5 minutes |
| Team Notification | Manual Slack/Email | Automatic |
| Knowledge Retention | Tribal knowledge | Stored & searchable |

---

## The Problem We're Solving

### Current Pain Points in Incident Management

1. **Slow Detection**: Engineers discover issues from customer complaints, not monitoring
2. **Manual Log Analysis**: Hours spent grep-ing through logs across multiple services
3. **Context Switching**: Engineers must jump between Kubernetes, GitHub, Slack, and monitoring tools
4. **Knowledge Silos**: Solutions to past incidents live in engineers' heads, not systems
5. **Alert Fatigue**: Too many alerts, not enough actionable insights
6. **Costly Downtime**: Every minute of outage costs money and reputation

### The Reality
> "Our on-call engineers spend 70% of their time on repetitive diagnosis tasks that could be automated."

---

## Our Solution

SRE Agent acts as a **24/7 AI-powered first responder** that:

1. **Monitors** application logs continuously
2. **Detects** anomalies and errors automatically
3. **Diagnoses** root causes by analyzing logs and code
4. **Searches** the codebase to identify faulty code
5. **Learns** from past incidents to improve future responses
6. **Reports** findings to the team via Slack with actionable insights

### What Makes This Different?

| Traditional Approach | SRE Agent Approach |
|---------------------|-------------------|
| Alert → Human reads logs → Human searches code → Human posts update | Alert → AI reads logs → AI searches code → AI posts diagnosis |
| Requires senior engineer availability | Works 24/7, escalates to humans when needed |
| Each incident starts from scratch | Learns from every incident |

---

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                              SRE AGENT ARCHITECTURE                          │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  ┌──────────────┐     ┌──────────────┐     ┌──────────────┐                │
│  │  Your Apps   │────▶│   Promtail   │────▶│     Loki     │                │
│  │   (Logs)     │     │ (Log Shipper)│     │ (Log Storage)│                │
│  └──────────────┘     └──────────────┘     └──────┬───────┘                │
│                                                    │                        │
│                                                    ▼                        │
│                                            ┌──────────────┐                 │
│                                            │   Grafana    │                 │
│                                            │  (Alerting)  │                 │
│                                            └──────┬───────┘                 │
│                                                   │                         │
│                         ┌─────────────────────────┼─────────────────────┐   │
│                         │        WEBHOOK          │                     │   │
│                         ▼                         ▼                     │   │
│  ┌──────────────────────────────────────────────────────────────────┐  │   │
│  │                        ORCHESTRATOR                               │  │   │
│  │  ┌────────────┐  ┌────────────┐  ┌────────────┐  ┌────────────┐  │  │   │
│  │  │   /alerts  │  │  /diagnose │  │    RAG     │  │   /health  │  │  │   │
│  │  │  Webhook   │  │   Manual   │  │  (Qdrant)  │  │   Check    │  │  │   │
│  │  └─────┬──────┘  └─────┬──────┘  └─────┬──────┘  └────────────┘  │  │   │
│  │        │               │               │                          │  │   │
│  │        └───────────────┴───────────────┘                          │  │   │
│  │                        │                                          │  │   │
│  │                        ▼                                          │  │   │
│  │              ┌──────────────────┐                                 │  │   │
│  │              │    LLM Server    │                                 │  │   │
│  │              │ (Gemini/Claude)  │                                 │  │   │
│  │              └────────┬─────────┘                                 │  │   │
│  └───────────────────────┼───────────────────────────────────────────┘  │   │
│                          │                                               │   │
│           ┌──────────────┼──────────────┬──────────────┐                │   │
│           │              │              │              │                │   │
│           ▼              ▼              ▼              ▼                │   │
│    ┌────────────┐ ┌────────────┐ ┌────────────┐ ┌────────────┐         │   │
│    │ Kubernetes │ │   GitHub   │ │   Slack    │ │   Prompt   │         │   │
│    │ MCP Server │ │ MCP Server │ │ MCP Server │ │   Server   │         │   │
│    └─────┬──────┘ └─────┬──────┘ └─────┬──────┘ └────────────┘         │   │
│          │              │              │                                │   │
│          ▼              ▼              ▼                                │   │
│    ┌────────────┐ ┌────────────┐ ┌────────────┐                        │   │
│    │    K8s     │ │   GitHub   │ │   Slack    │                        │   │
│    │  Cluster   │ │    Repo    │ │  Channel   │                        │   │
│    └────────────┘ └────────────┘ └────────────┘                        │   │
│                                                                         │   │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## System Design

### Component Breakdown

#### 1. Observability Stack (Log Collection & Alerting)
| Component | Purpose | Technology |
|-----------|---------|------------|
| **Promtail** | Ships logs from applications to Loki | Grafana Promtail |
| **Loki** | Stores and indexes logs | Grafana Loki |
| **Grafana** | Visualizes logs, triggers alerts | Grafana 11 |

#### 2. Core Agent (Brain)
| Component | Purpose | Technology |
|-----------|---------|------------|
| **Orchestrator** | Central coordinator, handles webhooks | Python/FastAPI |
| **LLM Server** | AI reasoning and decision making | Gemini/Claude API |
| **RAG Store** | Stores past incidents for learning | Qdrant Vector DB |

#### 3. MCP Servers (Tools)
| Server | Purpose | Capabilities |
|--------|---------|--------------|
| **Kubernetes MCP** | Query K8s cluster | Get logs, pod status, deployments |
| **GitHub MCP** | Search codebase | Find files, read code, create issues |
| **Slack MCP** | Team communication | Post messages, updates |
| **Prompt Server** | Structured prompts | Consistent AI instructions |

### Data Flow

```
1. APPLICATION LOGS
   └──▶ Promtail (collects)
        └──▶ Loki (stores)
             └──▶ Grafana (monitors)
                  └──▶ Alert Rule Triggers
                       └──▶ Webhook to /alerts

2. DIAGNOSIS FLOW
   └──▶ Orchestrator receives alert
        └──▶ Query RAG for similar past incidents
             └──▶ LLM analyzes context
                  └──▶ LLM calls tools (K8s logs, GitHub search)
                       └──▶ LLM synthesizes diagnosis
                            └──▶ Post to Slack + Create GitHub Issue
                                 └──▶ Store diagnosis in RAG for future
```

---

## Key Features

### 1. 🔔 Automated Alert Handling
- Receives alerts from Grafana via webhook
- Applies cooldown to prevent alert storms
- Validates alerts with secret-based authentication

### 2. 🧠 AI-Powered Diagnosis
- Uses LLM (Gemini/Claude) to reason about errors
- Follows structured diagnostic prompts
- Can call tools to gather more information

### 3. 🔍 Multi-Source Investigation
- **Kubernetes**: Fetches pod logs, deployment status
- **GitHub**: Searches code, identifies faulty files
- **Historical**: Queries past incidents for patterns

### 4. 📚 Learning System (RAG)
- Stores every diagnosis in vector database
- Retrieves similar past incidents during new diagnoses
- Continuously improves with each incident

### 5. 💬 Automated Reporting
- Posts detailed diagnosis to Slack
- Creates GitHub issues for tracking
- Includes actionable remediation steps

### 6. 🛡️ Security Features
- Webhook authentication with secrets
- Optional LLM firewall for prompt safety
- Bearer token authentication for API

---

## How It Works

### Scenario: Production Error Detected

```
TIME    EVENT
─────────────────────────────────────────────────────────────
T+0s    Application throws "Connection timeout to database"

T+5s    Promtail ships log to Loki

T+60s   Grafana alert rule evaluates: "errors in 5m > 0"
        ⚡ Alert fires!

T+61s   Grafana sends webhook to SRE Agent /alerts endpoint

T+62s   Orchestrator validates secret, checks cooldown
        ✓ Passes validation

T+63s   RAG query: "Find similar past database timeout incidents"
        📚 Returns 2 similar incidents from last month

T+65s   LLM receives context:
        - Alert details
        - Similar past incidents
        - Service: salesforce

T+70s   LLM decides: "I need to check Kubernetes logs"
        🔧 Calls K8s MCP → get_logs(service=salesforce)

T+75s   LLM analyzes logs, finds: "Connection pool exhausted"
        🔧 Calls GitHub MCP → search_code("connection pool")

T+80s   LLM finds: src/db/connection.py has hardcoded pool size

T+85s   LLM generates diagnosis:
        "Root cause: Connection pool size (10) insufficient for load.
         File: src/db/connection.py:45
         Fix: Increase POOL_SIZE or implement connection reuse"

T+90s   🔧 Calls Slack MCP → post_message(diagnosis)
        🔧 Calls GitHub MCP → create_issue(diagnosis)

T+92s   📝 Stores diagnosis in RAG for future learning

T+95s   ✅ DIAGNOSIS COMPLETE
        Total time: ~95 seconds (vs 30-60 minutes manually)
```

---

## Technology Stack

### Core Technologies

| Layer | Technology | Why |
|-------|------------|-----|
| **Language** | Python 3.12 | Fast development, AI ecosystem |
| **API Framework** | FastAPI | Async, modern, auto-docs |
| **AI Protocol** | MCP (Model Context Protocol) | Standardized LLM-tool communication |
| **Containerization** | Docker Compose | Easy local development |

### AI/ML Stack

| Component | Technology | Purpose |
|-----------|------------|---------|
| **LLM** | Gemini / Claude | Reasoning, diagnosis |
| **Embeddings** | Gemini text-embedding-004 | RAG vector generation |
| **Vector DB** | Qdrant | Similarity search for RAG |

### Observability Stack

| Component | Technology | Purpose |
|-----------|------------|---------|
| **Log Shipper** | Promtail | Collect and forward logs |
| **Log Store** | Loki | Index and query logs |
| **Dashboards** | Grafana | Visualization & alerting |

### Integrations

| Integration | Purpose |
|-------------|---------|
| **Kubernetes** | Query cluster logs and status |
| **GitHub** | Search code, create issues |
| **Slack** | Team notifications |

---

## PoC Testing Guide

### Prerequisites
- Docker Desktop running
- `.env` file configured with API keys

### Quick Start

```bash
# 1. Start the agent stack
docker compose -f compose.local.yaml up -d

# 2. Start observability stack
docker compose -f compose.observability.yaml up -d

# 3. Verify all services are running
docker ps | grep sre-agent
```

### Test 1: Health Check
```bash
curl http://localhost:8003/health
```
**Expected**: `{"status":"OK","detail":"All required MCP server connections are healthy."}`

### Test 2: Manual Diagnosis Trigger
```bash
curl -X POST http://localhost:8003/diagnose \
  -H "Authorization: Bearer dev-token-123" \
  -d "text=salesforce"
```
**Expected**: Returns acknowledgment, check Slack for diagnosis

### Test 3: Simulate Alert Webhook
```bash
curl -X POST http://localhost:8003/alerts \
  -H "Content-Type: application/json" \
  -H "X-Alert-Secret: demo-secret-123" \
  -d '{
    "title": "High Error Rate",
    "service": "salesforce",
    "annotations": {
      "summary": "Error spike detected in salesforce service"
    }
  }'
```
**Expected**: `{"status":"accepted","service":"salesforce"}`

### Test 4: Generate Test Logs
```bash
# Create error log that Promtail will ship to Loki
echo '{"level":"error","ts":"'$(date -u +%Y-%m-%dT%H:%M:%SZ)'","msg":"Connection timeout","service":"salesforce"}' >> logs/app/app.log
```

### Test 5: View in Grafana
1. Open http://localhost:3000
2. Login: `admin` / `admin`
3. Go to **Explore** → Select **Loki**
4. Query: `{service="salesforce"}`

### Test 6: Check RAG Storage
```bash
curl http://localhost:6333/collections/incidents
```

### Endpoints Reference

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/health` | GET | Service health check |
| `/diagnose` | POST | Manual diagnosis trigger |
| `/alerts` | POST | Webhook for Grafana alerts |

### Grafana URLs
- **Dashboard**: http://localhost:3000
- **Loki API**: http://localhost:3100
- **Qdrant API**: http://localhost:6333

---

## Business Value

### Quantifiable Benefits

| Metric | Impact |
|--------|--------|
| **MTTR Reduction** | 80-90% faster incident resolution |
| **On-Call Burden** | Reduce night pages by handling routine issues |
| **Knowledge Retention** | 100% of diagnoses stored and searchable |
| **Consistency** | Every incident gets the same thorough analysis |

### ROI Calculation Example

```
Assumptions:
- 20 incidents/month
- Current MTTR: 45 minutes
- Engineer cost: $100/hour
- Downtime cost: $1,000/minute

Current Monthly Cost:
  Engineer time: 20 × 0.75hr × $100 = $1,500
  Downtime: 20 × 45min × $1,000 = $900,000
  Total: $901,500

With SRE Agent (5-minute MTTR):
  Engineer time: 20 × 0.25hr × $100 = $500
  Downtime: 20 × 5min × $1,000 = $100,000
  Total: $100,500

Monthly Savings: ~$800,000 (89% reduction)
```

### Qualitative Benefits

1. **Engineer Satisfaction**: Less repetitive work, more interesting problems
2. **Faster Onboarding**: New engineers can learn from stored diagnoses
3. **Compliance**: Audit trail of all incident responses
4. **Scalability**: Handles growing infrastructure without adding headcount

---

## Roadmap

### Phase 1: PoC (Current)
- [x] Core diagnosis pipeline
- [x] Kubernetes log analysis
- [x] GitHub code search
- [x] Slack notifications
- [x] Grafana alerting integration
- [x] RAG for learning

### Phase 2: Enhanced Capabilities
- [ ] Auto-remediation for known issues
- [ ] Multi-cluster Kubernetes support
- [ ] PagerDuty integration
- [ ] Custom runbook execution

### Phase 3: Enterprise Features
- [ ] Role-based access control
- [ ] SSO integration
- [ ] Audit logging
- [ ] Multi-tenant support

### Phase 4: Advanced AI
- [ ] Predictive incident detection
- [ ] Anomaly detection in metrics
- [ ] Natural language querying
- [ ] Self-improving prompts

---

## Frequently Asked Questions

**Q: What if the AI makes a wrong diagnosis?**
A: The AI provides analysis to assist engineers, not replace them. All diagnoses are posted for human review before action.

**Q: How does it handle sensitive data?**
A: Logs stay within your infrastructure. Only summaries are stored in RAG. No data is sent to external services except the LLM API calls.

**Q: Can it work with our existing tools?**
A: Yes, the MCP architecture is extensible. New integrations (Datadog, PagerDuty, Jira) can be added as MCP servers.

**Q: What's the cost of running this?**
A: Main cost is LLM API calls (~$0.01-0.10 per diagnosis). Infrastructure costs are minimal with Docker.

---

## Contact & Support

For questions about this PoC, contact the development team.

---

*Document Version: 1.0 | Last Updated: November 2025*
