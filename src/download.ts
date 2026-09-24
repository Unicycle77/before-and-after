import { downloadZip } from "client-zip";
import type { Player } from "./types";

const EXT: Record<string, string> = {
  "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp", "image/heic": "heic",
  "video/mp4": "mp4", "video/quicktime": "mov", "video/webm": "webm", "video/x-matroska": "mkv",
};

export class CorsError extends Error {}

/**
 * Fetches every player's submitted files and saves them as one zip with a folder
 * per player (Name/before.jpg, Name/after.jpg, Name/video.mov), named by `filesOf`.
 * Needs the Storage bucket's CORS config (see README) or the fetches are blocked.
 */
export async function downloadAllMedia(
  code: string,
  players: Record<string, Player>,
  filesOf: (uid: string) => { name: string; url: string }[],
  onProgress: (done: number, total: number) => void,
): Promise<void> {
  const jobs: { folder: string; name: string; url: string }[] = [];
  const folders = new Set<string>();
  for (const [uid, player] of Object.entries(players)) {
    const base = player.name.replace(/[^\p{L}\p{N} _.-]/gu, "").trim() || "Player";
    let folder = base;
    for (let n = 2; folders.has(folder.toLowerCase()); n++) folder = `${base} (${n})`;
    folders.add(folder.toLowerCase());
    for (const { name, url } of filesOf(uid)) jobs.push({ folder, name, url });
  }

  const files: { name: string; input: Blob }[] = [];
  onProgress(0, jobs.length);
  for (const job of jobs) {
    let res: Response;
    try { res = await fetch(job.url); }
    catch { throw new CorsError("The browser blocked downloading the files (bucket CORS isn't set up)."); }
    if (!res.ok) throw new Error(`Couldn't download ${job.folder}'s ${job.name} (HTTP ${res.status}).`);
    const type = (res.headers.get("content-type") ?? "").split(";")[0]!.trim();
    const ext = EXT[type] ?? (job.name === "video" ? "mp4" : "jpg");
    files.push({ name: `${job.folder}/${job.name}.${ext}`, input: await res.blob() });
    onProgress(files.length, jobs.length);
  }

  const zip = await downloadZip(files).blob();
  const link = document.createElement("a");
  link.href = URL.createObjectURL(zip);
  link.download = `tm-party-games-${code}.zip`;
  link.click();
  setTimeout(() => URL.revokeObjectURL(link.href), 60_000);
}
