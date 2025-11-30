'use client';

import { motion } from 'framer-motion';
import { AlertTriangle, Database, Bell, Brain, CheckCircle2, ArrowRight } from 'lucide-react';

export type PipelineStage = 'idle' | 'active' | 'complete' | 'error';

export interface PipelineState {
    errorDetected: PipelineStage;
    logsCollected: PipelineStage;
    alertFired: PipelineStage;
    agentAnalyzing: PipelineStage;
    actionsComplete: PipelineStage;
}

interface PipelineFlowProps {
    state: PipelineState;
}

interface StageConfig {
    key: keyof PipelineState;
    label: string;
    icon: React.ReactNode;
}

const stages: StageConfig[] = [
    { key: 'errorDetected', label: 'Error Detected', icon: <AlertTriangle className="w-5 h-5" /> },
    { key: 'logsCollected', label: 'Logs Collected', icon: <Database className="w-5 h-5" /> },
    { key: 'alertFired', label: 'Alert Fired', icon: <Bell className="w-5 h-5" /> },
    { key: 'agentAnalyzing', label: 'Agent Analyzing', icon: <Brain className="w-5 h-5" /> },
    { key: 'actionsComplete', label: 'Actions Complete', icon: <CheckCircle2 className="w-5 h-5" /> },
];

function getStageStyles(status: PipelineStage) {
    switch (status) {
        case 'active':
            return {
                bg: 'bg-blue-500/20',
                border: 'border-blue-500',
                text: 'text-blue-400',
                icon: 'text-blue-400',
                glow: 'shadow-[0_0_20px_rgba(59,130,246,0.5)]',
            };
        case 'complete':
            return {
                bg: 'bg-emerald-500/20',
                border: 'border-emerald-500',
                text: 'text-emerald-400',
                icon: 'text-emerald-400',
                glow: '',
            };
        case 'error':
            return {
                bg: 'bg-red-500/20',
                border: 'border-red-500',
                text: 'text-red-400',
                icon: 'text-red-400',
                glow: 'shadow-[0_0_20px_rgba(239,68,68,0.5)]',
            };
        default:
            return {
                bg: 'bg-slate-800/50',
                border: 'border-slate-700',
                text: 'text-slate-500',
                icon: 'text-slate-600',
                glow: '',
            };
    }
}

function getConnectorStyles(fromStatus: PipelineStage, toStatus: PipelineStage) {
    if (fromStatus === 'complete' && (toStatus === 'active' || toStatus === 'complete')) {
        return 'bg-emerald-500';
    }
    if (fromStatus === 'active') {
        return 'bg-gradient-to-r from-blue-500 to-slate-600';
    }
    return 'bg-slate-700';
}

export function PipelineFlow({ state }: PipelineFlowProps) {
    return (
        <div className="bg-slate-900/50 border border-slate-800 rounded-xl p-6 backdrop-blur-sm">
            <h3 className="text-sm font-medium text-slate-400 mb-6 uppercase tracking-wider">Pipeline Status</h3>
            
            <div className="flex items-center justify-between">
                {stages.map((stage, index) => {
                    const status = state[stage.key];
                    const styles = getStageStyles(status);
                    const isLast = index === stages.length - 1;
                    const nextStatus = !isLast ? state[stages[index + 1].key] : 'idle';
                    
                    return (
                        <div key={stage.key} className="flex items-center flex-1">
                            {/* Stage Node */}
                            <motion.div
                                className={`
                                    relative flex flex-col items-center
                                `}
                                initial={{ scale: 0.9, opacity: 0 }}
                                animate={{ scale: 1, opacity: 1 }}
                                transition={{ delay: index * 0.1 }}
                            >
                                <motion.div
                                    className={`
                                        w-12 h-12 rounded-xl border-2 flex items-center justify-center
                                        ${styles.bg} ${styles.border} ${styles.glow}
                                        transition-all duration-300
                                    `}
                                    animate={status === 'active' ? {
                                        scale: [1, 1.05, 1],
                                    } : {}}
                                    transition={{
                                        duration: 1.5,
                                        repeat: status === 'active' ? Infinity : 0,
                                        ease: "easeInOut"
                                    }}
                                >
                                    <span className={styles.icon}>
                                        {stage.icon}
                                    </span>
                                </motion.div>
                                
                                <span className={`mt-2 text-xs font-medium ${styles.text} text-center whitespace-nowrap`}>
                                    {stage.label}
                                </span>
                                
                                {/* Pulse indicator for active */}
                                {status === 'active' && (
                                    <motion.div
                                        className="absolute -inset-1 rounded-xl bg-blue-500/20"
                                        animate={{ opacity: [0.5, 0, 0.5] }}
                                        transition={{ duration: 2, repeat: Infinity }}
                                    />
                                )}
                            </motion.div>
                            
                            {/* Connector */}
                            {!isLast && (
                                <div className="flex-1 flex items-center justify-center px-2 -mt-6">
                                    <motion.div
                                        className={`h-0.5 w-full rounded-full ${getConnectorStyles(status, nextStatus)}`}
                                        initial={{ scaleX: 0 }}
                                        animate={{ scaleX: 1 }}
                                        transition={{ delay: index * 0.1 + 0.1, duration: 0.3 }}
                                    />
                                    <ArrowRight className={`w-4 h-4 -ml-1 ${
                                        status === 'complete' ? 'text-emerald-500' : 'text-slate-600'
                                    }`} />
                                </div>
                            )}
                        </div>
                    );
                })}
            </div>
        </div>
    );
}

// Helper function to map events to pipeline state
export function eventsToPipelineState(events: Array<{ event_type: string }>): PipelineState {
    const state: PipelineState = {
        errorDetected: 'idle',
        logsCollected: 'idle',
        alertFired: 'idle',
        agentAnalyzing: 'idle',
        actionsComplete: 'idle',
    };

    for (const event of events) {
        switch (event.event_type) {
            case 'alert_received':
            case 'diagnosis_started':
                state.errorDetected = 'complete';
                state.logsCollected = 'active';
                break;
            case 'connecting_servers':
            case 'server_connecting':
                state.errorDetected = 'complete';
                state.logsCollected = 'complete';
                state.alertFired = 'active';
                break;
            case 'servers_connected':
                state.errorDetected = 'complete';
                state.logsCollected = 'complete';
                state.alertFired = 'complete';
                state.agentAnalyzing = 'active';
                break;
            case 'analyzing':
            case 'llm_request':
            case 'llm_response':
            case 'tool_call':
            case 'tool_result':
                state.errorDetected = 'complete';
                state.logsCollected = 'complete';
                state.alertFired = 'complete';
                state.agentAnalyzing = 'active';
                break;
            case 'complete':
                state.errorDetected = 'complete';
                state.logsCollected = 'complete';
                state.alertFired = 'complete';
                state.agentAnalyzing = 'complete';
                state.actionsComplete = 'complete';
                break;
            case 'error':
                // Mark current active stage as error
                if (state.agentAnalyzing === 'active') state.agentAnalyzing = 'error';
                else if (state.alertFired === 'active') state.alertFired = 'error';
                else if (state.logsCollected === 'active') state.logsCollected = 'error';
                break;
        }
    }

    return state;
}

// Initial idle state
export const initialPipelineState: PipelineState = {
    errorDetected: 'idle',
    logsCollected: 'idle',
    alertFired: 'idle',
    agentAnalyzing: 'idle',
    actionsComplete: 'idle',
};
