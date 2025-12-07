/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useMemo } from 'react';

interface RevenueImpactDashboardProps {
    startTime: number;
    isResolved: boolean;
    sreAgentStatus?: {
        step: 'detecting' | 'logs' | 'analyzing' | 'fixing' | 'validating' | 'done';
        message?: string;
    };
}

// Revenue loss rate: $5,600 per minute = $93.33 per second (ITIC 2024 data)
const REVENUE_LOSS_PER_SECOND = 93.33;

const RevenueImpactDashboard: React.FC<RevenueImpactDashboardProps> = ({
    startTime,
    isResolved,
    sreAgentStatus = { step: 'detecting', message: 'Detecting error...' }
}) => {
    const [elapsedSeconds, setElapsedSeconds] = useState(0);
    const [graphPoints, setGraphPoints] = useState<number[]>([0]);

    useEffect(() => {
        if (isResolved) return;

        const interval = setInterval(() => {
            const now = Date.now();
            const elapsed = Math.floor((now - startTime) / 1000);
            setElapsedSeconds(elapsed);

            // Update graph points (keep last 20 points)
            const loss = elapsed * REVENUE_LOSS_PER_SECOND;
            setGraphPoints(prev => [...prev.slice(-19), loss]);
        }, 1000);

        return () => clearInterval(interval);
    }, [startTime, isResolved]);

    const revenueLoss = useMemo(() => {
        return elapsedSeconds * REVENUE_LOSS_PER_SECOND;
    }, [elapsedSeconds]);

    const formatTime = (seconds: number) => {
        const mins = Math.floor(seconds / 60);
        const secs = seconds % 60;
        return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    };

    const formatCurrency = (amount: number) => {
        return new Intl.NumberFormat('en-US', {
            style: 'currency',
            currency: 'USD',
            minimumFractionDigits: 0,
            maximumFractionDigits: 0
        }).format(amount);
    };

    // Generate SVG path for the graph
    const graphPath = useMemo(() => {
        if (graphPoints.length < 2) return '';
        const maxValue = Math.max(...graphPoints, 1000);
        const width = 280;
        const height = 80;

        const points = graphPoints.map((value, index) => {
            const x = (index / (graphPoints.length - 1)) * width;
            const y = height - (value / maxValue) * height;
            return `${x},${y}`;
        });

        return `M ${points.join(' L ')}`;
    }, [graphPoints]);

    const pipelineSteps = [
        { id: 'detecting', label: 'Error Detected', icon: '⚠️' },
        { id: 'logs', label: 'Logs Retrieved', icon: '📋' },
        { id: 'analyzing', label: 'Root Cause Analysis', icon: '🔍' },
        { id: 'fixing', label: 'Fix Deployment', icon: '🔧' },
        { id: 'validating', label: 'Validation', icon: '✅' },
    ];

    const getStepStatus = (stepId: string) => {
        const stepOrder = ['detecting', 'logs', 'analyzing', 'fixing', 'validating', 'done'];
        const currentIndex = stepOrder.indexOf(sreAgentStatus.step);
        const stepIndex = stepOrder.indexOf(stepId);

        if (stepIndex < currentIndex) return 'complete';
        if (stepIndex === currentIndex) return 'active';
        return 'pending';
    };

    return (
        <div className="h-full bg-slate-900 text-white p-6 overflow-y-auto animate-slide-in-right">
            {/* Header */}
            <div className="flex items-center gap-3 mb-6">
                <div className="w-3 h-3 rounded-full bg-red-500 animate-pulse"></div>
                <h2 className="text-lg font-semibold tracking-wide uppercase text-red-400">
                    Revenue Impact Dashboard
                </h2>
            </div>

            {/* Revenue Loss Counter */}
            <div className="bg-slate-800/50 rounded-xl p-6 mb-6 border border-red-500/30 animate-pulse-glow">
                <p className="text-xs text-slate-400 uppercase tracking-widest mb-2">Revenue Lost</p>
                <div className="flex items-baseline gap-2">
                    <span className="text-4xl font-mono font-bold text-red-400 tabular-nums">
                        {formatCurrency(revenueLoss)}
                    </span>
                </div>
                <div className="flex items-center gap-2 mt-2">
                    <span className="text-sm text-red-300">+{formatCurrency(REVENUE_LOSS_PER_SECOND)}/sec</span>
                    <svg className="w-4 h-4 text-red-400 animate-bounce" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 10l7-7m0 0l7 7m-7-7v18" />
                    </svg>
                </div>
            </div>

            {/* Timer */}
            <div className="bg-slate-800/50 rounded-xl p-5 mb-6 border border-slate-700">
                <p className="text-xs text-slate-400 uppercase tracking-widest mb-3">Time to Resolution</p>
                <div className="flex items-center justify-center">
                    <div className="relative">
                        <svg className="w-24 h-24 transform -rotate-90">
                            <circle
                                cx="48"
                                cy="48"
                                r="42"
                                stroke="#334155"
                                strokeWidth="6"
                                fill="none"
                            />
                            <circle
                                cx="48"
                                cy="48"
                                r="42"
                                stroke="url(#timerGradient)"
                                strokeWidth="6"
                                fill="none"
                                strokeDasharray={`${Math.min(elapsedSeconds * 2, 264)} 264`}
                                strokeLinecap="round"
                            />
                            <defs>
                                <linearGradient id="timerGradient" x1="0%" y1="0%" x2="100%" y2="0%">
                                    <stop offset="0%" stopColor="#f97316" />
                                    <stop offset="100%" stopColor="#ef4444" />
                                </linearGradient>
                            </defs>
                        </svg>
                        <div className="absolute inset-0 flex flex-col items-center justify-center">
                            <span className="text-2xl font-mono font-bold text-white">{formatTime(elapsedSeconds)}</span>
                            <span className="text-xs text-slate-400">elapsed</span>
                        </div>
                    </div>
                </div>
            </div>

            {/* Revenue Loss Graph */}
            <div className="bg-slate-800/50 rounded-xl p-5 mb-6 border border-slate-700">
                <p className="text-xs text-slate-400 uppercase tracking-widest mb-3">Revenue Loss Trend</p>
                <svg viewBox="0 0 280 80" className="w-full h-20">
                    <defs>
                        <linearGradient id="graphGradient" x1="0%" y1="0%" x2="0%" y2="100%">
                            <stop offset="0%" stopColor="#ef4444" stopOpacity="0.5" />
                            <stop offset="100%" stopColor="#ef4444" stopOpacity="0" />
                        </linearGradient>
                    </defs>
                    {graphPath && (
                        <>
                            <path
                                d={graphPath + ` L 280,80 L 0,80 Z`}
                                fill="url(#graphGradient)"
                            />
                            <path
                                d={graphPath}
                                fill="none"
                                stroke="#ef4444"
                                strokeWidth="2"
                                strokeLinecap="round"
                            />
                        </>
                    )}
                </svg>
            </div>

            {/* Industry Stats */}
            <div className="bg-gradient-to-br from-slate-800/50 to-slate-800/30 rounded-xl p-5 mb-6 border border-amber-500/20">
                <p className="text-xs text-amber-400 uppercase tracking-widest mb-3 flex items-center gap-2">
                    <span>📊</span> Industry Benchmark
                </p>
                <div className="space-y-2 text-sm">
                    <div className="flex justify-between">
                        <span className="text-slate-400">Avg. downtime cost:</span>
                        <span className="text-white font-semibold">$5,600/min</span>
                    </div>
                    <div className="flex justify-between">
                        <span className="text-slate-400">Avg. resolution time:</span>
                        <span className="text-white font-semibold">4+ hours</span>
                    </div>
                </div>
                <p className="text-xs text-slate-500 mt-3 italic">*Source: ITIC 2024 Hourly Cost of Downtime Report</p>
            </div>

            {/* SRE Agent Status */}
            <div className="bg-slate-800/50 rounded-xl p-5 border border-cyan-500/30">
                <div className="flex items-center gap-2 mb-4">
                    <div className="w-2 h-2 rounded-full bg-cyan-400 animate-pulse"></div>
                    <p className="text-xs text-cyan-400 uppercase tracking-widest font-semibold">SRE Agent</p>
                </div>

                {/* Progress bar */}
                <div className="w-full bg-slate-700 rounded-full h-2 mb-4">
                    <div
                        className="bg-gradient-to-r from-cyan-500 to-cyan-400 h-2 rounded-full transition-all duration-500"
                        style={{
                            width: `${((['detecting', 'logs', 'analyzing', 'fixing', 'validating', 'done'].indexOf(sreAgentStatus.step) + 1) / 5) * 100}%`
                        }}
                    ></div>
                </div>

                {/* Pipeline steps */}
                <div className="space-y-2">
                    {pipelineSteps.map((step) => {
                        const status = getStepStatus(step.id);
                        return (
                            <div
                                key={step.id}
                                className={`flex items-center gap-3 text-sm px-3 py-2 rounded-lg transition-all ${status === 'complete' ? 'bg-cyan-500/10 text-cyan-400' :
                                        status === 'active' ? 'bg-orange-500/10 text-orange-400 animate-pulse' :
                                            'text-slate-500'
                                    }`}
                            >
                                <span className="w-5 text-center">
                                    {status === 'complete' ? '✓' : status === 'active' ? '●' : '○'}
                                </span>
                                <span>{step.label}</span>
                            </div>
                        );
                    })}
                </div>

                {sreAgentStatus.message && (
                    <p className="text-xs text-slate-400 mt-4 pt-3 border-t border-slate-700">
                        {sreAgentStatus.message}
                    </p>
                )}
            </div>
        </div>
    );
};

export default RevenueImpactDashboard;
