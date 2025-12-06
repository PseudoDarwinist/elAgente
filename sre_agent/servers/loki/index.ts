#!/usr/bin/env node
/**
 * MCP Server for Loki Log Queries
 * 
 * This server provides tools to query logs from Grafana Loki via the MCP protocol.
 * It replaces the Kubernetes MCP for environments using file-based logging with Loki.
 */

import express, {
    Request as ExpressRequest,
    Response as ExpressResponse,
} from "express";
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { SSEServerTransport } from "@modelcontextprotocol/sdk/server/sse.js";
import {
    CallToolRequestSchema,
    ListToolsRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";
import { z } from "zod";
import { zodToJsonSchema } from "zod-to-json-schema";

import * as logs from "./operations/logs.js";

const VERSION = "1.0.0";

// Simple logger
const logger = {
    info: (msg: string, ...args: unknown[]) => console.log(`[INFO] ${msg}`, ...args),
    error: (msg: string, ...args: unknown[]) => console.error(`[ERROR] ${msg}`, ...args),
    debug: (msg: string, ...args: unknown[]) => {
        if (process.env.DEBUG) console.log(`[DEBUG] ${msg}`, ...args);
    },
};

const server = new Server(
    {
        name: "mcp-server-loki",
        version: VERSION,
    },
    {
        capabilities: {
            tools: {},
        },
    },
);

// Register available tools
server.setRequestHandler(ListToolsRequestSchema, async () => {
    logger.debug("Received ListToolsRequest");
    return {
        tools: [
            {
                name: "query_logs",
                description: "Query logs from Loki using LogQL. Use this for custom log queries.",
                inputSchema: zodToJsonSchema(logs.QueryLogsSchema),
            },
            {
                name: "query_logs_by_service",
                description: "Query logs for a specific service. Simpler than raw LogQL for common use cases.",
                inputSchema: zodToJsonSchema(logs.QueryLogsByServiceSchema),
            },
            {
                name: "get_error_logs",
                description: "Get error-level logs for a service. Quick way to find errors.",
                inputSchema: zodToJsonSchema(z.object({
                    service: z.string().describe("Service name"),
                    limit: z.number().optional().default(50).describe("Max logs to return"),
                    since_minutes: z.number().optional().default(60).describe("Look back minutes"),
                })),
            },
            {
                name: "get_available_services",
                description: "List all services that have logs in Loki",
                inputSchema: zodToJsonSchema(z.object({})),
            },
            {
                name: "get_log_labels",
                description: "Get all available log labels (e.g., service, level, job)",
                inputSchema: zodToJsonSchema(logs.GetLabelsSchema),
            },
        ],
    };
});

// Handle tool calls
server.setRequestHandler(CallToolRequestSchema, async (request) => {
    logger.debug("Received CallToolRequest", { tool: request.params.name });

    try {
        const args = request.params.arguments || {};

        switch (request.params.name) {
            case "query_logs": {
                const parsed = logs.QueryLogsSchema.parse(args);
                const result = await logs.queryLogs(
                    parsed.query,
                    parsed.limit,
                    parsed.start,
                    parsed.end
                );
                return {
                    content: [{ type: "text", text: result }],
                };
            }

            case "query_logs_by_service": {
                const parsed = logs.QueryLogsByServiceSchema.parse(args);
                const result = await logs.queryLogsByService(
                    parsed.service,
                    parsed.level,
                    parsed.limit,
                    parsed.since_minutes
                );
                return {
                    content: [{ type: "text", text: result }],
                };
            }

            case "get_error_logs": {
                const schema = z.object({
                    service: z.string(),
                    limit: z.number().optional().default(50),
                    since_minutes: z.number().optional().default(60),
                });
                const parsed = schema.parse(args);
                const result = await logs.getErrorLogs(
                    parsed.service,
                    parsed.limit,
                    parsed.since_minutes
                );
                return {
                    content: [{ type: "text", text: result }],
                };
            }

            case "get_available_services": {
                const services = await logs.getLabelValues("service");
                return {
                    content: [{
                        type: "text",
                        text: services.length > 0
                            ? `Available services: ${services.join(", ")}`
                            : "No services found in Loki. Make sure logs are being shipped."
                    }],
                };
            }

            case "get_log_labels": {
                const parsed = logs.GetLabelsSchema.parse(args);
                const labels = await logs.getLabels(parsed.start, parsed.end);
                return {
                    content: [{
                        type: "text",
                        text: `Available labels: ${labels.join(", ")}`
                    }],
                };
            }

            default:
                throw new Error(`Unknown tool: ${request.params.name}`);
        }
    } catch (error) {
        if (error instanceof z.ZodError) {
            return {
                content: [{ type: "text", text: `Invalid input: ${JSON.stringify(error.errors)}` }],
                isError: true,
            };
        }
        if (error instanceof Error) {
            return {
                content: [{ type: "text", text: `Error: ${error.message}` }],
                isError: true,
            };
        }
        throw error;
    }
});

async function runServer() {
    logger.info("Starting Loki MCP Server via SSE transport");

    const app = express();
    const transports: { [sessionId: string]: SSEServerTransport } = {};

    // Health check endpoint
    app.get("/health", (_: ExpressRequest, res: ExpressResponse) => {
        res.json({ status: "healthy", service: "mcp-server-loki" });
    });

    // SSE endpoint for MCP connections
    app.get("/sse", async (_: ExpressRequest, res: ExpressResponse) => {
        logger.info("New SSE connection");
        const transport = new SSEServerTransport("/messages", res);
        transports[transport.sessionId] = transport;

        res.on("close", () => {
            logger.info("SSE connection closed", { sessionId: transport.sessionId });
            delete transports[transport.sessionId];
        });

        await server.connect(transport);
    });

    // Message handling endpoint
    app.post("/messages", async (req: ExpressRequest, res: ExpressResponse) => {
        const sessionId = req.query.sessionId as string;
        const transport = transports[sessionId];

        if (transport) {
            await transport.handlePostMessage(req, res);
        } else {
            res.status(400).json({ error: "No transport found for sessionId" });
        }
    });

    const port = process.env.PORT || 3001;
    app.listen(port, () => {
        logger.info(`Loki MCP Server listening on port ${port}`);
        logger.info(`Loki URL: ${process.env.LOKI_URL || "http://loki:3100"}`);
    });
}

runServer().catch((error) => {
    logger.error("Fatal error", { error: error instanceof Error ? error.message : String(error) });
    process.exit(1);
});
