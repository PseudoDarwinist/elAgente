#!/usr/bin/env node
/**
 * MCP Server for Prometheus Metrics
 * 
 * This server provides tools to query service health metrics from Prometheus.
 * It complements the Loki logs with "why" information (CPU, memory, error rates).
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
const PROMETHEUS_URL = process.env.PROMETHEUS_URL || "http://prometheus:9090";

// Simple logger
const logger = {
    info: (msg: string, ...args: unknown[]) => console.log(`[INFO] ${msg}`, ...args),
    error: (msg: string, ...args: unknown[]) => console.error(`[ERROR] ${msg}`, ...args),
    debug: (msg: string, ...args: unknown[]) => {
        if (process.env.DEBUG) console.log(`[DEBUG] ${msg}`, ...args);
    },
};

// Schema definitions
const GetServiceHealthSchema = z.object({
    service: z.string().describe("Service name to check health for"),
    timeRange: z.string().optional().default("5m").describe("Time range for metrics (e.g., '5m', '1h')"),
});

const GetResourceUsageSchema = z.object({
    service: z.string().describe("Service name"),
    metric: z.enum(["cpu", "memory", "all"]).optional().default("all").describe("Type of resource metrics"),
    timeRange: z.string().optional().default("1h").describe("Time range for metrics"),
});

const CheckAnomaliesSchema = z.object({
    service: z.string().describe("Service name to check for anomalies"),
    threshold: z.number().optional().default(2).describe("Standard deviations from baseline to consider anomalous"),
});

const QueryPrometheusSchema = z.object({
    query: z.string().describe("PromQL query to execute"),
    time: z.string().optional().describe("Evaluation timestamp (RFC3339 or Unix)"),
});

// Prometheus query client
async function queryPrometheus(query: string, time?: string): Promise<unknown> {
    const params = new URLSearchParams({ query });
    if (time) params.set("time", time);

    const url = `${PROMETHEUS_URL}/api/v1/query?${params}`;
    logger.debug(`Querying Prometheus: ${url}`);

    const response = await fetch(url);
    if (!response.ok) {
        throw new Error(`Prometheus API error: ${response.status} ${response.statusText}`);
    }
    return response.json();
}

async function queryPrometheusRange(query: string, start: number, end: number, step: string): Promise<unknown> {
    const params = new URLSearchParams({
        query,
        start: start.toString(),
        end: end.toString(),
        step,
    });

    const url = `${PROMETHEUS_URL}/api/v1/query_range?${params}`;
    logger.debug(`Querying Prometheus range: ${url}`);

    const response = await fetch(url);
    if (!response.ok) {
        throw new Error(`Prometheus API error: ${response.status} ${response.statusText}`);
    }
    return response.json();
}

// Parse time range to seconds
function parseTimeRange(timeRange: string): number {
    const match = timeRange.match(/^(\d+)([smhd])$/);
    if (!match) return 300; // default 5 minutes

    const value = parseInt(match[1], 10);
    const unit = match[2];

    switch (unit) {
        case 's': return value;
        case 'm': return value * 60;
        case 'h': return value * 3600;
        case 'd': return value * 86400;
        default: return 300;
    }
}

// Get comprehensive service health
async function getServiceHealth(service: string, timeRange: string): Promise<string> {
    try {
        const now = Math.floor(Date.now() / 1000);
        const range = parseTimeRange(timeRange);
        const start = now - range;

        // Query various health metrics
        const metrics = {
            // HTTP error rate
            errorRate: await queryPrometheus(
                `sum(rate(traces_spanmetrics_calls_total{service_name="${service}", status_code=~"5.."}[${timeRange}])) / sum(rate(traces_spanmetrics_calls_total{service_name="${service}"}[${timeRange}])) * 100`
            ),
            // Request latency (p95)
            latencyP95: await queryPrometheus(
                `histogram_quantile(0.95, sum(rate(traces_spanmetrics_latency_bucket{service_name="${service}"}[${timeRange}])) by (le))`
            ),
            // Request rate (throughput)
            requestRate: await queryPrometheus(
                `sum(rate(traces_spanmetrics_calls_total{service_name="${service}"}[${timeRange}]))`
            ),
        };

        // Extract values from Prometheus response
        const extractValue = (result: unknown): number | null => {
            try {
                const data = result as { data?: { result?: Array<{ value?: [number, string] }> } };
                const value = data.data?.result?.[0]?.value?.[1];
                return value ? parseFloat(value) : null;
            } catch {
                return null;
            }
        };

        const errorRate = extractValue(metrics.errorRate);
        const latencyP95 = extractValue(metrics.latencyP95);
        const requestRate = extractValue(metrics.requestRate);

        // Determine health status
        let status = "HEALTHY";
        const issues: string[] = [];

        if (errorRate !== null && errorRate > 1) {
            status = errorRate > 5 ? "CRITICAL" : "DEGRADED";
            issues.push(`Error rate: ${errorRate.toFixed(2)}%`);
        }

        if (latencyP95 !== null && latencyP95 > 1000) {
            if (status === "HEALTHY") status = "DEGRADED";
            if (latencyP95 > 5000) status = "CRITICAL";
            issues.push(`P95 latency: ${latencyP95.toFixed(0)}ms`);
        }

        const result = {
            service,
            timeRange,
            timestamp: new Date().toISOString(),
            status,
            metrics: {
                errorRate: errorRate !== null ? `${errorRate.toFixed(2)}%` : "N/A",
                latencyP95: latencyP95 !== null ? `${latencyP95.toFixed(0)}ms` : "N/A",
                requestRate: requestRate !== null ? `${requestRate.toFixed(2)} req/s` : "N/A",
            },
            issues: issues.length > 0 ? issues : ["No issues detected"],
        };

        return JSON.stringify(result, null, 2);
    } catch (error) {
        logger.error("Error getting service health", error);

        // Return mock data for demo
        return JSON.stringify({
            service,
            timeRange,
            note: "Demo mode - Prometheus not available or no metrics",
            status: "UNKNOWN",
            metrics: {
                errorRate: "N/A",
                latencyP95: "N/A",
                requestRate: "N/A",
            },
            issues: ["Unable to query metrics - Prometheus may not have data for this service yet"],
        }, null, 2);
    }
}

// Get resource usage (CPU, memory)
async function getResourceUsage(service: string, metric: string, timeRange: string): Promise<string> {
    try {
        const queries: Record<string, string> = {
            cpu: `100 - (avg by(instance) (rate(node_cpu_seconds_total{mode="idle", job="${service}"}[${timeRange}])) * 100)`,
            memory: `100 * (1 - (node_memory_MemAvailable_bytes{job="${service}"} / node_memory_MemTotal_bytes{job="${service}"}))`,
        };

        const results: Record<string, unknown> = {};

        if (metric === "all" || metric === "cpu") {
            results.cpu = await queryPrometheus(queries.cpu);
        }
        if (metric === "all" || metric === "memory") {
            results.memory = await queryPrometheus(queries.memory);
        }

        // Extract values
        const extractValue = (result: unknown): number | null => {
            try {
                const data = result as { data?: { result?: Array<{ value?: [number, string] }> } };
                const value = data.data?.result?.[0]?.value?.[1];
                return value ? parseFloat(value) : null;
            } catch {
                return null;
            }
        };

        const cpuUsage = results.cpu ? extractValue(results.cpu) : null;
        const memUsage = results.memory ? extractValue(results.memory) : null;

        const result = {
            service,
            timeRange,
            timestamp: new Date().toISOString(),
            resources: {
                cpu: cpuUsage !== null ? `${cpuUsage.toFixed(1)}%` : "N/A",
                memory: memUsage !== null ? `${memUsage.toFixed(1)}%` : "N/A",
            },
            status: (cpuUsage && cpuUsage > 80) || (memUsage && memUsage > 80) ? "HIGH_USAGE" : "NORMAL",
        };

        return JSON.stringify(result, null, 2);
    } catch (error) {
        logger.error("Error getting resource usage", error);

        return JSON.stringify({
            service,
            timeRange,
            note: "Demo mode - Resource metrics not available",
            resources: {
                cpu: "N/A",
                memory: "N/A",
            },
            status: "UNKNOWN",
        }, null, 2);
    }
}

// Check for anomalies by comparing current metrics to baseline
async function checkAnomalies(service: string, threshold: number): Promise<string> {
    try {
        // Get current and historical metrics for comparison
        const currentErrorRate = await queryPrometheus(
            `sum(rate(traces_spanmetrics_calls_total{service_name="${service}", status_code=~"5.."}[5m])) / sum(rate(traces_spanmetrics_calls_total{service_name="${service}"}[5m])) * 100`
        );

        const baselineErrorRate = await queryPrometheus(
            `avg_over_time((sum(rate(traces_spanmetrics_calls_total{service_name="${service}", status_code=~"5.."}[5m])) / sum(rate(traces_spanmetrics_calls_total{service_name="${service}"}[5m])) * 100)[24h:1h])`
        );

        const extractValue = (result: unknown): number | null => {
            try {
                const data = result as { data?: { result?: Array<{ value?: [number, string] }> } };
                const value = data.data?.result?.[0]?.value?.[1];
                return value ? parseFloat(value) : null;
            } catch {
                return null;
            }
        };

        const current = extractValue(currentErrorRate);
        const baseline = extractValue(baselineErrorRate);

        const anomalies: Array<{ metric: string; current: string; baseline: string; deviation: string }> = [];

        if (current !== null && baseline !== null && baseline > 0) {
            const deviation = (current - baseline) / baseline;
            if (Math.abs(deviation) > threshold) {
                anomalies.push({
                    metric: "error_rate",
                    current: `${current.toFixed(2)}%`,
                    baseline: `${baseline.toFixed(2)}%`,
                    deviation: `${(deviation * 100).toFixed(0)}%`,
                });
            }
        }

        const result = {
            service,
            threshold: `${threshold}x baseline`,
            timestamp: new Date().toISOString(),
            anomalyDetected: anomalies.length > 0,
            anomalies,
            recommendation: anomalies.length > 0
                ? "Investigate recent changes or traffic patterns"
                : "No significant anomalies detected",
        };

        return JSON.stringify(result, null, 2);
    } catch (error) {
        logger.error("Error checking anomalies", error);

        return JSON.stringify({
            service,
            threshold: `${threshold}x baseline`,
            note: "Demo mode - Unable to check anomalies",
            anomalyDetected: false,
            anomalies: [],
            recommendation: "Prometheus data not available for anomaly detection",
        }, null, 2);
    }
}

// Execute raw PromQL query
async function executeQuery(query: string, time?: string): Promise<string> {
    try {
        const result = await queryPrometheus(query, time);
        return JSON.stringify(result, null, 2);
    } catch (error) {
        logger.error("Error executing PromQL query", error);
        return JSON.stringify({
            error: error instanceof Error ? error.message : "Query failed",
            query,
        }, null, 2);
    }
}

// Create MCP server
const server = new Server(
    {
        name: "mcp-server-prometheus",
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
                name: "get_service_health",
                description: "Get comprehensive health metrics for a service including error rate, latency, and throughput. Use this to understand WHY a service is failing.",
                inputSchema: zodToJsonSchema(GetServiceHealthSchema),
            },
            {
                name: "get_resource_usage",
                description: "Get CPU and memory usage for a service. Helps identify resource exhaustion issues.",
                inputSchema: zodToJsonSchema(GetResourceUsageSchema),
            },
            {
                name: "check_anomalies",
                description: "Compare current metrics to historical baseline to detect anomalies. Useful for identifying sudden changes.",
                inputSchema: zodToJsonSchema(CheckAnomaliesSchema),
            },
            {
                name: "query_prometheus",
                description: "Execute a raw PromQL query. For advanced users who need specific metrics.",
                inputSchema: zodToJsonSchema(QueryPrometheusSchema),
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
            case "get_service_health": {
                const parsed = GetServiceHealthSchema.parse(args);
                const result = await getServiceHealth(parsed.service, parsed.timeRange);
                return {
                    content: [{ type: "text", text: result }],
                };
            }

            case "get_resource_usage": {
                const parsed = GetResourceUsageSchema.parse(args);
                const result = await getResourceUsage(parsed.service, parsed.metric, parsed.timeRange);
                return {
                    content: [{ type: "text", text: result }],
                };
            }

            case "check_anomalies": {
                const parsed = CheckAnomaliesSchema.parse(args);
                const result = await checkAnomalies(parsed.service, parsed.threshold);
                return {
                    content: [{ type: "text", text: result }],
                };
            }

            case "query_prometheus": {
                const parsed = QueryPrometheusSchema.parse(args);
                const result = await executeQuery(parsed.query, parsed.time);
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
    logger.info("Starting Prometheus MCP Server via SSE transport");

    const app = express();
    const transports: { [sessionId: string]: SSEServerTransport } = {};

    // Health check endpoint
    app.get("/health", (_: ExpressRequest, res: ExpressResponse) => {
        res.json({ status: "healthy", service: "mcp-server-prometheus" });
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
        logger.info(`Prometheus MCP Server listening on port ${port}`);
        logger.info(`Prometheus URL: ${PROMETHEUS_URL}`);
    });
}

runServer().catch((error) => {
    logger.error("Fatal error", { error: error instanceof Error ? error.message : String(error) });
    process.exit(1);
});
