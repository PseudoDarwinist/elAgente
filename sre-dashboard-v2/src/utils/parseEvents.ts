// Event parsing utilities for transforming SSE events into UI state

import {
    DiagnosisEvent,
    InvestigationStep,
    SubTask,
    AgentMessage,
    AlertInfo,
    WorkingTheory,
    InvestigationState,
} from '@/types/events';

/**
 * Groups tool calls into investigation steps
 * Each step represents a phase like "Investigating logs", "Checking traces", etc.
 */
export function parseEvents(events: DiagnosisEvent[]): InvestigationState {
    const steps: InvestigationStep[] = [];
    const messages: AgentMessage[] = [];
    let alert: AlertInfo | null = null;
    let workingTheory: WorkingTheory | null = null;
    let runId: string | null = null;
    let isActive = false;
    let lastUpdated: number | null = null;

    // Track current step for grouping
    let currentStep: InvestigationStep | null = null;
    let stepCounter = 0;
    let subTaskCounter = 0;

    for (const event of events) {
        const { event_type, timestamp, data } = event;
        lastUpdated = timestamp;

        switch (event_type) {
            case 'diagnosis_started':
            case 'alert_received':
                isActive = true;
                runId = data.run_id as string || null;

                // Create alert info if service provided
                if (data.service) {
                    alert = {
                        severity: 'fire',
                        title: `Alert for ${data.service}`,
                        service: data.service as string,
                        tags: {},
                        fireTime: new Date(timestamp * 1000).toLocaleString(),
                    };
                }

                // Add initial message
                messages.push({
                    id: `msg-${messages.length}`,
                    text: `I'll investigate this alert about ${data.service || 'the service'}. Let me start by gathering context from runbooks and past investigations, then analyze the alert.`,
                    timestamp,
                });
                break;

            case 'connecting_servers':
                // Create "Connecting to tools" step
                currentStep = {
                    id: `step-${stepCounter++}`,
                    title: 'Runbooks & Artifacts',
                    status: 'active',
                    summary: `Searching ${(data.servers as string[])?.length || 0} sources`,
                    subTasks: [],
                    timestamp,
                };
                steps.push(currentStep);
                break;

            case 'servers_connected':
                if (currentStep) {
                    currentStep.status = 'complete';
                    currentStep.summary = `Found ${(data.servers as string[])?.length || 3} artifacts • Searched ${(data.servers as string[])?.length || 5} sources`;
                }

                // Add analysis message
                messages.push({
                    id: `msg-${messages.length}`,
                    text: 'Now let me create an initial investigation plan based on the runbook guidance and alert context:',
                    timestamp,
                });
                break;

            case 'llm_request':
                // Start a new "Analyzing" step
                currentStep = {
                    id: `step-${stepCounter++}`,
                    title: 'Analyzing past investigations',
                    status: 'active',
                    subTasks: [],
                    timestamp,
                };
                steps.push(currentStep);
                break;

            case 'llm_response':
                if (currentStep) {
                    currentStep.status = 'complete';
                }
                break;

            case 'tool_call':
                const toolName = data.tool as string;
                const args = data.args || {};

                // Determine step category based on tool
                const stepTitle = getStepTitleForTool(toolName);

                // Check if we need a new step or can group with current
                if (!currentStep || currentStep.title !== stepTitle) {
                    // Close previous step
                    if (currentStep && currentStep.status === 'active') {
                        currentStep.status = 'complete';
                    }

                    // Create new step
                    currentStep = {
                        id: `step-${stepCounter++}`,
                        title: stepTitle,
                        status: 'active',
                        subTasks: [],
                        timestamp,
                        progressCount: 0,
                    };
                    steps.push(currentStep);
                }

                // Add subtask
                const subTask: SubTask = {
                    id: `subtask-${subTaskCounter++}`,
                    title: getSubTaskTitle(toolName, args),
                    query: getQueryFromArgs(toolName, args),
                    queryType: getQueryType(toolName),
                    status: 'active',
                };
                currentStep.subTasks.push(subTask);
                currentStep.progressCount = currentStep.subTasks.length;
                break;

            case 'tool_result':
                // Complete the last subtask
                if (currentStep && currentStep.subTasks.length > 0) {
                    const lastSubTask = currentStep.subTasks[currentStep.subTasks.length - 1];
                    lastSubTask.status = data.is_error ? 'error' : 'complete';
                    lastSubTask.duration = data.duration as number;

                    // Update step summary based on results
                    if (data.preview) {
                        currentStep.summary = extractSummaryFromPreview(data.preview as string);
                    }
                }

                // Add agent commentary for significant results
                if (data.preview && (data.preview as string).length > 50) {
                    const commentary = generateCommentary(data.tool as string, data.preview as string);
                    if (commentary) {
                        messages.push({
                            id: `msg-${messages.length}`,
                            text: commentary,
                            timestamp,
                        });
                    }
                }
                break;

            case 'complete':
                isActive = false;

                // Complete any active step
                if (currentStep && currentStep.status === 'active') {
                    currentStep.status = 'complete';
                }

                // Parse working theory from response
                if (data.response) {
                    workingTheory = parseWorkingTheory(data.response as string);
                }

                // Add completion message
                messages.push({
                    id: `msg-${messages.length}`,
                    text: 'Perfect! The investigation now shows HIGH confidence and COMPLETE runbook adherence. Let me conclude the investigation:',
                    timestamp,
                });

                // Add final step
                steps.push({
                    id: `step-${stepCounter++}`,
                    title: 'Concluding investigation',
                    status: 'complete',
                    summary: 'Complete',
                    subTasks: [],
                    timestamp,
                });
                break;
        }
    }

    return {
        runId,
        isActive,
        alert,
        steps,
        messages,
        workingTheory,
        timeline: [],
        lastUpdated,
    };
}

function getStepTitleForTool(tool: string): string {
    switch (tool) {
        case 'get_error_logs':
            return 'Investigating logs';
        case 'get_service_dependencies':
        case 'get_impact_radius':
        case 'get_service_graph':
            return 'Checking your traces from Tempo';
        case 'get_service_health':
        case 'check_anomalies':
        case 'get_resource_usage':
            return 'Investigating logs and infrastructure events';
        case 'slack_post_message':
            return 'Updating Investigation Report';
        case 'create_issue':
            return 'Creating documentation';
        default:
            return 'Exploring charts and dashboards';
    }
}

function getSubTaskTitle(tool: string, args: Record<string, unknown>): string {
    switch (tool) {
        case 'get_error_logs':
            return `Searching for error patterns in ${args.service || 'service'} logs`;
        case 'get_service_dependencies':
            return `Analyzing service dependencies for ${args.service || 'service'}`;
        case 'get_impact_radius':
            return 'Finding affected services in blast radius';
        case 'get_service_health':
            return `Checking health metrics for ${args.service || 'service'}`;
        case 'check_anomalies':
            return 'Analyzing error distribution across pods';
        case 'slack_post_message':
            return 'Posting update to incident channel';
        case 'create_issue':
            return 'Creating GitHub tracking issue';
        default:
            return `Executing ${tool}`;
    }
}

function getQueryFromArgs(tool: string, args: Record<string, unknown>): string | undefined {
    // Build a representative query string
    if (tool === 'get_error_logs') {
        const service = args.service || 'service';
        const limit = args.limit || 100;
        return `loki {k8s_namespace_name="ecommerce-app", service_name="${service}"} |= "error" | limit ${limit}`;
    }
    if (tool === 'get_service_health') {
        const service = args.service || 'service';
        return `sum(rate(http_requests_total{service="${service}",status=~"5.."}[5m]))`;
    }
    return undefined;
}

function getQueryType(tool: string): 'loki' | 'promql' | 'tempo' | 'other' {
    switch (tool) {
        case 'get_error_logs':
            return 'loki';
        case 'get_service_health':
        case 'check_anomalies':
        case 'get_resource_usage':
            return 'promql';
        case 'get_service_dependencies':
        case 'get_impact_radius':
        case 'get_service_graph':
            return 'tempo';
        default:
            return 'other';
    }
}

function extractSummaryFromPreview(preview: string): string {
    // Extract a short summary from the preview
    if (preview.includes('error')) {
        const errorCount = (preview.match(/error/gi) || []).length;
        return `Found ${errorCount} error patterns`;
    }
    if (preview.length > 100) {
        return 'Found relevant data';
    }
    return preview.slice(0, 50);
}

function generateCommentary(tool: string, preview: string): string | null {
    if (tool === 'get_error_logs') {
        return 'Excellent! I have detailed log analysis. Now let me write my initial report documenting these findings, then check for similar ongoing investigations before proceeding with trace analysis.';
    }
    if (tool === 'get_service_dependencies') {
        return 'Good, no duplicates. Now let me update my plan and proceed with trace analysis to identify which downstream service is the root cause.';
    }
    return null;
}

function parseWorkingTheory(response: string): WorkingTheory | null {
    // Try to extract structured data from the response
    // First, try to find JSON block
    const jsonMatch = response.match(/```json\s*([\s\S]*?)\s*```/);
    if (jsonMatch) {
        try {
            const data = JSON.parse(jsonMatch[1]);
            return {
                confidence: data.confidence?.toLowerCase() || 'medium',
                title: data.root_cause || data.title || 'Root cause identified',
                sections: [
                    {
                        heading: 'Error Propagation',
                        content: data.error_propagation || 'Errors propagate through the service mesh.',
                    },
                    {
                        heading: 'Timing and Deployment Context',
                        content: data.timing_context || 'Recent deployment may have introduced the issue.',
                    },
                ],
            };
        } catch {
            // Fall through to text parsing
        }
    }

    // Fallback: parse markdown headings
    const rootCauseMatch = response.match(/(?:root cause|issue|problem)[:\s]*([^\n]+)/i);
    return {
        confidence: response.toLowerCase().includes('high confidence') ? 'high' : 'medium',
        title: rootCauseMatch ? rootCauseMatch[1].trim() : 'Issue identified',
        sections: [
            {
                heading: 'Summary',
                content: response.slice(0, 500),
            },
        ],
    };
}

/**
 * Format relative time like "Updated 23 hours ago"
 */
export function formatRelativeTime(timestamp: number): string {
    const now = Date.now();
    const diff = now - timestamp * 1000;

    const seconds = Math.floor(diff / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);

    if (days > 0) return `${days} day${days > 1 ? 's' : ''} ago`;
    if (hours > 0) return `${hours} hour${hours > 1 ? 's' : ''} ago`;
    if (minutes > 0) return `${minutes} minute${minutes > 1 ? 's' : ''} ago`;
    return 'Just now';
}
