'use client';

import { Flame, AlertTriangle, Info } from 'lucide-react';

interface ConfidenceBadgeProps {
    level: 'high' | 'medium' | 'low';
}

export function ConfidenceBadge({ level }: ConfidenceBadgeProps) {
    const config = {
        high: {
            icon: <Flame className="w-3.5 h-3.5" />,
            label: 'High Confidence',
            className: 'badge badge-high',
        },
        medium: {
            icon: <AlertTriangle className="w-3.5 h-3.5" />,
            label: 'Medium Confidence',
            className: 'badge badge-medium',
        },
        low: {
            icon: <Info className="w-3.5 h-3.5" />,
            label: 'Low Confidence',
            className: 'badge badge-low',
        },
    };

    const { icon, label, className } = config[level];

    return (
        <span className={className}>
            {icon}
            {label}
        </span>
    );
}

interface SeverityBadgeProps {
    severity: 'fire' | 'warning' | 'info';
}

export function SeverityBadge({ severity }: SeverityBadgeProps) {
    const config = {
        fire: {
            label: 'FIRE',
            className: 'badge badge-fire',
        },
        warning: {
            label: 'WARNING',
            className: 'badge badge-medium',
        },
        info: {
            label: 'INFO',
            className: 'badge badge-high',
        },
    };

    const { label, className } = config[severity];

    return <span className={className}>{label}</span>;
}
