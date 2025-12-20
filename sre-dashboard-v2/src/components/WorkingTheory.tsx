'use client';

import { WorkingTheory as WorkingTheoryType } from '@/types/events';
import { ConfidenceBadge } from './ConfidenceBadge';
import { Flame } from 'lucide-react';

interface WorkingTheoryProps {
    theory: WorkingTheoryType;
}

export function WorkingTheory({ theory }: WorkingTheoryProps) {
    return (
        <div className="card p-6">
            <div className="mb-4">
                <ConfidenceBadge level={theory.confidence} />
            </div>

            <h3 className="text-xl font-semibold text-gray-900 mb-4">
                {theory.title}
            </h3>

            <div className="space-y-4">
                {theory.sections.map((section, index) => (
                    <div key={index}>
                        <h4 className="font-semibold text-gray-800 mb-2">
                            {section.heading}:
                        </h4>
                        <p className="text-gray-700 leading-relaxed">
                            {section.content}
                        </p>
                    </div>
                ))}
            </div>
        </div>
    );
}

// Placeholder when no theory yet
export function WorkingTheoryPlaceholder() {
    return (
        <div className="card p-6">
            <div className="flex items-center gap-2 text-gray-400 mb-4">
                <Flame className="w-5 h-5" />
                <span className="text-sm">Working Theory</span>
            </div>
            <div className="text-center py-12 text-gray-400">
                <p className="text-sm">Investigation in progress...</p>
                <p className="text-xs mt-2">Working theory will appear here once the agent forms a hypothesis</p>
            </div>
        </div>
    );
}
