'use client';

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Check, Loader2, ChevronDown, ChevronRight } from 'lucide-react';
import { InvestigationStep as InvestigationStepType, SubTask } from '@/types/events';
import { QueryDisplay } from './QueryDisplay';

interface InvestigationStepProps {
    step: InvestigationStepType;
}

export function InvestigationStep({ step }: InvestigationStepProps) {
    const [isExpanded, setIsExpanded] = useState(step.status === 'active');

    const getStatusIcon = () => {
        switch (step.status) {
            case 'complete':
                return (
                    <div className="step-indicator step-indicator-complete">
                        <Check className="w-3 h-3" />
                    </div>
                );
            case 'active':
                return (
                    <div className="step-indicator step-indicator-active">
                        <Loader2 className="w-3 h-3 animate-spin" />
                    </div>
                );
            case 'error':
                return (
                    <div className="step-indicator bg-red-500 text-white">
                        <span className="text-xs">!</span>
                    </div>
                );
            default:
                return (
                    <div className="step-indicator step-indicator-pending">
                        <span className="text-xs">○</span>
                    </div>
                );
        }
    };

    const hasSubTasks = step.subTasks && step.subTasks.length > 0;
    const completedSubTasks = step.subTasks?.filter(s => s.status === 'complete').length || 0;

    return (
        <div
            className={`step-card ${isExpanded ? 'step-card-expanded' : ''}`}
            onClick={() => hasSubTasks && setIsExpanded(!isExpanded)}
        >
            <div className="flex items-start gap-3">
                {getStatusIcon()}

                <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                            <h4 className="font-medium text-gray-900">
                                {step.title}
                            </h4>
                            {step.summary && (
                                <span className="text-sm text-gray-500">
                                    • {step.summary}
                                </span>
                            )}
                        </div>

                        {hasSubTasks && (
                            <button className="p-1 hover:bg-gray-200 rounded">
                                {isExpanded ? (
                                    <ChevronDown className="w-4 h-4 text-gray-400" />
                                ) : (
                                    <ChevronRight className="w-4 h-4 text-gray-400" />
                                )}
                            </button>
                        )}
                    </div>

                    <AnimatePresence>
                        {isExpanded && hasSubTasks && (
                            <motion.div
                                initial={{ height: 0, opacity: 0 }}
                                animate={{ height: 'auto', opacity: 1 }}
                                exit={{ height: 0, opacity: 0 }}
                                transition={{ duration: 0.2 }}
                                className="mt-3 overflow-hidden"
                                onClick={(e) => e.stopPropagation()}
                            >
                                {/* Progress */}
                                <div className="progress-text mb-3">
                                    <span className="progress-link">
                                        {completedSubTasks} previous tasks
                                    </span>
                                </div>

                                {/* Sub-tasks */}
                                <div className="space-y-2">
                                    {step.subTasks.map((subTask) => (
                                        <SubTaskItem key={subTask.id} subTask={subTask} />
                                    ))}
                                </div>
                            </motion.div>
                        )}
                    </AnimatePresence>
                </div>
            </div>
        </div>
    );
}

function SubTaskItem({ subTask }: { subTask: SubTask }) {
    return (
        <div className="sub-task">
            <div className="flex items-center gap-2 flex-1">
                {subTask.status === 'complete' && (
                    <span className="text-gray-400">•</span>
                )}
                {subTask.status === 'active' && (
                    <Loader2 className="w-3 h-3 text-blue-500 animate-spin" />
                )}
                <span className="sub-task-title">{subTask.title}</span>
                {subTask.duration && (
                    <span className="sub-task-duration">{subTask.duration.toFixed(0)}s</span>
                )}
            </div>

            {subTask.query && (
                <div className="mt-2 ml-5">
                    <QueryDisplay
                        query={subTask.query}
                        queryType={subTask.queryType}
                        duration={subTask.duration}
                    />
                </div>
            )}
        </div>
    );
}
