import { clsx } from 'clsx';
import { CheckCircle, XCircle, Loader2 } from 'lucide-react';

interface StatusBadgeProps {
  label: string;
  status: 'connected' | 'disconnected' | 'loading';
}

export function StatusBadge({ label, status }: StatusBadgeProps) {
  return (
    <div className={`
      flex items-center gap-2 px-4 py-2 rounded-full border backdrop-blur-md transition-all duration-300
      ${status === 'connected'
        ? 'bg-emerald-500/10 border-emerald-500/20 shadow-[0_0_15px_rgba(16,185,129,0.2)]'
        : 'bg-slate-900/50 border-slate-800'
      }
    `}>
      <span className={`
        text-xs font-bold tracking-wider uppercase
        ${status === 'connected' ? 'text-emerald-400' : 'text-slate-400'}
      `}>
        {label}
      </span>

      {status === 'loading' && <Loader2 className="w-4 h-4 text-blue-400 animate-spin" />}
      {status === 'connected' && (
        <div className="relative flex items-center justify-center">
          <div className="absolute w-2 h-2 bg-emerald-400 rounded-full animate-ping opacity-75" />
          <CheckCircle className="relative w-4 h-4 text-emerald-400" />
        </div>
      )}
      {status === 'disconnected' && <XCircle className="w-4 h-4 text-red-400" />}
    </div>
  );
}
