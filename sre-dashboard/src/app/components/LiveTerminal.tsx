'use client';

import { motion, AnimatePresence } from 'framer-motion';
import { Terminal, Play, Pause, ChevronDown } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';

export interface LogLine {
    id: string;
    timestamp: string;
    service: string;
    level: 'ERROR' | 'WARN' | 'INFO' | 'DEBUG';
    message: string;
    raw?: string;
}

interface LiveTerminalProps {
    logs: LogLine[];
    isStreaming: boolean;
}

const getLevelColor = (level: LogLine['level']) => {
    switch (level) {
        case 'ERROR':
            return 'text-red-400';
        case 'WARN':
            return 'text-yellow-400';
        case 'INFO':
            return 'text-cyan-400';
        case 'DEBUG':
            return 'text-gray-500';
        default:
            return 'text-white';
    }
};

export function LiveTerminal({ logs, isStreaming }: LiveTerminalProps) {
    const scrollRef = useRef<HTMLDivElement>(null);
    const [autoScroll, setAutoScroll] = useState(true);
    const [isPaused, setIsPaused] = useState(false);

    // Auto-scroll to bottom
    useEffect(() => {
        if (autoScroll && scrollRef.current && !isPaused) {
            scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
        }
    }, [logs, autoScroll, isPaused]);

    // Detect manual scroll
    const handleScroll = () => {
        if (scrollRef.current) {
            const { scrollTop, scrollHeight, clientHeight } = scrollRef.current;
            const isAtBottom = scrollHeight - scrollTop - clientHeight < 50;
            setAutoScroll(isAtBottom);
        }
    };

    return (
        <div className="flex flex-col h-full bg-[#0a0a0a] border-4 border-black shadow-[8px_8px_0px_0px_rgba(0,0,0,1)] overflow-hidden relative">
            {/* Scanlines overlay */}
            <div
                className="absolute inset-0 pointer-events-none z-10 opacity-[0.03]"
                style={{
                    backgroundImage: 'repeating-linear-gradient(0deg, transparent, transparent 2px, rgba(255,255,255,0.1) 2px, rgba(255,255,255,0.1) 4px)',
                }}
            />

            {/* CRT glow effect */}
            <div
                className="absolute inset-0 pointer-events-none z-10"
                style={{
                    boxShadow: 'inset 0 0 100px rgba(0,255,100,0.05)',
                }}
            />

            {/* Header */}
            <div className="bg-[#1a1a1a] border-b-2 border-[#333] p-3 flex items-center justify-between relative z-20">
                <div className="flex items-center gap-3">
                    {/* Window buttons */}
                    <div className="flex gap-2">
                        <div className="w-3 h-3 bg-red-500 border border-red-700 rounded-full" />
                        <div className="w-3 h-3 bg-yellow-500 border border-yellow-700 rounded-full" />
                        <div className="w-3 h-3 bg-green-500 border border-green-700 rounded-full" />
                    </div>
                    <div className="flex items-center gap-2 text-green-400 font-mono text-sm">
                        <Terminal className="w-4 h-4" />
                        <span className="font-bold">$ LIVE_TERMINAL</span>
                    </div>
                </div>
                <div className="flex items-center gap-2">
                    <button
                        onClick={() => setIsPaused(!isPaused)}
                        className={`p-1.5 border-2 border-[#333] hover:border-[#555] transition-colors ${isPaused ? 'bg-yellow-500/20 text-yellow-400' : 'bg-transparent text-gray-400 hover:text-white'
                            }`}
                    >
                        {isPaused ? <Play className="w-4 h-4" /> : <Pause className="w-4 h-4" />}
                    </button>
                    {isStreaming && (
                        <div className="flex items-center gap-1.5 px-2 py-1 bg-green-500/20 border border-green-500/50">
                            <div className="w-2 h-2 bg-green-400 rounded-full animate-pulse" />
                            <span className="text-green-400 text-xs font-mono uppercase">Streaming</span>
                        </div>
                    )}
                </div>
            </div>

            {/* Log content */}
            <div
                ref={scrollRef}
                onScroll={handleScroll}
                className="flex-1 overflow-y-auto p-4 font-mono text-sm relative z-20"
                style={{ backgroundColor: '#0d1117' }}
            >
                {logs.length === 0 ? (
                    <div className="flex flex-col items-center justify-center h-full text-gray-600">
                        <Terminal className="w-12 h-12 mb-3 opacity-30" />
                        <p className="font-mono text-sm">Waiting for logs...</p>
                        <p className="font-mono text-xs mt-1 text-gray-700">$ tail -f /var/log/aura/*</p>
                    </div>
                ) : (
                    <AnimatePresence mode="popLayout">
                        {logs.map((log, index) => (
                            <motion.div
                                key={log.id}
                                initial={{ opacity: 0, x: -10 }}
                                animate={{ opacity: 1, x: 0 }}
                                transition={{ duration: 0.15 }}
                                className="flex items-start gap-2 py-0.5 hover:bg-white/5 px-1 -mx-1"
                            >
                                <span className="text-gray-500 shrink-0 select-none">
                                    [{log.timestamp}]
                                </span>
                                <span className="text-cyan-300 shrink-0 min-w-[120px]">
                                    {log.service}
                                </span>
                                <span className="text-gray-500">|</span>
                                <span className={`shrink-0 min-w-[50px] font-bold ${getLevelColor(log.level)}`}>
                                    {log.level}
                                </span>
                                <span className="text-gray-500">|</span>
                                <span className="text-gray-300 break-all">
                                    {log.message}
                                </span>
                            </motion.div>
                        ))}
                    </AnimatePresence>
                )}

                {/* Blinking cursor */}
                {isStreaming && (
                    <motion.span
                        className="inline-block w-2 h-4 bg-green-400 ml-1"
                        animate={{ opacity: [1, 0, 1] }}
                        transition={{ duration: 1, repeat: Infinity }}
                    />
                )}
            </div>

            {/* Scroll to bottom indicator */}
            {!autoScroll && (
                <button
                    onClick={() => {
                        setAutoScroll(true);
                        if (scrollRef.current) {
                            scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
                        }
                    }}
                    className="absolute bottom-12 right-4 z-30 p-2 bg-blue-500 border-2 border-black shadow-[2px_2px_0px_0px_#000] hover:shadow-[4px_4px_0px_0px_#000] hover:-translate-y-0.5 transition-all"
                >
                    <ChevronDown className="w-4 h-4 text-white" />
                </button>
            )}

            {/* Footer status bar */}
            <div className="bg-[#1a1a1a] border-t-2 border-[#333] p-2 text-xs font-mono flex justify-between text-gray-500 relative z-20">
                <span>LINES: {logs.length}</span>
                <span>BUFFER: {logs.length > 100 ? 'FULL' : 'OK'}</span>
                <span className={autoScroll ? 'text-green-400' : 'text-yellow-400'}>
                    AUTO-SCROLL: {autoScroll ? 'ON' : 'OFF'}
                </span>
            </div>
        </div>
    );
}

// Helper function to parse Loki logs from tool results
export function parseLogsFromToolResult(
    response: string | undefined,
    existingLogs: LogLine[]
): LogLine[] {
    if (!response) return existingLogs;

    const newLogs: LogLine[] = [];
    const lines = response.split('\n');

    for (const line of lines) {
        if (!line.trim()) continue;

        // Try to parse structured log format: [timestamp] service | LEVEL | message
        const structuredMatch = line.match(/\[([^\]]+)\]\s*(\S+)\s*\|\s*(ERROR|WARN|INFO|DEBUG)\s*\|\s*(.+)/i);
        if (structuredMatch) {
            newLogs.push({
                id: `log-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
                timestamp: structuredMatch[1],
                service: structuredMatch[2],
                level: structuredMatch[3].toUpperCase() as LogLine['level'],
                message: structuredMatch[4],
                raw: line,
            });
            continue;
        }

        // Try to extract from JSON-like log
        const jsonMatch = line.match(/"level":\s*"([^"]+)".*"msg":\s*"([^"]+)"/i);
        if (jsonMatch) {
            newLogs.push({
                id: `log-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
                timestamp: new Date().toLocaleTimeString('en-US', { hour12: false }),
                service: 'aura-backend',
                level: jsonMatch[1].toUpperCase() as LogLine['level'],
                message: jsonMatch[2],
                raw: line,
            });
            continue;
        }

        // Fallback: detect level from content
        let level: LogLine['level'] = 'INFO';
        if (line.toLowerCase().includes('error') || line.toLowerCase().includes('fail')) {
            level = 'ERROR';
        } else if (line.toLowerCase().includes('warn')) {
            level = 'WARN';
        } else if (line.toLowerCase().includes('debug')) {
            level = 'DEBUG';
        }

        // Generic log line
        if (line.length > 5) {
            newLogs.push({
                id: `log-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
                timestamp: new Date().toLocaleTimeString('en-US', { hour12: false }),
                service: 'system',
                level,
                message: line.slice(0, 200),
                raw: line,
            });
        }
    }

    // Deduplicate based on raw content
    const existingRaws = new Set(existingLogs.map(l => l.raw));
    const uniqueNewLogs = newLogs.filter(l => !existingRaws.has(l.raw));

    return [...existingLogs, ...uniqueNewLogs].slice(-200); // Keep last 200 logs
}
