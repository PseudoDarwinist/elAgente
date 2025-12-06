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
    color: string;
}

const stages: StageConfig[] = [
    { key: 'errorDetected', label: 'ERROR', icon: <AlertTriangle className="w-6 h-6" />, color: '#fca5a5' },
    { key: 'logsCollected', label: 'LOGS', icon: <Database className="w-6 h-6" />, color: '#bae6fd' },
    { key: 'alertFired', label: 'ALERT', icon: <Bell className="w-6 h-6" />, color: '#fde047' },
    { key: 'agentAnalyzing', label: 'BRAIN', icon: <Brain className="w-6 h-6" />, color: '#d8b4fe' },
    { key: 'actionsComplete', label: 'DONE', icon: <CheckCircle2 className="w-6 h-6" />, color: '#86efac' },
];

function getStageStyles(status: PipelineStage, baseColor: string) {
    switch (status) {
        case 'active':
            return {
                bg: baseColor,
                border: 'border-black',
                opacity: 'opacity-100',
                transform: 'scale-110',
                shadow: 'shadow-[6px_6px_0px_0px_rgba(0,0,0,1)]',
            };
        case 'complete':
            return {
                bg: '#ffffff',
                border: 'border-black',
                opacity: 'opacity-100',
                transform: 'scale-100',
                shadow: 'shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]',
            };
        case 'error':
            return {
                bg: '#ef4444',
                border: 'border-black',
                opacity: 'opacity-100',
                transform: 'rotate-3',
                shadow: 'shadow-[6px_6px_0px_0px_rgba(0,0,0,1)]',
            };
        default:
            return {
                bg: '#e5e7eb',
                border: 'border-neutral-400',
                opacity: 'opacity-50',
                transform: 'scale-100',
                shadow: 'shadow-none',
            };
    }
}

export function PipelineFlow({ state }: PipelineFlowProps) {
    return (
        <div className="w-full overflow-x-auto pb-8">
            <div className="min-w-[800px] bg-white border-4 border-black p-8 shadow-[8px_8px_0px_0px_rgba(0,0,0,1)]">
                <div className="flex items-center justify-between gap-4">
                    {stages.map((stage, index) => {
                        const status = state[stage.key];
                        const styles = getStageStyles(status, stage.color);
                        const isLast = index === stages.length - 1;
                        
                        return (
                            <div key={stage.key} className="flex items-center flex-1 group">
                                {/* Stage Node */}
                                <motion.div
                                    className={`
                                        relative flex flex-col items-center justify-center
                                        w-24 h-24 border-4 transition-all duration-200 z-10
                                        ${styles.bg} ${styles.border} ${styles.shadow} ${styles.opacity}
                                    `}
                                    animate={status === 'active' ? {
                                        rotate: [-1, 1, -1],
                                        scale: [1.05, 1.1, 1.05],
                                    } : {}}
                                    transition={{
                                        duration: 0.5,
                                        repeat: status === 'active' ? Infinity : 0,
                                    }}
                                >
                                    <div className="text-black mb-1">
                                        {stage.icon}
                                    </div>
                                    <span className="text-xs font-black text-black tracking-tighter uppercase">
                                        {stage.label}
                                    </span>
                                    
                                    {/* Status Indicator Badge */}
                                    <div className="absolute -top-3 -right-3">
                                        {status === 'active' && (
                                            <div className="w-6 h-6 bg-blue-500 border-2 border-black animate-bounce flex items-center justify-center">
                                                <div className="w-2 h-2 bg-white rounded-full" />
                                            </div>
                                        )}
                                        {status === 'complete' && (
                                            <div className="w-6 h-6 bg-green-500 border-2 border-black flex items-center justify-center">
                                                <CheckCircle2 className="w-4 h-4 text-white" />
                                            </div>
                                        )}
                                    </div>
                                </motion.div>
                                
                                {/* Connector */}
                                {!isLast && (
                                    <div className="flex-1 h-2 mx-2 bg-gray-200 border-y-2 border-black relative overflow-hidden">
                                        {/* Progress bar inside connector */}
                                        <motion.div 
                                            className="absolute inset-0 bg-black"
                                            initial={{ x: '-100%' }}
                                            animate={{ 
                                                x: status === 'complete' ? '0%' : '-100%' 
                                            }}
                                            transition={{ duration: 0.5 }}
                                        />
                                        {status === 'active' && (
                                            <motion.div 
                                                className="absolute inset-0 bg-black/20"
                                                animate={{ x: ['-100%', '100%'] }}
                                                transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
                                            />
                                        )}
                                    </div>
                                )}
                            </div>
                        );
                    })}
                </div>
            </div>
        </div>
    );
}

// Helper function (kept same logic)
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
                if (state.agentAnalyzing === 'active') state.agentAnalyzing = 'error';
                else if (state.alertFired === 'active') state.alertFired = 'error';
                else if (state.logsCollected === 'active') state.logsCollected = 'error';
                break;
        }
    }
    return state;
}

export const initialPipelineState: PipelineState = {
    errorDetected: 'idle',
    logsCollected: 'idle',
    alertFired: 'idle',
    agentAnalyzing: 'idle',
    actionsComplete: 'idle',
};
