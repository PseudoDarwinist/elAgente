import { z } from "zod";

// Loki API base URL from environment
const LOKI_URL = process.env.LOKI_URL || "http://loki:3100";

// Schemas for tool inputs
export const QueryLogsSchema = z.object({
    query: z.string().describe("LogQL query, e.g., {service=\"myapp\"}"),
    limit: z.number().optional().default(100).describe("Max number of log lines to return"),
    start: z.string().optional().describe("Start time (RFC3339 or Unix timestamp)"),
    end: z.string().optional().describe("End time (RFC3339 or Unix timestamp)"),
});

export const QueryLogsByServiceSchema = z.object({
    service: z.string().describe("Service name to query logs for"),
    level: z.string().optional().describe("Log level filter (error, warn, info)"),
    limit: z.number().optional().default(100).describe("Max number of log lines"),
    since_minutes: z.number().optional().default(30).describe("Look back this many minutes"),
});

export const GetLabelsSchema = z.object({
    start: z.string().optional().describe("Start time for label query"),
    end: z.string().optional().describe("End time for label query"),
});

export const GetLabelValuesSchema = z.object({
    label: z.string().describe("Label name to get values for (e.g., 'service')"),
});

// Types for Loki API responses
interface LokiQueryResult {
    status: string;
    data: {
        resultType: string;
        result: Array<{
            stream: Record<string, string>;
            values: Array<[string, string]>;
        }>;
    };
}

interface LokiLabelsResult {
    status: string;
    data: string[];
}

/**
 * Query Loki using LogQL
 */
export async function queryLogs(
    query: string,
    limit: number = 100,
    start?: string,
    end?: string
): Promise<string> {
    const now = Date.now();
    const defaultStart = new Date(now - 30 * 60 * 1000).toISOString(); // 30 min ago
    const defaultEnd = new Date(now).toISOString();

    const params = new URLSearchParams({
        query,
        limit: limit.toString(),
        start: start || defaultStart,
        end: end || defaultEnd,
    });

    const url = `${LOKI_URL}/loki/api/v1/query_range?${params}`;

    try {
        const response = await fetch(url);

        if (!response.ok) {
            throw new Error(`Loki API error: ${response.status} ${response.statusText}`);
        }

        const data = await response.json() as LokiQueryResult;

        if (data.status !== "success") {
            throw new Error(`Loki query failed: ${JSON.stringify(data)}`);
        }

        // Format results for LLM consumption
        const logs: string[] = [];

        for (const stream of data.data.result) {
            const labels = Object.entries(stream.stream)
                .map(([k, v]) => `${k}="${v}"`)
                .join(", ");

            for (const [timestamp, line] of stream.values) {
                const date = new Date(parseInt(timestamp) / 1000000).toISOString();
                logs.push(`[${date}] {${labels}} ${line}`);
            }
        }

        if (logs.length === 0) {
            return "No logs found matching the query.";
        }

        return logs.join("\n");
    } catch (error) {
        if (error instanceof Error) {
            throw new Error(`Failed to query Loki: ${error.message}`);
        }
        throw error;
    }
}

/**
 * Query logs for a specific service with optional level filter
 */
export async function queryLogsByService(
    service: string,
    level?: string,
    limit: number = 100,
    sinceMinutes: number = 30
): Promise<string> {
    let query = `{service="${service}"}`;

    if (level) {
        query = `{service="${service}", level="${level}"}`;
    }

    const now = Date.now();
    const start = new Date(now - sinceMinutes * 60 * 1000).toISOString();
    const end = new Date(now).toISOString();

    return queryLogs(query, limit, start, end);
}

/**
 * Get all available labels from Loki
 */
export async function getLabels(start?: string, end?: string): Promise<string[]> {
    const params = new URLSearchParams();
    if (start) params.set("start", start);
    if (end) params.set("end", end);

    const url = `${LOKI_URL}/loki/api/v1/labels?${params}`;

    try {
        const response = await fetch(url);

        if (!response.ok) {
            throw new Error(`Loki API error: ${response.status} ${response.statusText}`);
        }

        const data = await response.json() as LokiLabelsResult;
        return data.data;
    } catch (error) {
        if (error instanceof Error) {
            throw new Error(`Failed to get labels: ${error.message}`);
        }
        throw error;
    }
}

/**
 * Get all values for a specific label
 */
export async function getLabelValues(label: string): Promise<string[]> {
    const url = `${LOKI_URL}/loki/api/v1/label/${label}/values`;

    try {
        const response = await fetch(url);

        if (!response.ok) {
            throw new Error(`Loki API error: ${response.status} ${response.statusText}`);
        }

        const data = await response.json() as LokiLabelsResult;
        return data.data;
    } catch (error) {
        if (error instanceof Error) {
            throw new Error(`Failed to get label values: ${error.message}`);
        }
        throw error;
    }
}

/**
 * Get error logs for a service (convenience function)
 */
export async function getErrorLogs(
    service: string,
    limit: number = 50,
    sinceMinutes: number = 60
): Promise<string> {
    return queryLogsByService(service, "error", limit, sinceMinutes);
}
