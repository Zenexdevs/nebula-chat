'use client';

import { useState } from 'react';
import { motion } from 'framer-motion';
import { Copy, Check, Volume2, VolumeX, LogOut, Users, Phone, Timer, ShieldOff } from 'lucide-react';
import Avatar from './Avatar';
import type { PresenceState } from '@/types';

export default function Sidebar({
  roomName,
  presence,
  selfId,
  soundEnabled,
  onToggleSound,
  onLeave,
  onStartCall,
  inCall,
  open,
  autoDelete24h,
  onToggleAutoDelete,
  onForgetDevice,
}: {
  roomName: string;
  presence: Record<string, PresenceState>;
  selfId: string;
  soundEnabled: boolean;
  onToggleSound: () => void;
  onLeave: () => void;
  onStartCall: () => void;
  inCall: boolean;
  open: boolean;
  autoDelete24h: boolean;
  onToggleAutoDelete: (enabled: boolean) => void;
  onForgetDevice: () => void;
}) {
  const [copied, setCopied] = useState(false);
  const [forgot, setForgot] = useState(false);
  const members = Object.values(presence).sort((a, b) => (a.id === selfId ? -1 : a.name.localeCompare(b.name)));

  function copyInvite() {
    const url = `${window.location.origin}/room/${encodeURIComponent(roomName)}`;
    navigator.clipboard.writeText(url).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    });
  }

  function handleForget() {
    onForgetDevice();
    setForgot(true);
    setTimeout(() => setForgot(false), 1800);
  }

  return (
    <motion.aside
      initial={false}
      animate={{ width: open ? 288 : 0, opacity: open ? 1 : 0 }}
      transition={{ duration: 0.25, ease: 'easeOut' }}
      className="glass-strong flex h-full shrink-0 flex-col overflow-hidden border-r border-white/10"
    >
      <div className="w-72 flex-1 overflow-y-auto scrollbar-thin p-5">
        <h2 className="truncate text-lg font-bold text-gradient">{roomName}</h2>
        <p className="mt-0.5 flex items-center gap-1 text-xs text-white/40">
          <Users className="h-3.5 w-3.5" /> {members.length} online
        </p>

        <div className="mt-4 flex flex-col gap-2">
          <button
            onClick={onStartCall}
            disabled={inCall}
            className="flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-neon-cyan to-neon-blue py-2.5 text-sm font-semibold text-void-950 shadow-neon transition disabled:opacity-40"
          >
            <Phone className="h-4 w-4" /> {inCall ? 'In call' : 'Start call'}
          </button>

          <button
            onClick={copyInvite}
            className="flex items-center justify-center gap-2 rounded-xl border border-white/10 bg-white/5 py-2.5 text-xs text-white/70 transition hover:border-neon-purple/40"
          >
            {copied ? <Check className="h-3.5 w-3.5 text-emerald-400" /> : <Copy className="h-3.5 w-3.5" />}
            {copied ? 'Link copied' : 'Copy invite link'}
          </button>
        </div>

        <div className="mt-6">
          <p className="mb-2 text-[11px] font-medium uppercase tracking-wider text-white/30">Members</p>
          <div className="flex flex-col gap-1">
            {members.map((m) => (
              <div key={m.id} className="flex items-center gap-2.5 rounded-xl px-2 py-1.5 transition hover:bg-white/5">
                <Avatar src={m.avatarUrl} name={m.name} size={32} online />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">
                    {m.name} {m.id === selfId && <span className="text-white/30">(you)</span>}
                  </p>
                  <p className="truncate text-[11px] text-white/35">
                    {m.typing ? <span className="text-neon-cyan">typing…</span> : m.status || 'online'}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="mt-6 border-t border-white/10 pt-4">
          <p className="mb-2 text-[11px] font-medium uppercase tracking-wider text-white/30">Privacy</p>

          <label className="flex cursor-pointer items-start gap-2.5 rounded-xl px-2 py-2 transition hover:bg-white/5">
            <span
              className={`mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded border transition ${
                autoDelete24h ? 'border-neon-cyan bg-neon-cyan/80' : 'border-white/25 bg-transparent'
              }`}
              onClick={(e) => {
                e.preventDefault();
                onToggleAutoDelete(!autoDelete24h);
              }}
            >
              {autoDelete24h && <Timer className="h-3 w-3 text-void-950" />}
            </span>
            <span className="text-xs text-white/60">
              Auto-delete messages after 24h
              <span className="mt-0.5 block text-[10px] text-white/30">
                Applies to everyone in this room. Deletes the message and its file from storage.
              </span>
            </span>
          </label>

          <button
            onClick={handleForget}
            className="mt-1 flex w-full items-center gap-2.5 rounded-xl px-2 py-2 text-left text-xs text-white/60 transition hover:bg-white/5"
            title="Remove this room's saved key from this browser"
          >
            <ShieldOff className="h-3.5 w-3.5 shrink-0" />
            {forgot ? 'Forgotten on this device' : 'Forget this room on this device'}
          </button>
        </div>
      </div>

      <div className="mt-auto flex w-72 items-center justify-between border-t border-white/10 p-4">
        <button
          onClick={onToggleSound}
          className="flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs text-white/50 transition hover:bg-white/10"
        >
          {soundEnabled ? <Volume2 className="h-4 w-4" /> : <VolumeX className="h-4 w-4" />}
          Sounds
        </button>
        <button
          onClick={onLeave}
          className="flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs text-red-300/80 transition hover:bg-red-500/10"
        >
          <LogOut className="h-4 w-4" /> Leave
        </button>
      </div>
    </motion.aside>
  );
}
