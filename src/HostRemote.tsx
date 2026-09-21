import { useEffect, useRef, useState } from "react";
import { patchDisplay, removePlayer, setDisplay, setShowDownload, setVideoGain } from "./session";
import { DEFAULT_VIDEO_GAIN, MAX_VIDEO_GAIN, MIN_VIDEO_GAIN } from "./videoAudio";
import type { Session } from "./types";

/** The host's phone: pick a player, then choose what the main screen shows (before / after / side by side / video). */
export function HostRemote({ code, session }: { code: string; session: Session }) {
  const players = Object.entries(session.players ?? {});
  const display = session.display ?? { step: "list" as const };
  const current = display.uid ? session.players?.[display.uid] : undefined;
  const currentMedia = display.uid ? session.media?.[display.uid] : undefined;

  if (display.step !== "list" && display.uid && current) {
    const uid = display.uid;
    const show = (step: "before" | "after" | "both") => void setDisplay(code, { uid, step });
    const cls = (step: string) => (display.step === step ? "step active" : "step");
    const hasVideo = !!currentMedia?.video;
    return (
      <section className="remote">
        <h2>{current.name}</h2>
        <div className="steps two">
          <button className={cls("before")} onClick={() => show("before")}>Before</button>
          <button className={cls("after")} onClick={() => show("after")}>After</button>
        </div>
        <div className="steps">
          <button className={cls("both")} onClick={() => show("both")}>◫ Side by side</button>
        </div>
        <div className="steps">
          <button className={cls("video")} disabled={!hasVideo} onClick={() => void setDisplay(code, { uid, step: "video", playing: true })}>
            {hasVideo ? "▶ Video" : "No video submitted"}
          </button>
        </div>
        {/* Always rendered, so every control keeps its position on every view. */}
        <div className="steps two">
          <button disabled={display.step !== "video"} onClick={() => void patchDisplay(code, { playing: display.playing === false })}>
            {display.step === "video" && display.playing === false ? "▶ Play" : "⏸ Pause"}
          </button>
          <button disabled={display.step !== "video"} onClick={() => void patchDisplay(code, { playing: true, restartAt: Date.now() })}>↺ Restart</button>
        </div>
        <VideoVolume code={code} gain={session.videoGain ?? DEFAULT_VIDEO_GAIN} />
        <button className="link" onClick={() => void setDisplay(code, { step: "list" })}>← Back to players</button>
      </section>
    );
  }

  return (
    <section className="remote">
      <h2>Pick a player</h2>
      <div className="steps">
        <button
          className={display.step === "review" ? "step active" : "step"}
          disabled={!players.some(([uid]) => session.media?.[uid]?.before || session.media?.[uid]?.after)}
          onClick={() => void setDisplay(code, display.step === "review" ? { step: "list" } : { step: "review" })}
        >
          {display.step === "review" ? "✕ Close review" : "◫ Review everyone"}
        </button>
      </div>
      {players.length === 0 && <p className="muted">No players yet.</p>}
      <ul className="picker">
        {players.map(([uid, p]) => {
          const m = session.media?.[uid] ?? {};
          const ready = !!m.before && !!m.after;
          return (
            <li key={uid}>
              <button disabled={!ready} onClick={() => void setDisplay(code, { uid, step: "before" })}>
                <span>{p.name}</span>
                <span className="muted small">{ready ? (m.video ? "ready" : "no video yet") : `waiting: ${[!m.before && "before", !m.after && "after"].filter(Boolean).join(", ")}`}</span>
              </button>
              <button className="x" aria-label={`Remove ${p.name}`} onClick={() => { if (confirm(`Remove ${p.name} and their video and photos? They can then rejoin fresh.`)) void removePlayer(code, uid); }}>×</button>
            </li>
          );
        })}
      </ul>
      <button onClick={() => void setShowDownload(code, !session.showDownload)}>
        {session.showDownload ? "Hide" : "Show"} download button on the main screen
      </button>
    </section>
  );
}

/** How loud the video is on the main screen (phone videos are recorded quiet, so it defaults to a boost). */
function VideoVolume({ code, gain }: { code: string; gain: number }) {
  const [value, setValue] = useState(gain);
  const timer = useRef<number>();
  useEffect(() => { setValue(gain); }, [gain]);
  function change(v: number) {
    setValue(v);
    window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => void setVideoGain(code, v), 120);
  }
  return (
    <label className="volume">🔊 Video volume: {Math.round(value * 100)}%
      <input type="range" min={MIN_VIDEO_GAIN} max={MAX_VIDEO_GAIN} step={0.25} value={value} onChange={(e) => change(Number(e.target.value))} />
    </label>
  );
}
