const MAX_DIM = 1600; // same size limit as uploaded photos
const QUALITY = 0.8;
const STEP_TIMEOUT_MS = 20_000;

export interface VideoFrames { first: Blob; last: Blob }

/** Resolves on the next `event` (or rejects on a video error / timeout). Register before triggering it. */
function next(video: HTMLVideoElement, event: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const done = (err?: Error) => {
      window.clearTimeout(timer);
      video.removeEventListener(event, onEvent);
      video.removeEventListener("error", onError);
      err ? reject(err) : resolve();
    };
    const onEvent = () => done();
    const onError = () => done(new Error("The video couldn't be read."));
    const timer = window.setTimeout(() => done(new Error(`Timed out waiting for "${event}".`)), STEP_TIMEOUT_MS);
    video.addEventListener(event, onEvent);
    video.addEventListener("error", onError);
  });
}

async function seek(video: HTMLVideoElement, time: number): Promise<void> {
  const seeked = next(video, "seeked");
  video.currentTime = time;
  await seeked;
  // Give the browser a moment to paint the sought frame before we copy it.
  await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
}

function snapshot(video: HTMLVideoElement): Promise<Blob> {
  const scale = Math.min(1, MAX_DIM / Math.max(video.videoWidth, video.videoHeight));
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.round(video.videoWidth * scale));
  canvas.height = Math.max(1, Math.round(video.videoHeight * scale));
  canvas.getContext("2d")!.drawImage(video, 0, 0, canvas.width, canvas.height);
  return new Promise((resolve, reject) =>
    canvas.toBlob((blob) => (blob ? resolve(blob) : reject(new Error("Couldn't capture a frame."))), "image/jpeg", QUALITY),
  );
}

/**
 * Grabs the first and last frame of a video file, entirely in the browser, as JPEGs.
 * (The phone that recorded the video can always play it, so this works for iPhone HEVC .mov too.)
 */
export async function extractFrames(file: Blob): Promise<VideoFrames> {
  const url = URL.createObjectURL(file);
  const video = document.createElement("video");
  video.muted = true;
  video.playsInline = true;
  video.preload = "auto";
  try {
    const loaded = next(video, "loadeddata");
    video.src = url;
    await loaded;

    // Some recorder-made files report an infinite duration until you seek far past the end.
    if (video.duration === Infinity) {
      await new Promise<void>((resolve, reject) => {
        const timer = window.setTimeout(() => reject(new Error("Couldn't work out the video's length.")), STEP_TIMEOUT_MS);
        video.ontimeupdate = () => {
          if (Number.isFinite(video.duration)) { window.clearTimeout(timer); video.ontimeupdate = null; resolve(); }
        };
        video.currentTime = 1e101;
      });
    }

    const duration = video.duration;
    if (!Number.isFinite(duration) || duration <= 0 || !video.videoWidth) throw new Error("The video couldn't be read.");

    // A hair off the exact ends: seeking to exactly 0 / the end can show nothing on some browsers.
    await seek(video, Math.min(0.05, duration / 4));
    const first = await snapshot(video);
    await seek(video, Math.max(0, duration - 0.1));
    const last = await snapshot(video);
    return { first, last };
  } finally {
    video.removeAttribute("src");
    video.load();
    URL.revokeObjectURL(url);
  }
}
