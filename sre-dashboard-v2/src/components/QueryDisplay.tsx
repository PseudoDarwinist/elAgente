'use client';

import { useState } from 'react';
import { Copy, Check } from 'lucide-react';

interface QueryDisplayProps {
    query: string;
    queryType?: 'loki' | 'promql' | 'tempo' | 'other';
    duration?: number;
}

export function QueryDisplay({ query, queryType = 'other', duration }: QueryDisplayProps) {
    const [copied, setCopied] = useState(false);

    const handleCopy = async () => {
        await navigator.clipboard.writeText(query);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    };

    const getTypeLabel = () => {
        switch (queryType) {
            case 'loki':
                return 'loki';
            case 'promql':
                return 'promql';
            case 'tempo':
                return 'tempo';
            default:
                return 'query';
        }
    };

    return (
        <div className="query-display group">
            <div className="flex items-center gap-2 mb-2">
                <span className="text-xs font-medium text-gray-500 uppercase tracking-wide">
                    {getTypeLabel()}
                </span>
                {duration && (
                    <span className="text-xs text-gray-400">
                        {duration.toFixed(1)}s
                    </span>
                )}
            </div>
            <code className="text-sm break-all whitespace-pre-wrap">
                {query}
            </code>
            <button
                onClick={handleCopy}
                className="copy-button group-hover:opacity-100"
                title="Copy query"
            >
                {copied ? (
                    <Check className="w-3.5 h-3.5 text-green-500" />
                ) : (
                    <Copy className="w-3.5 h-3.5 text-gray-400" />
                )}
            </button>
        </div>
    );
}
