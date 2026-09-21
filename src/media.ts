import { ref as dbRef, update } from "firebase/database";
import { getDownloadURL, ref, uploadBytesResumable } from "firebase/storage";
import { db, storage } from "./firebase";
import type { MediaKind } from "./types";

/**
 * Downscale phone photos (often 4000px+/8MB) so uploads are quick and the TV loads them instantly.
 * 1600px on the long side is still sharper than a 1080p screen ever shows a photo, and at quality 0.8
 * the files are ~40% smaller than 1920px @ 0.85.
 */
async function shrinkImage(file: File, maxDim = 1600): Promise<Blob> {
  try {
    const bitmap = await createImageBitmap(file, { imageOrientation: "from-image" });
    const scale = Math.min(1, maxDim / Math.max(bitmap.width, bitmap.height));
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(bitmap.width * scale);
    canvas.height = Math.round(bitmap.height * scale);
    canvas.getContext("2d")!.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    const blob = await new Promise<Blob | null>((r) => canvas.toBlob(r, "image/jpeg", 0.8));
    if (blob) return blob;
  } catch { /* e.g. unsupported format — upload the original */ }
  return file;
}

/** Uploads a file to Storage, then publishes its URL to the session. */
export async function submitMedia(
  code: string,
  uid: string,
  kind: MediaKind,
  file: File,
  onProgress: (fraction: number) => void,
): Promise<void> {
  const body = kind === "video" ? file : await shrinkImage(file);
  const contentType = kind === "video" ? file.type || "video/mp4" : body.type || "image/jpeg";
  const task = uploadBytesResumable(ref(storage(), `sessions/${code}/${uid}/${kind}-${Date.now()}`), body, {
    contentType,
    // File names are unique per upload, so a cached copy is never stale.
    cacheControl: "public, max-age=31536000, immutable",
  });
  await new Promise<void>((resolve, reject) => {
    task.on("state_changed", (s) => onProgress(s.bytesTransferred / s.totalBytes), reject, resolve);
  });
  const url = await getDownloadURL(task.snapshot.ref);
  await update(dbRef(db(), `sessions/${code}/media/${uid}`), { [kind]: url });
}
