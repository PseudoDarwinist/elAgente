'use client';

import { InvestigationState } from '@/types/events';
import { AlertCard } from './AlertCard';
import { InvestigationStep } from './InvestigationStep';
import { AgentMessage } from './AgentMessage';
import { Loader2, Zap } from 'lucide-react';

interface InvestigationPanelProps {
    state: InvestigationState;
}

export function InvestigationPanel({ state }: InvestigationPanelProps) {
    const { alert, steps, messages, isActive } = state;

    // Interleave messages and steps based on timestamp
    const items: Array<{ type: 'step' | 'message'; data: typeof steps[0] | typeof messages[0]; timestamp: number }> = [];

    steps.forEach(step => {
        items.push({ type: 'step', data: step, timestamp: step.timestamp });
    });

    messages.forEach(msg => {
        items.push({ type: 'message', data: msg, timestamp: msg.timestamp });
    });

    // Sort by timestamp
    items.sort((a, b) => a.timestamp - b.timestamp);

    return (
        <div className="investigation-panel">
            {/* Header */}
            <div className="sticky top-0 bg-white border-b border-gray-200 p-4 z-10">
                <div className="flex items-center justify-between">
                    <h2 className="text-lg font-semibold text-gray-900">Investigation</h2>
                    {isActive && (
                        <div className="flex items-center gap-2 px-3 py-1 bg-blue-50 rounded-full">
                            <Loader2 className="w-3 h-3 text-blue-500 animate-spin" />
                            <span className="text-xs font-medium text-blue-600">Live</span>
                        </div>
                    )}
                </div>
            </div>

            {/* Content */}
            <div className="p-4">
                {/* Alert Card */}
                {alert && <AlertCard alert={alert} />}

                {/* Investigation Items */}
                {items.length === 0 && !isActive ? (
                    <div className="text-center py-12">
                        <Zap className="w-12 h-12 text-gray-300 mx-auto mb-4" />
                        <p className="text-gray-500 text-sm">
                            Start an investigation to see the agent&apos;s reasoning process
                        </p>
                    </div>
                ) : (
                    <div className="space-y-0">
                        {items.map((item, index) => (
                            <div key={`${item.type}-${index}`}>
                                {item.type === 'message' ? (
                                    <AgentMessage message={item.data as typeof messages[0]} />
                                ) : (
                                    <InvestigationStep step={item.data as typeof steps[0]} />
                                )}
                            </div>
                        ))}
                    </div>
                )}

                {/* Active indicator */}
                {isActive && (
                    <div className="flex items-center gap-2 py-4 text-gray-400">
                        <Loader2 className="w-4 h-4 animate-spin" />
                        <span className="text-sm">Agent is thinking...</span>
                    </div>
                )}
            </div>
        </div>
    );
}
