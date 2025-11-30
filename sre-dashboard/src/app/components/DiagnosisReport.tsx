import { motion } from 'framer-motion';
import { AlertTriangle, CheckCircle2, FileCode, Search } from 'lucide-react';

interface DiagnosisReportProps {
    report: string | null;
}

export function DiagnosisReport({ report }: DiagnosisReportProps) {
    if (!report) return null;

    // Simple parsing logic for the markdown-like report from the agent
    // This is a basic implementation, in a real app we'd use a markdown parser
    const sections = report.split('\n\n');

    return (
        <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-slate-900/60 border border-slate-800 rounded-2xl p-8 shadow-2xl backdrop-blur-xl ring-1 ring-white/10 relative overflow-hidden"
        >
            {/* Decorative gradient blob */}
            <div className="absolute -top-20 -right-20 w-64 h-64 bg-purple-500/10 rounded-full blur-[80px] pointer-events-none" />

            <div className="flex items-center gap-4 mb-8 relative z-10">
                <div className="p-3 bg-purple-500/10 rounded-xl border border-purple-500/20 shadow-[0_0_15px_rgba(168,85,247,0.1)]">
                    <Search className="w-6 h-6 text-purple-400" />
                </div>
                <div>
                    <h2 className="text-2xl font-bold text-white tracking-tight">Diagnosis Report</h2>
                    <p className="text-slate-400 text-sm">Automated Root Cause Analysis</p>
                </div>
            </div>

            <div className="prose prose-invert max-w-none">
                <div className="whitespace-pre-wrap text-slate-300 font-sans leading-relaxed">
                    {report}
                </div>
            </div>

            <div className="mt-8 pt-6 border-t border-slate-800 flex gap-4">
                <button className="flex items-center gap-2 px-4 py-2 bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 rounded-lg border border-emerald-500/20 transition-colors">
                    <CheckCircle2 className="w-4 h-4" />
                    Apply Fix
                </button>
                <button className="flex items-center gap-2 px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg border border-slate-700 transition-colors">
                    <FileCode className="w-4 h-4" />
                    View Full Context
                </button>
            </div>
        </motion.div>
    );
}
