'use client';

import { motion, AnimatePresence } from 'framer-motion';

export default function TypingIndicator({ names }: { names: string[] }) {
  return (
    <AnimatePresence>
      {names.length > 0 && (
        <motion.div
          initial={{ opacity: 0, y: 8, height: 0 }}
          animate={{ opacity: 1, y: 0, height: 'auto' }}
          exit={{ opacity: 0, y: 8, height: 0 }}
          className="flex items-center gap-2 px-4 py-1 text-xs text-white/40"
        >
          <span className="flex gap-0.5">
            {[0, 1, 2].map((i) => (
              <motion.span
                key={i}
                animate={{ y: [0, -3, 0] }}
                transition={{ duration: 0.8, repeat: Infinity, delay: i * 0.15 }}
                className="h-1.5 w-1.5 rounded-full bg-neon-cyan"
              />
            ))}
          </span>
          {names.length === 1 ? `${names[0]} is typing…` : `${names.join(', ')} are typing…`}
        </motion.div>
      )}
    </AnimatePresence>
  );
}
