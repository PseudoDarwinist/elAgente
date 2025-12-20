'use client';

import { useEffect, useState } from 'react';
import { CheckCircle, XCircle, ArrowRight, Zap, Circle, AlertCircle } from 'lucide-react';

interface FaultPropagationChainProps {
    impactPath: string[];
    rootCauseService?: string;
    faultyServices?: string[];  // Services that have actual errors
    serviceStatuses?: Record<string, {
        status: string;
        findings?: string[];
    }>;
    isActive?: boolean;
}

type NodeStatus = 'healthy' | 'faulty' | 'unknown' | 'affected';

const getStatusColor = (status: NodeStatus) => {
    switch (status) {
        case 'healthy':
            return 'bg-green-200 border-green-600';
        case 'faulty':
            return 'bg-red-300 border-red-600';
        case 'affected':
            return 'bg-yellow-200 border-yellow-600';
        default:
            return 'bg-gray-100 border-gray-400';
    }
};

const getStatusIcon = (status: NodeStatus) => {
    switch (status) {
        case 'healthy':
            return <CheckCircle className="w-5 h-5 text-green-600" />;
        case 'faulty':
            return <XCircle className="w-5 h-5 text-red-600" />;
        case 'affected':
            return <AlertCircle className="w-5 h-5 text-yellow-600" />;
        default:
            return <Circle className="w-5 h-5 text-gray-400" />;
    }
};

export function FaultPropagationChain({
    impactPath = [],
    rootCauseService,
    faultyServices = [],
    serviceStatuses = {},
    isActive = false,
}: FaultPropagationChainProps) {
    const [animatedIndex, setAnimatedIndex] = useState(0);

    // Merge all discovered services: impactPath + serviceStatuses keys
    // Keep impactPath order as primary, add any additional services from serviceStatuses
    const discoveredServices = [...new Set([
        ...impactPath,
        ...Object.keys(serviceStatuses)
    ])];

    // Animate through the path when active
    useEffect(() => {
        if (isActive && discoveredServices.length > 0) {
            const interval = setInterval(() => {
                setAnimatedIndex((prev) => (prev + 1) % discoveredServices.length);
            }, 1000);
            return () => clearInterval(interval);
        }
    }, [isActive, discoveredServices.length]);

    // Determine status for each node - defaults to healthy unless explicitly faulty
    const getNodeStatus = (nodeId: string): NodeStatus => {
        const normalizedNode = nodeId.toLowerCase().replace(/[_-]/g, '');

        console.log(`[getNodeStatus] nodeId=${nodeId}, rootCauseService=${rootCauseService}, faultyServices=`, faultyServices, 'serviceStatuses=', serviceStatuses);

        // Check if this is in the faultyServices array
        const isFaultyFromArray = faultyServices.some(s => {
            const normalized = s.toLowerCase().replace(/[_-]/g, '');
            return normalized.includes(normalizedNode) || normalizedNode.includes(normalized);
        });
        if (isFaultyFromArray) {
            console.log(`[getNodeStatus] ${nodeId} is FAULTY from faultyServices`);
            return 'faulty';
        }

        // Check if this matches the root cause  
        if (rootCauseService) {
            const normalizedRoot = rootCauseService.toLowerCase().replace(/[_-]/g, '');
            console.log(`[getNodeStatus] Comparing normalizedNode=${normalizedNode} vs normalizedRoot=${normalizedRoot}`);
            if (normalizedRoot.includes(normalizedNode) || normalizedNode.includes(normalizedRoot)) {
                console.log(`[getNodeStatus] ${nodeId} is FAULTY - matches root cause`);
                return 'faulty';
            }
        }

        // Check serviceStatuses for health info
        const status = serviceStatuses[nodeId]?.status?.toLowerCase();
        console.log(`[getNodeStatus] serviceStatuses[${nodeId}] status = ${status}`);
        if (status === 'critical' || status === 'error' || status === 'faulty') return 'faulty';
        if (status === 'degraded' || status === 'warning') return 'affected';
        if (status === 'healthy' || status === 'ok') return 'healthy';

        // Default: healthy (agent checked and found no issues)
        return 'healthy';
    };

    // Show waiting state when no services discovered
    if (discoveredServices.length === 0) {
        return (
            <div className="bg-white border-4 border-black p-6 shadow-[6px_6px_0px_0px_#000]">
                <h3 className="text-lg font-black uppercase mb-4 flex items-center gap-2">
                    <Zap className="w-5 h-5" />
                    <span className="bg-black text-white px-2">Fault Propagation</span> Chain
                </h3>
                <div className="flex items-center justify-center py-8 text-gray-500 font-mono text-sm">
                    {isActive ? (
                        <div className="flex items-center gap-2">
                            <div className="w-4 h-4 border-2 border-black border-t-transparent animate-spin" />
                            <span>Discovering topology...</span>
                        </div>
                    ) : (
                        <span>Waiting for topology discovery...</span>
                    )}
                </div>
            </div>
        );
    }

    return (
        <div className="bg-white border-4 border-black p-6 shadow-[6px_6px_0px_0px_#000]">
            <h3 className="text-lg font-black uppercase mb-6 flex items-center gap-2">
                <Zap className="w-5 h-5" />
                <span className="bg-black text-white px-2">Fault Propagation</span> Chain
                <span className="text-sm font-mono font-normal text-gray-600">
                    ({discoveredServices.length} services)
                </span>
            </h3>

            {/* Dynamic chain visualization based on discovered topology */}
            <div className="overflow-x-auto pb-4">
                <div className="flex items-center justify-center gap-2 min-w-max">
                    {discoveredServices.map((serviceId, index) => {
                        const status = getNodeStatus(serviceId);
                        const isFaulty = status === 'faulty';
                        const isRootCause = rootCauseService &&
                            (rootCauseService.toLowerCase().replace(/[_-]/g, '').includes(serviceId.toLowerCase().replace(/[_-]/g, '')) ||
                                serviceId.toLowerCase().replace(/[_-]/g, '').includes(rootCauseService.toLowerCase().replace(/[_-]/g, '')));

                        return (
                            <div key={serviceId} className="flex items-center">
                                {/* Node */}
                                <div
                                    className={`
                                        relative px-5 py-4 border-4 border-black 
                                        ${getStatusColor(status)}
                                        shadow-[4px_4px_0px_0px_#000]
                                        ${isActive && index === animatedIndex ? 'animate-pulse ring-4 ring-blue-400' : ''}
                                        ${isFaulty ? 'ring-4 ring-red-500' : ''}
                                        transition-all duration-300
                                    `}
                                >
                                    {/* Service name */}
                                    <div className="flex items-center gap-2 mb-2">
                                        <span className="font-mono font-bold text-sm uppercase">
                                            {serviceId}
                                        </span>
                                    </div>

                                    {/* Status indicator */}
                                    <div className="flex items-center justify-center gap-2">
                                        {getStatusIcon(status)}
                                        <span className={`text-xs font-mono uppercase font-bold
                                            ${status === 'healthy' ? 'text-green-700' : ''}
                                            ${status === 'faulty' ? 'text-red-700' : ''}
                                            ${status === 'affected' ? 'text-yellow-700' : ''}
                                            ${status === 'unknown' ? 'text-gray-500' : ''}
                                        `}>
                                            {status.toUpperCase()}
                                        </span>
                                    </div>

                                    {/* Root cause indicator - only on actual root cause */}
                                    {isRootCause && (
                                        <div className="absolute -top-3 -right-3 bg-red-600 text-white text-xs font-black px-2 py-0.5 border-2 border-black shadow-[2px_2px_0px_0px_#000] transform rotate-12">
                                            ROOT CAUSE
                                        </div>
                                    )}
                                </div>

                                {/* Arrow connector */}
                                {index < discoveredServices.length - 1 && (
                                    <div className="flex items-center px-3">
                                        <ArrowRight
                                            className={`w-8 h-8 transition-all duration-300
                                                ${isActive && index === animatedIndex ? 'scale-125 text-blue-600' : 'text-black'}
                                            `}
                                        />
                                    </div>
                                )}
                            </div>
                        );
                    })}
                </div>
            </div>

            {/* Legend */}
            <div className="mt-4 pt-4 border-t-2 border-black flex flex-wrap gap-4">
                <div className="flex items-center gap-2 text-xs font-mono">
                    <div className="w-3 h-3 bg-green-200 border-2 border-black" />
                    <span>HEALTHY</span>
                </div>
                <div className="flex items-center gap-2 text-xs font-mono">
                    <div className="w-3 h-3 bg-yellow-200 border-2 border-black" />
                    <span>AFFECTED</span>
                </div>
                <div className="flex items-center gap-2 text-xs font-mono">
                    <div className="w-3 h-3 bg-red-300 border-2 border-black" />
                    <span>ROOT CAUSE</span>
                </div>
            </div>
        </div>
    );
}

// Helper function to parse fault propagation from agent response
// Extracts impactPath, rootCauseService, and serviceStatuses from complete event or tool results
export function parseFaultPropagation(events: Array<{ event_type: string; data: { response?: string; preview?: string; tool?: string; args?: Record<string, unknown> } }>): {
    impactPath: string[];
    rootCauseService?: string;
    faultyServices: string[];
    serviceStatuses: Record<string, { status: string; findings: string[] }>;
} {
    const services: string[] = [];
    let rootCause: string | undefined;
    const faultyServices: string[] = [];
    const serviceStatuses: Record<string, { status: string; findings: string[] }> = {};

    // Extract services from tool_call events (services being investigated)
    for (const event of events) {
        if (event.event_type === 'tool_call' && event.data.args?.service) {
            const svc = event.data.args.service as string;
            if (!services.includes(svc)) {
                services.push(svc);
            }
        }

        // Try to extract from tool_result events (get_impact_radius)
        if (event.event_type === 'tool_result' && event.data.preview) {
            try {
                const data = JSON.parse(event.data.preview);
                // get_impact_radius returns { impactPath: [...], service: "..." }
                if (data.impactPath && Array.isArray(data.impactPath) && data.impactPath.length > 0) {
                    console.log('[parseFaultPropagation] Found impactPath in tool_result:', data.impactPath);
                    return {
                        impactPath: data.impactPath,
                        rootCauseService: data.service,
                        faultyServices: [],
                        serviceStatuses: {},
                    };
                }
                // Extract any service names from the response
                if (data.service && !services.includes(data.service)) {
                    services.push(data.service);
                }
                if (data.affectedServices) {
                    data.affectedServices.forEach((s: string) => {
                        if (!services.includes(s)) services.push(s);
                    });
                }
            } catch {
                // Not JSON, continue
            }
        }
    }

    // Look for the complete event with JSON response
    const completeEvent = events.find(e => e.event_type === 'complete' && e.data.response);

    if (completeEvent?.data.response) {
        const response = completeEvent.data.response;
        console.log('[parseFaultPropagation] Checking complete response');

        // Try to parse JSON from the response
        const jsonMatch = response.match(/```json\s*([\s\S]*?)```/);
        if (jsonMatch) {
            try {
                const parsed = JSON.parse(jsonMatch[1]);

                // Extract service statuses and faulty services from investigation array
                if (parsed.investigation && Array.isArray(parsed.investigation)) {
                    for (const inv of parsed.investigation) {
                        if (inv.service) {
                            const status = inv.status?.toLowerCase() || 'unknown';
                            serviceStatuses[inv.service] = {
                                status: status,
                                findings: inv.findings || []
                            };
                            if (status === 'critical' || status === 'error' || status === 'faulty') {
                                faultyServices.push(inv.service);
                            }
                            if (!services.includes(inv.service)) {
                                services.push(inv.service);
                            }
                        }
                    }
                }

                if (parsed.faultPropagation) {
                    rootCause = parsed.faultPropagation.rootCauseService;
                    return {
                        impactPath: parsed.faultPropagation.impactPath || services,
                        rootCauseService: rootCause,
                        faultyServices: faultyServices,
                        serviceStatuses: serviceStatuses,
                    };
                }
                if (parsed.investigation) {
                    const svcList = parsed.investigation.map((i: { service: string }) => i.service);
                    // Use faultPropagation.rootCauseService, or first faulty service, or last in list
                    const determinedRootCause = parsed.faultPropagation?.rootCauseService ||
                        rootCause ||
                        (faultyServices.length > 0 ? faultyServices[0] : svcList[svcList.length - 1]);
                    return {
                        impactPath: svcList,
                        rootCauseService: determinedRootCause,
                        faultyServices: faultyServices,
                        serviceStatuses: serviceStatuses,
                    };
                }
            } catch {
                // Fall through to markdown parsing
            }
        }

        // Fallback: Try to extract from Fault Propagation Chain markdown section
        const fpMatch = response.match(/Fault Propagation[^→\n]*([→\s\w-]+)/i);
        if (fpMatch) {
            const chain = fpMatch[1].split('→').map(s => s.trim().replace(/●|ROOT CAUSE/g, '').trim()).filter(Boolean);
            if (chain.length > 0) {
                console.log('[parseFaultPropagation] Extracted from markdown:', chain);
                return {
                    impactPath: chain,
                    rootCauseService: chain[chain.length - 1],
                    faultyServices: faultyServices,
                    serviceStatuses: serviceStatuses,
                };
            }
        }

        // Fallback: Look for Root Cause service name - look for backtick-wrapped or hyphenated service names
        // Match patterns like `postgres-mock`, **postgres-mock**, or just postgres-mock
        const rcMatch = response.match(/Root Cause[^`\n]*[`*]{0,2}([a-z0-9]+(?:[-_][a-z0-9]+)+)[`*]{0,2}/i);
        if (rcMatch) {
            rootCause = rcMatch[1];
            faultyServices.push(rootCause);
        }
    }

    // If we found services from tool calls, return those as the impact path
    if (services.length > 0) {
        console.log('[parseFaultPropagation] Using services from tool_calls:', services);
        return {
            impactPath: services,
            rootCauseService: rootCause || services[services.length - 1],
            faultyServices: faultyServices,
            serviceStatuses: serviceStatuses,
        };
    }

    return { impactPath: [], faultyServices: [], serviceStatuses: {} };
}

export default FaultPropagationChain;
