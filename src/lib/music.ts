// Background music for timed quizzes: a short loop synthesised with the Web Audio API,
// so there is no audio file to ship and it works offline on every platform.

const KEY = 'quizzo.music';
const VOLUME = 0.16;
const BPM = 104;
const STEP = 60 / BPM / 2; // eighth notes
const STEPS_PER_BAR = 8;

/** One chord per bar: bass note and the triad the arpeggio runs over (MIDI notes). */
const BARS: { bass: number; chord: number[] }[] = [
  { bass: 48, chord: [60, 64, 67, 72] }, // C
  { bass: 45, chord: [57, 60, 64, 69] }, // Am
  { bass: 41, chord: [57, 60, 65, 69] }, // F
  { bass: 43, chord: [59, 62, 67, 71] }, // G
  { bass: 48, chord: [60, 64, 67, 72] }, // C
  { bass: 45, chord: [57, 60, 64, 69] }, // Am
  { bass: 50, chord: [57, 62, 65, 69] }, // Dm
  { bass: 43, chord: [59, 62, 67, 71] }, // G
];
const ARP = [0, 1, 2, 3, 2, 1, 2, 1];
/** The tune, one entry per eighth note (0 = rest). */
// prettier-ignore
const MELODY = [
  76, 0, 0, 79, 0, 76, 0, 0,
  72, 0, 0, 76, 0, 69, 0, 0,
  69, 0, 72, 0, 77, 0, 76, 0,
  74, 0, 0, 0, 71, 0, 74, 0,
  76, 0, 79, 0, 84, 0, 0, 79,
  81, 0, 0, 76, 0, 72, 0, 0,
  74, 0, 77, 0, 81, 0, 77, 0,
  79, 0, 0, 74, 0, 71, 0, 0,
];

const hz = (midi: number) => 440 * 2 ** ((midi - 69) / 12);

export const canPlayMusic = () => typeof window !== 'undefined' && 'AudioContext' in window;

/** The player's choice, kept on this device. Music is on until they turn it off. */
export function musicEnabled(): boolean {
  try {
    return localStorage.getItem(KEY) !== 'off';
  } catch {
    return true;
  }
}

export function setMusicEnabled(on: boolean): void {
  try {
    localStorage.setItem(KEY, on ? 'on' : 'off');
  } catch {
    /* storage unavailable: the choice lasts for this quiz only */
  }
}

let ctx: AudioContext | null = null;
let master: GainNode;
let duck: GainNode;
let noise: AudioBuffer;
let timer: ReturnType<typeof setInterval> | null = null;
let idle: ReturnType<typeof setTimeout> | null = null;
let step = 0;
let nextAt = 0;

function setup(): AudioContext {
  if (ctx) return ctx;
  ctx = new AudioContext();
  master = ctx.createGain();
  master.gain.value = 0;
  duck = ctx.createGain();
  // Take the edge off the oscillators.
  const soften = ctx.createBiquadFilter();
  soften.type = 'lowpass';
  soften.frequency.value = 3200;
  duck.connect(soften).connect(master).connect(ctx.destination);
  noise = ctx.createBuffer(1, ctx.sampleRate / 2, ctx.sampleRate);
  const data = noise.getChannelData(0);
  for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
  document.addEventListener('visibilitychange', () => {
    if (!ctx || !timer) return;
    if (document.hidden) void ctx.suspend();
    else void ctx.resume();
  });
  return ctx;
}

function tone(type: OscillatorType, freq: number, at: number, length: number, gain: number, endFreq?: number): void {
  const osc = ctx!.createOscillator();
  const env = ctx!.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, at);
  if (endFreq) osc.frequency.exponentialRampToValueAtTime(endFreq, at + length);
  env.gain.setValueAtTime(0, at);
  env.gain.linearRampToValueAtTime(gain, at + 0.008);
  env.gain.exponentialRampToValueAtTime(0.0001, at + length);
  osc.connect(env).connect(duck);
  osc.start(at);
  osc.stop(at + length + 0.02);
}

function hiss(at: number, length: number, gain: number, freq: number): void {
  const src = ctx!.createBufferSource();
  src.buffer = noise;
  const band = ctx!.createBiquadFilter();
  band.type = 'bandpass';
  band.frequency.value = freq;
  const env = ctx!.createGain();
  env.gain.setValueAtTime(gain, at);
  env.gain.exponentialRampToValueAtTime(0.0001, at + length);
  src.connect(band).connect(env).connect(duck);
  src.start(at);
  src.stop(at + length + 0.02);
}

function playStep(i: number, at: number): void {
  const bar = BARS[Math.floor(i / STEPS_PER_BAR)];
  const s = i % STEPS_PER_BAR;
  tone('triangle', hz(bar.chord[ARP[s]]), at, STEP * 1.6, 0.16);
  if (s === 0 || s === 3 || s === 4) tone('triangle', hz(bar.bass), at, STEP * 1.8, 0.4);
  if (MELODY[i]) {
    tone('sine', hz(MELODY[i]), at, STEP * 2.4, 0.3);
    tone('triangle', hz(MELODY[i] + 12), at, STEP * 1.2, 0.05); // a little sparkle
  }
  if (s === 0 || s === 4) tone('sine', 130, at, 0.14, 0.5, 45); // kick
  if (s === 2 || s === 6) hiss(at, 0.09, 0.22, 1800); // snap
  if (s % 2 === 1) hiss(at, 0.04, 0.1, 7000); // hat
}

function schedule(): void {
  if (!ctx || ctx.state !== 'running') return;
  const now = ctx.currentTime;
  if (nextAt < now) nextAt = now + 0.05; // fell behind (timers were throttled): carry on from now
  while (nextAt < now + 0.3) {
    playStep(step, nextAt);
    step = (step + 1) % MELODY.length;
    nextAt += STEP;
  }
  // Step back while a card is read aloud (dictation, read-aloud buttons).
  const speaking = 'speechSynthesis' in window && speechSynthesis.speaking;
  duck.gain.setTargetAtTime(speaking ? 0.2 : 1, now, 0.08);
}

/** Starts the loop from the top. Call after a tap or key press, or the browser keeps it silent. */
export function startMusic(): void {
  if (!canPlayMusic()) return;
  const c = setup();
  if (idle) clearTimeout(idle);
  idle = null;
  if (!document.hidden) void c.resume();
  step = 0;
  nextAt = c.currentTime + 0.1;
  master.gain.cancelScheduledValues(c.currentTime);
  master.gain.setTargetAtTime(VOLUME, c.currentTime, 0.25);
  if (!timer) timer = setInterval(schedule, 80);
}

export function stopMusic(): void {
  if (!ctx || !timer) return;
  clearInterval(timer);
  timer = null;
  master.gain.cancelScheduledValues(ctx.currentTime);
  master.gain.setTargetAtTime(0, ctx.currentTime, 0.12);
  // Let it fade, then stop using the audio device until the next quiz.
  idle = setTimeout(() => void ctx?.suspend(), 800);
}
