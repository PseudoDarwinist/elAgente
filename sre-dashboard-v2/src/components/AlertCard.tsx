'use client';

import { AlertInfo } from '@/types/events';
import { SeverityBadge } from './ConfidenceBadge';
import { Link2, Copy } from 'lucide-react';

interface AlertCardProps {
    alert: AlertInfo;
}

export function AlertCard({ alert }: AlertCardProps) {
    return (
        <div className="card p-4 mb-4">
            <div className="flex items-start justify-between mb-3">
                <span className="text-sm text-gray-500">Can you investigate this alert:</span>
                <button className="p-1 hover:bg-gray-100 rounded" title="Copy">
                    <Copy className="w-4 h-4 text-gray-400" />
                </button>
            </div>

            <div className="bg-[#FAFAF5] border border-gray-200 rounded-lg p-4">
                <div className="mb-3">
                    <SeverityBadge severity={alert.severity} />
                </div>

                <h3 className="text-lg font-semibold text-gray-900 mb-2">
                    {alert.title}
                </h3>

                {alert.subtitle && (
                    <p className="text-sm text-gray-600 mb-3">{alert.subtitle}</p>
                )}

                {alert.service && (
                    <div className="flex items-center gap-2 text-sm text-blue-600 mb-4">
                        <Link2 className="w-4 h-4" />
                        <span className="font-medium">{alert.service}</span>
                        {alert.namespace && (
                            <>
                                <span className="text-gray-400">|</span>
                                <span className="text-gray-600">{alert.namespace}</span>
                            </>
                        )}
                        {alert.cluster && (
                            <>
                                <span className="text-gray-400">(kube_service)</span>
                            </>
                        )}
                    </div>
                )}

                {/* Tags */}
                <div className="flex flex-wrap gap-2">
                    {Object.entries(alert.tags).map(([key, value]) => (
                        <span
                            key={key}
                            className="inline-flex items-center px-2 py-1 text-xs font-medium text-gray-600 bg-white border border-gray-200 rounded-md"
                        >
                            <span className="text-gray-400 mr-1">{key}:</span>
                            {value}
                        </span>
                    ))}
                </div>
            </div>

            {/* Service Info Bar */}
            <div className="mt-4 p-3 bg-[#FEF3C7] border-l-4 border-yellow-400 text-sm">
                <span className="text-gray-700">
                    {alert.service && <><strong>Service:</strong> {alert.service}, </>}
                    <strong>Service Type:</strong> kube_service, <strong>Service Class:</strong> Service,{' '}
                    <strong>Integration:</strong> grafana, <strong>Environment:</strong> unknown,{' '}
                    <strong>Alert Type:</strong> error/log
                    {alert.fireTime && <>, <strong>Fire Time:</strong> {alert.fireTime}</>}
                </span>
            </div>
        </div>
    );
}
