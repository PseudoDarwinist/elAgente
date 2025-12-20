'use client';

import { useState, useCallback, useEffect } from 'react';
import { Rocket, Zap, Search, CheckCircle, XCircle, StopCircle, ExternalLink } from 'lucide-react';
import { clsx } from 'clsx';

type DemoState = 'idle' | 'injecting' | 'active' | 'diagnosing' | 'done' | 'error';

interface DemoModeButtonProps {
    isDiagnosing: boolean;
    onDemoStart?: () => void;
    onDemoEnd?: () => void;
}

const AURA_BACKEND_URL = process.env.NEXT_PUBLIC_AURA_BACKEND_URL || 'http://localhost:4000';
const AURA_FRONTEND_URL = process.env.NEXT_PUBLIC_AURA_FRONTEND_URL || 'http://localhost:8080';

export function DemoModeButton({ isDiagnosing, onDemoStart, onDemoEnd }: DemoModeButtonProps) {
    const [demoState, setDemoState] = useState<DemoState>('idle');
    const [errorMessage, setErrorMessage] = useState<string | null>(null);

    // Inject fault into Aura backend
    const injectFault = useCallback(async () => {
        const response = await fetch(`${AURA_BACKEND_URL}/api/admin/fault`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ error_rate: 1.0 }),
        });
        if (!response.ok) throw new Error('Failed to inject fault');
        return response.json();
    }, []);

    // Clear fault from Aura backend
    const clearFault = useCallback(async () => {
        try {
            await fetch(`${AURA_BACKEND_URL}/api/admin/fault`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ error_rate: 0 }),
            });
        } catch (e) {
            console.error('Failed to clear fault:', e);
        }
    }, []);

    // Track when diagnosis starts/ends
    useEffect(() => {
        if (demoState === 'active' && isDiagnosing) {
            setDemoState('diagnosing');
            onDemoStart?.();
        }
    }, [isDiagnosing, demoState, onDemoStart]);

    useEffect(() => {
        if (demoState === 'diagnosing' && !isDiagnosing) {
            setDemoState('done');
            // Auto-clear fault when diagnosis completes
            clearFault();
        }
    }, [isDiagnosing, demoState, clearFault]);

    // Auto-reset after showing done state
    useEffect(() => {
        if (demoState === 'done') {
            const timer = setTimeout(() => {
                setDemoState('idle');
                onDemoEnd?.();
            }, 5000);
            return () => clearTimeout(timer);
        }
    }, [demoState, onDemoEnd]);

    const startDemo = useCallback(async () => {
        setErrorMessage(null);

        try {
            // Step 1: Inject fault
            setDemoState('injecting');
            await injectFault();

            // Step 2: Open Aura shop in new tab
            setDemoState('active');
            window.open(AURA_FRONTEND_URL, '_blank');

        } catch (error) {
            console.error('Demo failed:', error);
            setDemoState('error');
            setErrorMessage(error instanceof Error ? error.message : 'Failed to inject fault');
            await clearFault();
        }
    }, [injectFault, clearFault]);

    const stopDemo = useCallback(async () => {
        await clearFault();
        setDemoState('idle');
        onDemoEnd?.();
    }, [clearFault, onDemoEnd]);

    const stateConfig = {
        idle: {
            icon: Rocket,
            label: 'START DEMO',
            sublabel: 'Inject fault & open shop',
            bg: 'bg-[#fef08a]',
            hoverBg: 'hover:bg-[#fde047]',
            animate: '',
        },
        injecting: {
            icon: Zap,
            label: 'INJECTING...',
            sublabel: 'Setting up fault',
            bg: 'bg-[#fed7aa]',
            hoverBg: '',
            animate: 'animate-pulse',
        },
        active: {
            icon: ExternalLink,
            label: 'FAULT ACTIVE',
            sublabel: 'Go checkout in Aura →',
            bg: 'bg-[#fca5a5]',
            hoverBg: '',
            animate: 'animate-pulse',
        },
        diagnosing: {
            icon: Search,
            label: 'AI ANALYZING',
            sublabel: 'Investigating real errors...',
            bg: 'bg-[#bbf7d0]',
            hoverBg: '',
            animate: '',
        },
        done: {
            icon: CheckCircle,
            label: 'COMPLETE',
            sublabel: 'Fault auto-cleared',
            bg: 'bg-[#86efac]',
            hoverBg: '',
            animate: '',
        },
        error: {
            icon: XCircle,
            label: 'FAILED',
            sublabel: errorMessage || 'Click to retry',
            bg: 'bg-[#fca5a5]',
            hoverBg: 'hover:bg-[#f87171]',
            animate: '',
        },
    };

    const config = stateConfig[demoState];
    const Icon = config.icon;
    const canStart = demoState === 'idle' || demoState === 'error' || demoState === 'done';
    const canStop = demoState === 'active' || demoState === 'diagnosing';

    return (
        <div className="flex items-center gap-3">
            {/* Main Demo Button */}
            <button
                onClick={canStart ? startDemo : undefined}
                disabled={!canStart && !canStop}
                className={clsx(
                    "relative flex items-center gap-3 px-5 py-2.5 border-4 border-black font-black uppercase tracking-wider transition-all duration-200",
                    "shadow-[6px_6px_0px_0px_rgba(0,0,0,1)]",
                    config.bg,
                    config.hoverBg,
                    config.animate,
                    canStart && "hover:translate-y-[-2px] hover:shadow-[8px_8px_0px_0px_rgba(0,0,0,1)] cursor-pointer",
                    canStart && "active:translate-y-[2px] active:shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]",
                    !canStart && !canStop && "cursor-wait"
                )}
            >
                {/* Glowing border when diagnosing */}
                {demoState === 'diagnosing' && (
                    <div className="absolute inset-0 border-4 border-green-400 animate-pulse pointer-events-none" />
                )}

                <div className="p-1.5 bg-white border-2 border-black">
                    <Icon className={clsx("w-4 h-4 text-black", demoState === 'injecting' && "animate-spin")} />
                </div>

                <div className="text-left">
                    <div className="text-xs md:text-sm leading-none">{config.label}</div>
                    <div className="text-[9px] md:text-[10px] font-mono font-normal text-gray-700 mt-0.5 normal-case">
                        {config.sublabel}
                    </div>
                </div>
            </button>

            {/* Stop Button (visible when fault is active or diagnosing) */}
            {canStop && (
                <button
                    onClick={stopDemo}
                    className={clsx(
                        "flex items-center gap-2 px-3 py-2.5 border-4 border-black font-black uppercase tracking-wider transition-all duration-200",
                        "shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]",
                        "bg-[#fca5a5] hover:bg-[#f87171]",
                        "hover:translate-y-[-2px] hover:shadow-[6px_6px_0px_0px_rgba(0,0,0,1)]",
                        "active:translate-y-[2px] active:shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]"
                    )}
                >
                    <StopCircle className="w-4 h-4" />
                    <span className="text-xs">STOP</span>
                </button>
            )}
        </div>
    );
}
