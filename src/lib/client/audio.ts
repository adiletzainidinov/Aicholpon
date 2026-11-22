/**
 * Background music with a smooth fade (via WebAudio gain – iOS ignores
 * HTMLMediaElement.volume) and tiny synthesized foley for the envelope.
 */
let ctx: AudioContext | null = null;
let gain: GainNode | null = null;
let el: HTMLAudioElement | null = null;
let fxGain: GainNode | null = null;
const MUSIC_VOLUME = 0.55;

function ensure() {
  if (typeof window === 'undefined') return null;
  if (!el) {
    el = new Audio('/aicholpon-music.mp3');
    el.loop = true;
    el.preload = 'auto';
    el.crossOrigin = 'anonymous';
  }
  if (!ctx) {
    const AC = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (AC) {
      try {
        ctx = new AC();
        gain = ctx.createGain();
        gain.gain.value = 0;
        ctx.createMediaElementSource(el).connect(gain).connect(ctx.destination);
        fxGain = ctx.createGain();
        fxGain.gain.value = 0.35;
        fxGain.connect(ctx.destination);
      } catch {
        ctx = null;
      }
    }
  }
  return el;
}

export async function playMusic(): Promise<boolean> {
  const audio = ensure();
  if (!audio) return false;
  try {
    if (ctx?.state === 'suspended') await ctx.resume();
    if (gain && ctx) {
      const t = ctx.currentTime;
      gain.gain.cancelScheduledValues(t);
      gain.gain.setValueAtTime(gain.gain.value, t);
      gain.gain.linearRampToValueAtTime(MUSIC_VOLUME, t + 3.5);
    } else audio.volume = MUSIC_VOLUME;
    await audio.play();
    return true;
  } catch {
    return false;
  }
}

export function pauseMusic() {
  if (!el) return;
  if (gain && ctx) {
    const t = ctx.currentTime;
    gain.gain.cancelScheduledValues(t);
    gain.gain.setValueAtTime(gain.gain.value, t);
    gain.gain.linearRampToValueAtTime(0, t + 0.6);
    const audio = el;
    window.setTimeout(() => audio.pause(), 650);
  } else el.pause();
}

export const isMusicPlaying = () => Boolean(el && !el.paused);

/** A soft crystalline chime for the seal. */
export function chime() {
  if (!ctx || !fxGain) return;
  const t = ctx.currentTime;
  [1318.5, 1975.5, 2637].forEach((f, i) => {
    const o = ctx!.createOscillator();
    const g = ctx!.createGain();
    o.type = 'sine';
    o.frequency.value = f;
    g.gain.setValueAtTime(0, t + i * 0.06);
    g.gain.linearRampToValueAtTime(0.22 / (i + 1), t + i * 0.06 + 0.01);
    g.gain.exponentialRampToValueAtTime(0.0001, t + i * 0.06 + 1.8);
    o.connect(g).connect(fxGain!);
    o.start(t + i * 0.06);
    o.stop(t + i * 0.06 + 2);
  });
}

/** Filtered-noise "paper" swish for the flap and the card. */
export function paperSwish(duration = 0.7, delay = 0) {
  if (!ctx || !fxGain) return;
  const t = ctx.currentTime + delay;
  const len = Math.floor(ctx.sampleRate * duration);
  const buf = ctx.createBuffer(1, len, ctx.sampleRate);
  const data = buf.getChannelData(0);
  for (let i = 0; i < len; i++) data[i] = (Math.random() * 2 - 1) * Math.sin((Math.PI * i) / len) ** 2;
  const src = ctx.createBufferSource();
  src.buffer = buf;
  const bp = ctx.createBiquadFilter();
  bp.type = 'bandpass';
  bp.frequency.setValueAtTime(900, t);
  bp.frequency.linearRampToValueAtTime(2600, t + duration);
  bp.Q.value = 0.8;
  const g = ctx.createGain();
  g.gain.value = 0.32;
  src.connect(bp).connect(g).connect(fxGain);
  src.start(t);
}
