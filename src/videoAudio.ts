/**
 * Phone videos are recorded quiet compared to mastered music, and a <video> can't go above 100%.
 * Routing its audio through the Web Audio API lets us amplify it (a gain > 1) with a limiter after it
 * so the loud bits don't distort.
 */

export const DEFAULT_VIDEO_GAIN = 3;
export const MIN_VIDEO_GAIN = 1;
export const MAX_VIDEO_GAIN = 6;

export interface Boost {
  setGain(gain: number): void;
  detach(): void;
  /** Final node in the chain (exposed so tests can measure the output level). */
  output: AudioNode;
}

let context: AudioContext | undefined;
// An element can only ever have ONE MediaElementSource, so keep it and rewire it as needed.
const sources = new WeakMap<HTMLMediaElement, MediaElementAudioSourceNode>();

const sleep = (ms: number) => new Promise<void>((r) => window.setTimeout(r, ms));

/** A running AudioContext, or undefined if the browser hasn't allowed audio yet (needs a click/keypress first). */
async function runningContext(): Promise<AudioContext | undefined> {
  const Ctor = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!Ctor) return undefined;
  context ??= new Ctor();
  if (context.state !== "running") {
    // resume() never settles without a user gesture, so don't wait on it for long.
    try { await Promise.race([context.resume(), sleep(300)]); } catch { /* ignore */ }
  }
  return context.state === "running" ? context : undefined;
}

/**
 * Amplifies a video's sound. Resolves undefined (video plays normally, un-boosted) if audio isn't
 * unlocked yet — we never route through a suspended context, because that would make the video silent.
 */
export async function attachBoost(video: HTMLVideoElement, gain: number): Promise<Boost | undefined> {
  const ctx = await runningContext();
  if (!ctx) return undefined;

  let source = sources.get(video);
  if (!source) { source = ctx.createMediaElementSource(video); sources.set(video, source); }
  source.disconnect();
  const amp = ctx.createGain();
  amp.gain.value = gain;
  const limiter = ctx.createDynamicsCompressor();
  limiter.threshold.value = -4; // dB: start squashing just below full scale
  limiter.knee.value = 0;
  limiter.ratio.value = 20;
  limiter.attack.value = 0.003;
  limiter.release.value = 0.12;

  source.connect(amp);
  amp.connect(limiter);
  limiter.connect(ctx.destination);

  return {
    setGain: (g) => amp.gain.setTargetAtTime(g, ctx.currentTime, 0.05),
    // Back to a plain, un-boosted connection so the video stays audible after we let go.
    detach: () => { source.disconnect(); amp.disconnect(); limiter.disconnect(); source.connect(ctx.destination); },
    output: limiter,
  };
}
