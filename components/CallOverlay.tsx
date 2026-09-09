'use client';

import { AnimatePresence, motion } from 'framer-motion';
import { Mic, MicOff, Video, VideoOff, MonitorUp, MonitorX, PhoneOff, Loader2 } from 'lucide-react';
import ParticipantTile from './ParticipantTile';
import type { CallParticipant } from '@/types';

export default function CallOverlay({
  inCall,
  connecting,
  error,
  participants,
  micOn,
  camOn,
  sharingScreen,
  onToggleMic,
  onToggleCam,
  onToggleScreenShare,
  onEndCall,
}: {
  inCall: boolean;
  connecting: boolean;
  error: string | null;
  participants: CallParticipant[];
  micOn: boolean;
  camOn: boolean;
  sharingScreen: boolean;
  onToggleMic: () => void;
  onToggleCam: () => void;
  onToggleScreenShare: () => void;
  onEndCall: () => void;
}) {
  return (
    <AnimatePresence>
      {inCall && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 20 }}
          className="glass-strong absolute inset-3 z-30 flex flex-col rounded-3xl p-4 shadow-glass sm:inset-6"
        >
          {connecting && (
            <div className="absolute inset-0 z-10 flex items-center justify-center gap-2 rounded-3xl bg-black/40 text-sm text-white/70 backdrop-blur-sm">
              <Loader2 className="h-4 w-4 animate-spin" /> Connecting…
            </div>
          )}

          {error && (
            <div className="mb-3 rounded-xl border border-red-500/30 bg-red-500/10 px-3 py-2 text-xs text-red-300">
              {error}
            </div>
          )}

          <div className="grid flex-1 auto-rows-fr grid-cols-1 gap-3 overflow-y-auto scrollbar-thin sm:grid-cols-2 lg:grid-cols-3">
            {participants.map((p) => (
              <ParticipantTile key={p.id} participant={p} />
            ))}
          </div>

          <div className="mt-4 flex items-center justify-center gap-3">
            <ControlButton active={micOn} onClick={onToggleMic} activeIcon={<Mic className="h-5 w-5" />} inactiveIcon={<MicOff className="h-5 w-5" />} />
            <ControlButton active={camOn} onClick={onToggleCam} activeIcon={<Video className="h-5 w-5" />} inactiveIcon={<VideoOff className="h-5 w-5" />} />
            <ControlButton
              active={sharingScreen}
              onClick={onToggleScreenShare}
              activeIcon={<MonitorUp className="h-5 w-5" />}
              inactiveIcon={<MonitorX className="h-5 w-5" />}
              accent="pink"
            />
            <motion.button
              whileHover={{ scale: 1.06 }}
              whileTap={{ scale: 0.94 }}
              onClick={onEndCall}
              className="flex h-12 w-12 items-center justify-center rounded-full bg-red-500 text-white shadow-[0_0_20px_rgba(239,68,68,0.5)]"
              aria-label="End call"
            >
              <PhoneOff className="h-5 w-5" />
            </motion.button>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

function ControlButton({
  active,
  onClick,
  activeIcon,
  inactiveIcon,
  accent = 'cyan',
}: {
  active: boolean;
  onClick: () => void;
  activeIcon: React.ReactNode;
  inactiveIcon: React.ReactNode;
  accent?: 'cyan' | 'pink';
}) {
  return (
    <motion.button
      whileHover={{ scale: 1.06 }}
      whileTap={{ scale: 0.94 }}
      onClick={onClick}
      className={
        active
          ? `flex h-12 w-12 items-center justify-center rounded-full text-void-950 ${
              accent === 'pink' ? 'bg-gradient-to-br from-neon-pink to-neon-purple' : 'bg-gradient-to-br from-neon-cyan to-neon-blue'
            } shadow-neon`
          : 'flex h-12 w-12 items-center justify-center rounded-full border border-white/15 bg-white/5 text-white/60'
      }
    >
      {active ? activeIcon : inactiveIcon}
    </motion.button>
  );
}
