'use client';

import { InvestigationState } from '@/types/events';
import { WorkingTheory, WorkingTheoryPlaceholder } from './WorkingTheory';
import { formatRelativeTime } from '@/utils/parseEvents';
import { ThumbsUp, MessageSquare, FileText, Settings } from 'lucide-react';

interface ReportPanelProps {
    state: InvestigationState;
}

export function ReportPanel({ state }: ReportPanelProps) {
    const { workingTheory, lastUpdated, isActive } = state;

    return (
        <div className="report-panel">
            {/* Header */}
            <div className="flex items-center justify-between mb-6">
                <h2 className="text-lg font-semibold text-gray-900">Report</h2>
                <div className="flex items-center gap-4">
                    <button className="p-2 hover:bg-gray-100 rounded">
                        <ThumbsUp className="w-4 h-4 text-gray-400" />
                    </button>
                    <button className="p-2 hover:bg-gray-100 rounded">
                        <MessageSquare className="w-4 h-4 text-gray-400" />
                    </button>
                    {lastUpdated && (
                        <span className="text-sm text-gray-500">
                            Updated {formatRelativeTime(lastUpdated)}
                        </span>
                    )}
                    <button className="p-2 hover:bg-gray-100 rounded">
                        <FileText className="w-4 h-4 text-gray-400" />
                    </button>
                    <button className="p-2 hover:bg-gray-100 rounded">
                        <Settings className="w-4 h-4 text-gray-400" />
                    </button>
                </div>
            </div>

            {/* Working Theory Section */}
            <section className="mb-8">
                <h3 className="text-xl font-semibold text-gray-900 mb-4">
                    {workingTheory ? '1 Working Theory' : 'Working Theory'}
                </h3>

                {workingTheory ? (
                    <WorkingTheory theory={workingTheory} />
                ) : (
                    <WorkingTheoryPlaceholder />
                )}
            </section>

            {/* Timeline Section - Placeholder */}
            {workingTheory && (
                <section className="mb-8">
                    <h3 className="text-lg font-semibold text-gray-900 mb-4">Timeline</h3>
                    <div className="card p-4">
                        <div className="space-y-3">
                            <div className="flex items-center gap-3">
                                <div className="w-2 h-2 rounded-full bg-red-500" />
                                <span className="text-sm text-gray-700">Error spike detected</span>
                                <span className="text-xs text-gray-400 ml-auto">5 min ago</span>
                            </div>
                            <div className="flex items-center gap-3">
                                <div className="w-2 h-2 rounded-full bg-yellow-500" />
                                <span className="text-sm text-gray-700">Service degradation started</span>
                                <span className="text-xs text-gray-400 ml-auto">10 min ago</span>
                            </div>
                            <div className="flex items-center gap-3">
                                <div className="w-2 h-2 rounded-full bg-blue-500" />
                                <span className="text-sm text-gray-700">Deployment completed</span>
                                <span className="text-xs text-gray-400 ml-auto">15 min ago</span>
                            </div>
                        </div>
                    </div>
                </section>
            )}

            {/* Recommendations Section - Placeholder */}
            {workingTheory && (
                <section className="mb-8">
                    <h3 className="text-lg font-semibold text-gray-900 mb-4">Recommendations</h3>
                    <div className="card p-4">
                        <ul className="space-y-2 text-sm text-gray-700">
                            <li className="flex items-start gap-2">
                                <span className="text-green-500 mt-0.5">•</span>
                                <span>Roll back the recent deployment to the previous stable version</span>
                            </li>
                            <li className="flex items-start gap-2">
                                <span className="text-green-500 mt-0.5">•</span>
                                <span>Scale up the affected pods to handle the current load</span>
                            </li>
                            <li className="flex items-start gap-2">
                                <span className="text-green-500 mt-0.5">•</span>
                                <span>Monitor the error rate after remediation</span>
                            </li>
                        </ul>
                    </div>
                </section>
            )}

            {/* Investigation in progress message */}
            {isActive && !workingTheory && (
                <div className="text-center py-12 text-gray-400">
                    <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-gray-100 flex items-center justify-center">
                        <FileText className="w-8 h-8" />
                    </div>
                    <p className="text-sm">Report will be generated as the investigation progresses</p>
                </div>
            )}
        </div>
    );
}
