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

interface DiagnoseRequest {
    service: string;
    alertContext?: string;
    slackChannelId?: string;
}

interface DiagnoseResponse {
    success: boolean;
    report?: string;
    messages?: SDKMessage[];
    error?: string;
}

/**
 * Generate the SRE investigation prompt
 */
function buildPrompt(service: string, alertContext: string | undefined, slackChannelId: string | undefined): string {
    return `## 🔍 INCIDENT INVESTIGATION: ${service}

You are an expert SRE investigating a production incident for the \`${service}\` service.

${alertContext ? `### Alert Context\n${alertContext}\n` : ''}

### INVESTIGATION WORKFLOW (Follow these steps IN ORDER):

**STEP 1: GATHER LOGS (Do this ONCE)**
- Call \`get_error_logs\` with service="${service}" to see recent errors
- Review the log output carefully for error patterns

**STEP 2: ANALYZE & FORM HYPOTHESIS**
Based on the logs, identify:
- Error type (database, network, memory, code bug, etc.)
- Error message details
- Affected components

**STEP 3: GENERATE DIAGNOSIS**
Write your analysis in this exact format:

---
## 🧠 Chain of Thought

1. **Initial Observation**: [What the error logs showed]
2. **Hypothesis**: [Your theory about root cause]
3. **Evidence**: [Log entries that support this]
4. **Conclusion**: [Clear statement of root cause]

## 📊 Evidence Table

| Evidence | Source | Finding |
|----------|--------|---------|
| [Log entry] | Loki | [What it indicates] |

## 🎯 Root Cause

**[Clear, specific statement of the root cause]**

Confidence: [X]%

## 📋 Runbook

### Immediate Mitigation
1. [First action to stop the problem]

### Fix Root Cause
2. [Action to fix underlying issue]

### Verify Fix
3. [How to confirm the fix worked]
---

**STEP 4: POST TO SLACK (MANDATORY)**
${slackChannelId ? `Call \`slack_post_message\` with channel: "${slackChannelId}" and your diagnosis` : 'Post your diagnosis to the configured Slack channel'}

**STEP 5: CREATE GITHUB ISSUE (MANDATORY)**
Call \`create_issue\` with:
- title: "[Incident] ${service}: [Root cause summary]"
- body: Your complete diagnosis from Step 3

IMPORTANT: You MUST complete steps 4 and 5 after your analysis. Do not stop early.`;
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

/**
 * Main diagnosis endpoint - called by Python orchestrator
 */
app.post('/diagnose', async (req, res) => {
    const { service, alertContext, slackChannelId }: DiagnoseRequest = req.body;

    if (!service) {
        return res.status(400).json({ success: false, error: 'service is required' });
    }

    console.log(`[Agent Worker] Starting diagnosis for service: ${service}`);

    try {
        const prompt = buildPrompt(service, alertContext, slackChannelId);

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

        console.log('[Agent Worker] Calling Claude Agent SDK...');

        const messages: SDKMessage[] = [];
        let finalContent = '';

        // Iterate over the async generator
        for await (const message of queryGenerator) {
            console.log(`[Agent Worker] Received message type: ${message.type}`);
            messages.push(message);

            // Collect text from assistant messages
            if (message.type === 'assistant') {
                for (const block of message.message.content) {
                    if (block.type === 'text') {
                        finalContent += block.text;
                    }
                }
            }

            // Handle result message
            if (message.type === 'result') {
                console.log(`[Agent Worker] Query completed with subtype: ${message.subtype}`);
            }
        }

        console.log('[Agent Worker] Diagnosis complete');

        const response: DiagnoseResponse = {
            success: true,
            report: finalContent,
            messages,
        };

        return res.json(response);
    } catch (error) {
        console.error('[Agent Worker] Error during diagnosis:', error);
        return res.status(500).json({
            success: false,
            error: error instanceof Error ? error.message : 'Unknown error',
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
    console.log(`[Agent Worker] MCP Servers:`);
    console.log(`  - Loki: ${LOKI_MCP_URL}`);
    console.log(`  - Slack: ${SLACK_MCP_URL}`);
    console.log(`  - GitHub: ${GITHUB_MCP_URL}`);
});
