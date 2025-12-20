'use client';

import { useState } from 'react';
import {
    Target,
    BarChart2,
    ClipboardList,
    ChevronRight,
    CheckCircle,
    Copy,
    Check,
    Terminal
} from 'lucide-react';

interface RunbookStep {
    step: number;
    action: string;
    command?: string;
}

interface HypothesisPanelProps {
    rootCause?: string;
    confidence?: number;
    evidence?: string[];
    runbook?: RunbookStep[];
    isComplete?: boolean;
}

const ConfidenceBar = ({ confidence }: { confidence: number }) => {
    const getColor = () => {
        if (confidence >= 80) return 'bg-green-400';
        if (confidence >= 60) return 'bg-yellow-400';
        return 'bg-red-400';
    };

    return (
        <div className="flex items-center gap-3">
            <div className="flex-1 h-6 bg-gray-200 border-3 border-black overflow-hidden">
                <div
                    className={`h-full ${getColor()} transition-all duration-1000 ease-out`}
                    style={{ width: `${confidence}%` }}
                />
            </div>
            <span className={`font-black text-lg ${confidence >= 80 ? 'text-green-600' :
                confidence >= 60 ? 'text-yellow-600' :
                    'text-red-600'
                }`}>
                {confidence}%
            </span>
        </div>
    );
};

const RunbookStepItem = ({ step, onCopyCommand }: {
    step: RunbookStep;
    onCopyCommand: (cmd: string) => void;
}) => {
    const [copied, setCopied] = useState(false);

    const handleCopy = () => {
        if (step.command) {
            navigator.clipboard.writeText(step.command);
            onCopyCommand(step.command);
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
        }
    };

    return (
        <div className="border-3 border-black bg-white p-4 shadow-[3px_3px_0px_0px_#000]">
            <div className="flex items-start gap-3">
                {/* Step number */}
                <div className="w-8 h-8 bg-black text-white flex items-center justify-center font-black text-sm shrink-0">
                    {step.step}
                </div>

                <div className="flex-1">
                    {/* Action description */}
                    <p className="font-mono text-sm mb-2">{step.action}</p>

                    {/* Command if present */}
                    {step.command && (
                        <div className="relative">
                            <pre className="bg-black text-green-400 p-3 font-mono text-xs overflow-x-auto border-2 border-gray-600">
                                <code>{step.command}</code>
                            </pre>
                            <button
                                onClick={handleCopy}
                                className="absolute top-2 right-2 p-1 bg-gray-800 hover:bg-gray-700 border border-gray-600 transition-colors"
                                title="Copy command"
                            >
                                {copied ? (
                                    <Check className="w-4 h-4 text-green-400" />
                                ) : (
                                    <Copy className="w-4 h-4 text-gray-400" />
                                )}
                            </button>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export function HypothesisPanel({
    rootCause,
    confidence = 0,
    evidence = [],
    runbook = [],
    isComplete = false,
}: HypothesisPanelProps) {
    const [activeTab, setActiveTab] = useState<'diagnosis' | 'runbook'>('diagnosis');

    if (!rootCause && !isComplete) {
        return (
            <div className="bg-white border-4 border-black p-6 shadow-[6px_6px_0px_0px_#000]">
                <h3 className="text-lg font-black uppercase mb-4 flex items-center gap-2">
                    <Target className="w-5 h-5" />
                    <span className="bg-black text-white px-2">Diagnosis</span>
                </h3>
                <div className="flex flex-col items-center justify-center py-8 text-gray-500 font-mono text-sm">
                    <div className="w-8 h-8 border-4 border-gray-300 border-t-black animate-spin mb-4" />
                    <span>Analyzing evidence and forming hypothesis...</span>
                </div>
            </div>
        );
    }

    return (
        <div className="bg-white border-4 border-black shadow-[6px_6px_0px_0px_#000]">
            {/* Tabs */}
            <div className="flex border-b-4 border-black">
                <button
                    onClick={() => setActiveTab('diagnosis')}
                    className={`flex-1 px-4 py-3 font-black uppercase text-sm flex items-center justify-center gap-2 transition-colors ${activeTab === 'diagnosis'
                        ? 'bg-black text-white'
                        : 'bg-gray-100 hover:bg-gray-200'
                        }`}
                >
                    <Target className="w-4 h-4" />
                    Diagnosis
                </button>
                <button
                    onClick={() => setActiveTab('runbook')}
                    className={`flex-1 px-4 py-3 font-black uppercase text-sm flex items-center justify-center gap-2 transition-colors border-l-4 border-black ${activeTab === 'runbook'
                        ? 'bg-black text-white'
                        : 'bg-gray-100 hover:bg-gray-200'
                        }`}
                >
                    <ClipboardList className="w-4 h-4" />
                    Runbook ({runbook.length})
                </button>
            </div>

            {/* Content */}
            <div className="p-6">
                {activeTab === 'diagnosis' ? (
                    <div className="space-y-6">
                        {/* Root Cause */}
                        <div>
                            <h4 className="text-xs font-black uppercase text-gray-500 mb-2 flex items-center gap-2">
                                <Target className="w-4 h-4" />
                                Root Cause
                            </h4>
                            <div className="bg-red-50 border-4 border-red-400 p-4 shadow-[4px_4px_0px_0px_#f87171]">
                                <p className="font-mono font-bold text-lg text-red-800">
                                    {rootCause || 'Analysis in progress...'}
                                </p>
                            </div>
                        </div>

                        {/* Confidence */}
                        <div>
                            <h4 className="text-xs font-black uppercase text-gray-500 mb-2 flex items-center gap-2">
                                <BarChart2 className="w-4 h-4" />
                                Confidence Level
                            </h4>
                            <ConfidenceBar confidence={confidence} />
                        </div>

                        {/* Evidence */}
                        {evidence.length > 0 && (
                            <div>
                                <h4 className="text-xs font-black uppercase text-gray-500 mb-2">
                                    Supporting Evidence
                                </h4>
                                <ul className="space-y-2">
                                    {evidence.map((item, index) => (
                                        <li
                                            key={index}
                                            className="flex items-start gap-2 text-sm font-mono bg-gray-50 p-2 border-2 border-black"
                                        >
                                            <CheckCircle className="w-4 h-4 text-green-600 shrink-0 mt-0.5" />
                                            <span>{item}</span>
                                        </li>
                                    ))}
                                </ul>
                            </div>
                        )}
                    </div>
                ) : (
                    <div className="space-y-4">
                        {runbook.length === 0 ? (
                            <div className="flex flex-col items-center justify-center py-8 text-gray-500 font-mono text-sm">
                                <Terminal className="w-8 h-8 mb-2 opacity-50" />
                                <span>No runbook steps generated yet</span>
                            </div>
                        ) : (
                            <>
                                <div className="text-xs font-mono text-gray-600 mb-4">
                                    Follow these steps to resolve the issue. Commands can be copied.
                                </div>
                                {runbook.map((step) => (
                                    <RunbookStepItem
                                        key={step.step}
                                        step={step}
                                        onCopyCommand={(cmd) => console.log('Copied:', cmd)}
                                    />
                                ))}
                            </>
                        )}
                    </div>
                )}
            </div>

            {/* Status footer */}
            {isComplete && (
                <div className="p-4 border-t-4 border-black bg-green-100 flex items-center justify-center gap-2">
                    <CheckCircle className="w-5 h-5 text-green-600" />
                    <span className="font-black uppercase text-green-800 text-sm">
                        Diagnosis Complete
                    </span>
                </div>
            )}
        </div>
    );
}

// Helper to parse diagnosis from events
export function parseDiagnosis(events: Array<{ event_type: string; data: { response?: string } }>): {
    rootCause?: string;
    confidence?: number;
    evidence?: string[];
    runbook?: RunbookStep[];
} {
    const completeEvent = events.find(e => e.event_type === 'complete' && e.data.response);

    if (completeEvent?.data.response) {
        const response = completeEvent.data.response;
        console.log('[parseDiagnosis] Response length:', response.length);

        // Try to parse JSON code block
        const jsonMatch = response.match(/```json\s*([\s\S]*?)```/);
        if (jsonMatch) {
            console.log('[parseDiagnosis] Found JSON block');
            try {
                const parsed = JSON.parse(jsonMatch[1]);
                console.log('[parseDiagnosis] Parsed JSON keys:', Object.keys(parsed));
                console.log('[parseDiagnosis] parsed.runbook:', parsed.runbook);
                console.log('[parseDiagnosis] parsed.diagnosis:', parsed.diagnosis);
                return {
                    rootCause: parsed.diagnosis?.rootCause,
                    confidence: parsed.diagnosis?.confidence,
                    evidence: parsed.diagnosis?.evidence || [],
                    runbook: parsed.runbook || [],
                };
            } catch (e) {
                console.log('[parseDiagnosis] JSON parse failed:', e);
                console.log('[parseDiagnosis] JSON content:', jsonMatch[1].slice(0, 500));
            }
        }

        // Fallback: Try to extract from markdown sections
        console.log('[parseDiagnosis] Trying markdown extraction');

        // Look for Root Cause section - multiple patterns
        const rootCauseMatch = response.match(/##[^#]*Root Cause[\s\S]*?\*\*([^*]+)\*\*/i) ||
            response.match(/Root Cause[:\s]+(.+?)(?:\n|\()/i) ||
            response.match(/Root Cause[:\s]*\n?\s*(.+?)(?:\n|$)/i) ||
            response.match(/\*\*Root Cause\*\*[:\s]*(.+?)(?:\n|$)/i);

        // Look for Confidence - multiple patterns
        const confidenceMatch = response.match(/[Cc]onfidence[:\s]*([\d]+)[%\s]/) ||
            response.match(/[Cc]onfidence[:\s]+(\d+)/) ||
            response.match(/(\d+)%?\s*(?:confidence|certain)/i);

        // Look for Runbook steps - multiple patterns
        const runbookSteps: RunbookStep[] = [];

        // Pattern 1: ## Runbook section with numbered steps (multiple variations)
        const runbookSection = response.match(/##[^#]*(?:Recovery\s*)?Runbook([\s\S]*?)(?:##[^#]|---|$)/i) ||
            response.match(/📋\s*(?:Recovery\s*)?Runbook([\s\S]*?)(?:##[^#]|---|$)/i) ||
            response.match(/\*\*Runbook\*\*([\s\S]*?)(?:##[^#]|---|$)/i) ||
            response.match(/###\s*Runbook([\s\S]*?)(?:##[^#]|---|$)/i);

        console.log('[parseDiagnosis] Looking for runbook section...');
        console.log('[parseDiagnosis] Response snippet for runbook:', response.slice(0, 2000));

        if (runbookSection) {
            console.log('[parseDiagnosis] Found runbook section:', runbookSection[1].slice(0, 500));
            // Match lines starting with numbers like "1. ", "2. " etc (including bold text)
            const lines = runbookSection[1].match(/\d+\.\s+(?:\*\*)?(.+?)(?:\*\*)?(?:\n|$)/g);
            console.log('[parseDiagnosis] Found runbook lines:', lines);
            if (lines) {
                lines.forEach((line, idx) => {
                    // Clean up the action text - remove numbering, asterisks, and extra whitespace
                    let action = line.replace(/^\d+\.\s+/, '').trim();
                    action = action.replace(/^\*\*|\*\*$/g, '').trim();
                    action = action.replace(/^\*\*(.+?)\*\*:?\s*/, '$1: ').trim();

                    if (action.length > 3) { // Only add non-empty steps
                        runbookSteps.push({
                            step: idx + 1,
                            action: action,
                        });
                    }
                });
            }
        } else {
            // Fallback: Look for any numbered list in the response
            console.log('[parseDiagnosis] No runbook section found, trying fallback patterns...');
            const numberedSteps = response.match(/(?:^|\n)\s*(\d+)\.\s+\*\*([^*]+)\*\*[:\s]*([^\n]*)/gm);
            if (numberedSteps) {
                console.log('[parseDiagnosis] Found numbered steps in response:', numberedSteps.length);
                numberedSteps.forEach((match, idx) => {
                    const stepMatch = match.match(/(\d+)\.\s+\*\*([^*]+)\*\*[:\s]*(.*)/);
                    if (stepMatch) {
                        runbookSteps.push({
                            step: parseInt(stepMatch[1]) || (idx + 1),
                            action: `${stepMatch[2].trim()}${stepMatch[3] ? ': ' + stepMatch[3].trim() : ''}`,
                        });
                    }
                });
            }
        }

        console.log('[parseDiagnosis] Final runbook steps count:', runbookSteps.length);

        console.log('[parseDiagnosis] Extracted - rootCause:', rootCauseMatch?.[1], 'confidence:', confidenceMatch?.[1], 'runbook steps:', runbookSteps.length);

        if (rootCauseMatch || confidenceMatch || runbookSteps.length > 0) {
            // Try to extract just the service name from the root cause text
            let rootCauseText = rootCauseMatch?.[1]?.trim();
            let serviceName = rootCauseText;

            // Extract service name from patterns like "postgres-mock database connection timeout"
            if (rootCauseText) {
                // Common service name patterns
                const servicePatterns = [
                    /\b(postgres[-_]?mock)\b/i,
                    /\b(redis[-_]?mock)\b/i,
                    /\b(stripe[-_]?mock)\b/i,
                    /\b(aura[-_]?backend)\b/i,
                    /\b(aura[-_]?frontend)\b/i,
                    /\b([a-z]+-mock)\b/i,
                    /\b([a-z]+-service)\b/i,
                ];

                for (const pattern of servicePatterns) {
                    const match = rootCauseText.match(pattern);
                    if (match) {
                        serviceName = match[1];
                        break;
                    }
                }
            }

            return {
                rootCause: serviceName,
                confidence: confidenceMatch ? parseInt(confidenceMatch[1], 10) : undefined,
                evidence: [],
                runbook: runbookSteps,
            };
        }
    }

    return {};
}

export default HypothesisPanel;
