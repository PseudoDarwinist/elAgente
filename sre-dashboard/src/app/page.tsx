'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { Activity, Search, Sparkles, Radio, Zap } from 'lucide-react';
import { StatusBadge } from './components/StatusBadge';
import { DiagnosisReport } from './components/DiagnosisReport';
import { PipelineFlow, PipelineState, eventsToPipelineState, initialPipelineState } from './components/PipelineFlow';
import { ChainOfThought, ThoughtStep, eventsToThoughtSteps } from './components/ChainOfThought';

import { DemoModeButton } from './components/DemoModeButton';
import { FaultPropagationChain, parseFaultPropagation } from './components/FaultPropagationChain';
import { ServiceDependencyGraph, parseServiceGraph } from './components/ServiceDependencyGraph';
import { HypothesisPanel, parseDiagnosis } from './components/HypothesisPanel';

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
        is_error?: boolean;
        title?: string;
        server?: string;
        progress?: string;
        servers?: string[];
        related_services?: string[];
        [key: string]: unknown;
    };
}

export default function Home() {
    const [serviceName, setServiceName] = useState('');
    const [isDiagnosing, setIsDiagnosing] = useState(false);
    const [report, setReport] = useState<string | null>(null);
    const [runId, setRunId] = useState<string | null>(null);
    const [pipelineState, setPipelineState] = useState<PipelineState>(initialPipelineState);
    const [events, setEvents] = useState<DiagnosisEvent[]>([]);
    const [isListening, setIsListening] = useState(false);
    const [thoughtSteps, setThoughtSteps] = useState<ThoughtStep[]>([]);

    const eventSourceRef = useRef<EventSource | null>(null);

    // Topology-aware state
    const [faultPropagation, setFaultPropagation] = useState<{
        impactPath: string[];
        rootCauseService?: string;
        faultyServices: string[];
        serviceStatuses: Record<string, { status: string; findings: string[] }>;
    }>({ impactPath: [], faultyServices: [], serviceStatuses: {} });
    const [serviceGraph, setServiceGraph] = useState<{ services: string[]; edges: Array<{ from: string; to: string }>; healthMap: Record<string, string> }>({
        services: [],
        edges: [],
        healthMap: {}
    });
    const [diagnosis, setDiagnosis] = useState<{ rootCause?: string; confidence?: number; evidence?: string[]; runbook?: Array<{ step: number; action: string; command?: string }> }>({});

    // Process events into thought steps and topology data
    useEffect(() => {
        if (events.length > 0) {
            // Update thought steps
            setThoughtSteps(eventsToThoughtSteps(events));

            // Continuously update service graph and fault propagation from tool results
            const serviceGraphData = parseServiceGraph(events);
            const faultData = parseFaultPropagation(events);

            console.log('[Dashboard] Events count:', events.length);
            console.log('[Dashboard] Service Graph:', serviceGraphData);
            console.log('[Dashboard] Fault Propagation:', faultData);

            setServiceGraph(serviceGraphData);
            setFaultPropagation(faultData);

            // Parse diagnosis data from complete event
            const completeEvent = events.find(e => e.event_type === 'complete');
            if (completeEvent) {
                console.log('[Dashboard] Complete event found:', completeEvent);
                console.log('[Dashboard] Response preview:', completeEvent.data.response?.slice(0, 500));

                const diagnosisData = parseDiagnosis(events);
                console.log('[Dashboard] Parsed diagnosis:', diagnosisData);
                setDiagnosis(diagnosisData);
            }
        }
    }, [events]);


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
    }, []);

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
                    setReport(null);
                    setEvents([]);
                    setThoughtSteps([]);

                    setPipelineState(initialPipelineState);
                    // Reset topology state
                    setFaultPropagation({ impactPath: [], faultyServices: [], serviceStatuses: {} });
                    setServiceGraph({ services: [], edges: [], healthMap: {} });
                    setDiagnosis({});

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
        setReport(null);
        setEvents([]);
        setThoughtSteps([]);

        setPipelineState(initialPipelineState);
        setRunId(null);
        // Reset topology state
        setFaultPropagation({ impactPath: [], faultyServices: [], serviceStatuses: {} });
        setServiceGraph({ services: [], edges: [], healthMap: {} });
        setDiagnosis({});

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
            console.error('Diagnosis error:', error);
            setIsDiagnosing(false);
        }
    };

    return (
        <main className="min-h-screen bg-[#e0f2fe] font-sans overflow-x-hidden relative selection:bg-pink-400 selection:text-black">
            {/* Background grid */}
            <div className="fixed inset-0 opacity-10 pointer-events-none z-0"
                style={{ backgroundImage: 'linear-gradient(#000 1px, transparent 1px), linear-gradient(90deg, #000 1px, transparent 1px)', backgroundSize: '40px 40px' }} />

            <div className="relative z-10 max-w-[1800px] mx-auto p-4 md:p-8">

                {/* Header */}
                <header className="mb-8">
                    <div className="bg-black text-white p-6 border-b-8 border-yellow-400 shadow-[12px_12px_0px_0px_rgba(0,0,0,0.2)] transform -rotate-1 hover:rotate-0 transition-transform duration-300">
                        <div className="flex flex-col md:flex-row justify-between items-center gap-6">
                            <div className="flex items-center gap-4">
                                <div className="w-70 h-70 bg-white border-4 border-black overflow-hidden shadow-[4px_4px_0px_0px_#fbbf24]">
                                    <video
                                        className="w-full h-full object-cover"
                                        src="/animated-logo.MP4"
                                        autoPlay
                                        loop
                                        muted
                                        playsInline
                                    />
                                </div>
                                <div>
                                    <p className="font-mono text-sm text-gray-400 uppercase tracking-widest">
                                        Autonomous Incident Response System
                                    </p>
                                </div>
                            </div>

                            <div className="flex items-center gap-4">
                                <DemoModeButton isDiagnosing={isDiagnosing} />
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
                    <div className="bg-yellow-400 border-4 border-black py-2 overflow-hidden mt-4 transform rotate-1 shadow-[8px_8px_0px_0px_rgba(0,0,0,1)]">
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
                <div className="mb-8">
                    <h3 className="text-xl font-black uppercase mb-4 flex items-center gap-2">
                        <span className="bg-black text-white px-2">Pipeline</span> Status
                    </h3>
                    <PipelineFlow state={pipelineState} />
                </div>

                {/* Topology Visualization - Fault Propagation & Service Map */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
                    <FaultPropagationChain
                        impactPath={faultPropagation.impactPath}
                        rootCauseService={faultPropagation.rootCauseService || diagnosis.rootCause}
                        faultyServices={faultPropagation.faultyServices}
                        serviceStatuses={faultPropagation.serviceStatuses}
                        isActive={isDiagnosing}
                    />
                    <ServiceDependencyGraph
                        services={serviceGraph.services}
                        edges={serviceGraph.edges}
                        serviceHealthMap={serviceGraph.healthMap}
                        highlightServices={faultPropagation.impactPath}
                        isLoading={isDiagnosing && serviceGraph.services.length === 0}
                    />
                </div>

                {/* Main Content Grid - Two Columns */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
                    {/* Left Column: Search + Chain of Thought */}
                    <div className="space-y-6">
                        {/* Search Card */}
                        <div className="bg-[#fff1f2] border-4 border-black p-6 shadow-[8px_8px_0px_0px_rgba(0,0,0,1)]">
                            <h2 className="text-lg font-black text-black mb-4 flex items-center gap-2 uppercase transform -rotate-1">
                                <Sparkles className="w-5 h-5 text-black" />
                                Start Investigation
                            </h2>
                            <form onSubmit={handleDiagnose} className="space-y-3">
                                <div className="relative group">
                                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-black transition-transform group-hover:scale-110" />
                                    <input
                                        type="text"
                                        value={serviceName}
                                        onChange={(e) => setServiceName(e.target.value)}
                                        placeholder="SERVICE NAME..."
                                        className="w-full bg-white border-4 border-black py-3 pl-11 pr-3 text-black placeholder:text-gray-400 font-mono font-bold focus:outline-none focus:shadow-[4px_4px_0px_0px_#000] focus:-translate-y-1 transition-all uppercase text-sm"
                                    />
                                </div>
                                <button
                                    type="submit"
                                    disabled={isDiagnosing || !serviceName}
                                    className="w-full bg-[#bae6fd] hover:bg-[#7dd3fc] text-black font-black py-3 border-4 border-black shadow-[4px_4px_0px_0px_#000] hover:shadow-[6px_6px_0px_0px_#000] hover:-translate-y-0.5 active:translate-y-0 active:shadow-[2px_2px_0px_0px_#000] transition-all uppercase disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                                >
                                    {isDiagnosing ? (
                                        <>
                                            <Zap className="w-4 h-4 animate-spin" />
                                            Diagnosing...
                                        </>
                                    ) : (
                                        'Diagnose'
                                    )}
                                </button>
                            </form>
                        </div>

                        {/* Chain of Thought */}
                        <div className="h-[400px]">
                            <ChainOfThought steps={thoughtSteps} isActive={isDiagnosing} />
                        </div>
                    </div>

                    {/* Right Column: Hypothesis Panel */}
                    <div>
                        <HypothesisPanel
                            rootCause={diagnosis.rootCause}
                            confidence={diagnosis.confidence}
                            evidence={diagnosis.evidence}
                            runbook={diagnosis.runbook}
                            isComplete={!isDiagnosing && !!report}
                        />
                    </div>
                </div>

                {/* Diagnosis Report (full width when complete) */}
                {report && (
                    <div className="mt-8">
                        <DiagnosisReport report={report} />
                    </div>
                )}
            </div>
        </main>
    );
}
