'use client';

import { useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { SmilePlus } from 'lucide-react';

const QUICK_EMOJIS = ['❤️', '😂', '😮', '😢', '👍', '🔥'];

export default function ReactionPicker({ onPick }: { onPick: (emoji: string) => void }) {
  const [open, setOpen] = useState(false);

  return (
    <div className="relative">
      <button
        onClick={() => setOpen((v) => !v)}
        onBlur={() => setTimeout(() => setOpen(false), 150)}
        className="rounded-full p-1.5 text-white/40 transition hover:bg-white/10 hover:text-neon-cyan"
        aria-label="Add reaction"
      >
        <SmilePlus className="h-4 w-4" />
      </button>
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: 6, scale: 0.9 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 6, scale: 0.9 }}
            transition={{ duration: 0.15 }}
            className="glass-strong absolute bottom-full z-20 mb-2 flex gap-1 rounded-full p-1.5 shadow-glass"
          >
            {QUICK_EMOJIS.map((emoji) => (
              <button
                key={emoji}
                onMouseDown={(e) => {
                  e.preventDefault();
                  onPick(emoji);
                  setOpen(false);
                }}
                className="rounded-full p-1 text-lg transition hover:scale-125"
              >
                {emoji}
              </button>
            ))}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
