'use client';

import { useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import JoinScreen, { JoinResult } from './JoinScreen';
import ProfileSetup from './ProfileSetup';
import ChatRoom from './ChatRoom';
import type { Profile } from '@/types';

type Step =
  | { name: 'join' }
  | { name: 'profile'; session: JoinResult }
  | { name: 'chat'; session: JoinResult; profile: Profile };

export default function App({ initialRoomName }: { initialRoomName?: string }) {
  const [step, setStep] = useState<Step>({ name: 'join' });

  return (
    <AnimatePresence mode="wait">
      {step.name === 'join' && (
        <motion.div key="join" exit={{ opacity: 0 }} className="h-full">
          <JoinScreen
            initialRoomName={initialRoomName}
            onJoined={(session) => setStep({ name: 'profile', session })}
          />
        </motion.div>
      )}

      {step.name === 'profile' && (
        <motion.div key="profile" exit={{ opacity: 0 }} className="h-full">
          <ProfileSetup
            roomName={step.session.roomName}
            onReady={(profile) => setStep({ name: 'chat', session: step.session, profile })}
          />
        </motion.div>
      )}

      {step.name === 'chat' && (
        <motion.div key="chat" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="h-full">
          <ChatRoom
            roomId={step.session.roomId}
            roomName={step.session.roomName}
            secretKey={step.session.secretKey}
            profile={step.profile}
            onLeave={() => setStep({ name: 'join' })}
          />
        </motion.div>
      )}
    </AnimatePresence>
  );
}
