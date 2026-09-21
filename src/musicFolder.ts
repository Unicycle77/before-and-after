/**
 * Music lives on the main-screen PC only: the host picks a folder with Chrome's
 * File System Access API and files are read straight from disk — nothing is uploaded.
 * The folder handle is remembered in IndexedDB so a refresh doesn't lose it
 * (Chrome may still ask for one click to re-grant access).
 */

interface FileHandle { kind: "file"; name: string; getFile(): Promise<File> }
export interface DirHandle {
  kind: "directory";
  name: string;
  values(): AsyncIterable<FileHandle | DirHandle>;
  queryPermission?(o: { mode: "read" }): Promise<PermissionState>;
  requestPermission?(o: { mode: "read" }): Promise<PermissionState>;
}
export interface Track { title: string; handle: FileHandle }

const AUDIO_EXT = /\.(mp3|m4a|aac|wav|ogg|oga|opus|flac)$/i;
const MAX_TRACKS = 1000;
const MAX_DEPTH = 4;

type Picker = (o?: { mode?: "read" }) => Promise<DirHandle>;
const picker = () => (window as unknown as { showDirectoryPicker?: Picker }).showDirectoryPicker;

export const folderPickerSupported = () => typeof picker() === "function";

/** Opens the folder picker. Resolves undefined if the user cancels. */
export async function pickFolder(): Promise<DirHandle | undefined> {
  try { return await picker()!({ mode: "read" }); }
  catch (e) {
    if (e instanceof DOMException && e.name === "AbortError") return undefined;
    throw e;
  }
}

/** Recursively lists audio files (title = file name without extension), sorted by title. */
export async function scanFolder(dir: DirHandle): Promise<Track[]> {
  const tracks: Track[] = [];
  async function walk(d: DirHandle, depth: number) {
    for await (const entry of d.values()) {
      if (tracks.length >= MAX_TRACKS) return;
      if (entry.kind === "file") {
        if (AUDIO_EXT.test(entry.name)) tracks.push({ title: entry.name.replace(AUDIO_EXT, ""), handle: entry });
      } else if (depth < MAX_DEPTH) {
        await walk(entry, depth + 1);
      }
    }
  }
  await walk(dir, 0);
  return tracks.sort((a, b) => a.title.localeCompare(b.title, undefined, { numeric: true, sensitivity: "base" }));
}

// ---- remembering the folder across refreshes ----
const DB = "before-and-after";
const STORE = "handles";
const KEY = "musicFolder";

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB, 1);
    req.onupgradeneeded = () => req.result.createObjectStore(STORE);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function idb<T>(mode: IDBTransactionMode, run: (s: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  const db = await openDb();
  return new Promise<T>((resolve, reject) => {
    const req = run(db.transaction(STORE, mode).objectStore(STORE));
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

export async function rememberFolder(dir: DirHandle): Promise<void> {
  try { await idb("readwrite", (s) => s.put(dir, KEY)); } catch { /* private mode etc. — non-fatal */ }
}

export async function recallFolder(): Promise<DirHandle | undefined> {
  try { return (await idb<DirHandle | undefined>("readonly", (s) => s.get(KEY))) ?? undefined; } catch { return undefined; }
}

/** True if we can read the folder right now without prompting. */
export async function hasAccess(dir: DirHandle): Promise<boolean> {
  return (await dir.queryPermission?.({ mode: "read" })) === "granted";
}

/** Must be called from a click. */
export async function requestAccess(dir: DirHandle): Promise<boolean> {
  return (await dir.requestPermission?.({ mode: "read" })) === "granted";
}
