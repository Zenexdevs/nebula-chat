export type Profile = {
  id: string; // random per-session id, generated on join — not tied to any account
  name: string;
  avatarUrl: string; // DiceBear URL, or a decrypted-file blob URL for uploaded avatars
  status: string;
};

export type ChatMessageType = 'text' | 'file' | 'system';

export type FileMeta = {
  name: string;
  size: number;
  mime: string;
  path: string; // storage path inside the room's folder
  nonce: string; // base64 nonce used to encrypt the uploaded bytes
};

export type ChatMessage = {
  id: string;
  roomId: string;
  senderId: string;
  senderName: string;
  type: ChatMessageType;
  text?: string;
  file?: FileMeta;
  reactions: Record<string, string[]>; // emoji -> [senderId]
  replyTo?: string;
  createdAt: string;
  pending?: boolean; // optimistic UI flag
};

export type PresenceState = {
  id: string;
  name: string;
  avatarUrl: string;
  status: string;
  online_at: string;
  typing?: boolean;
  lastReadAt?: string;
  inCall?: boolean;
};

export type CallParticipant = {
  id: string;
  name: string;
  avatarUrl: string;
  stream?: MediaStream;
  micOn: boolean;
  camOn: boolean;
  isScreenShare?: boolean;
  isLocal?: boolean;
};

export type RoomSession = {
  roomId: string;
  roomName: string;
  secretKey: Uint8Array; // never leaves the client, never sent anywhere
  profile: Profile;
};
