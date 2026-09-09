'use client';

import { FormEvent, useRef, useState } from 'react';
import { motion } from 'framer-motion';
import { Shuffle, Upload, ArrowRight, Loader2 } from 'lucide-react';
import GlassPanel from './GlassPanel';
import { generatedAvatarUrl } from '@/lib/avatar';
import { randomId } from '@/lib/crypto';
import type { Profile } from '@/types';

const MAX_AVATAR_BYTES = 300 * 1024; // keep encrypted avatar payloads small

export default function ProfileSetup({
  roomName,
  onReady,
}: {
  roomName: string;
  onReady: (profile: Profile) => void;
}) {
  const [name, setName] = useState('');
  const [status, setStatus] = useState('');
  const [seed, setSeed] = useState(() => randomId());
  const [uploadedAvatar, setUploadedAvatar] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const avatarUrl = uploadedAvatar ?? generatedAvatarUrl(seed || name || 'nebula');

  function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      setError('Please choose an image file.');
      return;
    }
    if (file.size > MAX_AVATAR_BYTES) {
      setError('Avatar image is too big — please pick one under 300KB.');
      return;
    }
    setError(null);
    const reader = new FileReader();
    reader.onload = () => setUploadedAvatar(reader.result as string);
    reader.readAsDataURL(file);
  }

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!name.trim()) {
      setError('Pick a display name.');
      return;
    }
    setSubmitting(true);
    onReady({
      id: randomId(),
      name: name.trim().slice(0, 40),
      avatarUrl,
      status: status.trim().slice(0, 60),
    });
  }

  return (
    <div className="flex h-full w-full items-center justify-center p-6">
      <motion.div
        initial={{ opacity: 0, y: 24, scale: 0.98 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 0.5, ease: 'easeOut' }}
        className="w-full max-w-md"
      >
        <div className="mb-6 text-center">
          <h1 className="text-2xl font-bold">
            Joining <span className="text-gradient">{roomName}</span>
          </h1>
          <p className="mt-1 text-sm text-white/50">Set up how others will see you in this room.</p>
        </div>

        <GlassPanel strong className="p-6">
          <form onSubmit={handleSubmit} className="flex flex-col gap-5">
            <div className="flex items-center gap-4">
              <div className="relative">
                <motion.img
                  key={avatarUrl}
                  initial={{ opacity: 0, scale: 0.8 }}
                  animate={{ opacity: 1, scale: 1 }}
                  src={avatarUrl}
                  alt="avatar preview"
                  className="h-20 w-20 rounded-2xl border border-white/10 bg-white/5 object-cover shadow-neon"
                />
              </div>
              <div className="flex flex-col gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setUploadedAvatar(null);
                    setSeed(randomId());
                  }}
                  className="flex items-center gap-1.5 rounded-lg border border-white/10 bg-white/5 px-3 py-1.5 text-xs text-white/70 transition hover:border-neon-cyan/40 hover:text-white"
                >
                  <Shuffle className="h-3.5 w-3.5" /> Generate new
                </button>
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="flex items-center gap-1.5 rounded-lg border border-white/10 bg-white/5 px-3 py-1.5 text-xs text-white/70 transition hover:border-neon-purple/40 hover:text-white"
                >
                  <Upload className="h-3.5 w-3.5" /> Upload image
                </button>
                <input ref={fileInputRef} type="file" accept="image/*" hidden onChange={handleFile} />
              </div>
            </div>

            <div>
              <label className="mb-1.5 block text-xs font-medium uppercase tracking-wider text-white/40">
                Display name
              </label>
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="What should we call you?"
                className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm outline-none transition focus:border-neon-cyan/50"
                maxLength={40}
                autoFocus
              />
            </div>

            <div>
              <label className="mb-1.5 block text-xs font-medium uppercase tracking-wider text-white/40">
                Status message <span className="normal-case text-white/25">(optional)</span>
              </label>
              <input
                value={status}
                onChange={(e) => setStatus(e.target.value)}
                placeholder="e.g. lurking, brb, on mobile…"
                className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm outline-none transition focus:border-neon-pink/50"
                maxLength={60}
              />
            </div>

            {error && (
              <p className="rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-xs text-red-300">
                {error}
              </p>
            )}

            <motion.button
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              type="submit"
              disabled={submitting}
              className="flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-neon-purple to-neon-pink py-3 text-sm font-semibold text-white shadow-neon-pink transition disabled:opacity-60"
            >
              {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <ArrowRight className="h-4 w-4" />}
              Join the room
            </motion.button>
          </form>
        </GlassPanel>
      </motion.div>
    </div>
  );
}
