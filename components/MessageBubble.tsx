'use client';

import { useState } from 'react';
import { motion } from 'framer-motion';
import { Download, File as FileIcon, Loader2, CheckCheck } from 'lucide-react';
import clsx from 'clsx';
import Avatar from './Avatar';
import ReactionPicker from './ReactionPicker';
import type { ChatMessage } from '@/types';

function formatTime(iso: string) {
  return new Date(iso).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

function formatBytes(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export default function MessageBubble({
  message,
  isOwn,
  avatarUrl,
  onReact,
  onDownload,
  readByNames,
}: {
  message: ChatMessage;
  isOwn: boolean;
  avatarUrl: string;
  onReact: (emoji: string) => void;
  onDownload: (message: ChatMessage) => Promise<Blob | null>;
  readByNames: string[];
}) {
  const [downloading, setDownloading] = useState(false);

  if (message.type === 'system') {
    return (
      <div className="flex justify-center py-1">
        <span className="rounded-full bg-white/5 px-3 py-1 text-[11px] text-white/40">{message.text}</span>
      </div>
    );
  }

  const isImage = message.file?.mime.startsWith('image/');

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25, ease: 'easeOut' }}
      className={clsx('group flex items-end gap-2.5 px-1', isOwn ? 'flex-row-reverse' : 'flex-row')}
    >
      {!isOwn && <Avatar src={avatarUrl} name={message.senderName} size={30} />}

      <div className={clsx('flex max-w-[72%] flex-col gap-1', isOwn ? 'items-end' : 'items-start')}>
        {!isOwn && <span className="px-1 text-[11px] font-medium text-white/40">{message.senderName}</span>}

        <div
          className={clsx(
            'relative rounded-2xl px-4 py-2.5 text-sm leading-relaxed shadow-glass',
            isOwn
              ? 'rounded-br-sm bg-gradient-to-br from-neon-purple/80 to-neon-pink/70 text-white'
              : 'glass rounded-bl-sm text-white/90'
          )}
        >
          {message.type === 'file' && message.file ? (
            isImage ? (
              <FileImagePreview file={message.file} onReveal={() => onDownload(message)} />
            ) : (
              <button
                disabled={downloading}
                onClick={async () => {
                  setDownloading(true);
                  const blob = await onDownload(message);
                  if (blob) {
                    const url = URL.createObjectURL(blob);
                    const a = document.createElement('a');
                    a.href = url;
                    a.download = message.file!.name;
                    a.click();
                    setTimeout(() => URL.revokeObjectURL(url), 4000);
                  }
                  setDownloading(false);
                }}
                className="flex items-center gap-2.5 rounded-lg border border-white/10 bg-black/20 px-3 py-2 text-left transition hover:border-neon-cyan/40"
              >
                <FileIcon className="h-5 w-5 shrink-0 text-neon-cyan" />
                <span className="min-w-0">
                  <span className="block truncate text-xs font-medium">{message.file.name}</span>
                  <span className="block text-[10px] text-white/40">{formatBytes(message.file.size)}</span>
                </span>
                {downloading ? (
                  <Loader2 className="h-4 w-4 shrink-0 animate-spin text-white/50" />
                ) : (
                  <Download className="h-4 w-4 shrink-0 text-white/50" />
                )}
              </button>
            )
          ) : (
            <span className="whitespace-pre-wrap break-words">{message.text}</span>
          )}
        </div>

        <div className="flex items-center gap-2 px-1">
          <span className="text-[10px] text-white/25">{formatTime(message.createdAt)}</span>
          {isOwn && readByNames.length > 0 && (
            <span className="flex items-center gap-0.5 text-[10px] text-neon-cyan/70">
              <CheckCheck className="h-3 w-3" /> Read
            </span>
          )}
          <div className="opacity-0 transition group-hover:opacity-100">
            <ReactionPicker onPick={onReact} />
          </div>
        </div>

        {Object.keys(message.reactions).length > 0 && (
          <div className="flex flex-wrap gap-1 px-1">
            {Object.entries(message.reactions).map(([emoji, ids]) => (
              <button
                key={emoji}
                onClick={() => onReact(emoji)}
                className="flex items-center gap-1 rounded-full border border-white/10 bg-white/5 px-2 py-0.5 text-xs transition hover:border-neon-cyan/40"
              >
                <span>{emoji}</span>
                <span className="text-white/40">{ids.length}</span>
              </button>
            ))}
          </div>
        )}
      </div>
    </motion.div>
  );
}

function FileImagePreview({
  file,
  onReveal,
}: {
  file: { name: string; path: string };
  onReveal: () => Promise<Blob | null>;
}) {
  const [url, setUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function reveal() {
    setLoading(true);
    const blob = await onReveal();
    if (blob) setUrl(URL.createObjectURL(blob));
    setLoading(false);
  }

  return (
    <div className="w-56">
      {url ? (
        <img src={url} alt={file.name} className="max-h-72 w-full rounded-lg object-cover" />
      ) : (
        <button
          onClick={reveal}
          disabled={loading}
          className="flex h-32 w-full flex-col items-center justify-center gap-2 rounded-lg border border-dashed border-white/20 bg-black/20 text-xs text-white/50 transition hover:border-neon-cyan/40"
        >
          {loading ? <Loader2 className="h-5 w-5 animate-spin" /> : <FileIcon className="h-5 w-5" />}
          {loading ? 'Decrypting…' : 'Tap to view image'}
        </button>
      )}
    </div>
  );
}
