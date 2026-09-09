'use client';

import { useEffect, useRef } from 'react';
import { motion } from 'framer-motion';
import { MicOff, MonitorPlay } from 'lucide-react';
import Avatar from './Avatar';
import type { CallParticipant } from '@/types';

export default function ParticipantTile({ participant }: { participant: CallParticipant }) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const hasVideo = participant.camOn && participant.stream && participant.stream.getVideoTracks().length > 0;

  useEffect(() => {
    if (videoRef.current && participant.stream) {
      videoRef.current.srcObject = participant.stream;
    }
  }, [participant.stream]);

  return (
    <motion.div
      layout
      initial={{ opacity: 0, scale: 0.9 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.9 }}
      className="glass relative flex aspect-video items-center justify-center overflow-hidden rounded-2xl"
    >
      {/* Always mounted — even for an audio-only participant — so the
          <video> element's audio track keeps playing. It was previously
          only rendered when the camera was on, which meant a voice-only
          call carried no sound in either direction; `hidden` (display:
          none) doesn't pause an already-attached media element's audio. */}
      <video
        ref={videoRef}
        autoPlay
        playsInline
        muted={participant.isLocal}
        className={hasVideo ? 'h-full w-full object-cover' : 'hidden'}
      />

      {!hasVideo && (
        <div className="flex flex-col items-center gap-2">
          <Avatar src={participant.avatarUrl} name={participant.name} size={64} ring />
        </div>
      )}

      <div className="absolute bottom-2 left-2 flex items-center gap-1.5 rounded-lg bg-black/50 px-2 py-1 text-xs backdrop-blur-sm">
        {participant.isScreenShare && <MonitorPlay className="h-3 w-3 text-neon-cyan" />}
        <span className="max-w-[10rem] truncate">{participant.name}</span>
        {!participant.micOn && <MicOff className="h-3 w-3 text-red-400" />}
      </div>

      {!participant.stream && (
        <div className="shimmer-bg absolute inset-0 animate-shimmer opacity-30" />
      )}
    </motion.div>
  );
}
