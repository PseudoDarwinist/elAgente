'use client';

import { useState } from 'react';
import {
    FileSearch,
    CheckCircle,
    AlertTriangle,
    XCircle,
    ChevronDown,
    ChevronRight,
    Database,
    Server,
    Cpu,
    Activity
} from 'lucide-react';

interface InvestigationFinding {
    service: string;
    status: 'HEALTHY' | 'DEGRADED' | 'CRITICAL' | 'UNKNOWN';
    findings: string[];
    evidence: string[];
    metrics?: {
        errorRate?: string;
        latency?: string;
        cpu?: string;
        memory?: string;
    };
}

interface InvestigationLogProps {
    findings: InvestigationFinding[];
    isActive?: boolean;
}

const getStatusIcon = (status: string) => {
    switch (status.toUpperCase()) {
        case 'HEALTHY':
            return <CheckCircle className="w-5 h-5 text-green-600" />;
        case 'DEGRADED':
            return <AlertTriangle className="w-5 h-5 text-yellow-600" />;
        case 'CRITICAL':
            return <XCircle className="w-5 h-5 text-red-600" />;
        default:
            return <Activity className="w-5 h-5 text-gray-500" />;
    }
};

const getStatusBg = (status: string) => {
    switch (status.toUpperCase()) {
        case 'HEALTHY':
            return 'bg-green-100 border-green-400';
        case 'DEGRADED':
            return 'bg-yellow-100 border-yellow-400';
        case 'CRITICAL':
            return 'bg-red-100 border-red-400';
        default:
            return 'bg-gray-100 border-gray-400';
    }
};

const getServiceIcon = (serviceName: string) => {
    const lower = serviceName.toLowerCase();
    if (lower.includes('db') || lower.includes('database') || lower.includes('postgres')) {
        return <Database className="w-4 h-4" />;
    }
    if (lower.includes('cpu') || lower.includes('compute')) {
        return <Cpu className="w-4 h-4" />;
    }
    return <Server className="w-4 h-4" />;
};

function FindingCard({ finding, isExpanded, onToggle }: {
    finding: InvestigationFinding;
    isExpanded: boolean;
    onToggle: () => void;
}) {
    return (
        <div className={`border-3 border-black shadow-[4px_4px_0px_0px_#000] ${getStatusBg(finding.status)}`}>
            {/* Header - clickable */}
            <button
                onClick={onToggle}
                className="w-full px-4 py-3 flex items-center justify-between text-left hover:bg-opacity-80 transition-colors"
            >
                <div className="flex items-center gap-3">
                    {getStatusIcon(finding.status)}
                    <div className="flex items-center gap-2">
                        {getServiceIcon(finding.service)}
                        <span className="font-mono font-bold uppercase text-sm">
                            {finding.service}
                        </span>
                    </div>
                    <span className={`
                        px-2 py-0.5 text-xs font-black uppercase border-2 border-black
                        ${finding.status === 'HEALTHY' ? 'bg-green-300' : ''}
                        ${finding.status === 'DEGRADED' ? 'bg-yellow-300' : ''}
                        ${finding.status === 'CRITICAL' ? 'bg-red-300' : ''}
                    `}>
                        {finding.status}
                    </span>
                </div>
                <div className="flex items-center gap-2">
                    <span className="text-xs text-gray-600 font-mono">
                        {finding.findings.length + finding.evidence.length} items
                    </span>
                    {isExpanded ? (
                        <ChevronDown className="w-4 h-4" />
                    ) : (
                        <ChevronRight className="w-4 h-4" />
                    )}
                </div>
            </button>

            {/* Expanded content */}
            {isExpanded && (
                <div className="border-t-3 border-black p-4 bg-white/50 space-y-4">
                    {/* Metrics row */}
                    {finding.metrics && Object.keys(finding.metrics).length > 0 && (
                        <div className="flex flex-wrap gap-3">
                            {finding.metrics.errorRate && (
                                <div className="px-3 py-1 bg-white border-2 border-black font-mono text-sm">
                                    <span className="text-gray-500">ERR: </span>
                                    <span className="font-bold text-red-600">{finding.metrics.errorRate}</span>
                                </div>
                            )}
                            {finding.metrics.latency && (
                                <div className="px-3 py-1 bg-white border-2 border-black font-mono text-sm">
                                    <span className="text-gray-500">LAT: </span>
                                    <span className="font-bold">{finding.metrics.latency}</span>
                                </div>
                            )}
                            {finding.metrics.cpu && (
                                <div className="px-3 py-1 bg-white border-2 border-black font-mono text-sm">
                                    <span className="text-gray-500">CPU: </span>
                                    <span className="font-bold text-orange-600">{finding.metrics.cpu}</span>
                                </div>
                            )}
                            {finding.metrics.memory && (
                                <div className="px-3 py-1 bg-white border-2 border-black font-mono text-sm">
                                    <span className="text-gray-500">MEM: </span>
                                    <span className="font-bold">{finding.metrics.memory}</span>
                                </div>
                            )}
                        </div>
                    )}

                    {/* Findings */}
                    {finding.findings.length > 0 && (
                        <div>
                            <h4 className="text-xs font-black uppercase text-gray-600 mb-2">Findings</h4>
                            <ul className="space-y-1">
                                {finding.findings.map((f, i) => (
                                    <li key={i} className="flex items-start gap-2 text-sm font-mono">
                                        <span className="text-gray-400">•</span>
                                        <span>{f}</span>
                                    </li>
                                ))}
                            </ul>
                        </div>
                    )}

                    {/* Evidence */}
                    {finding.evidence.length > 0 && (
                        <div>
                            <h4 className="text-xs font-black uppercase text-gray-600 mb-2">Evidence</h4>
                            <div className="bg-black/5 p-2 font-mono text-xs overflow-x-auto">
                                {finding.evidence.map((e, i) => (
                                    <div key={i} className="py-1 border-b border-black/10 last:border-0">
                                        {e}
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}

export function InvestigationLog({ findings = [], isActive = false }: InvestigationLogProps) {
    const [expandedServices, setExpandedServices] = useState<Set<string>>(new Set());

    const toggleService = (service: string) => {
        setExpandedServices(prev => {
            const next = new Set(prev);
            if (next.has(service)) {
                next.delete(service);
            } else {
                next.add(service);
            }
            return next;
        });
    };

    // Auto-expand critical services
    const criticalServices = findings.filter(f => f.status === 'CRITICAL').map(f => f.service);

    return (
        <div className="bg-white border-4 border-black shadow-[6px_6px_0px_0px_#000] h-full flex flex-col">
            {/* Header */}
            <div className="p-4 border-b-4 border-black bg-gray-100 flex items-center justify-between">
                <h3 className="text-lg font-black uppercase flex items-center gap-2">
                    <FileSearch className="w-5 h-5" />
                    <span className="bg-black text-white px-2">Investigation</span> Log
                </h3>
                {findings.length > 0 && (
                    <div className="flex items-center gap-2">
                        <span className="text-xs font-mono text-gray-600">
                            {findings.length} services checked
                        </span>
                        {isActive && (
                            <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
                        )}
                    </div>
                )}
            </div>

            {/* Content */}
            <div className="flex-1 overflow-y-auto p-4">
                {findings.length === 0 ? (
                    <div className="flex flex-col items-center justify-center h-full text-gray-500 font-mono text-sm">
                        <FileSearch className="w-8 h-8 mb-2 opacity-50" />
                        <span>Waiting for investigation data...</span>
                    </div>
                ) : (
                    <div className="space-y-3">
                        {findings.map((finding) => (
                            <FindingCard
                                key={finding.service}
                                finding={finding}
                                isExpanded={expandedServices.has(finding.service) || criticalServices.includes(finding.service)}
                                onToggle={() => toggleService(finding.service)}
                            />
                        ))}
                    </div>
                )}
            </div>

            {/* Summary footer */}
            {findings.length > 0 && (
                <div className="p-3 border-t-4 border-black bg-gray-50 flex justify-between text-xs font-mono">
                    <div className="flex gap-4">
                        <span className="flex items-center gap-1">
                            <div className="w-2 h-2 bg-green-400 border border-black" />
                            {findings.filter(f => f.status === 'HEALTHY').length} healthy
                        </span>
                        <span className="flex items-center gap-1">
                            <div className="w-2 h-2 bg-yellow-400 border border-black" />
                            {findings.filter(f => f.status === 'DEGRADED').length} degraded
                        </span>
                        <span className="flex items-center gap-1">
                            <div className="w-2 h-2 bg-red-400 border border-black" />
                            {findings.filter(f => f.status === 'CRITICAL').length} critical
                        </span>
                    </div>
                </div>
            )}
        </div>
    );
}

// Helper to parse investigation findings from events
export function parseInvestigationFindings(events: Array<{ event_type: string; data: { response?: string } }>): InvestigationFinding[] {
    const completeEvent = events.find(e => e.event_type === 'complete' && e.data.response);

    if (completeEvent?.data.response) {
        const response = completeEvent.data.response;

        // Try to parse JSON from response
        const jsonMatch = response.match(/```json\s*([\s\S]*?)```/);
        if (jsonMatch) {
            try {
                const parsed = JSON.parse(jsonMatch[1]);
                if (parsed.investigation && Array.isArray(parsed.investigation)) {
                    return parsed.investigation.map((item: {
                        service: string;
                        status: string;
                        findings?: string[];
                        evidence?: string[];
                    }) => ({
                        service: item.service,
                        status: item.status?.toUpperCase() || 'UNKNOWN',
                        findings: item.findings || [],
                        evidence: item.evidence || [],
                    }));
                }
            } catch {
                // Not valid JSON
            }
        }
    }

    return [];
}

export default InvestigationLog;
