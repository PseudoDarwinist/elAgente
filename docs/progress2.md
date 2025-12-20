# SRE Agent - Topology-Aware Production Upgrade

> **Purpose**: Complete context for building production-grade topology-aware SRE agent
> **Created**: 2025-12-09
> **Branch**: `feature/topology-aware-agent` ← CREATE THIS BRANCH BEFORE STARTING

---

## 🎯 Vision

Transform el Agénte from a log-fetching tool into an **Instana-inspired production-grade SRE system** with:

1. **Automatic topology discovery** via distributed tracing
2. **Intelligent context curation** - query only relevant services, not fire hose
3. **Fault propagation visualization** - show impact path in UI
4. **MELT integration** - Metrics, Events, Logs, Traces (not just logs)

---

## 🧠 Core Insight: Context Curation via Topology

> *"If you pipe that fire hose straight into the LLM...welcome to hallucination city."*
> — GAP_ANALYSIS.md

**Current (Bad):**
```
Alert → Get logs for ONE service → Send to LLM → Hope for the best
```

**Target (Topology-Aware):**
```
Alert: "auth-service errors"
    ↓
Query Tempo: "What does auth-service depend on?"
    ↓
Returns: upstream=[user-db, redis], downstream=[api-gateway]
    ↓
Query Loki: ONLY logs from these 4 services (not 20 others)
Query Prometheus: ONLY metrics from these 4 services
    ↓
Curated context to LLM → Accurate diagnosis
```

---

## 🏗️ New Architecture

```
┌─────────────────────────────────────────────────────────────────────────┐
│                         YOUR APPLICATIONS                                │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐                 │
│  │ Frontend │  │ Backend  │  │ Database │  │  Cache   │                 │
│  └────┬─────┘  └────┬─────┘  └────┬─────┘  └────┬─────┘                 │
│       └──────────────┴──────────────┴──────────────┘                     │
│                        OpenTelemetry                                     │
│                   (auto-instrumentation)                                 │
└─────────────────────────────────────────────────────────────────────────┘
                                  │
         ┌────────────────────────┼────────────────────────┐
         ▼                        ▼                        ▼
┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐
│      LOKI       │     │     TEMPO       │     │   PROMETHEUS    │
│     (Logs)      │     │    (Traces)     │     │   (Metrics)     │
│  "what happened"│     │  "who calls who"│     │  "why it failed"│
│   ✅ HAVE       │     │   🆕 ADD        │     │   🆕 ADD        │
└────────┬────────┘     └────────┬────────┘     └────────┬────────┘
         │                       │                       │
         └───────────────────────┼───────────────────────┘
                                 ▼
               ┌─────────────────────────────────┐
               │         SRE AGENT               │
               │  ┌───────────────────────────┐  │
               │  │  1. Receive alert         │  │
               │  │  2. Query TOPOLOGY (Tempo)│  │
               │  │  3. Get RELATED services  │  │
               │  │  4. Query ONLY those      │  │
               │  │  5. Curated context → LLM │  │
               │  │  6. Report + remediation  │  │
               │  └───────────────────────────┘  │
               └─────────────────────────────────┘
```

---

## 📦 What We're Adding

### Infrastructure (Docker Compose)

| Component | Purpose | Port |
|-----------|---------|------|
| **Tempo** | Collect traces, build service graph | 3200 (API), 4317 (OTLP) |
| **Prometheus** | Collect metrics (CPU, memory, latency) | 9090 |

### MCP Servers (New)

| Server | Purpose | Tools |
|--------|---------|-------|
| **topology-server** | Query Tempo for dependencies | `get_service_dependencies`, `get_impact_radius` |
| **prometheus-server** | Query Prometheus for metrics | `get_service_health`, `check_anomalies` |

### App Changes

| Change | Purpose |
|--------|---------|
| Add OpenTelemetry to demo apps | Auto-instrument HTTP, DB calls |

### UI Components (Dashboard)

| Component | Purpose |
|-----------|---------|
| **FaultPropagationChain** | Horizontal impact path visualization |
| **ServiceDependencyGraph** | Interactive node graph |
| **InvestigationLog** | Structured findings with evidence |
| **DiagnosisPanel** | Root cause + confidence + runbook |

---

## 📋 Implementation Phases

### Phase 1: Observability Stack ✅ COMPLETE
- [x] Add Tempo to docker-compose
- [x] Add Prometheus to docker-compose
- [x] Add OpenTelemetry to aura-backend (Node.js)
- [ ] Add OpenTelemetry to aura-frontend (optional)
- [x] Configure Grafana datasources for Tempo + Prometheus
- [ ] Verify traces appear in Grafana (manual testing)

### Phase 2: Topology-Aware Agent ✅ COMPLETE
- [x] Create `sre_agent/servers/topology-server/` (TypeScript MCP)
- [x] Create `sre_agent/servers/prometheus-server/` (TypeScript MCP)
- [x] Update `compose.local.yaml` with new MCP servers
- [x] Modify agent diagnosis flow to query topology first
- [x] Update prompt to include topology context

### Phase 3: Dashboard UI ✅ COMPLETE
- [x] Create `FaultPropagationChain.tsx` component
- [x] Create `ServiceDependencyGraph.tsx` component
- [x] Create `InvestigationLogNew.tsx` component
- [x] Create `HypothesisPanel.tsx` component
- [x] Update `page.tsx` layout
- [x] Add new SSE event handlers

### Phase 4: Integration 🔄 IN PROGRESS
- [x] Add SSE events for topology (parsing in page.tsx)
- [ ] Update agent-worker to emit structured diagnosis
- [ ] End-to-end testing
- [ ] Update theme to minimalist neo-brutalism

**Total: ~17-22 hours**

---

## 🔑 Key Decisions Made

### Decision: Use Tempo for Topology Discovery
**Why**: 
- Automatic - no manual config file maintenance
- Real - based on actual traffic, not guesses
- Grafana-native - integrates with existing stack

**Alternatives Rejected**:
- Manual config file (gets stale)
- API endpoints on each service (requires code in every app)
- Kubernetes labels (user doesn't use K8s)

### Decision: Use Prometheus for Metrics
**Why**:
- Logs show "what", metrics show "why" (CPU at 99%, memory exhausted)
- Standard solution, works with Grafana
- OpenTelemetry can export to both Tempo AND Prometheus

### Decision: Minimalist Neo-Brutalism UI
**Why**:
- Keep brand identity ("el Agénte" character)
- But production-grade (cleaner, less playful)
- 2px borders instead of 4px, subtle shadows

---

## 🔄 Agent Diagnosis Flow (New)

```python
async def diagnose(alert: Alert):
    # 1. Get alert details
    service = alert.service  # e.g., "auth-service"
    
    # 2. Query topology (NEW!)
    related = await topology_server.get_service_dependencies(service)
    # Returns: {upstream: ["user-db", "redis"], downstream: ["api-gateway"]}
    
    # 3. Query ONLY relevant services (CURATED!)
    services_to_check = [service] + related.upstream + related.downstream
    
    context = []
    for svc in services_to_check:
        logs = await loki.get_error_logs(svc)          # What happened
        health = await prometheus.get_service_health(svc)  # Why it failed
        context.append({svc: {logs, health}})
    
    # 4. Send curated context to LLM
    diagnosis = await llm.analyze(context)
    
    # 5. LLM returns structured output
    # - faultPropagationChain: [api-gateway → auth-service → user-db●]
    # - rootCause: {service: "user-db", issue: "connection pool", confidence: 92%}
    # - runbook: [step1, step2, step3]
```

---

## 📊 SSE Events (New Types)

| Event | Data | UI Updates |
|-------|------|------------|
| `topology_discovered` | `{upstream: [], downstream: [], impactPath: []}` | Fault propagation chain |
| `service_health` | `{service, cpu, memory, errorRate, status}` | Service map coloring |
| `investigation_finding` | `{service, status, title, evidence[]}` | Investigation log |
| `diagnosis_complete` | `{rootCause, confidence, evidence[], runbook[]}` | Diagnosis panel |

---

## 📁 New Files to Create

```
sre-agent/
├── sre_agent/servers/
│   ├── topology-server/          # 🆕 Tempo MCP
│   │   ├── package.json
│   │   ├── tsconfig.json
│   │   ├── src/index.ts
│   │   └── Dockerfile
│   └── prometheus-server/        # 🆕 Prometheus MCP
│       ├── package.json
│       ├── tsconfig.json
│       ├── src/index.ts
│       └── Dockerfile
├── observability/
│   ├── tempo/                    # 🆕 Tempo config
│   │   └── tempo.yaml
│   └── prometheus/               # 🆕 Prometheus config
│       └── prometheus.yaml
├── aura-quiet-living/
│   └── backend/
│       └── tracing.js            # 🆕 OpenTelemetry setup
└── sre-dashboard/src/app/components/
    ├── FaultPropagationChain.tsx # 🆕
    ├── ServiceDependencyGraph.tsx # 🆕
    ├── InvestigationLog.tsx      # 🆕
    └── HypothesisPanel.tsx       # 🆕
```

---

## 🚀 Getting Started (New Session)

```bash
# 1. Create new branch
git checkout -b feature/topology-aware-agent

# 2. Start current stack (verify baseline works)
docker compose -f compose.local.yaml up -d

# 3. Start agent-worker locally
cd sre_agent/agent-worker
LOKI_MCP_URL=http://localhost:3103/sse \
SLACK_MCP_URL=http://localhost:3101/sse \
GITHUB_MCP_URL=http://localhost:3102/sse \
PORT=3005 npx tsx src/index.ts

# 4. Start dashboard
cd sre-dashboard && npm run dev

# 5. Verify demo flow still works before adding new features
```

---

## 📝 Reference Documents

| Document | Location |
|----------|----------|
| Full Implementation Plan | `~/.gemini/antigravity/brain/.../implementation_plan.md` |
| Gap Analysis | `docs/GAP_ANALYSIS.md` |
| Current Architecture | `docs/ARCHITECTURE.md` |
| Previous Progress | `docs/progress.md` |

---

## ✅ Verification Checklist

Before considering this complete:

- [ ] Tempo receives traces from apps
- [ ] Prometheus scrapes metrics from apps
- [ ] Agent queries topology before investigation
- [ ] Agent queries ONLY related services (not all)
- [ ] Dashboard shows fault propagation chain
- [ ] Dashboard shows service dependency graph
- [ ] Root cause identified with confidence
- [ ] Runbook generated
- [ ] Full flow: Alert → Curated investigation → Report

---

**Last Updated**: 2025-12-09T13:00:00+05:30
**Status**: Plan approved, ready for implementation
