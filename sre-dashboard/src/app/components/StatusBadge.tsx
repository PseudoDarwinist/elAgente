import { clsx } from 'clsx';
import { Check, X, Loader2 } from 'lucide-react';

interface StatusBadgeProps {
  label: string;
  status: 'connected' | 'disconnected' | 'loading';
}

export function StatusBadge({ label, status }: StatusBadgeProps) {
  return (
    <div className={clsx(
      "flex items-center gap-3 px-4 py-2 border-3 border-black font-bold uppercase tracking-wider transition-all duration-200",
      "shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] hover:translate-y-[-2px] hover:shadow-[6px_6px_0px_0px_rgba(0,0,0,1)]",
      status === 'connected' ? "bg-[#bbf7d0] text-black" : 
      status === 'disconnected' ? "bg-[#fca5a5] text-black" :
      "bg-[#fef08a] text-black"
    )}>
      <span className="text-xs md:text-sm font-black">{label}</span>

      <div className="p-1 border-2 border-black bg-white rounded-none">
        {status === 'loading' && <Loader2 className="w-4 h-4 animate-spin" />}
        {status === 'connected' && <Check className="w-4 h-4 text-black" />}
        {status === 'disconnected' && <X className="w-4 h-4 text-black" />}
      </div>
    </div>
  );
}
