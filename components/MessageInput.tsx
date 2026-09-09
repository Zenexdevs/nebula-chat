'use client';

import { ChangeEvent, KeyboardEvent, useRef, useState } from 'react';
import { motion } from 'framer-motion';
import { Paperclip, Send } from 'lucide-react';

export default function MessageInput({
  onSend,
  onFile,
  onTyping,
  uploadProgress,
}: {
  onSend: (text: string) => void;
  onFile: (file: File) => void;
  onTyping: (typing: boolean) => void;
  uploadProgress: number | null;
}) {
  const [text, setText] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  function submit() {
    if (!text.trim()) return;
    onSend(text);
    setText('');
    onTyping(false);
  }

  function handleKeyDown(e: KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      submit();
    }
  }

  function handleChange(e: ChangeEvent<HTMLTextAreaElement>) {
    setText(e.target.value);
    onTyping(e.target.value.length > 0);
  }

  function handleFile(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (file) onFile(file);
    e.target.value = '';
  }

  return (
    <div className="border-t border-white/10 p-3">
      {uploadProgress !== null && (
        <div className="mb-2 flex items-center gap-2 rounded-lg bg-white/5 px-3 py-1.5 text-xs text-white/50">
          <div className="h-1 flex-1 overflow-hidden rounded-full bg-white/10">
            <motion.div
              className="h-full bg-gradient-to-r from-neon-cyan to-neon-purple"
              animate={{ width: `${uploadProgress}%` }}
            />
          </div>
          Encrypting & uploading…
        </div>
      )}
      <div className="glass flex items-end gap-2 rounded-2xl p-2">
        <button
          onClick={() => fileInputRef.current?.click()}
          className="rounded-xl p-2.5 text-white/40 transition hover:bg-white/10 hover:text-neon-cyan"
          aria-label="Attach file"
        >
          <Paperclip className="h-5 w-5" />
        </button>
        <input ref={fileInputRef} type="file" hidden onChange={handleFile} />

        <textarea
          value={text}
          onChange={handleChange}
          onKeyDown={handleKeyDown}
          onBlur={() => onTyping(false)}
          placeholder="Type an encrypted message…"
          rows={1}
          className="max-h-32 flex-1 resize-none bg-transparent py-2 text-sm outline-none placeholder:text-white/30"
        />

        <motion.button
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
          onClick={submit}
          disabled={!text.trim()}
          className="rounded-xl bg-gradient-to-r from-neon-cyan to-neon-purple p-2.5 text-void-950 shadow-neon transition disabled:opacity-30"
          aria-label="Send message"
        >
          <Send className="h-4 w-4" />
        </motion.button>
      </div>
    </div>
  );
}
