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
