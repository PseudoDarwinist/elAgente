import { motion } from 'framer-motion';
import { CheckCircle2, FileCode, Search, ShieldAlert, Printer } from 'lucide-react';

interface DiagnosisReportProps {
    report: string | null;
}

export function DiagnosisReport({ report }: DiagnosisReportProps) {
    if (!report) return null;

    return (
        <motion.div
            initial={{ opacity: 0, scale: 0.9, rotate: 1 }}
            animate={{ opacity: 1, scale: 1, rotate: 0 }}
            className="relative bg-[#fdfbf7] border-4 border-black shadow-[12px_12px_0px_0px_rgba(0,0,0,1)] p-0 overflow-hidden"
        >
            {/* Folder Tab */}
            <div className="absolute -top-1 left-0 w-32 h-8 bg-black transform skew-x-12 -ml-4" />
            
            {/* Header */}
            <div className="bg-yellow-400 border-b-4 border-black p-6 flex items-start justify-between relative z-10">
                <div className="flex gap-4 items-center">
                    <div className="w-12 h-12 bg-white border-4 border-black flex items-center justify-center shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]">
                        <ShieldAlert className="w-6 h-6 text-black" />
                    </div>
                    <div>
                        <h2 className="text-3xl font-black text-black tracking-tighter uppercase italic">Confidential</h2>
                        <p className="text-sm font-bold font-mono text-black/70">CASE_ID: {Math.random().toString(36).substr(2, 9).toUpperCase()}</p>
                    </div>
                </div>
                <div className="bg-white border-2 border-black px-3 py-1 rotate-[-2deg]">
                    <span className="text-red-600 font-black text-xs uppercase border-2 border-red-600 px-1 inline-block transform rotate-2">Top Secret</span>
                </div>
            </div>

            {/* Content */}
            <div className="p-8 bg-[#f8f5f2]" style={{ backgroundImage: 'linear-gradient(#e5e5e5 1px, transparent 1px), linear-gradient(90deg, #e5e5e5 1px, transparent 1px)', backgroundSize: '20px 20px' }}>
                <div className="prose prose-neutral max-w-none">
                    <div className="font-mono text-sm text-black leading-relaxed whitespace-pre-wrap bg-white border-2 border-neutral-200 p-6 shadow-[4px_4px_0px_0px_rgba(0,0,0,0.05)]">
                        {report}
                    </div>
                </div>

                <div className="mt-8 pt-6 border-t-4 border-black/10 flex gap-4">
                    <button className="flex-1 flex items-center justify-center gap-2 px-6 py-4 bg-[#86efac] hover:bg-[#4ade80] text-black font-black uppercase tracking-wide border-4 border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] hover:translate-y-[-2px] hover:shadow-[6px_6px_0px_0px_rgba(0,0,0,1)] active:translate-y-0 active:shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] transition-all">
                        <CheckCircle2 className="w-6 h-6" />
                        Execute Fix
                    </button>
                    
                    <button className="flex items-center justify-center gap-2 px-6 py-4 bg-white hover:bg-gray-50 text-black font-bold uppercase border-4 border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] hover:translate-y-[-2px] hover:shadow-[6px_6px_0px_0px_rgba(0,0,0,1)] active:translate-y-0 active:shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] transition-all">
                        <Printer className="w-5 h-5" />
                    </button>
                </div>
            </div>
            
            {/* Watermark */}
            <div className="absolute bottom-4 right-4 opacity-10 pointer-events-none rotate-[-20deg]">
                <span className="text-8xl font-black text-red-600 border-8 border-red-600 px-4 py-2 rounded-xl">CLASSIFIED</span>
            </div>
        </motion.div>
    );
}
