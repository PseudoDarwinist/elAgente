/**
 * Claude Agent SDK Worker for SRE Agent
 * 
 * This service acts as a bridge between the Python orchestrator and Claude Agent SDK.
 * It uses your Claude Pro subscription (via ~/.claude/ credentials) to power the agent.
 */

import express from 'express';
import cors from 'cors';
import { query, type SDKMessage, type SDKResultMessage, type McpServerConfig } from '@anthropic-ai/claude-agent-sdk';

const app = express();
app.use(cors());
app.use(express.json());

const PORT = process.env.PORT || 3005;

// Environment variables for MCP server URLs (inside Docker network)
const LOKI_MCP_URL = process.env.LOKI_MCP_URL || 'http://loki-mcp:3001/sse';
const SLACK_MCP_URL = process.env.SLACK_MCP_URL || 'http://slack:3001/sse';
const GITHUB_MCP_URL = process.env.GITHUB_MCP_URL || 'http://github:3001/sse';
const TOPOLOGY_MCP_URL = process.env.TOPOLOGY_MCP_URL || 'http://topology-mcp:3001/sse';
const PROMETHEUS_MCP_URL = process.env.PROMETHEUS_MCP_URL || 'http://prometheus-mcp:3001/sse';

// GitHub repo configuration for issue creation
const GITHUB_OWNER = process.env.GITHUB_ORGANISATION || 'PseudoDarwinist';
const GITHUB_REPO = process.env.GITHUB_REPO_NAME || 'elAgente';

interface DiagnoseRequest {
    service: string;
    alertContext?: string;
    slackChannelId?: string;
}

interface DiagnoseResponse {
    success: boolean;
    report?: string;
    messages?: SDKMessage[];
    events?: DiagnoseEvent[];
    error?: string;
}

/**
 * Generate the SRE investigation prompt
 */
function buildPrompt(service: string, alertContext: string | undefined, slackChannelId: string | undefined): string {
    return `## 🔍 TOPOLOGY-AWARE INCIDENT INVESTIGATION: ${service}

You are an expert SRE investigating a production incident for the \`${service}\` service.
You have access to topology discovery, metrics, and log tools to perform INTELLIGENT context curation.

${alertContext ? `### Alert Context\n${alertContext}\n` : ''}

### INVESTIGATION WORKFLOW (Follow these steps IN ORDER):

**STEP 1: DISCOVER TOPOLOGY (Do this FIRST)**
- Call \`get_service_dependencies\` with service="${service}" to find related services
- Call \`get_impact_radius\` with service="${service}" to understand blast radius
- Note the upstream and downstream services - you will check ONLY these

**STEP 2: CHECK SERVICE HEALTH (For affected services)**
For each service in the impact radius:
- Call \`get_service_health\` to check error rates, latency, throughput
- Call \`check_anomalies\` to detect deviations from baseline
- This tells you WHY services are failing (CPU, memory, etc.)

**STEP 3: GATHER TARGETED LOGS (Only related services)**
- Call \`get_error_logs\` ONLY for services identified in Step 1
- Do NOT query logs for unrelated services
- This is CURATED context, not a fire hose

**STEP 4: BUILD FAULT PROPAGATION CHAIN**
Based on topology and health data, identify:
- Origin of the failure (root cause service)
- Propagation path (how failure cascaded)
- Affected downstream services

**STEP 5: GENERATE DIAGNOSIS**
Write your analysis in this exact JSON format (for the dashboard to parse):

\`\`\`json
{
  "faultPropagation": {
    "impactPath": ["service1", "service2", "root-cause-service"],
    "direction": "downstream",
    "rootCauseService": "service-name"
  },
  "investigation": [
    {
      "service": "service-name",
      "status": "CRITICAL|DEGRADED|HEALTHY",
      "findings": ["finding 1", "finding 2"],
      "evidence": ["log entry", "metric value"]
    }
  ],
  "diagnosis": {
    "rootCause": "Clear statement of root cause",
    "confidence": 85,
    "evidence": ["evidence 1", "evidence 2"]
  },
  "runbook": [
    {
      "step": 1,
      "action": "Immediate mitigation",
      "command": "optional shell command"
    }
  ]
}
\`\`\`

ALSO write a human-readable summary:

---
## 🗺️ Fault Propagation Chain
[Visual representation: service1 → service2 → ROOT CAUSE●]

## 🔬 Investigation Findings
| Service | Status | Key Finding |
|---------|--------|-------------|
| [name]  | [status] | [finding] |

## 🎯 Root Cause
**[Clear statement]** (Confidence: X%)

## 📋 Runbook
1. [Immediate action]
2. [Fix root cause]
3. [Verification]
---

**STEP 6: POST TO SLACK (MANDATORY)**
${slackChannelId ? `Call \`slack_post_message\` with channel: "${slackChannelId}" and your diagnosis` : 'Post your diagnosis to the configured Slack channel'}

**STEP 7: CREATE GITHUB ISSUE (MANDATORY)**
Call \`create_issue\` with EXACTLY these parameters:
- owner: "${GITHUB_OWNER}"
- repo: "${GITHUB_REPO}"
- title: "[Incident] ${service}: [Root cause summary]"
- body: Your complete diagnosis

IMPORTANT: You MUST complete steps 6 and 7. Do not stop early.`;
}

/**
 * Build MCP server configurations
 */
function buildMcpServers(): Record<string, McpServerConfig> {
    return {
        'loki-mcp': {
            type: 'sse',
            url: LOKI_MCP_URL,
        },
        'topology-mcp': {
            type: 'sse',
            url: TOPOLOGY_MCP_URL,
        },
        'prometheus-mcp': {
            type: 'sse',
            url: PROMETHEUS_MCP_URL,
        },
        'slack': {
            type: 'sse',
            url: SLACK_MCP_URL,
        },
        'github': {
            type: 'sse',
            url: GITHUB_MCP_URL,
        },
    };
}

interface DiagnoseEvent {
    event_type: string;
    timestamp: number;
    data: Record<string, unknown>;
}

/**
 * Main diagnosis endpoint - called by Python orchestrator
 */
app.post('/diagnose', async (req, res) => {
    const { service, alertContext, slackChannelId }: DiagnoseRequest = req.body;

    if (!service) {
        return res.status(400).json({ success: false, error: 'service is required' });
    }

    console.log(`[Agent Worker] Starting diagnosis for service: ${service}`);

    const events: DiagnoseEvent[] = [];
    const emitEvent = (type: string, data: Record<string, unknown>) => {
        const event: DiagnoseEvent = {
            event_type: type,
            timestamp: Date.now(),
            data
        };
        events.push(event);
        console.log(`[Agent Worker] Event: ${type} - ${JSON.stringify(data).slice(0, 100)}`);
    };

    try {
        const prompt = buildPrompt(service, alertContext, slackChannelId);

        emitEvent('connecting_servers', { message: 'Connecting to MCP servers (Topology, Prometheus, Loki, Slack, GitHub)...' });

        // Use Claude Agent SDK with native MCP support
        // query() returns an AsyncGenerator<SDKMessage>
        const queryGenerator = query({
            prompt,
            options: {
                mcpServers: buildMcpServers(),
                permissionMode: 'bypassPermissions',
                allowDangerouslySkipPermissions: true, // Required for automation
            },
        });

        console.log('[Agent Worker] Calling Claude Agent SDK with topology-aware diagnosis...');
        emitEvent('servers_connected', {
            message: 'Connected to all MCP servers',
            servers: ['topology-mcp', 'prometheus-mcp', 'loki-mcp', 'slack', 'github']
        });

        const messages: SDKMessage[] = [];
        let finalContent = '';
        let toolCallCount = 0;

        // Iterate over the async generator
        for await (const message of queryGenerator) {
            console.log(`[Agent Worker] Received message type: ${message.type}`);
            messages.push(message);

            // Emit events for different message types
            if (message.type === 'assistant') {
                // Check for tool use blocks
                for (const block of message.message.content) {
                    if (block.type === 'text') {
                        finalContent += block.text;
                        // Emit thinking/analysis event for text content
                        if (block.text.length > 50) {
                            emitEvent('llm_response', {
                                message: 'Claude analyzing logs and forming hypothesis...',
                                preview: block.text.slice(0, 200) + '...'
                            });
                        }
                    } else if (block.type === 'tool_use') {
                        toolCallCount++;
                        emitEvent('tool_call', {
                            tool: block.name,
                            args: block.input,
                            message: `Calling tool: ${block.name}`
                        });
                    }
                }
            }

            // Handle tool results
            if (message.type === 'user') {
                for (const block of (message as { message: { content: Array<{ type: string; content?: string; tool_use_id?: string }> } }).message.content) {
                    if (block.type === 'tool_result') {
                        const preview = typeof block.content === 'string' ? block.content.slice(0, 2000) : '';
                        emitEvent('tool_result', {
                            tool_use_id: block.tool_use_id,
                            message: `Tool completed`,
                            preview: preview + (preview.length >= 2000 ? '...' : ''),
                            is_error: false
                        });
                    }
                }
            }

            // Handle result message
            if (message.type === 'result') {
                console.log(`[Agent Worker] Query completed with subtype: ${(message as SDKResultMessage).subtype}`);
                emitEvent('analysis_complete', {
                    message: 'Analysis complete, posting to Slack and creating GitHub issue...',
                    tool_calls: toolCallCount
                });
            }
        }

        console.log('[Agent Worker] Diagnosis complete');

        emitEvent('complete', {
            status: 'success',
            message: 'Diagnosis completed successfully',
            response: finalContent.slice(0, 10000)
        });

        const response: DiagnoseResponse = {
            success: true,
            report: finalContent,
            messages,
            events, // Include events for dashboard
        };

        return res.json(response);
    } catch (error) {
        console.error('[Agent Worker] Error during diagnosis:', error);

        emitEvent('error', {
            message: error instanceof Error ? error.message : 'Unknown error'
        });

        return res.status(500).json({
            success: false,
            error: error instanceof Error ? error.message : 'Unknown error',
            events,
        });
    }
});


/**
 * Health check endpoint
 */
app.get('/health', (_req, res) => {
    res.json({ status: 'ok', version: '1.0.0' });
});

/**
 * Generate endpoint - Compatible interface for the Python orchestrator
 * This allows the Python orchestrator to call this as a drop-in replacement
 */
app.post('/generate', async (req, res) => {
    const { messages, tools } = req.body;

    if (!messages || !Array.isArray(messages)) {
        return res.status(400).json({ error: 'messages array is required' });
    }

    try {
        // Extract the last user message as the prompt
        const userMessages = messages.filter((m: { role: string }) => m.role === 'user');
        const lastUserMessage = userMessages[userMessages.length - 1];

        let prompt = '';
        if (typeof lastUserMessage?.content === 'string') {
            prompt = lastUserMessage.content;
        } else if (Array.isArray(lastUserMessage?.content)) {
            const textContent = lastUserMessage.content.find((c: { type: string }) => c.type === 'text');
            prompt = textContent?.text || '';
        }

        if (!prompt) {
            return res.status(400).json({ error: 'No user message found' });
        }

        console.log('[Agent Worker] /generate called, using Claude Agent SDK');

        const queryGenerator = query({
            prompt,
            options: {
                mcpServers: buildMcpServers(),
                permissionMode: 'bypassPermissions',
                allowDangerouslySkipPermissions: true,
            },
        });

        let finalContent = '';
        let usageInputTokens = 0;
        let usageOutputTokens = 0;

        for await (const message of queryGenerator) {
            if (message.type === 'assistant') {
                for (const block of message.message.content) {
                    if (block.type === 'text') {
                        finalContent += block.text;
                    }
                }
            }

            // Collect usage stats
            if (message.type === 'result') {
                usageInputTokens = (message as SDKResultMessage).usage?.inputTokens || 0;
                usageOutputTokens = (message as SDKResultMessage).usage?.outputTokens || 0;
            }
        }

        // Convert to format expected by Python orchestrator
        const response = {
            content: [
                {
                    type: 'text',
                    text: finalContent,
                },
            ],
            stop_reason: 'end_turn', // SDK completes the full agent loop
            usage: {
                input_tokens: usageInputTokens,
                output_tokens: usageOutputTokens,
            },
        };

        return res.json(response);
    } catch (error) {
        console.error('[Agent Worker] Error in /generate:', error);
        return res.status(500).json({
            error: error instanceof Error ? error.message : 'Unknown error',
        });
    }
});

app.listen(PORT, () => {
    console.log(`[Agent Worker] Claude Agent SDK worker listening on port ${PORT}`);
    console.log(`[Agent Worker] MCP Servers (Topology-Aware):`);
    console.log(`  - Topology: ${TOPOLOGY_MCP_URL}`);
    console.log(`  - Prometheus: ${PROMETHEUS_MCP_URL}`);
    console.log(`  - Loki: ${LOKI_MCP_URL}`);
    console.log(`  - Slack: ${SLACK_MCP_URL}`);
    console.log(`  - GitHub: ${GITHUB_MCP_URL}`);
});
