import { motion } from 'framer-motion';
import { Terminal, Check, Loader2, AlertCircle } from 'lucide-react';
import { useEffect, useRef } from 'react';

export interface LogEntry {
    id: string;
    message: string;
    type: 'info' | 'success' | 'error' | 'process';
    timestamp: number;
}

interface InvestigationFeedProps {
    logs: LogEntry[];
}

export function InvestigationFeed({ logs }: InvestigationFeedProps) {
    const scrollRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        if (scrollRef.current) {
            scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
        }
    }, [logs]);

    return (
        <div className="flex flex-col h-full bg-slate-950/80 border border-slate-800 rounded-xl overflow-hidden shadow-[0_0_30px_rgba(0,0,0,0.5)] backdrop-blur-sm ring-1 ring-white/5">
            <div className="flex items-center gap-2 px-4 py-3 bg-slate-900/90 border-b border-slate-800">
                <div className="p-1.5 bg-blue-500/10 rounded-md">
                    <Terminal className="w-4 h-4 text-blue-400" />
                </div>
                <span className="text-sm font-mono text-blue-200 tracking-tight">AGENT_ACTIVITY_LOG</span>
                <div className="ml-auto flex items-center gap-2">
                    <div className="flex gap-1.5">
                        <div className="w-2 h-2 rounded-full bg-slate-700" />
                        <div className="w-2 h-2 rounded-full bg-slate-700" />
                        <div className="w-2 h-2 rounded-full bg-slate-700" />
                    </div>
                </div>
            </div>

            <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 space-y-3 font-mono text-sm">
                {logs.length === 0 && (
                    <div className="text-slate-600 text-center mt-10 italic">
                        Waiting for diagnosis trigger...
                    </div>
                )}

                {logs.map((log) => (
                    <motion.div
                        key={log.id}
                        initial={{ opacity: 0, x: -10 }}
                        animate={{ opacity: 1, x: 0 }}
                        className="flex items-start gap-3"
                    >
                        <div className="mt-1">
                            {log.type === 'process' && <Loader2 className="w-3.5 h-3.5 text-blue-400 animate-spin" />}
                            {log.type === 'success' && <Check className="w-3.5 h-3.5 text-emerald-400" />}
                            {log.type === 'error' && <AlertCircle className="w-3.5 h-3.5 text-red-400" />}
                            {log.type === 'info' && <div className="w-1.5 h-1.5 rounded-full bg-slate-600 mt-1" />}
                        </div>
                        <div className="flex-1">
                            <p className={`
                ${log.type === 'process' ? 'text-blue-300' : ''}
                ${log.type === 'success' ? 'text-emerald-300' : ''}
                ${log.type === 'error' ? 'text-red-300' : ''}
                ${log.type === 'info' ? 'text-slate-400' : ''}
              `}>
                                {log.message}
                            </p>
                            <span className="text-[10px] text-slate-700">
                                {new Date(log.timestamp).toLocaleTimeString()}
                            </span>
                        </div>
                    </motion.div>
                ))}
            </div>
        </div>
    );
}
