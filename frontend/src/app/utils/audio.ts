// Minimal Web Audio helpers for scheduling simple tones

let audioCtx: (AudioContext | null) = null;

export const ensureAudioContext = async (): Promise<boolean> => {
  const Ctor = (window as any).AudioContext || (window as any).webkitAudioContext;
  if (!Ctor) return false;
  if (!audioCtx) audioCtx = new Ctor();
  if (audioCtx.state === 'suspended') {
    try { await audioCtx.resume(); } catch (_) { /* ignore */ }
  }
  return audioCtx.state === 'running' || audioCtx.state === 'interrupted';
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
  if (!ok || !audioCtx) return;

  const noteSec = (opts.noteMs ?? 450) / 1000;
  const gapSec = (opts.gapMs ?? 100) / 1000;
  const attack = (opts.attackMs ?? 10) / 1000;
  const release = (opts.releaseMs ?? 80) / 1000;
  const waveform: OscillatorType = opts.waveform ?? 'triangle';

  let t = audioCtx.currentTime + 0.05; // small lead-in for stability
  for (const n of notes) {
    const freq = noteToFrequency(n);
    const dur = noteSec;
    if (freq) {
      const osc = audioCtx.createOscillator();
      const gain = audioCtx.createGain();
      osc.type = waveform;
      osc.frequency.value = freq;
      gain.gain.setValueAtTime(0, t);
      gain.gain.linearRampToValueAtTime(0.9, t + attack);
      gain.gain.setValueAtTime(0.9, t + dur - release);
      gain.gain.linearRampToValueAtTime(0.0001, t + dur);
      osc.connect(gain).connect(audioCtx.destination);
      osc.start(t);
      osc.stop(t + dur + 0.01);
    }
    t += noteSec + gapSec;
  }
};


