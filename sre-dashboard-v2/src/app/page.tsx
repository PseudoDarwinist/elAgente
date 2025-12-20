'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { Zap, Search, Radio } from 'lucide-react';
import { DiagnosisEvent, InvestigationState } from '@/types/events';
import { parseEvents } from '@/utils/parseEvents';
import { InvestigationPanel } from '@/components/InvestigationPanel';
import { ReportPanel } from '@/components/ReportPanel';

const ORCHESTRATOR_URL = process.env.NEXT_PUBLIC_ORCHESTRATOR_URL || 'http://localhost:8003';

const initialState: InvestigationState = {
    runId: null,
    isActive: false,
    alert: null,
    steps: [],
    messages: [],
    workingTheory: null,
    timeline: [],
    lastUpdated: null,
};

export default function Home() {
    const [serviceName, setServiceName] = useState('');
    const [isDiagnosing, setIsDiagnosing] = useState(false);
    const [runId, setRunId] = useState<string | null>(null);
    const [events, setEvents] = useState<DiagnosisEvent[]>([]);
    const [isListening, setIsListening] = useState(false);
    const [investigationState, setInvestigationState] = useState<InvestigationState>(initialState);

    const eventSourceRef = useRef<EventSource | null>(null);

    // Parse events into investigation state
    useEffect(() => {
        if (events.length > 0) {
            const state = parseEvents(events);
            state.isActive = isDiagnosing;
            setInvestigationState(state);
        }
    }, [events, isDiagnosing]);

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

    // Cleanup on unmount
    useEffect(() => {
        return () => {
            if (eventSourceRef.current) {
                eventSourceRef.current.close();
            }
        };
    }, []);

    // Poll for new alert-triggered runs
    useEffect(() => {
        let lastSeenRunId: string | null = null;

        const pollForAlerts = async () => {
            try {
                const res = await fetch(`${ORCHESTRATOR_URL}/latest-run`);
                if (!res.ok) return;

                const data = await res.json();

                if (
                    data.run_id &&
                    data.run_id !== lastSeenRunId &&
                    data.run_id !== runId &&
                    !isDiagnosing
                ) {
                    lastSeenRunId = data.run_id;

                    setRunId(data.run_id);
                    setServiceName(data.service || '');
                    setIsDiagnosing(true);
                    setEvents([]);
                    setInvestigationState(initialState);

                    subscribeToEvents(data.run_id);
                }
            } catch {
                // Silently ignore polling errors
            }
        };

        const interval = setInterval(pollForAlerts, 3000);
        pollForAlerts();

        return () => clearInterval(interval);
    }, [runId, isDiagnosing, subscribeToEvents]);

    const handleDiagnose = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!serviceName.trim()) return;

        // Reset state
        setIsDiagnosing(true);
        setEvents([]);
        setInvestigationState(initialState);
        setRunId(null);

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
        <main className="min-h-screen bg-[var(--background)]">
            {/* Header */}
            <header className="bg-white border-b border-gray-200 px-6 py-3">
                <div className="flex items-center justify-between max-w-[1800px] mx-auto">
                    <div className="flex items-center gap-4">
                        {/* Logo */}
                        <div className="flex items-center gap-2">
                            <div className="w-8 h-8 bg-black rounded-sm flex items-center justify-center">
                                <Zap className="w-5 h-5 text-yellow-400" />
                            </div>
                            <span className="font-semibold text-lg">el Agénte</span>
                        </div>

                        {/* Search Bar */}
                        <form onSubmit={handleDiagnose} className="flex items-center gap-2 ml-8">
                            <div className="relative">
                                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                                <input
                                    type="text"
                                    value={serviceName}
                                    onChange={(e) => setServiceName(e.target.value)}
                                    placeholder="Enter service name..."
                                    className="w-64 pl-10 pr-4 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                                />
                            </div>
                            <button
                                type="submit"
                                disabled={isDiagnosing || !serviceName}
                                className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                            >
                                {isDiagnosing ? 'Diagnosing...' : 'Diagnose'}
                            </button>
                        </form>
                    </div>

                    {/* Status */}
                    <div className="flex items-center gap-4">
                        {isListening ? (
                            <div className="flex items-center gap-2 px-3 py-1.5 bg-green-50 text-green-700 rounded-full">
                                <Radio className="w-3 h-3 animate-pulse" />
                                <span className="text-xs font-medium">Live</span>
                            </div>
                        ) : (
                            <div className="flex items-center gap-2 px-3 py-1.5 bg-gray-100 text-gray-600 rounded-full">
                                <Radio className="w-3 h-3" />
                                <span className="text-xs font-medium">Awaiting</span>
                            </div>
                        )}
                    </div>
                </div>
            </header>

            {/* Two Panel Layout */}
            <div className="two-panel-layout">
                <InvestigationPanel state={investigationState} />
                <ReportPanel state={investigationState} />
            </div>
        </main>
    );
}
