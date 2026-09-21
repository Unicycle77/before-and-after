// Kept at module level on purpose: holding a reference stops the browser dropping the
// downloaded (and decoded) image, so it's ready the moment a screen wants it.
const kept = new Map<string, HTMLImageElement>();

/** Starts downloading and decoding each photo now, so reveals and the review screen don't wait. */
export function preloadImages(urls: string[]): void {
  for (const url of urls) {
    if (!url || kept.has(url)) continue;
    const img = new Image();
    img.decoding = "async";
    img.src = url;
    kept.set(url, img);
    void img.decode?.().catch(() => { /* a failed preload is retried by SafeImg when shown */ });
  }
}

// ---- videos ----
// Videos are fetched whole into memory (a Blob) once a player is selected, so pressing "Video" starts
// instantly and Restart / seeking never touches the network. Needs the bucket's CORS setting (see README);
// if the fetch is blocked or fails we quietly fall back to streaming from the network as before.
const MAX_VIDEOS_KEPT = 3;
const videos = new Map<string, string | null>(); // url -> blob URL (null while downloading)

export function preloadVideo(url: string | undefined): void {
  if (!url || videos.has(url)) return;
  videos.set(url, null);
  void fetch(url)
    .then((res) => (res.ok ? res.blob() : Promise.reject(new Error(`HTTP ${res.status}`))))
    .then((blob) => {
      videos.set(url, URL.createObjectURL(blob));
      // Keep memory bounded: drop the oldest finished downloads beyond the limit.
      for (const [oldUrl, blobUrl] of videos) {
        if (videos.size <= MAX_VIDEOS_KEPT) break;
        if (oldUrl !== url && blobUrl) { URL.revokeObjectURL(blobUrl); videos.delete(oldUrl); }
      }
    })
    .catch(() => videos.delete(url));
}

/** The in-memory copy if it has finished downloading, otherwise the original URL. */
export const playableVideoUrl = (url: string): string => videos.get(url) ?? url;
