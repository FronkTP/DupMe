// Minimal Web Audio helpers for scheduling simple tones

let audioCtx: AudioContext | null = null;

declare global {
  interface Window {
    webkitAudioContext?: typeof AudioContext;
  }
}

type SoundPack = 'soft' | 'classic' | 'retro';
const PACK_KEY = 'dupme_sound_pack';
let currentPack: SoundPack = 'classic';
try {
  const saved = typeof window !== 'undefined' ? (localStorage.getItem(PACK_KEY) as SoundPack | null) : null;
  if (saved === 'soft' || saved === 'classic' || saved === 'retro') currentPack = saved;
} catch {}

export const getSoundPack = (): SoundPack => currentPack;
export const setSoundPack = (p: SoundPack): void => {
  currentPack = p;
  try { localStorage.setItem(PACK_KEY, p); } catch {}
};

export const ensureAudioContext = async (): Promise<boolean> => {
  if (typeof window === 'undefined') return false;
  const Ctor = window.AudioContext || window.webkitAudioContext;
  if (!Ctor) return false;
  if (!audioCtx) audioCtx = new Ctor();
  const ctx = audioCtx;
  if (ctx.state === 'suspended') {
    try { await ctx.resume(); } catch { /* ignore */ }
  }
  return ctx.state === 'running' || ctx.state === 'interrupted';
};

const noteToFrequency = (note: string): number | null => {
  // Map single-octave natural notes to 4th octave frequencies
  switch ((note || '').toUpperCase()) {
    case 'C': return 261.626; // C4
    case 'D': return 293.665; // D4
    case 'E': return 329.628; // E4
    case 'F': return 349.228; // F4
    case 'G': return 391.995; // G4
    case 'A': return 440.000; // A4
    case 'B': return 493.883; // B4
    default: return null;
  }
};

type PlaySequenceOptions = {
  noteMs?: number;
  gapMs?: number;
  waveform?: OscillatorType;
  attackMs?: number;
  releaseMs?: number;
};

export const playSequence = async (notes: string[], opts: PlaySequenceOptions = {}): Promise<void> => {
  if (!notes || notes.length === 0) return;
  const ok = await ensureAudioContext();
  const ctx = audioCtx;
  if (!ok || !ctx) return;

  const noteSec = (opts.noteMs ?? 450) / 1000;
  const gapSec = (opts.gapMs ?? 100) / 1000;
  const pack = currentPack;
  const defaultAttackMs = pack === 'soft' ? 15 : pack === 'retro' ? 5 : 10;
  const defaultReleaseMs = pack === 'soft' ? 100 : pack === 'retro' ? 60 : 80;
  const attack = (opts.attackMs ?? defaultAttackMs) / 1000;
  const release = (opts.releaseMs ?? defaultReleaseMs) / 1000;
  const defaultWave: OscillatorType = pack === 'soft' ? 'sine' : pack === 'retro' ? 'square' : 'triangle';
  const waveform: OscillatorType = opts.waveform ?? defaultWave;

  let t = ctx.currentTime + 0.05; // small lead-in for stability
  for (const n of notes) {
    const freq = noteToFrequency(n);
    const dur = noteSec;
    if (freq) {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = waveform;
      osc.frequency.value = freq;
      gain.gain.setValueAtTime(0, t);
      gain.gain.linearRampToValueAtTime(0.9, t + attack);
      gain.gain.setValueAtTime(0.9, t + dur - release);
      gain.gain.linearRampToValueAtTime(0.0001, t + dur);
      osc.connect(gain).connect(ctx.destination);
      osc.start(t);
      osc.stop(t + dur + 0.01);
    }
    t += noteSec + gapSec;
  }
};

export const playBeep = async (frequencyHz: number, durationMs: number, volume = 0.06): Promise<void> => {
  const ok = await ensureAudioContext();
  const ctx = audioCtx;
  if (!ok || !ctx) return;
  const now = ctx.currentTime + 0.01;
  const dur = Math.max(0.04, durationMs / 1000);
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.type = 'sine';
  osc.frequency.value = frequencyHz;
  gain.gain.setValueAtTime(0, now);
  gain.gain.linearRampToValueAtTime(volume, now + 0.02);
  gain.gain.setValueAtTime(volume, now + dur - 0.05);
  gain.gain.linearRampToValueAtTime(0.0001, now + dur);
  osc.connect(gain).connect(ctx.destination);
  osc.start(now);
  osc.stop(now + dur + 0.02);
};


