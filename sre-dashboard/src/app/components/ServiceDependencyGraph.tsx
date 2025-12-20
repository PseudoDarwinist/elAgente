'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { Network, Circle, AlertCircle, CheckCircle, XCircle, Maximize2, Minimize2 } from 'lucide-react';

interface ServiceNode {
    id: string;
    name: string;
    status: 'healthy' | 'degraded' | 'critical' | 'unknown';
    x: number;
    y: number;
    type: 'service' | 'database' | 'cache' | 'external';
}

interface ServiceDependencyGraphProps {
    services: string[];
    edges?: Array<{ from: string; to: string }>;
    serviceHealthMap?: Record<string, string>;
    highlightServices?: string[];
    isLoading?: boolean;
}

const STATUS_COLORS = {
    healthy: { bg: '#86efac', border: '#22c55e', text: '#166534' },
    degraded: { bg: '#fef08a', border: '#eab308', text: '#854d0e' },
    critical: { bg: '#fca5a5', border: '#ef4444', text: '#991b1b' },
    unknown: { bg: '#e5e7eb', border: '#9ca3af', text: '#4b5563' },
};

const getNodeType = (name: string): ServiceNode['type'] => {
    const lower = name.toLowerCase();
    if (lower.includes('db') || lower.includes('database') || lower.includes('postgres') || lower.includes('mysql')) {
        return 'database';
    }
    if (lower.includes('redis') || lower.includes('cache') || lower.includes('memcache')) {
        return 'cache';
    }
    if (lower.includes('stripe') || lower.includes('external') || lower.includes('api')) {
        return 'external';
    }
    return 'service';
};

const getNodeShape = (type: ServiceNode['type']) => {
    switch (type) {
        case 'database':
            return 'rounded-b-xl rounded-t-sm';
        case 'cache':
            return 'rounded-full';
        case 'external':
            return 'skew-x-6';
        default:
            return 'rounded-lg';
    }
};

export function ServiceDependencyGraph({
    services = [],
    edges = [],
    serviceHealthMap = {},
    highlightServices = [],
    isLoading = false,
}: ServiceDependencyGraphProps) {
    const containerRef = useRef<HTMLDivElement>(null);
    const [nodes, setNodes] = useState<ServiceNode[]>([]);
    const [isExpanded, setIsExpanded] = useState(false);
    const [hoveredNode, setHoveredNode] = useState<string | null>(null);

    // Calculate node positions in a force-directed layout approximation
    const calculateLayout = useCallback(() => {
        if (services.length === 0) return [];

        const width = 600;
        const height = 350;
        const centerX = width / 2;
        const centerY = height / 2;

        const angleStep = (2 * Math.PI) / services.length;
        const radius = Math.min(width, height) * 0.35;

        return services.map((name, index): ServiceNode => {
            const angle = index * angleStep - Math.PI / 2;
            const jitter = (Math.random() - 0.5) * 30;

            return {
                id: name,
                name,
                status: (serviceHealthMap[name]?.toLowerCase() as ServiceNode['status']) || 'unknown',
                x: centerX + Math.cos(angle) * (radius + jitter),
                y: centerY + Math.sin(angle) * (radius + jitter),
                type: getNodeType(name),
            };
        });
    }, [services, serviceHealthMap]);

    useEffect(() => {
        setNodes(calculateLayout());
    }, [calculateLayout]);

    // Draw SVG edges
    const renderEdges = () => {
        return edges.map((edge, index) => {
            const fromNode = nodes.find(n => n.id === edge.from);
            const toNode = nodes.find(n => n.id === edge.to);

            if (!fromNode || !toNode) return null;

            const isHighlighted = highlightServices.includes(edge.from) || highlightServices.includes(edge.to);

            return (
                <line
                    key={`edge-${index}`}
                    x1={fromNode.x}
                    y1={fromNode.y}
                    x2={toNode.x}
                    y2={toNode.y}
                    stroke={isHighlighted ? '#ef4444' : '#000'}
                    strokeWidth={isHighlighted ? 3 : 2}
                    strokeDasharray={isHighlighted ? '' : '5,5'}
                    markerEnd="url(#arrowhead)"
                    className="transition-all duration-300"
                />
            );
        });
    };

    if (services.length === 0) {
        return (
            <div className="bg-white border-4 border-black p-6 shadow-[6px_6px_0px_0px_#000]">
                <h3 className="text-lg font-black uppercase mb-4 flex items-center gap-2">
                    <Network className="w-5 h-5" />
                    <span className="bg-black text-white px-2">Service</span> Map
                </h3>
                <div className="flex items-center justify-center py-12 text-gray-500 font-mono text-sm">
                    {isLoading ? (
                        <div className="flex items-center gap-2">
                            <div className="w-4 h-4 border-2 border-black border-t-transparent animate-spin" />
                            <span>Discovering topology...</span>
                        </div>
                    ) : (
                        <span>No services discovered yet</span>
                    )}
                </div>
            </div>
        );
    }

    return (
        <div className={`bg-white border-4 border-black shadow-[6px_6px_0px_0px_#000] ${isExpanded ? 'fixed inset-4 z-50' : ''}`}>
            {/* Header */}
            <div className="flex items-center justify-between p-4 border-b-4 border-black bg-gray-100">
                <h3 className="text-lg font-black uppercase flex items-center gap-2">
                    <Network className="w-5 h-5" />
                    <span className="bg-black text-white px-2">Service</span> Map
                    <span className="text-sm font-mono font-normal text-gray-600">
                        ({services.length} services)
                    </span>
                </h3>
                <button
                    onClick={() => setIsExpanded(!isExpanded)}
                    className="p-2 border-2 border-black bg-white hover:bg-yellow-200 transition-colors"
                >
                    {isExpanded ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
                </button>
            </div>

            {/* Graph Canvas */}
            <div
                ref={containerRef}
                className={`relative overflow-hidden ${isExpanded ? 'h-[calc(100%-80px)]' : 'h-[350px]'}`}
            >
                {/* SVG for edges */}
                <svg className="absolute inset-0 w-full h-full pointer-events-none">
                    <defs>
                        <marker
                            id="arrowhead"
                            markerWidth="10"
                            markerHeight="7"
                            refX="10"
                            refY="3.5"
                            orient="auto"
                        >
                            <polygon points="0 0, 10 3.5, 0 7" fill="#000" />
                        </marker>
                    </defs>
                    {renderEdges()}
                </svg>

                {/* Nodes */}
                {nodes.map((node) => {
                    const colors = STATUS_COLORS[node.status];
                    const isHighlighted = highlightServices.includes(node.id);
                    const isHovered = hoveredNode === node.id;

                    return (
                        <div
                            key={node.id}
                            className={`
                                absolute transform -translate-x-1/2 -translate-y-1/2
                                px-3 py-2 border-3 border-black
                                ${getNodeShape(node.type)}
                                cursor-pointer transition-all duration-200
                                ${isHighlighted ? 'ring-4 ring-red-500 z-10' : ''}
                                ${isHovered ? 'scale-110 z-20' : ''}
                            `}
                            style={{
                                left: node.x,
                                top: node.y,
                                backgroundColor: colors.bg,
                                borderColor: colors.border,
                                boxShadow: isHovered
                                    ? '4px 4px 0px 0px #000'
                                    : '2px 2px 0px 0px #000',
                            }}
                            onMouseEnter={() => setHoveredNode(node.id)}
                            onMouseLeave={() => setHoveredNode(null)}
                        >
                            <div className="flex items-center gap-1">
                                {node.status === 'healthy' && <CheckCircle className="w-3 h-3" style={{ color: colors.text }} />}
                                {node.status === 'degraded' && <AlertCircle className="w-3 h-3" style={{ color: colors.text }} />}
                                {node.status === 'critical' && <XCircle className="w-3 h-3" style={{ color: colors.text }} />}
                                {node.status === 'unknown' && <Circle className="w-3 h-3" style={{ color: colors.text }} />}
                                <span
                                    className="font-mono text-xs font-bold uppercase"
                                    style={{ color: colors.text }}
                                >
                                    {node.name}
                                </span>
                            </div>

                            {/* Tooltip on hover */}
                            {isHovered && (
                                <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 bg-black text-white text-xs px-2 py-1 whitespace-nowrap font-mono">
                                    {node.type.toUpperCase()} • {node.status.toUpperCase()}
                                </div>
                            )}
                        </div>
                    );
                })}
            </div>

            {/* Legend */}
            <div className="p-4 border-t-4 border-black bg-gray-50 flex flex-wrap gap-4">
                <div className="flex items-center gap-2 text-xs font-mono">
                    <CheckCircle className="w-3 h-3 text-green-600" />
                    <span>HEALTHY</span>
                </div>
                <div className="flex items-center gap-2 text-xs font-mono">
                    <AlertCircle className="w-3 h-3 text-yellow-600" />
                    <span>DEGRADED</span>
                </div>
                <div className="flex items-center gap-2 text-xs font-mono">
                    <XCircle className="w-3 h-3 text-red-600" />
                    <span>CRITICAL</span>
                </div>
                <div className="ml-auto flex items-center gap-4">
                    <span className="text-xs font-mono text-gray-500">
                        <span className="inline-block w-3 h-3 rounded-lg bg-gray-200 border border-gray-400 mr-1" />
                        SERVICE
                    </span>
                    <span className="text-xs font-mono text-gray-500">
                        <span className="inline-block w-3 h-3 rounded-full bg-gray-200 border border-gray-400 mr-1" />
                        CACHE
                    </span>
                    <span className="text-xs font-mono text-gray-500">
                        <span className="inline-block w-3 h-3 rounded-b-lg bg-gray-200 border border-gray-400 mr-1" />
                        DATABASE
                    </span>
                </div>
            </div>
        </div>
    );
}

// Helper to parse service graph from events
// Extracts topology from topology-mcp and health from prometheus-mcp tool results
export function parseServiceGraph(events: Array<{ event_type: string; data: { response?: string; preview?: string; tool?: string; args?: Record<string, unknown> } }>): {
    services: string[];
    edges: Array<{ from: string; to: string }>;
    healthMap: Record<string, string>;
} {
    const services = new Set<string>();
    const edges: Array<{ from: string; to: string }> = [];
    const healthMap: Record<string, string> = {};

    for (const event of events) {
        // Extract service from tool_call events
        if (event.event_type === 'tool_call' && event.data.args) {
            const serviceName = event.data.args.service as string;
            if (serviceName) {
                services.add(serviceName);
            }
        }

        // Parse tool_result events - this is where the actual data comes back
        if (event.event_type === 'tool_result' && event.data.preview) {
            try {
                const data = JSON.parse(event.data.preview);

                // Parse get_service_dependencies response
                // Format: { service, upstream: [], downstream: [] }
                if (data.upstream && Array.isArray(data.upstream)) {
                    data.upstream.forEach((s: string) => {
                        services.add(s);
                        if (data.service) {
                            edges.push({ from: s, to: data.service });
                        }
                    });
                }
                if (data.downstream && Array.isArray(data.downstream)) {
                    data.downstream.forEach((s: string) => {
                        services.add(s);
                        if (data.service) {
                            edges.push({ from: data.service, to: s });
                        }
                    });
                }
                if (data.service) {
                    services.add(data.service);
                }

                // Parse get_impact_radius response
                // Format: { service, affectedServices: [], impactPath: [] }
                if (data.affectedServices && Array.isArray(data.affectedServices)) {
                    data.affectedServices.forEach((s: string) => services.add(s));
                }
                if (data.impactPath && Array.isArray(data.impactPath)) {
                    data.impactPath.forEach((s: string) => services.add(s));
                    // Create edges from impact path sequence
                    for (let i = 0; i < data.impactPath.length - 1; i++) {
                        const existing = edges.find(e =>
                            (e.from === data.impactPath[i] && e.to === data.impactPath[i + 1]) ||
                            (e.from === data.impactPath[i + 1] && e.to === data.impactPath[i])
                        );
                        if (!existing) {
                            edges.push({ from: data.impactPath[i], to: data.impactPath[i + 1] });
                        }
                    }
                }

                // Parse get_service_health response
                // Format: { service, status: "HEALTHY|DEGRADED|CRITICAL" }
                if (data.status && data.service) {
                    healthMap[data.service] = data.status.toLowerCase();
                    services.add(data.service);
                }

                // Parse get_service_graph response
                // Format: { services: [], edges: [] }
                if (data.services && Array.isArray(data.services)) {
                    data.services.forEach((s: string) => services.add(s));
                }
                if (data.edges && Array.isArray(data.edges)) {
                    data.edges.forEach((e: { from: string; to: string }) => {
                        if (e.from && e.to) {
                            edges.push(e);
                        }
                    });
                }
            } catch {
                // Not JSON, skip
            }
        }
    }

    // Deduplicate edges
    const uniqueEdges = edges.filter((edge, index, self) =>
        index === self.findIndex(e => e.from === edge.from && e.to === edge.to)
    );

    return {
        services: Array.from(services),
        edges: uniqueEdges,
        healthMap,
    };
}

export default ServiceDependencyGraph;
