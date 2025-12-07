'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { Activity, Search, Sparkles, Radio, Zap } from 'lucide-react';
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
            case 'topology_check':
                message = `🔗 Topology: Checking related services: ${(data.related_services as string[])?.join(', ')}`;
                type = 'process';
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

    // Poll for new alert-triggered runs (auto-subscribe to Grafana alerts)
    useEffect(() => {
        let lastSeenRunId: string | null = null;

        const pollForAlerts = async () => {
            try {
                const res = await fetch(`${ORCHESTRATOR_URL}/latest-run`);
                if (!res.ok) return;

                const data = await res.json();

                // Check if there's a new run we haven't seen
                if (
                    data.run_id &&
                    data.run_id !== lastSeenRunId &&
                    data.run_id !== runId &&
                    !isDiagnosing
                ) {
                    lastSeenRunId = data.run_id;

                    // Auto-subscribe to the new alert-triggered run
                    setRunId(data.run_id);
                    setServiceName(data.service || '');
                    setIsDiagnosing(true);
                    setLogs([{
                        id: 'alert-init',
                        message: `🚨 Alert detected for ${data.service}! Auto-subscribing...`,
                        type: 'info',
                        timestamp: Date.now()
                    }]);
                    setReport(null);
                    setEvents([]);
                    setPipelineState(initialPipelineState);

                    subscribeToEvents(data.run_id);
                }
            } catch {
                // Silently ignore polling errors
            }
        };

        const interval = setInterval(pollForAlerts, 3000);

        // Initial poll
        pollForAlerts();

        return () => clearInterval(interval);
    }, [runId, isDiagnosing, subscribeToEvents]);

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
        <main className="min-h-screen bg-[#e0f2fe] font-sans overflow-x-hidden relative selection:bg-pink-400 selection:text-black">
            {/* Background grid */}
            <div className="fixed inset-0 opacity-10 pointer-events-none z-0"
                style={{ backgroundImage: 'linear-gradient(#000 1px, transparent 1px), linear-gradient(90deg, #000 1px, transparent 1px)', backgroundSize: '40px 40px' }} />

            <div className="relative z-10 max-w-[1400px] mx-auto p-4 md:p-8">

                {/* Header */}
                <header className="mb-12">
                    <div className="bg-black text-white p-6 border-b-8 border-yellow-400 shadow-[12px_12px_0px_0px_rgba(0,0,0,0.2)] transform -rotate-1 hover:rotate-0 transition-transform duration-300">
                        <div className="flex flex-col md:flex-row justify-between items-center gap-6">
                            <div className="flex items-center gap-4">
                                <div className="w-16 h-16 bg-white border-4 border-black flex items-center justify-center shadow-[4px_4px_0px_0px_#fbbf24]">
                                    <Activity className="w-10 h-10 text-black animate-pulse" />
                                </div>
                                <div>
                                    <h1 className="text-4xl md:text-5xl font-black tracking-tighter uppercase leading-none italic">
                                        el Agénte <span className="text-yellow-400 not-italic text-3xl align-top">v2.0</span>
                                    </h1>
                                    <p className="font-mono text-sm text-gray-400 uppercase tracking-widest">Autonomous Incident Response System</p>
                                </div>
                            </div>

                            <div className="flex items-center gap-4">
                                {isListening ? (
                                    <div className="flex items-center gap-2 px-4 py-2 bg-[#86efac] border-4 border-black animate-bounce shadow-[4px_4px_0px_0px_#000]">
                                        <Radio className="w-4 h-4 text-black animate-pulse" />
                                        <span className="text-xs text-black font-black uppercase">Live</span>
                                    </div>
                                ) : !isDiagnosing && (
                                    <div className="flex items-center gap-2 px-4 py-2 bg-[#fca5a5] border-4 border-black shadow-[4px_4px_0px_0px_#000]">
                                        <Radio className="w-4 h-4 text-black" />
                                        <span className="text-xs text-black font-black uppercase">Awaiting Alerts</span>
                                    </div>
                                )}
                                <StatusBadge label="GitHub" status="connected" />
                                <StatusBadge label="Slack" status="connected" />
                            </div>
                        </div>
                    </div>

                    {/* Marquee Tape */}
                    <div className="bg-yellow-400 border-4 border-black py-2 overflow-hidden mt-6 transform rotate-1 shadow-[8px_8px_0px_0px_rgba(0,0,0,1)]">
                        <div className="animate-marquee whitespace-nowrap font-black text-sm uppercase tracking-widest flex gap-8">
                            <span>{'/// SYSTEM NORMAL'}</span>
                            <span>{'/// MONITORING ACTIVE'}</span>
                            <span>{'/// NO ANOMALIES DETECTED'}</span>
                            <span>{'/// WAITING FOR INPUT'}</span>
                            <span>{'/// SYSTEM NORMAL'}</span>
                            <span>{'/// MONITORING ACTIVE'}</span>
                            <span>{'/// NO ANOMALIES DETECTED'}</span>
                            <span>{'/// WAITING FOR INPUT'}</span>
                        </div>
                    </div>
                </header>

                {/* Pipeline Visualization */}
                <div className="mb-12">
                    <h3 className="text-xl font-black uppercase mb-4 flex items-center gap-2">
                        <span className="bg-black text-white px-2">Pipeline</span> Status
                    </h3>
                    <PipelineFlow state={pipelineState} />
                </div>

                {/* Main Content Grid */}
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
                    {/* Left Column: Controls & Feed */}
                    <div className="lg:col-span-5 space-y-8">
                        {/* Search Card */}
                        <div className="bg-[#fff1f2] border-4 border-black p-6 shadow-[8px_8px_0px_0px_rgba(0,0,0,1)]">
                            <h2 className="text-xl font-black text-black mb-6 flex items-center gap-2 uppercase transform -rotate-1">
                                <Sparkles className="w-6 h-6 text-black" />
                                Start Investigation
                            </h2>
                            <form onSubmit={handleDiagnose} className="space-y-4">
                                <div className="relative group">
                                    <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-6 h-6 text-black transition-transform group-hover:scale-110" />
                                    <input
                                        type="text"
                                        value={serviceName}
                                        onChange={(e) => setServiceName(e.target.value)}
                                        placeholder="ENTER SERVICE NAME..."
                                        className="w-full bg-white border-4 border-black py-4 pl-14 pr-4 text-black placeholder:text-gray-400 font-mono font-bold focus:outline-none focus:shadow-[6px_6px_0px_0px_#000] focus:-translate-y-1 transition-all uppercase"
                                    />
                                </div>
                                <button
                                    type="submit"
                                    disabled={isDiagnosing || !serviceName}
                                    className="w-full bg-[#bae6fd] hover:bg-[#7dd3fc] text-black font-black py-4 border-4 border-black shadow-[4px_4px_0px_0px_#000] hover:shadow-[6px_6px_0px_0px_#000] hover:-translate-y-0.5 active:translate-y-0 active:shadow-[2px_2px_0px_0px_#000] transition-all uppercase disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 text-lg"
                                >
                                    {isDiagnosing ? (
                                        <>
                                            <Zap className="w-5 h-5 animate-spin" />
                                            Running Diagnostics...
                                        </>
                                    ) : (
                                        'Diagnose Service'
                                    )}
                                </button>
                            </form>
                        </div>

                        {/* Feed */}
                        <InvestigationFeed logs={logs} />
                    </div>

                    {/* Right Column: Results */}
                    <div className="lg:col-span-7 min-h-[600px]">
                        {report ? (
                            <DiagnosisReport report={report} />
                        ) : (
                            <div className="h-full min-h-[600px] flex flex-col items-center justify-center text-neutral-400 border-4 border-dashed border-neutral-300 bg-neutral-50 rounded-none">
                                <Activity className="w-24 h-24 mb-6 opacity-20 animate-bounce" />
                                <p className="font-black text-xl uppercase tracking-widest opacity-40">Ready to analyze</p>
                                <p className="font-mono text-sm mt-2 opacity-40">WAITING FOR TRIGGER EVENT...</p>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </main>
    );
}
