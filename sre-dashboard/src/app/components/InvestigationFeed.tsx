import { motion } from 'framer-motion';
import { Terminal, Check, Loader2, AlertCircle, ArrowRight } from 'lucide-react';
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
        <div className="flex flex-col h-[600px] bg-white border-4 border-black shadow-[8px_8px_0px_0px_rgba(0,0,0,1)] overflow-hidden relative">
            {/* Header Tape */}
            <div className="bg-yellow-300 border-b-4 border-black p-4 flex items-center justify-between relative z-10">
                <div className="flex items-center gap-3">
                    <div className="bg-black text-white p-2 font-mono font-bold text-lg">
                        LOG_STREAM
                    </div>
                    <div className="flex gap-1">
                        <div className="w-3 h-3 bg-red-500 border-2 border-black rounded-full" />
                        <div className="w-3 h-3 bg-yellow-500 border-2 border-black rounded-full" />
                        <div className="w-3 h-3 bg-green-500 border-2 border-black rounded-full" />
                    </div>
                </div>
                <div className="font-mono text-xs font-bold uppercase tracking-widest">
                    Sys.Active
                </div>
            </div>

            {/* Zigzag tear effect */}
            <div className="h-4 w-full bg-repeat-x relative -mt-2 z-20" 
                 style={{ 
                     backgroundImage: 'linear-gradient(135deg, #fff 25%, transparent 25%), linear-gradient(225deg, #fff 25%, transparent 25%)',
                     backgroundSize: '20px 20px'
                 }} 
            />

            <div ref={scrollRef} className="flex-1 overflow-y-auto p-6 space-y-4 font-mono text-sm bg-[#fafafa] relative">
                {/* Grid background */}
                <div className="absolute inset-0 opacity-10 pointer-events-none" 
                     style={{ backgroundImage: 'radial-gradient(#000 1px, transparent 1px)', backgroundSize: '20px 20px' }} 
                />

                {logs.length === 0 && (
                    <div className="flex flex-col items-center justify-center h-full text-neutral-400 space-y-4">
                        <div className="w-16 h-16 border-4 border-neutral-300 rounded-full flex items-center justify-center animate-pulse">
                            <Terminal className="w-8 h-8" />
                        </div>
                        <p className="font-bold uppercase tracking-widest">Awaiting Input...</p>
                    </div>
                )}

                {logs.map((log, i) => (
                    <motion.div
                        key={log.id}
                        initial={{ opacity: 0, x: -20, rotateX: -10 }}
                        animate={{ opacity: 1, x: 0, rotateX: 0 }}
                        transition={{ type: 'spring', stiffness: 100 }}
                        className="relative pl-4 group"
                    >
                        {/* Timeline line */}
                        <div className="absolute left-0 top-2 bottom-[-20px] w-0.5 bg-neutral-200 group-last:hidden" />
                        
                        {/* Bullet */}
                        <div className={`
                            absolute left-[-4px] top-1.5 w-2.5 h-2.5 border-2 border-black rotate-45
                            ${log.type === 'error' ? 'bg-red-500' : 
                              log.type === 'success' ? 'bg-green-500' : 
                              log.type === 'process' ? 'bg-blue-500' : 'bg-white'}
                        `} />

                        <div className="flex items-start gap-3 p-3 border-2 border-transparent hover:border-black hover:bg-white hover:shadow-[4px_4px_0px_0px_rgba(0,0,0,0.1)] transition-all rounded-lg">
                            <span className="mt-0.5 font-bold text-xs bg-black text-white px-1 py-0.5 shrink-0">
                                {new Date(log.timestamp).toLocaleTimeString([], { hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                            </span>
                            
                            <div className="flex-1">
                                <p className={`font-bold leading-snug ${
                                    log.type === 'error' ? 'text-red-600' : 'text-black'
                                }`}>
                                    {log.message}
                                </p>
                                {log.type === 'process' && (
                                    <div className="mt-1 h-1 w-12 bg-gray-200 overflow-hidden">
                                        <div className="h-full bg-blue-500 animate-[progress_1s_ease-in-out_infinite]" 
                                             style={{ width: '50%' }} />
                                    </div>
                                )}
                            </div>
                        </div>
                    </motion.div>
                ))}
            </div>
            
            {/* Footer status */}
            <div className="bg-black text-white p-2 text-xs font-mono flex justify-between">
                <span>BUFFER: OK</span>
                <span className="animate-pulse">_CURSOR_ACTIVE</span>
            </div>
        </div>
    );
}
