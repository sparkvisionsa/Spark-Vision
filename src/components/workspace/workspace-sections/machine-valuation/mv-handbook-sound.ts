let context: AudioContext | null = null;
let paper: AudioBuffer | null = null;

function audioContext() {
  const Ctx = window.AudioContext || (window as Window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!Ctx) return null;
  context ??= new Ctx();
  return context;
}

function paperBuffer(ctx: AudioContext) {
  if (paper?.sampleRate === ctx.sampleRate) return paper;
  const duration = 1.05;
  const length = Math.floor(ctx.sampleRate * duration);
  const buffer = ctx.createBuffer(1, length, ctx.sampleRate);
  const data = buffer.getChannelData(0);
  let brown = 0;
  for (let index = 0; index < length; index += 1) {
    const white = Math.random() * 2 - 1;
    brown = (brown + 0.04 * white) / 1.04;
    const time = index / length;
    const flutter = 0.42 + 0.58 * Math.abs(Math.sin(time * Math.PI * 6.5));
    const envelope = Math.sin(Math.PI * Math.min(1, time / 0.9)) ** 0.72;
    data[index] = brown * flutter * envelope * 2.2;
  }
  paper = buffer;
  return buffer;
}

/** The same paper turn for both directions, so every page feels like one book. */
export function playPageTurn() {
  if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
  const ctx = audioContext();
  if (!ctx) return;
  try {
    void ctx.resume().catch(() => undefined);
    const now = ctx.currentTime;
    const source = ctx.createBufferSource();
    source.buffer = paperBuffer(ctx);
    const filter = ctx.createBiquadFilter();
    filter.type = "bandpass";
    filter.Q.value = 0.65;
    filter.frequency.setValueAtTime(780, now);
    filter.frequency.exponentialRampToValueAtTime(2400, now + 0.11);
    filter.frequency.exponentialRampToValueAtTime(640, now + 1.05);
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.exponentialRampToValueAtTime(0.22, now + 0.05);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 1.05);
    source.connect(filter);
    filter.connect(gain);
    gain.connect(ctx.destination);
    source.start(now);
    source.stop(now + 1.08);

    const thump = ctx.createOscillator();
    thump.type = "sine";
    thump.frequency.setValueAtTime(128, now);
    thump.frequency.exponentialRampToValueAtTime(48, now + 0.12);
    const thumpGain = ctx.createGain();
    thumpGain.gain.setValueAtTime(0.0001, now);
    thumpGain.gain.exponentialRampToValueAtTime(0.09, now + 0.012);
    thumpGain.gain.exponentialRampToValueAtTime(0.0001, now + 0.14);
    thump.connect(thumpGain);
    thumpGain.connect(ctx.destination);
    thump.start(now);
    thump.stop(now + 0.15);
    const land = ctx.createOscillator();
    land.type = "sine";
    land.frequency.setValueAtTime(96, now + 0.9);
    land.frequency.exponentialRampToValueAtTime(42, now + 1.05);
    const landGain = ctx.createGain();
    landGain.gain.setValueAtTime(0.0001, now + 0.9);
    landGain.gain.exponentialRampToValueAtTime(0.07, now + 0.93);
    landGain.gain.exponentialRampToValueAtTime(0.0001, now + 1.08);
    land.connect(landGain);
    landGain.connect(ctx.destination);
    land.start(now + 0.9);
    land.stop(now + 1.1);
  } catch {
    /* Sound is optional; the page turn still plays. */
  }
}
