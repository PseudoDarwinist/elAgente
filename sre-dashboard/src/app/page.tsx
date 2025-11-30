'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { Activity, Search, Sparkles, Radio } from 'lucide-react';
import { StatusBadge } from './components/StatusBadge';
import { InvestigationFeed, LogEntry } from './components/InvestigationFeed';
import { DiagnosisReport } from './components/DiagnosisReport';
import { PipelineFlow, PipelineState, eventsToPipelineState, initialPipelineState } from './components/PipelineFlow';

const ORCHESTRATOR_URL = process.env.NEXT_PUBLIC_ORCHESTRATOR_URL || 'http://localhost:8003';

interface DiagnosisEvent {
    event_type: string;
    timestamp: number;
    data: {
        message?: string;
        service?: string;
        tool?: string;
        args?: Record<string, unknown>;
        preview?: string;
        duration?: number;
        response?: string;
        status?: string;
        [key: string]: unknown;
    };
}

export default function Home() {
    const [serviceName, setServiceName] = useState('');
    const [isDiagnosing, setIsDiagnosing] = useState(false);
    const [logs, setLogs] = useState<LogEntry[]>([]);
    const [report, setReport] = useState<string | null>(null);
    const [runId, setRunId] = useState<string | null>(null);
    const [pipelineState, setPipelineState] = useState<PipelineState>(initialPipelineState);
    const [events, setEvents] = useState<DiagnosisEvent[]>([]);
    const [isListening, setIsListening] = useState(false);
    const eventSourceRef = useRef<EventSource | null>(null);

    // Convert event to log entry
    const eventToLogEntry = useCallback((event: DiagnosisEvent): LogEntry | null => {
        const { event_type, data, timestamp } = event;
        let message = data.message || '';
        let type: LogEntry['type'] = 'info';

        switch (event_type) {
            case 'alert_received':
                message = `🚨 Alert received: ${data.title || data.service}`;
                type = 'error';
                break;
            case 'diagnosis_started':
                message = `Starting diagnosis for ${data.service}`;
                type = 'info';
                break;
            case 'connecting_servers':
                message = 'Connecting to MCP servers...';
                type = 'process';
                break;
            case 'server_connecting':
                message = `Connecting to ${data.server}... (${data.progress})`;
                type = 'process';
                break;
            case 'servers_connected':
                message = `✓ Connected to all servers: ${(data.servers as string[])?.join(', ')}`;
                type = 'success';
                break;
            case 'analyzing':
                message = `Analyzing ${data.service}...`;
                type = 'process';
                break;
            case 'llm_request':
                message = 'Sending request to LLM for analysis...';
                type = 'process';
                break;
            case 'llm_response':
                message = `LLM responded in ${data.duration?.toFixed(2)}s`;
                type = 'success';
                break;
            case 'tool_call':
                message = `🔧 Calling tool: ${data.tool}`;
                type = 'process';
                break;
            case 'tool_result':
                message = `✓ ${data.tool} completed in ${data.duration?.toFixed(2)}s`;
                type = data.is_error ? 'error' : 'success';
                break;
            case 'complete':
                if (data.status === 'success') {
                    message = '✅ Diagnosis completed successfully';
                    type = 'success';
                } else if (data.status === 'error') {
                    message = `❌ Diagnosis failed: ${data.message}`;
                    type = 'error';
                } else if (data.status === 'timeout') {
                    message = `⏱️ Diagnosis timed out: ${data.message}`;
                    type = 'error';
                }
                break;
            case 'error':
                message = `Error: ${data.message}`;
                type = 'error';
                break;
            default:
                if (!message) return null;
        }

        return {
            id: `${event_type}-${timestamp}`,
            message,
            type,
            timestamp: timestamp * 1000,
        };
    }, []);

    // Subscribe to SSE events
    const subscribeToEvents = useCallback((newRunId: string) => {
        if (eventSourceRef.current) {
            eventSourceRef.current.close();
        }

        setIsListening(true);
        const eventSource = new EventSource(`${ORCHESTRATOR_URL}/events/${newRunId}`);
        eventSourceRef.current = eventSource;

        eventSource.onmessage = (e) => {
            try {
                const event: DiagnosisEvent = JSON.parse(e.data);
                setEvents(prev => [...prev, event]);
                
                // Convert to log entry
                const logEntry = eventToLogEntry(event);
                if (logEntry) {
                    setLogs(prev => [...prev, logEntry]);
                }

                // Check for completion
                if (event.event_type === 'complete') {
                    setIsDiagnosing(false);
                    setIsListening(false);
                    eventSource.close();
                    
                    // Set report if we have a response
                    if (event.data.response) {
                        setReport(event.data.response);
                    }
                }
            } catch (err) {
                console.error('Failed to parse event:', err);
            }
        };

        eventSource.onerror = () => {
            console.error('EventSource error');
            setIsListening(false);
            eventSource.close();
        };
    }, [eventToLogEntry]);

    // Update pipeline state when events change
    useEffect(() => {
        if (events.length > 0) {
            setPipelineState(eventsToPipelineState(events));
        }
    }, [events]);

    // Cleanup on unmount
    useEffect(() => {
        return () => {
            if (eventSourceRef.current) {
                eventSourceRef.current.close();
            }
        };
    }, []);

    const handleDiagnose = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!serviceName.trim()) return;

        // Reset state
        setIsDiagnosing(true);
        setLogs([]);
        setReport(null);
        setEvents([]);
        setPipelineState(initialPipelineState);
        setRunId(null);

        // Add initial log
        setLogs([{
            id: 'init',
            message: `Initializing diagnosis for ${serviceName}...`,
            type: 'info',
            timestamp: Date.now()
        }]);

        try {
            const response = await fetch(`${ORCHESTRATOR_URL}/diagnose`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/x-www-form-urlencoded',
                },
                body: `text=${encodeURIComponent(serviceName)}`,
            });

            if (!response.ok) {
                throw new Error('Failed to start diagnosis');
            }

            const data = await response.json();
            
            if (data.run_id) {
                setRunId(data.run_id);
                subscribeToEvents(data.run_id);
            } else {
                throw new Error('No run_id returned from server');
            }

        } catch (error) {
            setLogs(prev => [...prev, {
                id: 'error',
                message: `Error: ${error instanceof Error ? error.message : 'Unknown error'}`,
                type: 'error',
                timestamp: Date.now()
            }]);
            setIsDiagnosing(false);
        }
    };

    return (
        <main className="min-h-screen p-8 max-w-7xl mx-auto relative overflow-hidden">
            {/* Background Effects */}
            <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[1000px] h-[500px] bg-blue-600/20 rounded-full blur-[120px] -z-10 pointer-events-none" />
            <div className="absolute bottom-0 right-0 w-[800px] h-[600px] bg-purple-600/10 rounded-full blur-[100px] -z-10 pointer-events-none" />

            {/* Header */}
            <header className="flex items-center justify-between mb-8 relative z-10">
                <div className="flex items-center gap-4">
                    <div className="p-3 bg-gradient-to-br from-blue-600 to-indigo-600 rounded-xl shadow-lg shadow-blue-500/30 ring-1 ring-white/20">
                        <Activity className="w-8 h-8 text-white" />
                    </div>
                    <div>
                        <h1 className="text-3xl font-bold text-white tracking-tight flex items-center gap-2">
                            SRE Agent
                            <span className="px-2 py-0.5 rounded-full bg-blue-500/10 border border-blue-500/20 text-xs text-blue-300 font-mono">v2.0</span>
                        </h1>
                        <p className="text-slate-400 text-sm font-medium">Autonomous Incident Response System</p>
                    </div>
                </div>

                <div className="flex items-center gap-4">
                    {isListening && (
                        <div className="flex items-center gap-2 px-3 py-1.5 bg-emerald-500/10 border border-emerald-500/30 rounded-full">
                            <Radio className="w-3 h-3 text-emerald-400 animate-pulse" />
                            <span className="text-xs text-emerald-400 font-medium">Live</span>
                        </div>
                    )}
                    <StatusBadge label="GitHub" status="connected" />
                    <StatusBadge label="Slack" status="connected" />
                </div>
            </header>

            {/* Pipeline Visualization */}
            <div className="mb-8">
                <PipelineFlow state={pipelineState} />
            </div>

            {/* Main Content Grid */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">

                {/* Left Column: Controls & Feed */}
                <div className="lg:col-span-5 space-y-6">
                    {/* Search Card */}
                    <div className="bg-slate-900/50 border border-slate-800 rounded-xl p-6 backdrop-blur-sm">
                        <h2 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
                            <Sparkles className="w-4 h-4 text-purple-400" />
                            Start Investigation
                        </h2>
                        <form onSubmit={handleDiagnose} className="space-y-4">
                            <div className="relative">
                                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-500" />
                                <input
                                    type="text"
                                    value={serviceName}
                                    onChange={(e) => setServiceName(e.target.value)}
                                    placeholder="Enter service name (e.g., cartservice)..."
                                    className="w-full bg-slate-950 border border-slate-800 rounded-lg py-3 pl-10 pr-4 text-white placeholder:text-slate-600 focus:outline-none focus:ring-2 focus:ring-blue-500/50 transition-all"
                                />
                            </div>
                            <button
                                type="submit"
                                disabled={isDiagnosing || !serviceName}
                                className="w-full bg-blue-600 hover:bg-blue-500 text-white font-medium py-3 rounded-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-lg shadow-blue-900/20"
                            >
                                {isDiagnosing ? 'Agent Working...' : 'Diagnose Service'}
                            </button>
                        </form>
                    </div>

                    {/* Feed */}
                    <div className="h-[500px]">
                        <InvestigationFeed logs={logs} />
                    </div>
                </div>

                {/* Right Column: Results */}
                <div className="lg:col-span-7">
                    {report ? (
                        <DiagnosisReport report={report} />
                    ) : (
                        <div className="h-full min-h-[400px] flex flex-col items-center justify-center text-slate-600 border-2 border-dashed border-slate-800 rounded-xl bg-slate-900/20">
                            <Activity className="w-12 h-12 mb-4 opacity-20" />
                            <p>Ready to analyze system health</p>
                        </div>
                    )}
                </div>
            </div>
        </main>
    );
}
