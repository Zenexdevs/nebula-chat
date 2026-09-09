'use client';

/**
 * "Remember this room" — lets a returning visitor skip retyping the room
 * password. Only the DERIVED encryption key is stored (never the password
 * itself), in this browser's localStorage only. It never leaves the device
 * and is never sent to Supabase or anywhere else.
 *
 * Trade-off, stated plainly: localStorage is less protected than the
 * in-memory-only key used during a normal session — anyone with access to
 * this browser profile (not just this tab) could reopen a remembered room
 * without the password. That's why every remembered room can be forgotten
 * with one click, both from the join screen and from inside the room.
 */
import { encodeBase64, decodeBase64 } from 'tweetnacl-util';
import type { Profile } from '@/types';

const STORAGE_KEY = 'nebula:sessions:v1';

export type StoredSession = {
  roomId: string;
  roomName: string;
  secretKeyB64: string;
  profile: Profile;
  savedAt: string;
};

type Store = Record<string, StoredSession>;

function readStore(): Store {
  if (typeof window === 'undefined') return {};
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as Store) : {};
  } catch {
    return {};
  }
}

function writeStore(store: Store) {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(store));
  } catch {
    /* localStorage unavailable (private browsing, quota, disabled) — the
       app still works, it just won't remember this room next time. */
  }
}

export function saveSession(roomId: string, roomName: string, secretKey: Uint8Array, profile: Profile) {
  const store = readStore();
  store[roomId] = {
    roomId,
    roomName,
    secretKeyB64: encodeBase64(secretKey),
    profile,
    savedAt: new Date().toISOString(),
  };
  writeStore(store);
}

export function getSession(
  roomId: string
): { roomName: string; secretKey: Uint8Array; profile: Profile } | null {
  const entry = readStore()[roomId];
  if (!entry) return null;
  try {
    return { roomName: entry.roomName, secretKey: decodeBase64(entry.secretKeyB64), profile: entry.profile };
  } catch {
    return null;
  }
}

export function listSessions(): StoredSession[] {
  return Object.values(readStore()).sort((a, b) => (a.savedAt < b.savedAt ? 1 : -1));
}

export function forgetSession(roomId: string) {
  const store = readStore();
  delete store[roomId];
  writeStore(store);
}

