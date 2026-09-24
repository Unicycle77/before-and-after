const MAX_DIM = 1600; // same size limit as uploaded photos
const QUALITY = 0.8;
const METADATA_TIMEOUT_MS = 15_000;
const SEEK_TIMEOUT_MS = 10_000;

export interface VideoFrames { first: Blob; last: Blob }

/** Why frame capture failed, in words for the player plus technical detail for us. */
export class FrameError extends Error {
  constructor(message: string, readonly detail: string) { super(message); }
}

/** Resolves on the next `event` (rejects on a video error / timeout). Register before triggering it. */
function next(video: HTMLVideoElement, event: string, timeoutMs: number): Promise<void> {
  return new Promise((resolve, reject) => {
    const done = (err?: Error) => {
      window.clearTimeout(timer);
      video.removeEventListener(event, onEvent);
      video.removeEventListener("error", onError);
      err ? reject(err) : resolve();
    };
    const onEvent = () => done();
    const onError = () => done(new Error("error event"));
    const timer = window.setTimeout(() => done(new Error(`timed out waiting for "${event}"`)), timeoutMs);
    video.addEventListener(event, onEvent);
    video.addEventListener("error", onError);
  });
}

const sleep = (ms: number) => new Promise<void>((r) => window.setTimeout(r, ms));
const paint = () => new Promise<void>((r) => requestAnimationFrame(() => requestAnimationFrame(() => r())));

/** Phone browsers often don't decode a frame until the video has been "played" a moment. */
async function ensureFrame(video: HTMLVideoElement): Promise<void> {
  if (video.readyState >= 2) return;
  try { await video.play(); } catch { /* autoplay refusal is fine — we only need a decoded frame */ }
  for (let i = 0; i < 80 && video.readyState < 2; i++) await sleep(50);
  video.pause();
}

async function seekTo(video: HTMLVideoElement, time: number): Promise<void> {
  const seeked = next(video, "seeked", SEEK_TIMEOUT_MS);
  video.currentTime = time;
  await seeked;
  await ensureFrame(video);
  await paint(); // let the browser present the sought frame before we copy it
}

function snapshot(video: HTMLVideoElement): Promise<Blob> {
  const scale = Math.min(1, MAX_DIM / Math.max(video.videoWidth, video.videoHeight));
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.round(video.videoWidth * scale));
  canvas.height = Math.max(1, Math.round(video.videoHeight * scale));
  canvas.getContext("2d")!.drawImage(video, 0, 0, canvas.width, canvas.height);
  return new Promise((resolve, reject) =>
    canvas.toBlob((blob) => (blob ? resolve(blob) : reject(new Error("canvas produced no image"))), "image/jpeg", QUALITY),
  );
}

function describe(file: Blob, video: HTMLVideoElement, step: string, cause: unknown): string {
  const err = video.error ? `mediaError=${video.error.code}${video.error.message ? ` (${video.error.message})` : ""}` : "mediaError=none";
  return [
    `step=${step}`,
    `cause=${cause instanceof Error ? cause.message : String(cause)}`,
    `type=${file.type || "unknown"}`,
    `size=${(file.size / 1048576).toFixed(1)}MB`,
    `readyState=${video.readyState}`,
    `networkState=${video.networkState}`,
    `dims=${video.videoWidth}x${video.videoHeight}`,
    `duration=${video.duration}`,
    err,
  ].join(" ");
}

/**
 * Grabs the first and last frame of a video file, entirely in the browser, as JPEGs.
 * The <video> is attached to the page (invisibly) because mobile Safari won't load an off-page one.
 */
export async function extractFrames(file: Blob): Promise<VideoFrames> {
  const url = URL.createObjectURL(file);
  const video = document.createElement("video");
  video.muted = true;
  video.defaultMuted = true;
  video.playsInline = true;
  video.setAttribute("playsinline", "");
  video.setAttribute("webkit-playsinline", "");
  video.preload = "auto";
  Object.assign(video.style, { position: "fixed", left: "0", top: "0", width: "2px", height: "2px", opacity: "0.01", pointerEvents: "none" });
  document.body.appendChild(video);

  let step = "load";
  try {
    const meta = next(video, "loadedmetadata", METADATA_TIMEOUT_MS);
    video.src = url;
    video.load();
    await meta;

    // Some recorder-made files report an infinite duration until you seek far past the end.
    if (video.duration === Infinity) {
      step = "duration";
      await new Promise<void>((resolve, reject) => {
        const timer = window.setTimeout(() => reject(new Error("couldn't work out the video's length")), SEEK_TIMEOUT_MS);
        video.ontimeupdate = () => {
          if (Number.isFinite(video.duration)) { window.clearTimeout(timer); video.ontimeupdate = null; resolve(); }
        };
        video.currentTime = 1e101;
      });
    }

    const duration = video.duration;
    if (!Number.isFinite(duration) || duration <= 0) throw new Error("no usable duration");

    // A hair off the exact ends: seeking to exactly 0 / the end can show nothing on some browsers.
    step = "first frame";
    await seekTo(video, Math.min(0.05, duration / 4));
    if (!video.videoWidth) throw new Error("video has no picture");
    const first = await snapshot(video);

    step = "last frame";
    await seekTo(video, Math.max(0, duration - 0.1));
    const last = await snapshot(video);
    return { first, last };
  } catch (e) {
    const detail = describe(file, video, step, e);
    console.error("Frame capture failed:", detail);
    // MediaError 4 = the browser understood the file but not its video format (codec).
    const message = video.error?.code === 4
      ? "This phone's browser can't read that video's format. On iPhone, set Settings → Camera → Formats → Most Compatible, then record again."
      : "We couldn't read that video. Please record it again.";
    throw new FrameError(message, detail);
  } finally {
    video.removeAttribute("src");
    video.load();
    video.remove();
    URL.revokeObjectURL(url);
  }
}
