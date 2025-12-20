'use client';

import { motion, AnimatePresence } from 'framer-motion';
import { Brain, Check, Loader2, Search, FileText, MessageSquare, GitBranch, Lightbulb, Wrench } from 'lucide-react';
import { useEffect, useState } from 'react';

export interface ThoughtStep {
    id: string;
    title: string;
    description: string;
    status: 'pending' | 'active' | 'complete' | 'error';
    tool?: string;
    duration?: number;
}

interface ChainOfThoughtProps {
    steps: ThoughtStep[];
    isActive: boolean;
}

const getStepIcon = (tool?: string) => {
    switch (tool) {
        case 'get_error_logs':
            return <Search className="w-4 h-4" />;
        case 'slack_post_message':
            return <MessageSquare className="w-4 h-4" />;
        case 'create_issue':
            return <GitBranch className="w-4 h-4" />;
        case 'hypothesis':
            return <Lightbulb className="w-4 h-4" />;
        default:
            return <Wrench className="w-4 h-4" />;
    }
};

const getStatusColor = (status: ThoughtStep['status']) => {
    switch (status) {
        case 'complete':
            return 'bg-green-400 border-green-600';
        case 'active':
            return 'bg-blue-400 border-blue-600';
        case 'error':
            return 'bg-red-400 border-red-600';
        default:
            return 'bg-gray-200 border-gray-400';
    }
};

export function ChainOfThought({ steps, isActive }: ChainOfThoughtProps) {
    const [typingText, setTypingText] = useState<Record<string, string>>({});

    // Typing animation for active steps
    useEffect(() => {
        const activeStep = steps.find(s => s.status === 'active');
        if (activeStep && activeStep.description) {
            let currentIndex = 0;
            const fullText = activeStep.description;

            const interval = setInterval(() => {
                if (currentIndex <= fullText.length) {
                    setTypingText(prev => ({
                        ...prev,
                        [activeStep.id]: fullText.slice(0, currentIndex)
                    }));
                    currentIndex++;
                } else {
                    clearInterval(interval);
                }
            }, 30);

            return () => clearInterval(interval);
        }
    }, [steps]);

    return (
        <div className="flex flex-col h-full bg-white border-4 border-black shadow-[8px_8px_0px_0px_rgba(0,0,0,1)] overflow-hidden">
            {/* Header */}
            <div className="bg-[#fde047] border-b-4 border-black p-4 flex items-center justify-between">
                <div className="flex items-center gap-3">
                    <div className="bg-black text-white p-2 flex items-center gap-2">
                        <Brain className="w-5 h-5" />
                        <span className="font-mono font-bold text-sm">THINKING_PROCESS</span>
                    </div>
                </div>
                {isActive && (
                    <div className="flex items-center gap-2 px-3 py-1 bg-blue-400 border-2 border-black">
                        <div className="w-2 h-2 bg-white rounded-full animate-pulse" />
                        <span className="text-xs font-bold uppercase">Processing</span>
                    </div>
                )}
            </div>

            {/* Steps Container */}
            <div className="flex-1 overflow-y-auto p-4 space-y-3 bg-[#fafafa]">
                {/* Grid background */}
                <div
                    className="absolute inset-0 opacity-5 pointer-events-none"
                    style={{ backgroundImage: 'radial-gradient(#000 1px, transparent 1px)', backgroundSize: '16px 16px' }}
                />

                {steps.length === 0 ? (
                    <div className="flex flex-col items-center justify-center h-full text-neutral-400 py-12">
                        <Brain className="w-16 h-16 mb-4 opacity-30" />
                        <p className="font-bold uppercase tracking-widest text-sm">Waiting for input...</p>
                    </div>
                ) : (
                    <AnimatePresence mode="popLayout">
                        {steps.map((step, index) => (
                            <motion.div
                                key={step.id}
                                initial={{ opacity: 0, x: -20, scale: 0.95 }}
                                animate={{ opacity: 1, x: 0, scale: 1 }}
                                exit={{ opacity: 0, x: 20 }}
                                transition={{ type: 'spring', stiffness: 200, damping: 20 }}
                                className={`
                                    relative border-4 border-black p-4
                                    ${step.status === 'active' ? 'bg-[#bae6fd] shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]' :
                                        step.status === 'complete' ? 'bg-white' :
                                            step.status === 'error' ? 'bg-[#fca5a5]' : 'bg-gray-100 opacity-50'}
                                    transition-all duration-200
                                `}
                            >
                                {/* Left accent bar */}
                                <div className={`absolute left-0 top-0 bottom-0 w-2 ${step.status === 'complete' ? 'bg-green-500' :
                                        step.status === 'active' ? 'bg-blue-500' :
                                            step.status === 'error' ? 'bg-red-500' : 'bg-gray-300'
                                    }`} />

                                <div className="flex items-start gap-3 pl-3">
                                    {/* Step number/status */}
                                    <div className={`
                                        w-8 h-8 border-2 border-black flex items-center justify-center shrink-0
                                        ${step.status === 'complete' ? 'bg-green-400' :
                                            step.status === 'active' ? 'bg-blue-400' :
                                                step.status === 'error' ? 'bg-red-400' : 'bg-gray-200'}
                                    `}>
                                        {step.status === 'complete' ? (
                                            <Check className="w-5 h-5 text-black" />
                                        ) : step.status === 'active' ? (
                                            <Loader2 className="w-5 h-5 text-black animate-spin" />
                                        ) : (
                                            <span className="font-black text-sm">{index + 1}</span>
                                        )}
                                    </div>

                                    {/* Content */}
                                    <div className="flex-1 min-w-0">
                                        <div className="flex items-center gap-2 mb-1">
                                            <h4 className="font-black text-sm uppercase tracking-tight">
                                                {step.title}
                                            </h4>
                                            {step.tool && (
                                                <div className="flex items-center gap-1 px-2 py-0.5 bg-black text-white text-xs font-mono">
                                                    {getStepIcon(step.tool)}
                                                    <span>{step.tool}</span>
                                                </div>
                                            )}
                                        </div>
                                        <p className="text-sm font-mono text-gray-700 leading-snug">
                                            {step.status === 'active'
                                                ? (typingText[step.id] || '') + (typingText[step.id]?.length !== step.description.length ? '▋' : '')
                                                : step.description
                                            }
                                        </p>
                                        {step.duration && step.status === 'complete' && (
                                            <span className="text-xs font-mono text-gray-500 mt-1 inline-block">
                                                Completed in {step.duration.toFixed(2)}s
                                            </span>
                                        )}
                                    </div>
                                </div>

                                {/* Active pulse effect */}
                                {step.status === 'active' && (
                                    <motion.div
                                        className="absolute inset-0 border-4 border-blue-500 pointer-events-none"
                                        animate={{ opacity: [0.5, 0, 0.5] }}
                                        transition={{ duration: 1.5, repeat: Infinity }}
                                    />
                                )}
                            </motion.div>
                        ))}
                    </AnimatePresence>
                )}
            </div>

            {/* Footer */}
            <div className="bg-black text-white p-2 text-xs font-mono flex justify-between">
                <span>STEPS: {steps.filter(s => s.status === 'complete').length}/{steps.length}</span>
                <span className={isActive ? 'animate-pulse' : ''}>
                    {isActive ? 'REASONING...' : 'IDLE'}
                </span>
            </div>
        </div>
    );
}

// Helper function to convert SSE events to thought steps
export function eventsToThoughtSteps(events: Array<{
    event_type: string;
    timestamp: number;
    data: {
        message?: string;
        tool?: string;
        args?: Record<string, unknown>;
        preview?: string;
        duration?: number;
        response?: string;
        [key: string]: unknown;
    };
}>): ThoughtStep[] {
    const steps: ThoughtStep[] = [];
    let stepCounter = 0;

    for (const event of events) {
        const { event_type, timestamp, data } = event;

        switch (event_type) {
            case 'diagnosis_started':
            case 'alert_received':
                steps.push({
                    id: `step-${stepCounter++}`,
                    title: 'Initializing Analysis',
                    description: `Received alert for ${data.service || 'service'}. Starting diagnostic workflow...`,
                    status: 'complete',
                });
                break;

            case 'connecting_servers':
                steps.push({
                    id: `step-${stepCounter++}`,
                    title: 'Connecting to MCP Servers',
                    description: 'Establishing connections to Loki, Slack, and GitHub servers...',
                    status: 'active',
                });
                break;

            case 'servers_connected':
                // Update previous step to complete
                const connectStep = steps.find(s => s.title === 'Connecting to MCP Servers');
                if (connectStep) connectStep.status = 'complete';
                break;

            case 'llm_request':
                steps.push({
                    id: `step-${stepCounter++}`,
                    title: 'Analyzing with AI',
                    description: 'Sending context to LLM for root cause analysis...',
                    status: 'active',
                });
                break;

            case 'llm_response':
                const llmStep = steps.find(s => s.title === 'Analyzing with AI');
                if (llmStep) {
                    llmStep.status = 'complete';
                    llmStep.duration = data.duration;
                    llmStep.description = `Analysis complete. Identified potential issues and next steps.`;
                }
                break;

            case 'tool_call':
                const toolName = data.tool || 'unknown';
                let title = 'Executing Tool';
                let desc = `Calling ${toolName}...`;

                if (toolName === 'get_error_logs') {
                    title = 'Fetching Error Logs';
                    desc = `Querying Loki for recent error logs from ${data.args?.service || 'all services'}...`;
                } else if (toolName === 'slack_post_message') {
                    title = 'Posting to Slack';
                    desc = 'Sending incident report to Slack channel...';
                } else if (toolName === 'create_issue') {
                    title = 'Creating GitHub Issue';
                    desc = 'Creating tracking issue in GitHub repository...';
                }

                steps.push({
                    id: `step-${stepCounter++}`,
                    title,
                    description: desc,
                    status: 'active',
                    tool: toolName,
                });
                break;

            case 'tool_result':
                // Find last active tool step and complete it
                const lastToolStep = [...steps].reverse().find(s => s.status === 'active');
                if (lastToolStep) {
                    lastToolStep.status = data.is_error ? 'error' : 'complete';
                    lastToolStep.duration = data.duration;
                    if (data.preview) {
                        lastToolStep.description = data.preview.slice(0, 100) + (data.preview.length > 100 ? '...' : '');
                    }
                }
                break;

            case 'complete':
                steps.push({
                    id: `step-${stepCounter++}`,
                    title: 'Analysis Complete',
                    description: data.status === 'success'
                        ? 'Successfully completed incident analysis and posted results.'
                        : `Completed with status: ${data.status}`,
                    status: data.status === 'success' ? 'complete' : 'error',
                });
                break;
        }
    }

    return steps;
}
