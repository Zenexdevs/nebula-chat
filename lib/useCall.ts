'use client';

/**
 * Mesh WebRTC voice/video calling, signaled entirely over a Supabase
 * Realtime channel (no separate signaling server needed).
 *
 * Design notes / known limits (documented here rather than hidden):
 *  - Full mesh: every participant connects directly to every other
 *    participant. This is simple and needs no media server, but scales to
 *    roughly 6-8 people comfortably. Beyond that, swap in an SFU
 *    (e.g. LiveKit Cloud's free tier) — the signaling channel below is
 *    where you'd plug it in.
 *  - Screen share REPLACES your camera track on the existing connection
 *    (via replaceTrack) rather than sending both at once — simpler, and
 *    avoids renegotiating a second video transceiver per peer. A signaling
 *    message tells peers to label the tile "screen" vs "camera".
 *  - System audio during screen share is best-effort: captured only when
 *    the browser's screen-share picker offers it (Chrome, tab/window
 *    sharing), sent as an extra audio track alongside the mic track.
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import type { RealtimeChannel } from '@supabase/supabase-js';
import { supabase } from './supabase';
import type { CallParticipant } from '@/types';

// STUN alone frequently fails to connect real-world NAT pairs (mobile
// networks, CGNAT, restrictive corporate/home routers) — the call signals
// fine but no media ever flows, which looks exactly like "I can't hear
// them and they can't hear me". A TURN relay is the fix: when a direct
// path can't be found, media is relayed through the TURN server instead.
// Metered's Open Relay project publishes these credentials for free,
// public use (rate-limited, fine for casual use between a few people). For
// heavier use, sign up for a free Metered.ca account and set
// NEXT_PUBLIC_TURN_URL / _USERNAME / _CREDENTIAL to your own credentials.
const ICE_SERVERS: RTCIceServer[] = [
  { urls: 'stun:stun.l.google.com:19302' },
  { urls: 'stun:stun1.l.google.com:19302' },
  {
    urls: process.env.NEXT_PUBLIC_TURN_URL || 'turn:openrelay.metered.ca:80',
    username: process.env.NEXT_PUBLIC_TURN_USERNAME || 'openrelayproject',
    credential: process.env.NEXT_PUBLIC_TURN_CREDENTIAL || 'openrelayproject',
  },
  { urls: 'turn:openrelay.metered.ca:443', username: 'openrelayproject', credential: 'openrelayproject' },
  {
    urls: 'turn:openrelay.metered.ca:443?transport=tcp',
    username: 'openrelayproject',
    credential: 'openrelayproject',
  },
];

type SignalMessage =
  | { kind: 'offer'; to: string; from: string; sdp: RTCSessionDescriptionInit }
  | { kind: 'answer'; to: string; from: string; sdp: RTCSessionDescriptionInit }
  | { kind: 'candidate'; to: string; from: string; candidate: RTCIceCandidateInit }
  | { kind: 'screen-share'; to: string; from: string; active: boolean }
  | { kind: 'media-state'; to: string; from: string; micOn: boolean; camOn: boolean };

type Peer = {
  id: string;
  name: string;
  avatarUrl: string;
  connection: RTCPeerConnection;
  remoteStream: MediaStream;
  screenSharing: boolean;
  micOn: boolean;
  camOn: boolean;
  makingOffer: boolean;
};

export function useCall(
  roomId: string,
  selfId: string,
  selfName: string,
  selfAvatar: string
) {
  const [inCall, setInCall] = useState(false);
  const [micOn, setMicOn] = useState(true);
  const [camOn, setCamOn] = useState(false);
  const [sharingScreen, setSharingScreen] = useState(false);
  const [participants, setParticipants] = useState<CallParticipant[]>([]);
  const [connecting, setConnecting] = useState(false);
  const [callError, setCallError] = useState<string | null>(null);

  const channelRef = useRef<RealtimeChannel | null>(null);
  const localStreamRef = useRef<MediaStream | null>(null);
  const cameraTrackRef = useRef<MediaStreamTrack | null>(null);
  const screenStreamRef = useRef<MediaStream | null>(null);
  const peersRef = useRef<Map<string, Peer>>(new Map());
  const micOnRef = useRef(true);
  const camOnRef = useRef(false);

  const emitParticipants = useCallback(() => {
    const list: CallParticipant[] = [];
    if (localStreamRef.current) {
      list.push({
        id: selfId,
        name: selfName,
        avatarUrl: selfAvatar,
        stream: sharingScreen ? screenStreamRef.current ?? localStreamRef.current : localStreamRef.current,
        micOn: micOnRef.current,
        camOn: camOnRef.current || sharingScreen,
        isScreenShare: sharingScreen,
        isLocal: true,
      });
    }
    peersRef.current.forEach((p) => {
      list.push({
        id: p.id,
        name: p.screenSharing ? `${p.name} (screen)` : p.name,
        avatarUrl: p.avatarUrl,
        stream: p.remoteStream,
        micOn: p.micOn,
        camOn: p.camOn,
        isScreenShare: p.screenSharing,
      });
    });
    setParticipants(list);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selfId, selfName, selfAvatar, sharingScreen]);

  const send = useCallback((msg: SignalMessage) => {
    channelRef.current?.send({ type: 'broadcast', event: 'signal', payload: msg });
  }, []);

  const createPeerConnection = useCallback(
    (peerId: string, peerName: string, peerAvatar: string, initiator: boolean) => {
      const pc = new RTCPeerConnection({ iceServers: ICE_SERVERS });
      const remoteStream = new MediaStream();

      const peer: Peer = {
        id: peerId,
        name: peerName,
        avatarUrl: peerAvatar,
        connection: pc,
        remoteStream,
        screenSharing: false,
        micOn: true,
        camOn: false,
        makingOffer: false,
      };
      peersRef.current.set(peerId, peer);

      localStreamRef.current?.getTracks().forEach((track) => {
        pc.addTrack(track, localStreamRef.current!);
      });

      pc.ontrack = (event) => {
        event.streams[0]?.getTracks().forEach((t) => remoteStream.addTrack(t));
        if (event.streams.length === 0) remoteStream.addTrack(event.track);
        emitParticipants();
      };

      pc.onicecandidate = (event) => {
        if (event.candidate) {
          send({ kind: 'candidate', to: peerId, from: selfId, candidate: event.candidate.toJSON() });
        }
      };

      pc.onconnectionstatechange = () => {
        if (['failed', 'closed', 'disconnected'].includes(pc.connectionState)) {
          peersRef.current.delete(peerId);
          emitParticipants();
        }
      };

      pc.onnegotiationneeded = async () => {
        try {
          peer.makingOffer = true;
          const offer = await pc.createOffer();
          await pc.setLocalDescription(offer);
          send({ kind: 'offer', to: peerId, from: selfId, sdp: pc.localDescription! });
        } finally {
          peer.makingOffer = false;
        }
      };

      if (initiator) {
        // onnegotiationneeded fires automatically once tracks are added.
      }

      return peer;
    },
    [selfId, send, emitParticipants]
  );

  const handleSignal = useCallback(
    async (msg: SignalMessage) => {
      if (msg.to !== selfId) return;

      if (msg.kind === 'offer') {
        let peer = peersRef.current.get(msg.from);
        if (!peer) peer = createPeerConnection(msg.from, msg.from, '', false);
        await peer.connection.setRemoteDescription(new RTCSessionDescription(msg.sdp));
        const answer = await peer.connection.createAnswer();
        await peer.connection.setLocalDescription(answer);
        send({ kind: 'answer', to: msg.from, from: selfId, sdp: peer.connection.localDescription! });
      } else if (msg.kind === 'answer') {
        const peer = peersRef.current.get(msg.from);
        if (peer) await peer.connection.setRemoteDescription(new RTCSessionDescription(msg.sdp));
      } else if (msg.kind === 'candidate') {
        const peer = peersRef.current.get(msg.from);
        if (peer) {
          try {
            await peer.connection.addIceCandidate(new RTCIceCandidate(msg.candidate));
          } catch {
            /* benign if it arrives before remote description is set */
          }
        }
      } else if (msg.kind === 'screen-share') {
        const peer = peersRef.current.get(msg.from);
        if (peer) {
          peer.screenSharing = msg.active;
          emitParticipants();
        }
      } else if (msg.kind === 'media-state') {
        const peer = peersRef.current.get(msg.from);
        if (peer) {
          peer.micOn = msg.micOn;
          peer.camOn = msg.camOn;
          emitParticipants();
        }
      }
    },
    [selfId, createPeerConnection, send, emitParticipants]
  );

  const connectToPeer = useCallback(
    (peerId: string, peerName: string, peerAvatar: string) => {
      if (peersRef.current.has(peerId)) return;
      createPeerConnection(peerId, peerName, peerAvatar, true);
    },
    [createPeerConnection]
  );

  const startCall = useCallback(async () => {
    setCallError(null);
    setConnecting(true);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: true,
        video: camOnRef.current,
      });
      localStreamRef.current = stream;
      cameraTrackRef.current = stream.getVideoTracks()[0] ?? null;
      stream.getAudioTracks().forEach((t) => (t.enabled = micOnRef.current));

      const channel = supabase.channel(`call:${roomId}`, {
        config: { presence: { key: selfId }, broadcast: { self: false } },
      });
      channelRef.current = channel;

      channel.on('broadcast', { event: 'signal' }, ({ payload }) => {
        handleSignal(payload as SignalMessage);
      });

      channel.on('presence', { event: 'sync' }, () => {
        const state = channel.presenceState<{ name: string; avatarUrl: string }>();
        Object.entries(state).forEach(([peerId, metas]) => {
          if (peerId === selfId) return;
          const meta = metas[0];

          const existing = peersRef.current.get(peerId);
          if (existing) {
            // Fill in real name/avatar once presence metadata arrives —
            // an inbound offer may have created the peer before we knew them.
            existing.name = meta?.name ?? existing.name;
            existing.avatarUrl = meta?.avatarUrl ?? existing.avatarUrl;
          } else if (selfId < peerId) {
            // Lower id initiates the offer, avoiding a glare of double-offers.
            connectToPeer(peerId, meta?.name ?? 'Guest', meta?.avatarUrl ?? '');
          }
        });
        emitParticipants();
      });

      channel.on('presence', { event: 'leave' }, ({ key }) => {
        const peer = peersRef.current.get(key);
        peer?.connection.close();
        peersRef.current.delete(key);
        emitParticipants();
      });

      await channel.subscribe(async (status) => {
        if (status === 'SUBSCRIBED') {
          await channel.track({ name: selfName, avatarUrl: selfAvatar });
        }
      });

      setInCall(true);
      emitParticipants();
    } catch (err) {
      console.error(err);
      setCallError(
        err instanceof Error && err.name === 'NotAllowedError'
          ? 'Camera/microphone permission was denied.'
          : 'Could not start the call — check camera/mic permissions.'
      );
    } finally {
      setConnecting(false);
    }
  }, [roomId, selfId, selfName, selfAvatar, handleSignal, connectToPeer, emitParticipants]);

  const endCall = useCallback(() => {
    peersRef.current.forEach((p) => p.connection.close());
    peersRef.current.clear();
    localStreamRef.current?.getTracks().forEach((t) => t.stop());
    screenStreamRef.current?.getTracks().forEach((t) => t.stop());
    localStreamRef.current = null;
    screenStreamRef.current = null;
    channelRef.current?.untrack();
    channelRef.current?.unsubscribe();
    channelRef.current = null;
    setInCall(false);
    setSharingScreen(false);
    setParticipants([]);
  }, []);

  const broadcastMediaState = useCallback(() => {
    peersRef.current.forEach((_, peerId) => {
      send({ kind: 'media-state', to: peerId, from: selfId, micOn: micOnRef.current, camOn: camOnRef.current });
    });
  }, [selfId, send]);

  const toggleMic = useCallback(() => {
    micOnRef.current = !micOnRef.current;
    setMicOn(micOnRef.current);
    localStreamRef.current?.getAudioTracks().forEach((t) => (t.enabled = micOnRef.current));
    broadcastMediaState();
    emitParticipants();
  }, [broadcastMediaState, emitParticipants]);

  const toggleCam = useCallback(async () => {
    const turningOn = !camOnRef.current;
    camOnRef.current = turningOn;
    setCamOn(turningOn);

    if (!localStreamRef.current) return;

    if (turningOn && !cameraTrackRef.current) {
      const camStream = await navigator.mediaDevices.getUserMedia({ video: true });
      const track = camStream.getVideoTracks()[0];
      cameraTrackRef.current = track;
      localStreamRef.current.addTrack(track);
      peersRef.current.forEach((p) => {
        const sender = p.connection.getSenders().find((s) => s.track?.kind === 'video');
        if (sender) sender.replaceTrack(track);
        else p.connection.addTrack(track, localStreamRef.current!);
      });
    } else if (cameraTrackRef.current) {
      cameraTrackRef.current.enabled = turningOn;
    }
    broadcastMediaState();
    emitParticipants();
  }, [broadcastMediaState, emitParticipants]);

  const startScreenShare = useCallback(async () => {
    try {
      const display = await navigator.mediaDevices.getDisplayMedia({
        video: true,
        audio: true, // best-effort system audio (Chrome tab/window share)
      });
      screenStreamRef.current = display;
      const screenTrack = display.getVideoTracks()[0];

      peersRef.current.forEach((p) => {
        const sender = p.connection.getSenders().find((s) => s.track?.kind === 'video');
        if (sender) {
          sender.replaceTrack(screenTrack);
        } else {
          // No existing video sender (camera was never turned on) — a
          // replaceTrack() here would silently do nothing, which is why
          // the screen never reached the other side. Add a fresh sender
          // instead; this renegotiates and creates the video m-line.
          p.connection.addTrack(screenTrack, display);
        }
        send({ kind: 'screen-share', to: p.id, from: selfId, active: true });
      });

      screenTrack.onended = () => stopScreenShare();
      setSharingScreen(true);
      emitParticipants();
    } catch (err) {
      console.error('Screen share failed or was cancelled', err);
    }
  }, [selfId, send, emitParticipants]);

  const stopScreenShare = useCallback(() => {
    screenStreamRef.current?.getTracks().forEach((t) => t.stop());
    screenStreamRef.current = null;
    peersRef.current.forEach((p) => {
      const sender = p.connection.getSenders().find((s) => s.track?.kind === 'video');
      if (sender) sender.replaceTrack(cameraTrackRef.current ?? null);
      send({ kind: 'screen-share', to: p.id, from: selfId, active: false });
    });
    setSharingScreen(false);
    emitParticipants();
  }, [send, emitParticipants]);

  const toggleScreenShare = useCallback(() => {
    if (sharingScreen) stopScreenShare();
    else startScreenShare();
  }, [sharingScreen, startScreenShare, stopScreenShare]);

  useEffect(() => {
    return () => {
      endCall();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return {
    inCall,
    connecting,
    callError,
    micOn,
    camOn,
    sharingScreen,
    participants,
    startCall,
    endCall,
    toggleMic,
    toggleCam,
    toggleScreenShare,
  };
}
