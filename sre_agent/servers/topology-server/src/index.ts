#!/usr/bin/env node
/**
 * MCP Server for Topology Discovery via Tempo
 * 
 * This server provides tools to query service dependencies from Grafana Tempo.
 * It extracts topology information from distributed traces to enable
 * intelligent context curation for the SRE agent.
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

const VERSION = "1.0.0";
const TEMPO_URL = process.env.TEMPO_URL || "http://tempo:3200";

// Simple logger
const logger = {
    info: (msg: string, ...args: unknown[]) => console.log(`[INFO] ${msg}`, ...args),
    error: (msg: string, ...args: unknown[]) => console.error(`[ERROR] ${msg}`, ...args),
    debug: (msg: string, ...args: unknown[]) => {
        if (process.env.DEBUG) console.log(`[DEBUG] ${msg}`, ...args);
    },
};

// Schema definitions
const GetServiceDependenciesSchema = z.object({
    service: z.string().describe("Service name to get dependencies for"),
    timeRange: z.string().optional().default("1h").describe("Time range to look back (e.g., '1h', '6h', '24h')"),
});

const GetImpactRadiusSchema = z.object({
    service: z.string().describe("Service name that has an issue"),
    direction: z.enum(["upstream", "downstream", "both"]).optional().default("both")
        .describe("Direction to trace impact: upstream (what this depends on), downstream (what depends on this), or both"),
});

const GetServiceGraphSchema = z.object({
    timeRange: z.string().optional().default("1h").describe("Time range to look back"),
});

// Tempo API client
async function fetchFromTempo(path: string): Promise<unknown> {
    const url = `${TEMPO_URL}${path}`;
    logger.debug(`Fetching from Tempo: ${url}`);

    const response = await fetch(url);
    if (!response.ok) {
        throw new Error(`Tempo API error: ${response.status} ${response.statusText}`);
    }
    return response.json();
}

// Parse time range to duration in seconds
function parseTimeRange(timeRange: string): number {
    const match = timeRange.match(/^(\d+)([hmd])$/);
    if (!match) return 3600; // default 1 hour

    const value = parseInt(match[1], 10);
    const unit = match[2];

    switch (unit) {
        case 'h': return value * 3600;
        case 'd': return value * 86400;
        case 'm': return value * 60;
        default: return 3600;
    }
}

// Get service dependencies from Tempo's service graph
async function getServiceDependencies(service: string, timeRange: string): Promise<string> {
    try {
        const now = Date.now();
        const durationSeconds = parseTimeRange(timeRange);
        const start = now - (durationSeconds * 1000);

        // Query Tempo for traces involving this service
        const searchParams = new URLSearchParams({
            q: `{ resource.service.name="${service}" }`,
            start: Math.floor(start / 1000).toString(),
            end: Math.floor(now / 1000).toString(),
            limit: '100',
        });

        const traces = await fetchFromTempo(`/api/search?${searchParams}`);

        // Extract unique services from traces
        const upstream = new Set<string>();
        const downstream = new Set<string>();

        // If Tempo returns trace data with service relationships
        if (traces && typeof traces === 'object' && 'traces' in traces) {
            const traceList = (traces as { traces: Array<{ spanSets?: Array<{ spans?: Array<{ attributes?: Record<string, string> }> }> }> }).traces || [];

            for (const trace of traceList) {
                // Parse spans to find relationships
                // This is a simplified version - real implementation would trace parent-child relationships
                if (trace.spanSets) {
                    for (const spanSet of trace.spanSets) {
                        for (const span of spanSet.spans || []) {
                            const spanService = span.attributes?.['service.name'];
                            if (spanService && spanService !== service) {
                                // Heuristic: if it appears in same trace, it's related
                                // Real implementation would use parent span IDs
                                downstream.add(spanService);
                            }
                        }
                    }
                }
            }
        }

        // Also try to get service graph metrics if available
        try {
            const metricsPath = `/api/metrics/query?query=traces_service_graph_request_total{client="${service}"}`;
            const clientMetrics = await fetchFromTempo(metricsPath);
            if (clientMetrics && typeof clientMetrics === 'object' && 'data' in clientMetrics) {
                const data = clientMetrics as { data?: { result?: Array<{ metric?: { server?: string } }> } };
                for (const result of data.data?.result || []) {
                    if (result.metric?.server) {
                        upstream.add(result.metric.server);
                    }
                }
            }
        } catch (e) {
            logger.debug("Service graph metrics not available, using trace data only");
        }

        const result = {
            service,
            timeRange,
            upstream: Array.from(upstream),
            downstream: Array.from(downstream),
            totalRelatedServices: upstream.size + downstream.size,
        };

        return JSON.stringify(result, null, 2);
    } catch (error) {
        logger.error("Error getting service dependencies", error);

        // Return mock data for demo purposes if Tempo is not available
        return JSON.stringify({
            service,
            timeRange,
            note: "Demo mode - Tempo not available",
            upstream: ["database", "cache", "auth-service"],
            downstream: ["api-gateway", "frontend"],
            totalRelatedServices: 5,
        }, null, 2);
    }
}

// Get impact radius - all services affected by an issue in this service
async function getImpactRadius(service: string, direction: string): Promise<string> {
    try {
        const now = Date.now();
        const oneHourAgo = now - 3600000;

        const affected: string[] = [];
        const impactPath: string[] = [service];

        // Query Tempo for the service graph
        const searchParams = new URLSearchParams({
            q: `{ resource.service.name="${service}" }`,
            start: Math.floor(oneHourAgo / 1000).toString(),
            end: Math.floor(now / 1000).toString(),
            limit: '100',
        });

        const traces = await fetchFromTempo(`/api/search?${searchParams}`);

        // Extract services from traces
        if (traces && typeof traces === 'object' && 'traces' in traces) {
            const traceList = (traces as { traces: Array<{ spanSets?: Array<{ spans?: Array<{ attributes?: Record<string, string> }> }> }> }).traces || [];

            for (const trace of traceList) {
                if (trace.spanSets) {
                    for (const spanSet of trace.spanSets) {
                        for (const span of spanSet.spans || []) {
                            const spanService = span.attributes?.['service.name'];
                            if (spanService && spanService !== service && !affected.includes(spanService)) {
                                affected.push(spanService);
                            }
                        }
                    }
                }
            }
        }

        const result = {
            service,
            direction,
            affectedServices: affected,
            impactPath: impactPath.concat(affected.slice(0, 3)), // Show first few in path
            totalAffected: affected.length,
            severity: affected.length > 5 ? "HIGH" : affected.length > 2 ? "MEDIUM" : "LOW",
        };

        return JSON.stringify(result, null, 2);
    } catch (error) {
        logger.error("Error getting impact radius", error);

        // Return mock data for demo purposes
        return JSON.stringify({
            service,
            direction,
            note: "Demo mode - Tempo not available",
            affectedServices: ["api-gateway", "frontend", "mobile-app"],
            impactPath: [service, "api-gateway", "frontend"],
            totalAffected: 3,
            severity: "MEDIUM",
        }, null, 2);
    }
}

// Get full service graph
async function getServiceGraph(timeRange: string): Promise<string> {
    try {
        const durationSeconds = parseTimeRange(timeRange);
        const now = Date.now();
        const start = now - (durationSeconds * 1000);

        // Try to get service graph from Tempo
        const searchParams = new URLSearchParams({
            start: Math.floor(start / 1000).toString(),
            end: Math.floor(now / 1000).toString(),
        });

        // Tempo's service graph endpoint (if available)
        const graph = await fetchFromTempo(`/api/search/tags?${searchParams}`);

        // Extract services from available tags
        const services: string[] = [];
        if (graph && typeof graph === 'object' && 'tagNames' in graph) {
            // Parse tag values to find services
            const tagNames = (graph as { tagNames: string[] }).tagNames;
            if (tagNames.includes('service.name')) {
                const serviceValues = await fetchFromTempo(`/api/search/tag/service.name/values?${searchParams}`);
                if (serviceValues && typeof serviceValues === 'object' && 'tagValues' in serviceValues) {
                    services.push(...(serviceValues as { tagValues: string[] }).tagValues);
                }
            }
        }

        const result = {
            timeRange,
            services,
            totalServices: services.length,
            timestamp: new Date().toISOString(),
        };

        return JSON.stringify(result, null, 2);
    } catch (error) {
        logger.error("Error getting service graph", error);

        // Return mock data for demo
        return JSON.stringify({
            timeRange,
            note: "Demo mode - Tempo not available",
            services: ["frontend", "aura-backend", "database", "cache", "api-gateway"],
            edges: [
                { from: "frontend", to: "api-gateway" },
                { from: "api-gateway", to: "aura-backend" },
                { from: "aura-backend", to: "database" },
                { from: "aura-backend", to: "cache" },
            ],
            totalServices: 5,
            timestamp: new Date().toISOString(),
        }, null, 2);
    }
}

// Create MCP server
const server = new Server(
    {
        name: "mcp-server-topology",
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
                name: "get_service_dependencies",
                description: "Get the upstream and downstream dependencies of a service. Use this to understand what services are related to the one experiencing issues.",
                inputSchema: zodToJsonSchema(GetServiceDependenciesSchema),
            },
            {
                name: "get_impact_radius",
                description: "Get all services that would be affected by an issue in the specified service. Helps understand blast radius of failures.",
                inputSchema: zodToJsonSchema(GetImpactRadiusSchema),
            },
            {
                name: "get_service_graph",
                description: "Get the full service dependency graph showing all services and their relationships.",
                inputSchema: zodToJsonSchema(GetServiceGraphSchema),
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
            case "get_service_dependencies": {
                const parsed = GetServiceDependenciesSchema.parse(args);
                const result = await getServiceDependencies(parsed.service, parsed.timeRange);
                return {
                    content: [{ type: "text", text: result }],
                };
            }

            case "get_impact_radius": {
                const parsed = GetImpactRadiusSchema.parse(args);
                const result = await getImpactRadius(parsed.service, parsed.direction);
                return {
                    content: [{ type: "text", text: result }],
                };
            }

            case "get_service_graph": {
                const parsed = GetServiceGraphSchema.parse(args);
                const result = await getServiceGraph(parsed.timeRange);
                return {
                    content: [{ type: "text", text: result }],
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
    logger.info("Starting Topology MCP Server via SSE transport");

    const app = express();
    const transports: { [sessionId: string]: SSEServerTransport } = {};

    // Health check endpoint
    app.get("/health", (_: ExpressRequest, res: ExpressResponse) => {
        res.json({ status: "healthy", service: "mcp-server-topology" });
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
        logger.info(`Topology MCP Server listening on port ${port}`);
        logger.info(`Tempo URL: ${TEMPO_URL}`);
    });
}

runServer().catch((error) => {
    logger.error("Fatal error", { error: error instanceof Error ? error.message : String(error) });
    process.exit(1);
});
