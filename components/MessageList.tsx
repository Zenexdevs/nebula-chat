'use client';

import { useEffect, useRef } from 'react';
import MessageBubble from './MessageBubble';
import type { ChatMessage, PresenceState } from '@/types';

export default function MessageList({
  messages,
  selfId,
  presence,
  onReact,
  onDownload,
  onVisible,
}: {
  messages: ChatMessage[];
  selfId: string;
  presence: Record<string, PresenceState>;
  onReact: (messageId: string, emoji: string) => void;
  onDownload: (message: ChatMessage) => Promise<Blob | null>;
  onVisible: () => void;
}) {
  const bottomRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
    onVisible();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [messages.length]);

  const avatarFor = (senderId: string) => presence[senderId]?.avatarUrl ?? '';

  function readByNames(message: ChatMessage): string[] {
    if (message.senderId !== selfId) return [];
    return Object.values(presence)
      .filter((p) => p.id !== selfId && p.lastReadAt && p.lastReadAt >= message.createdAt)
      .map((p) => p.name);
  }

  return (
    <div
      ref={containerRef}
      onScroll={(e) => {
        const el = e.currentTarget;
        if (el.scrollHeight - el.scrollTop - el.clientHeight < 80) onVisible();
      }}
      className="flex-1 overflow-y-auto scrollbar-thin px-4 py-4"
    >
      <div className="flex flex-col gap-3">
        {messages.map((m) => (
          <MessageBubble
            key={m.id}
            message={m}
            isOwn={m.senderId === selfId}
            avatarUrl={avatarFor(m.senderId)}
            onReact={(emoji) => onReact(m.id, emoji)}
            onDownload={onDownload}
            readByNames={readByNames(m)}
          />
        ))}
      </div>
      <div ref={bottomRef} />
    </div>
  );
}
