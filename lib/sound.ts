'use client';

/**
 * Tiny synthesized notification sounds via the Web Audio API — no binary
 * audio assets to bundle or host. Two-tone "message" ping and a softer
 * "join" chime.
 */
let ctx: AudioContext | null = null;

function getCtx(): AudioContext | null {
  if (typeof window === 'undefined') return null;
  if (!ctx) {
    const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
    if (!AudioCtx) return null;
    ctx = new AudioCtx();
  }
  return ctx;
}

function tone(freq: number, start: number, duration: number, gainPeak = 0.05) {
  const audio = getCtx();
  if (!audio) return;
  const osc = audio.createOscillator();
  const gain = audio.createGain();
  osc.type = 'sine';
  osc.frequency.value = freq;
  gain.gain.setValueAtTime(0, audio.currentTime + start);
  gain.gain.linearRampToValueAtTime(gainPeak, audio.currentTime + start + 0.02);
  gain.gain.exponentialRampToValueAtTime(0.0001, audio.currentTime + start + duration);
  osc.connect(gain);
  gain.connect(audio.destination);
  osc.start(audio.currentTime + start);
  osc.stop(audio.currentTime + start + duration + 0.05);
}

export function playMessageSound() {
  tone(880, 0, 0.12);
  tone(1320, 0.09, 0.15);
}

export function playJoinSound() {
  tone(520, 0, 0.1, 0.04);
  tone(780, 0.08, 0.18, 0.04);
}

export function playCallSound() {
  tone(440, 0, 0.15, 0.06);
  tone(660, 0.12, 0.15, 0.06);
  tone(880, 0.24, 0.2, 0.06);
}
