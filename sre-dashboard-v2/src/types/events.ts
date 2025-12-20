// Types for SSE diagnosis events

export interface DiagnosisEvent {
    event_type: string;
    timestamp: number;
    data: EventData;
}

export interface EventData {
    message?: string;
    service?: string;
    tool?: string;
    args?: Record<string, unknown>;
    preview?: string;
    duration?: number;
    response?: string;
    status?: string;
    is_error?: boolean;
    title?: string;
    server?: string;
    progress?: string;
    servers?: string[];
    related_services?: string[];
    [key: string]: unknown;
}

// Investigation step for the left panel
export interface InvestigationStep {
    id: string;
    title: string;
    status: 'pending' | 'active' | 'complete' | 'error';
    summary?: string;  // e.g., "Found 4 relevant patterns"
    progressCount?: number;  // e.g., 8 (previous tasks)
    subTasks: SubTask[];
    timestamp: number;
}

export interface SubTask {
    id: string;
    title: string;
    duration?: number;  // in seconds
    query?: string;  // The actual query (loki, promQL, etc.)
    queryType?: 'loki' | 'promql' | 'tempo' | 'other';
    status: 'pending' | 'active' | 'complete' | 'error';
}

// Alert information
export interface AlertInfo {
    severity: 'fire' | 'warning' | 'info';
    title: string;
    subtitle?: string;
    service?: string;
    namespace?: string;
    cluster?: string;
    tags: Record<string, string>;
    fireTime?: string;
}

// Working theory for the report panel
export interface WorkingTheory {
    confidence: 'high' | 'medium' | 'low';
    title: string;
    sections: TheorySection[];
}

export interface TheorySection {
    heading: string;
    content: string;
}

// Agent message (chat-style text between steps)
export interface AgentMessage {
    id: string;
    text: string;
    timestamp: number;
}

// Full investigation state
export interface InvestigationState {
    runId: string | null;
    isActive: boolean;
    alert: AlertInfo | null;
    steps: InvestigationStep[];
    messages: AgentMessage[];
    workingTheory: WorkingTheory | null;
    timeline: TimelineEvent[];
    lastUpdated: number | null;
}

export interface TimelineEvent {
    id: string;
    time: string;
    description: string;
    type: 'error' | 'deployment' | 'change' | 'metric';
}
