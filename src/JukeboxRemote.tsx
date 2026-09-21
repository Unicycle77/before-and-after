import { useEffect, useRef, useState } from "react";
import { setJukeboxState } from "./session";
import type { Session } from "./types";

const asList = (v: unknown): string[] => (Array.isArray(v) ? (v as string[]) : Object.values((v ?? {}) as Record<string, string>));

/** The host's phone: pick songs and control the main-screen jukebox. */
export function JukeboxRemote({ code, session }: { code: string; session: Session }) {
  const tracks = asList(session.jukebox?.tracks);
  const state = session.jukebox?.state ?? {};
  const current = state.current;
  const playing = state.playing === true;

  // Slider follows the shared value, but stays responsive while dragging.
  const [vol, setVol] = useState(state.volume ?? 0.8);
  const timer = useRef<number>();
  useEffect(() => { setVol(state.volume ?? 0.8); }, [state.volume]);
  function onVolume(v: number) {
    setVol(v);
    window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => void setJukeboxState(code, { volume: v }), 120);
  }

  const repeat = state.repeat === true;
  const play = (i: number) => void setJukeboxState(code, { current: i, playing: true });
  const toggle = () => (current === undefined ? play(0) : void setJukeboxState(code, { playing: !playing }));

  if (tracks.length === 0) {
    return (
      <section className="remote">
        <h2>Jukebox</h2>
        <p className="muted">No music yet. On the main screen, click <strong>🎵 Choose music folder</strong> (Chrome, on the PC that has the songs).</p>
      </section>
    );
  }

  return (
    <section className="remote">
      <h2>Jukebox</h2>
      <p className="now-playing">{current !== undefined && tracks[current] ? `${playing ? "♪" : "⏸"} ${tracks[current]}` : "Pick a song"}</p>
      <div className="steps two">
        <button className={playing ? "step active" : "step"} onClick={toggle}>{playing ? "⏸ Pause" : "▶ Play"}</button>
        <button className={repeat ? "step active" : "step"} onClick={() => void setJukeboxState(code, { repeat: !repeat })}>
          🔁 Repeat {repeat ? "on" : "off"}
        </button>
      </div>
      <label className="volume">🔈 Volume
        <input type="range" min={0} max={1} step={0.02} value={vol} onChange={(e) => onVolume(Number(e.target.value))} />
      </label>
      <ul className="tracklist">
        {tracks.map((t, i) => (
          <li key={i}>
            <button className={i === current ? "active" : ""} onClick={() => play(i)}>{i === current ? "♪ " : ""}{t}</button>
          </li>
        ))}
      </ul>
      <p className="muted small">Plays the song you pick once, or on repeat. It never moves on by itself, and it pauses while a video plays.</p>
    </section>
  );
}
