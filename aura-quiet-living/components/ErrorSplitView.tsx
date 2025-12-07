/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import RevenueImpactDashboard from './RevenueImpactDashboard';

interface ErrorSplitViewProps {
    children: React.ReactNode;
    isActive: boolean;
    errorStartTime: number;
    errorMessage: string;
    onRetry: () => void;
    isRetrying?: boolean;
    sreAgentStatus?: {
        step: 'detecting' | 'logs' | 'analyzing' | 'fixing' | 'validating' | 'done';
        message?: string;
    };
}

const ErrorSplitView: React.FC<ErrorSplitViewProps> = ({
    children,
    isActive,
    errorStartTime,
    errorMessage,
    onRetry,
    isRetrying = false,
    sreAgentStatus
}) => {
    if (!isActive) {
        return <>{children}</>;
    }

    return (
        <div className="fixed inset-0 z-50 flex bg-slate-50">
            {/* Left Side: Dimmed Checkout with Error Overlay */}
            <div className="w-3/5 relative overflow-hidden">
                {/* Original content dimmed */}
                <div className="opacity-40 pointer-events-none blur-sm scale-[0.98] origin-center transition-all duration-500">
                    {children}
                </div>

                {/* Error Overlay */}
                <div className="absolute inset-0 flex items-center justify-center bg-gradient-to-br from-slate-900/70 to-slate-800/80 backdrop-blur-sm">
                    <div className="max-w-md text-center p-8 animate-fade-in-up">
                        {/* Error Icon */}
                        <div className="w-20 h-20 mx-auto mb-6 rounded-full bg-red-500/20 flex items-center justify-center animate-pulse">
                            <svg className="w-10 h-10 text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                            </svg>
                        </div>

                        {/* Error Message */}
                        <h2 className="text-2xl font-serif text-white mb-3">Payment Service Unavailable</h2>
                        <p className="text-slate-300 mb-6">{errorMessage}</p>

                        {/* Status Badge */}
                        <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-orange-500/20 text-orange-300 text-sm mb-6">
                            <div className="w-2 h-2 rounded-full bg-orange-400 animate-pulse"></div>
                            <span>SRE Agent is investigating...</span>
                        </div>

                        {/* Retry Button */}
                        <div>
                            <button
                                onClick={onRetry}
                                disabled={isRetrying}
                                className={`px-8 py-3 rounded-lg font-semibold text-sm uppercase tracking-widest transition-all duration-300 ${isRetrying
                                        ? 'bg-slate-600 text-slate-400 cursor-wait'
                                        : 'bg-white text-slate-900 hover:bg-slate-100 hover:scale-105 shadow-lg shadow-white/20'
                                    }`}
                            >
                                {isRetrying ? (
                                    <span className="flex items-center gap-2">
                                        <svg className="animate-spin w-4 h-4" fill="none" viewBox="0 0 24 24">
                                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                        </svg>
                                        Retrying...
                                    </span>
                                ) : (
                                    'Retry Payment'
                                )}
                            </button>
                        </div>
                    </div>
                </div>
            </div>

            {/* Center Divider */}
            <div className="w-1 bg-gradient-to-b from-red-500 via-orange-500 to-red-500 shadow-lg shadow-red-500/50 animate-pulse"></div>

            {/* Right Side: Revenue Impact Dashboard */}
            <div className="w-2/5 bg-slate-900 overflow-hidden">
                <RevenueImpactDashboard
                    startTime={errorStartTime}
                    isResolved={false}
                    sreAgentStatus={sreAgentStatus}
                />
            </div>
        </div>
    );
};

export default ErrorSplitView;
