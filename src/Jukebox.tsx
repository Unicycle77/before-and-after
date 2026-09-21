import { useEffect, useRef, useState } from "react";
import {
  type DirHandle, type Track, folderPickerSupported, hasAccess, pickFolder, recallFolder,
  rememberFolder, requestAccess, scanFolder,
} from "./musicFolder";
import { publishTracks, setJukeboxState } from "./session";
import type { Jukebox as JukeboxData } from "./types";

/**
 * Main-screen music player (plays one chosen song, once or on repeat). Always mounted (so music carries on across the lobby and
 * reveal screens); the host phone drives it through `session.jukebox.state`.
 * Only the small "choose folder" chip is ever visible, and only in the lobby (`showUi`).
 */
export function Jukebox({ code, jukebox, duck, showUi }: { code: string; jukebox?: JukeboxData; duck: boolean; showUi: boolean }) {
  const audioRef = useRef<HTMLAudioElement>(null);
  const urlRef = useRef<string>();
  const [library, setLibrary] = useState<Track[]>([]);
  const [saved, setSaved] = useState<DirHandle>(); // remembered folder we can't read until the user clicks
  const [error, setError] = useState<string>();
  const [blocked, setBlocked] = useState(false);

  const current = jukebox?.state?.current;
  const wantPlaying = jukebox?.state?.playing === true;
  const volume = jukebox?.state?.volume ?? 0.8;
  const repeat = jukebox?.state?.repeat === true;
  const shouldPlay = wantPlaying && !duck; // music pauses while a video is playing

  async function load(dir: DirHandle) {
    setError(undefined);
    try {
      const tracks = await scanFolder(dir);
      setLibrary(tracks);
      setSaved(undefined);
      void rememberFolder(dir);
      void publishTracks(code, tracks.map((t) => t.title));
      if (tracks.length === 0) setError("No audio files found in that folder.");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't read that folder.");
    }
  }

  // On startup, reconnect to the remembered folder if Chrome still allows it.
  useEffect(() => {
    if (!folderPickerSupported()) return;
    void (async () => {
      const dir = await recallFolder();
      if (!dir) return;
      if (await hasAccess(dir)) await load(dir);
      else setSaved(dir);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Load the selected track into the <audio> element.
  const shouldPlayRef = useRef(shouldPlay);
  shouldPlayRef.current = shouldPlay;
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;
    const track = current === undefined ? undefined : library[current];
    if (!track) { audio.pause(); audio.removeAttribute("src"); return; }
    let cancelled = false;
    void track.handle.getFile().then((file) => {
      if (cancelled) return;
      const url = URL.createObjectURL(file);
      if (urlRef.current) URL.revokeObjectURL(urlRef.current);
      urlRef.current = url;
      audio.src = url;
      if (shouldPlayRef.current) audio.play().catch(() => setBlocked(true));
    }).catch(() => setError(`Couldn't open "${track.title}".`));
    return () => { cancelled = true; };
  }, [current, library]);

  // Play / pause (also drives the auto-pause during videos).
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio || !audio.getAttribute("src")) return;
    if (shouldPlay) audio.play().catch(() => setBlocked(true));
    else audio.pause();
  }, [shouldPlay]);

  useEffect(() => { if (audioRef.current) audioRef.current.loop = repeat; }, [repeat]);

  useEffect(() => { if (audioRef.current) audioRef.current.volume = Math.min(1, Math.max(0, volume)); }, [volume]);

  // Chrome blocks audio until the page has had a click/keypress; retry on the next one.
  useEffect(() => {
    if (!blocked) return;
    const retry = () => { setBlocked(false); void audioRef.current?.play().catch(() => setBlocked(true)); };
    document.addEventListener("click", retry, { once: true });
    document.addEventListener("keydown", retry, { once: true });
    return () => { document.removeEventListener("click", retry); document.removeEventListener("keydown", retry); };
  }, [blocked]);

  // One song at a time: when it finishes (repeat off) we simply stop — never move on to another.
  function stop() {
    void setJukeboxState(code, { playing: false });
  }

  async function choose() {
    const dir = await pickFolder();
    if (dir) await load(dir);
  }

  async function reconnect() {
    if (saved && (await requestAccess(saved))) await load(saved);
    else await choose();
  }

  const title = current === undefined ? undefined : library[current]?.title;

  return (
    <>
      <audio ref={audioRef} onEnded={stop} onError={() => { if (audioRef.current?.getAttribute("src")) stop(); }} />
      {showUi && folderPickerSupported() && (
        <div className="jukebox-chip">
          {library.length === 0 ? (
            <button onClick={() => void (saved ? reconnect() : choose())}>
              🎵 {saved ? `Reconnect music folder (${saved.name})` : "Choose music folder"}
            </button>
          ) : (
            <span>
              ♪ {wantPlaying && title ? title : `${library.length} songs ready`}{" "}
              <button className="link" onClick={() => void choose()}>change folder</button>
            </span>
          )}
          {blocked && <span> · click anywhere to enable sound</span>}
          {error && <span className="error"> · {error}</span>}
        </div>
      )}
    </>
  );
}
