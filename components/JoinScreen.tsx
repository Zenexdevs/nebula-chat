'use client';

import { FormEvent, useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { Lock, Users, ArrowRight, Loader2, ShieldCheck, X, LogIn } from 'lucide-react';
import GlassPanel from './GlassPanel';
import Avatar from './Avatar';
import { supabase } from '@/lib/supabase';
import {
  slugifyRoomName,
  randomSalt,
  deriveVerifier,
  deriveSecretKey,
  verifiersMatch,
} from '@/lib/crypto';
import { encodeBase64, decodeBase64 } from 'tweetnacl-util';
import { listSessions, forgetSession, type StoredSession } from '@/lib/sessionStore';
import type { Profile } from '@/types';

export type JoinResult = {
  roomId: string;
  roomName: string;
  secretKey: Uint8Array;
  isNewRoom: boolean;
};

export default function JoinScreen({
  initialRoomName = '',
  onJoined,
  onResume,
}: {
  initialRoomName?: string;
  onJoined: (result: JoinResult) => void;
  onResume: (result: JoinResult, profile: Profile) => void;
}) {
  const [roomName, setRoomName] = useState(initialRoomName);
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [recent, setRecent] = useState<StoredSession[]>([]);

  useEffect(() => {
    setRecent(listSessions());
  }, []);

  function handleResume(session: StoredSession) {
    onResume(
      { roomId: session.roomId, roomName: session.roomName, secretKey: decodeBase64(session.secretKeyB64), isNewRoom: false },
      session.profile
    );
  }

  function handleForget(e: React.MouseEvent, roomId: string) {
    e.stopPropagation();
    forgetSession(roomId);
    setRecent(listSessions());
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);

    if (!roomName.trim() || password.length < 4) {
      setError('Enter a room name and a password of at least 4 characters.');
      return;
    }

    setLoading(true);
    try {
      const roomId = slugifyRoomName(roomName);
      const { data: existingRoom, error: fetchErr } = await supabase
        .from('rooms')
        .select('id, verifier_hash, verifier_salt')
        .eq('id', roomId)
        .maybeSingle();

      if (fetchErr) throw fetchErr;

      if (existingRoom) {
        const salt = decodeBase64(existingRoom.verifier_salt);
        const verifier = await deriveVerifier(password, salt);
        if (!verifiersMatch(verifier, existingRoom.verifier_hash)) {
          setError('Wrong password for that room.');
          setLoading(false);
          return;
        }
        const secretKey = await deriveSecretKey(password, salt);
        onJoined({ roomId, roomName: roomName.trim(), secretKey, isNewRoom: false });
      } else {
        const salt = randomSalt();
        const verifier = await deriveVerifier(password, salt);
        const secretKey = await deriveSecretKey(password, salt);
        const { error: insertErr } = await supabase.from('rooms').insert({
          id: roomId,
          verifier_hash: verifier,
          verifier_salt: encodeBase64(salt),
        });
        if (insertErr && insertErr.code !== '23505') throw insertErr; // ignore race-created dupes
        onJoined({ roomId, roomName: roomName.trim(), secretKey, isNewRoom: true });
      }
    } catch (err) {
      console.error(err);
      setError('Something went wrong connecting to the room. Check your Supabase setup.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex h-full w-full flex-col items-center justify-center gap-4 overflow-y-auto p-6">
      <motion.div
        initial={{ opacity: 0, y: 24, scale: 0.98 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 0.5, ease: 'easeOut' }}
        className="w-full max-w-md"
      >
        <div className="mb-8 flex flex-col items-center text-center">
          <motion.div
            animate={{ boxShadow: ['0 0 20px rgba(0,240,255,0.35)', '0 0 32px rgba(168,85,247,0.45)', '0 0 20px rgba(0,240,255,0.35)'] }}
            transition={{ duration: 3, repeat: Infinity }}
            className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-neon-cyan/20 to-neon-purple/20"
          >
            <Lock className="h-6 w-6 text-neon-cyan" />
          </motion.div>
          <h1 className="text-3xl font-extrabold tracking-tight">
            <span className="text-gradient">Nebula</span> Chat
          </h1>
          <p className="mt-2 text-sm text-white/50">
            Private rooms. End-to-end encrypted. Nobody else can read a word.
          </p>
        </div>

        {recent.length > 0 && (
          <GlassPanel className="mb-4 p-4">
            <p className="mb-2 text-[11px] font-medium uppercase tracking-wider text-white/30">
              Continue where you left off
            </p>
            <div className="flex flex-col gap-1.5">
              {recent.map((s) => (
                <button
                  key={s.roomId}
                  onClick={() => handleResume(s)}
                  className="group flex items-center gap-2.5 rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-left transition hover:border-neon-cyan/40"
                >
                  <Avatar src={s.profile.avatarUrl} name={s.profile.name} size={28} />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">{s.roomName}</p>
                    <p className="truncate text-[11px] text-white/40">as {s.profile.name}</p>
                  </div>
                  <LogIn className="h-3.5 w-3.5 shrink-0 text-white/30 transition group-hover:text-neon-cyan" />
                  <button
                    onClick={(e) => handleForget(e, s.roomId)}
                    className="shrink-0 rounded-md p-1 text-white/25 transition hover:bg-red-500/10 hover:text-red-300"
                    aria-label={`Forget ${s.roomName} on this device`}
                    title="Forget this room on this device"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                </button>
              ))}
            </div>
            <p className="mt-2 text-[10px] text-white/25">
              Saved only in this browser. Use the × to forget a room on a shared device.
            </p>
          </GlassPanel>
        )}

        <GlassPanel strong className="p-6">
          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            <div>
              <label className="mb-1.5 block text-xs font-medium uppercase tracking-wider text-white/40">
                Room name
              </label>
              <div className="relative">
                <Users className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-white/30" />
                <input
                  value={roomName}
                  onChange={(e) => setRoomName(e.target.value)}
                  placeholder="e.g. midnight-crew"
                  className="w-full rounded-xl border border-white/10 bg-white/5 py-3 pl-10 pr-4 text-sm outline-none transition focus:border-neon-cyan/50 focus:shadow-neon"
                  maxLength={64}
                />
              </div>
            </div>

            <div>
              <label className="mb-1.5 block text-xs font-medium uppercase tracking-wider text-white/40">
                Room password
              </label>
              <div className="relative">
                <Lock className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-white/30" />
                <input
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  type="password"
                  placeholder="Shared secret for this room"
                  className="w-full rounded-xl border border-white/10 bg-white/5 py-3 pl-10 pr-4 text-sm outline-none transition focus:border-neon-purple/50"
                  maxLength={128}
                />
              </div>
              <p className="mt-1.5 flex items-center gap-1 text-[11px] text-white/30">
                <ShieldCheck className="h-3 w-3" /> Your password never leaves this browser.
              </p>
            </div>

            {error && (
              <motion.p
                initial={{ opacity: 0, x: -6 }}
                animate={{ opacity: 1, x: 0 }}
                className="rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-xs text-red-300"
              >
                {error}
              </motion.p>
            )}

            <motion.button
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              type="submit"
              disabled={loading}
              className="mt-2 flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-neon-cyan to-neon-purple py-3 text-sm font-semibold text-void-950 shadow-neon transition disabled:opacity-60"
            >
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <ArrowRight className="h-4 w-4" />}
              {loading ? 'Connecting…' : 'Enter room'}
            </motion.button>

            <p className="text-center text-[11px] text-white/30">
              New room name? It's created automatically with your password.
            </p>
          </form>
        </GlassPanel>
      </motion.div>

      <p className="pb-2 text-[11px] text-white/20">Made by K35C</p>
    </div>
  );
}
