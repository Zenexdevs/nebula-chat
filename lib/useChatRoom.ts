'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import type { RealtimeChannel } from '@supabase/supabase-js';
import { supabase, STORAGE_BUCKET } from './supabase';
import {
  decryptText,
  encryptText,
  decryptJSON,
  encryptJSON,
  encryptRawBytes,
  decryptRawBytes,
  randomId,
} from './crypto';
import { playJoinSound, playMessageSound } from './sound';
import type { ChatMessage, FileMeta, PresenceState, Profile } from '@/types';
import { encodeBase64, decodeBase64 } from 'tweetnacl-util';

const AUTO_DELETE_MS = 24 * 60 * 60 * 1000;
// Safety-net poll: catches any message a dropped/throttled realtime
// connection missed (e.g. a backgrounded browser tab), instead of only
// ever recovering on a manual leave + rejoin.
const POLL_INTERVAL_MS = 6000;

type Row = {
  id: string;
  room_id: string;
  sender_id: string;
  sender_name_cipher: string;
  sender_name_nonce: string;
  ciphertext: string;
  nonce: string;
  msg_type: 'text' | 'file' | 'system';
  file_meta_cipher: string | null;
  file_meta_nonce: string | null;
  reactions: Record<string, string[]>;
  reply_to: string | null;
  created_at: string;
};

function decryptRow(row: Row, secretKey: Uint8Array): ChatMessage | null {
  const senderName = decryptText(secretKey, row.sender_name_cipher, row.sender_name_nonce) ?? 'Unknown';
  let text: string | undefined;
  let file: FileMeta | undefined;

  if (row.msg_type === 'file' && row.file_meta_cipher && row.file_meta_nonce) {
    file = decryptJSON<FileMeta>(secretKey, row.file_meta_cipher, row.file_meta_nonce) ?? undefined;
  } else {
    const decrypted = decryptText(secretKey, row.ciphertext, row.nonce);
    if (decrypted === null) return null;
    text = decrypted;
  }

  return {
    id: row.id,
    roomId: row.room_id,
    senderId: row.sender_id,
    senderName,
    type: row.msg_type,
    text,
    file,
    reactions: row.reactions ?? {},
    replyTo: row.reply_to ?? undefined,
    createdAt: row.created_at,
  };
}

export function useChatRoom(roomId: string, secretKey: Uint8Array, profile: Profile) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(true);
  const [presence, setPresence] = useState<Record<string, PresenceState>>({});
  const [uploadProgress, setUploadProgress] = useState<number | null>(null);
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [autoDelete24h, setAutoDelete24hState] = useState(false);

  const channelRef = useRef<RealtimeChannel | null>(null);
  const soundEnabledRef = useRef(true);
  const typingTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isFirstLoadRef = useRef(true);
  const latestCreatedAtRef = useRef<string | null>(null);
  const profileRef = useRef(profile);

  useEffect(() => {
    soundEnabledRef.current = soundEnabled;
  }, [soundEnabled]);

  useEffect(() => {
    profileRef.current = profile;
  }, [profile]);

  /** Decrypts, de-dupes, and merges rows into state — used by the initial
   *  load, the realtime INSERT handler, and the polling safety net alike,
   *  so all three paths behave identically. Returns only the rows that
   *  were actually new (not already in state). */
  const mergeRows = useCallback(
    (rows: Row[]): ChatMessage[] => {
      const decoded = rows.map((row) => decryptRow(row, secretKey)).filter((m): m is ChatMessage => m !== null);
      if (decoded.length === 0) return [];

      let fresh: ChatMessage[] = [];
      setMessages((prev) => {
        const ids = new Set(prev.map((m) => m.id));
        fresh = decoded.filter((m) => !ids.has(m.id));
        if (fresh.length === 0) return prev;
        return [...prev, ...fresh].sort((a, b) => (a.createdAt < b.createdAt ? -1 : a.createdAt > b.createdAt ? 1 : 0));
      });

      for (const m of decoded) {
        if (!latestCreatedAtRef.current || m.createdAt > latestCreatedAtRef.current) {
          latestCreatedAtRef.current = m.createdAt;
        }
      }
      return fresh;
    },
    [secretKey]
  );

  const removeMessages = useCallback((ids: string[]) => {
    if (ids.length === 0) return;
    const idSet = new Set(ids);
    setMessages((prev) => prev.filter((m) => !idSet.has(m.id)));
  }, []);

  // Initial history load
  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoadingHistory(true);
      const { data, error } = await supabase
        .from('messages')
        .select('*')
        .eq('room_id', roomId)
        .order('created_at', { ascending: true })
        .limit(500);

      if (!cancelled) {
        if (!error && data) mergeRows(data as Row[]);
        setLoadingHistory(false);
      }
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [roomId, secretKey]);

  // Room settings (auto-delete flag)
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { data } = await supabase.from('rooms').select('auto_delete_24h').eq('id', roomId).maybeSingle();
      if (!cancelled && data) setAutoDelete24hState(Boolean((data as { auto_delete_24h?: boolean }).auto_delete_24h));
    })();
    return () => {
      cancelled = true;
    };
  }, [roomId]);

  const setAutoDelete24h = useCallback(
    async (enabled: boolean) => {
      setAutoDelete24hState(enabled);
      const { error } = await supabase.from('rooms').update({ auto_delete_24h: enabled }).eq('id', roomId);
      if (error) console.error('setAutoDelete24h failed', error);
    },
    [roomId]
  );

  // Best-effort client-side cleanup for rooms with auto-delete on: removes
  // the encrypted file blob from Storage *and* the message row for
  // anything older than 24h. A server-side scheduled job (see
  // supabase/schema.sql) deletes expired rows even when nobody has the
  // room open; this just runs it eagerly (and catches file blobs) whenever
  // someone does.
  const purgeExpired = useCallback(async () => {
    const cutoff = new Date(Date.now() - AUTO_DELETE_MS).toISOString();
    try {
      const { data: expiredFiles } = await supabase
        .from('messages')
        .select('id, file_meta_cipher, file_meta_nonce')
        .eq('room_id', roomId)
        .eq('msg_type', 'file')
        .lt('created_at', cutoff);

      const paths: string[] = [];
      (expiredFiles ?? []).forEach((row: { file_meta_cipher: string | null; file_meta_nonce: string | null }) => {
        if (!row.file_meta_cipher || !row.file_meta_nonce) return;
        const meta = decryptJSON<FileMeta>(secretKey, row.file_meta_cipher, row.file_meta_nonce);
        if (meta?.path) paths.push(meta.path);
      });
      if (paths.length > 0) {
        await supabase.storage.from(STORAGE_BUCKET).remove(paths);
      }

      const { data: deletedRows } = await supabase
        .from('messages')
        .delete()
        .eq('room_id', roomId)
        .lt('created_at', cutoff)
        .select('id');

      if (deletedRows && deletedRows.length > 0) {
        removeMessages((deletedRows as { id: string }[]).map((r) => r.id));
      }
    } catch (err) {
      console.error('purgeExpired failed', err);
    }
  }, [roomId, secretKey, removeMessages]);

  useEffect(() => {
    if (!autoDelete24h) return;
    purgeExpired();
    const interval = setInterval(purgeExpired, 5 * 60 * 1000);
    return () => clearInterval(interval);
  }, [autoDelete24h, purgeExpired]);

  // Realtime: new messages + reaction updates + deletions + presence + typing
  useEffect(() => {
    const channel = supabase.channel(`room:${roomId}`, {
      config: { presence: { key: profile.id } },
    });
    channelRef.current = channel;

    channel.on(
      'postgres_changes',
      { event: 'INSERT', schema: 'public', table: 'messages', filter: `room_id=eq.${roomId}` },
      (payload) => {
        const row = payload.new as Row;
        const fresh = mergeRows([row]);
        const decoded = fresh[0];
        if (decoded && decoded.senderId !== profile.id && soundEnabledRef.current) playMessageSound();
      }
    );

    channel.on(
      'postgres_changes',
      { event: 'UPDATE', schema: 'public', table: 'messages', filter: `room_id=eq.${roomId}` },
      (payload) => {
        const row = payload.new as Row;
        setMessages((prev) =>
          prev.map((m) => (m.id === row.id ? { ...m, reactions: row.reactions ?? {} } : m))
        );
      }
    );

    channel.on(
      'postgres_changes',
      { event: 'DELETE', schema: 'public', table: 'messages', filter: `room_id=eq.${roomId}` },
      (payload) => {
        const oldRow = payload.old as { id?: string };
        if (oldRow?.id) removeMessages([oldRow.id]);
      }
    );

    channel.on('presence', { event: 'sync' }, () => {
      const state = channel.presenceState<PresenceState>();
      const next: Record<string, PresenceState> = {};
      Object.entries(state).forEach(([id, metas]) => {
        const meta = metas[metas.length - 1] as unknown as PresenceState;
        next[id] = meta;
      });
      setPresence(next);
    });

    channel.on('presence', { event: 'join' }, ({ key }) => {
      if (key !== profile.id && !isFirstLoadRef.current && soundEnabledRef.current) {
        playJoinSound();
      }
    });

    channel.subscribe(async (status) => {
      if (status === 'SUBSCRIBED') {
        await channel.track({
          id: profile.id,
          name: profile.name,
          avatarUrl: profile.avatarUrl,
          status: profile.status,
          online_at: new Date().toISOString(),
          typing: false,
        } satisfies PresenceState);
        isFirstLoadRef.current = false;
      }
    });

    return () => {
      channel.unsubscribe();
      channelRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [roomId, secretKey, profile.id]);

  // Self-healing safety net: a backgrounded/throttled tab or a dropped
  // websocket can silently miss a realtime event. Poll for anything newer
  // than the last message we know about, and also re-sync immediately
  // whenever the tab regains focus/visibility (also re-announces presence,
  // in case that went stale too).
  useEffect(() => {
    let cancelled = false;

    const poll = async () => {
      let query = supabase
        .from('messages')
        .select('*')
        .eq('room_id', roomId)
        .order('created_at', { ascending: true })
        .limit(200);
      if (latestCreatedAtRef.current) query = query.gt('created_at', latestCreatedAtRef.current);
      const { data, error } = await query;
      if (!cancelled && !error && data && data.length > 0) mergeRows(data as Row[]);
    };

    const onVisible = () => {
      if (document.visibilityState !== 'visible') return;
      poll();
      channelRef.current?.track({
        id: profileRef.current.id,
        name: profileRef.current.name,
        avatarUrl: profileRef.current.avatarUrl,
        status: profileRef.current.status,
        online_at: new Date().toISOString(),
        typing: false,
      } satisfies PresenceState);
    };

    const interval = setInterval(poll, POLL_INTERVAL_MS);
    document.addEventListener('visibilitychange', onVisible);
    window.addEventListener('focus', onVisible);
    return () => {
      cancelled = true;
      clearInterval(interval);
      document.removeEventListener('visibilitychange', onVisible);
      window.removeEventListener('focus', onVisible);
    };
  }, [roomId, mergeRows]);

  const updatePresence = useCallback(
    (patch: Partial<PresenceState>) => {
      const channel = channelRef.current;
      if (!channel) return;
      const current = presence[profile.id];
      channel.track({
        id: profile.id,
        name: profile.name,
        avatarUrl: profile.avatarUrl,
        status: profile.status,
        online_at: current?.online_at ?? new Date().toISOString(),
        ...patch,
      } satisfies PresenceState);
    },
    [presence, profile]
  );

  const setTyping = useCallback(
    (typing: boolean) => {
      updatePresence({ typing });
      if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
      if (typing) {
        typingTimeoutRef.current = setTimeout(() => updatePresence({ typing: false }), 3000);
      }
    },
    [updatePresence]
  );

  const markRead = useCallback(() => {
    updatePresence({ lastReadAt: new Date().toISOString() });
  }, [updatePresence]);

  const sendMessage = useCallback(
    async (text: string, replyTo?: string) => {
      if (!text.trim()) return;
      const { ciphertext, nonce } = encryptText(secretKey, text.trim());
      const nameCipher = encryptText(secretKey, profile.name);
      const { error } = await supabase.from('messages').insert({
        room_id: roomId,
        sender_id: profile.id,
        sender_name_cipher: nameCipher.ciphertext,
        sender_name_nonce: nameCipher.nonce,
        ciphertext,
        nonce,
        msg_type: 'text',
        reply_to: replyTo ?? null,
      });
      if (error) console.error('sendMessage failed', error);
      setTyping(false);
    },
    [roomId, profile, secretKey, setTyping]
  );

  const sendFile = useCallback(
    async (file: File) => {
      setUploadProgress(0);
      try {
        const buffer = new Uint8Array(await file.arrayBuffer());
        const { cipher, nonce } = encryptRawBytes(secretKey, buffer);
        const path = `${roomId}/${randomId()}-${encodeURIComponent(file.name)}`;

        const { error: uploadErr } = await supabase.storage
          .from(STORAGE_BUCKET)
          .upload(path, cipher, { contentType: 'application/octet-stream' });
        if (uploadErr) throw uploadErr;

        setUploadProgress(70);

        const fileMeta: FileMeta = {
          name: file.name,
          size: file.size,
          mime: file.type || 'application/octet-stream',
          path,
          nonce: encodeBase64(nonce),
        };
        const metaCipher = encryptJSON(secretKey, fileMeta);
        const nameCipher = encryptText(secretKey, profile.name);
        const placeholderText = encryptText(secretKey, `📎 ${file.name}`);

        const { error: insertErr } = await supabase.from('messages').insert({
          room_id: roomId,
          sender_id: profile.id,
          sender_name_cipher: nameCipher.ciphertext,
          sender_name_nonce: nameCipher.nonce,
          ciphertext: placeholderText.ciphertext,
          nonce: placeholderText.nonce,
          msg_type: 'file',
          file_meta_cipher: metaCipher.ciphertext,
          file_meta_nonce: metaCipher.nonce,
        });
        if (insertErr) throw insertErr;
        setUploadProgress(100);
      } catch (err) {
        console.error('sendFile failed', err);
      } finally {
        setTimeout(() => setUploadProgress(null), 600);
      }
    },
    [roomId, profile, secretKey]
  );

  const downloadFile = useCallback(
    async (meta: FileMeta): Promise<Blob | null> => {
      const { data, error } = await supabase.storage.from(STORAGE_BUCKET).download(meta.path);
      if (error || !data) {
        console.error('download failed', error);
        return null;
      }
      const cipherBuf = new Uint8Array(await data.arrayBuffer());
      const plain = decryptRawBytes(secretKey, cipherBuf, decodeBase64(meta.nonce));
      if (!plain) return null;
      return new Blob([plain as BlobPart], { type: meta.mime });
    },
    [secretKey]
  );

  const toggleReaction = useCallback(
    async (messageId: string, emoji: string) => {
      const message = messages.find((m) => m.id === messageId);
      if (!message) return;
      const reactions = { ...message.reactions };
      const set = new Set(reactions[emoji] ?? []);
      if (set.has(profile.id)) set.delete(profile.id);
      else set.add(profile.id);
      if (set.size === 0) delete reactions[emoji];
      else reactions[emoji] = Array.from(set);

      setMessages((prev) => prev.map((m) => (m.id === messageId ? { ...m, reactions } : m)));
      const { error } = await supabase.from('messages').update({ reactions }).eq('id', messageId);
      if (error) console.error('toggleReaction failed', error);
    },
    [messages, profile.id]
  );

  const leaveRoom = useCallback(() => {
    channelRef.current?.untrack();
    channelRef.current?.unsubscribe();
  }, []);

  return {
    messages,
    loadingHistory,
    presence,
    onlineCount: Object.keys(presence).length,
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
  };
}
