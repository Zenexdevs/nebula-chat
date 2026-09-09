'use client';

import { useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { Menu, Loader2 } from 'lucide-react';
import Sidebar from './Sidebar';
import MessageList from './MessageList';
import MessageInput from './MessageInput';
import TypingIndicator from './TypingIndicator';
import CallOverlay from './CallOverlay';
import Avatar from './Avatar';
import { useChatRoom } from '@/lib/useChatRoom';
import { useCall } from '@/lib/useCall';
import { forgetSession } from '@/lib/sessionStore';
import type { ChatMessage, Profile } from '@/types';

export default function ChatRoom({
  roomId,
  roomName,
  secretKey,
  profile,
  onLeave,
}: {
  roomId: string;
  roomName: string;
  secretKey: Uint8Array;
  profile: Profile;
  onLeave: () => void;
}) {
  const [sidebarOpen, setSidebarOpen] = useState(true);

  const {
    messages,
    loadingHistory,
    presence,
    onlineCount,
    uploadProgress,
    soundEnabled,
    setSoundEnabled,
    autoDelete24h,
    setAutoDelete24h,
    setTyping,
    markRead,
    sendMessage,
    sendFile,
    downloadFile,
    toggleReaction,
    leaveRoom,
  } = useChatRoom(roomId, secretKey, profile);

  const call = useCall(roomId, profile.id, profile.name, profile.avatarUrl);

  const typingNames = useMemo(
    () =>
      Object.values(presence)
        .filter((p) => p.id !== profile.id && p.typing)
        .map((p) => p.name),
    [presence, profile.id]
  );

  function handleLeave() {
    call.endCall();
    leaveRoom();
    onLeave();
  }

  async function handleDownload(message: ChatMessage) {
    if (!message.file) return null;
    return downloadFile(message.file);
  }

  return (
    <div className="relative flex h-full w-full">
      <Sidebar
        roomName={roomName}
        presence={presence}
        selfId={profile.id}
        soundEnabled={soundEnabled}
        onToggleSound={() => setSoundEnabled((v) => !v)}
        onLeave={handleLeave}
        onStartCall={call.startCall}
        inCall={call.inCall}
        open={sidebarOpen}
        autoDelete24h={autoDelete24h}
        onToggleAutoDelete={setAutoDelete24h}
        onForgetDevice={() => forgetSession(roomId)}
      />

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="glass flex items-center gap-3 border-b border-white/10 px-4 py-3">
          <button
            onClick={() => setSidebarOpen((v) => !v)}
            className="rounded-lg p-2 text-white/50 transition hover:bg-white/10"
            aria-label="Toggle sidebar"
          >
            <Menu className="h-5 w-5" />
          </button>
          <Avatar src={profile.avatarUrl} name={profile.name} size={34} online />
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold">{roomName}</p>
            <p className="text-[11px] text-white/40">{onlineCount} online</p>
          </div>
        </header>

        <div className="relative flex flex-1 flex-col overflow-hidden">
          {loadingHistory ? (
            <div className="flex flex-1 items-center justify-center gap-2 text-sm text-white/40">
              <Loader2 className="h-4 w-4 animate-spin" /> Decrypting message history…
            </div>
          ) : messages.length === 0 ? (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="flex flex-1 flex-col items-center justify-center gap-2 text-center text-white/30"
            >
              <p className="text-sm">No messages yet.</p>
              <p className="text-xs">Say hello — it's all encrypted before it leaves your device.</p>
            </motion.div>
          ) : (
            <MessageList
              messages={messages}
              selfId={profile.id}
              presence={presence}
              onReact={toggleReaction}
              onDownload={handleDownload}
              onVisible={markRead}
            />
          )}

          <TypingIndicator names={typingNames} />

          <CallOverlay
            inCall={call.inCall}
            connecting={call.connecting}
            error={call.callError}
            participants={call.participants}
            micOn={call.micOn}
            camOn={call.camOn}
            sharingScreen={call.sharingScreen}
            onToggleMic={call.toggleMic}
            onToggleCam={call.toggleCam}
            onToggleScreenShare={call.toggleScreenShare}
            onEndCall={call.endCall}
          />
        </div>

        <MessageInput onSend={sendMessage} onFile={sendFile} onTyping={setTyping} uploadProgress={uploadProgress} />
      </div>
    </div>
  );
}
