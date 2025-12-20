'use client';

import { AgentMessage as AgentMessageType } from '@/types/events';

interface AgentMessageProps {
    message: AgentMessageType;
}

export function AgentMessage({ message }: AgentMessageProps) {
    return (
        <div className="agent-message px-4">
            <p>{message.text}</p>
        </div>
    );
}
