import { submissionStatus } from "./submission";
import { patchDisplay, removePlayer, setDisplay, setShowDownload, setUnlocked } from "./session";
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
          const status = submissionStatus(m);
          const unlocked = !!session.unlocked?.[uid];
          return (
            <li key={uid}>
              <button disabled={status !== "submitted"} onClick={() => void setDisplay(code, { uid, step: "before" })}>
                <span>{p.name}</span>
                <span className="muted small">
                  {status === "submitted" ? "✓ submitted" : status === "sending" ? "sending…" : "waiting"}
                  {unlocked && " · 🔓 may resubmit"}
                </span>
              </button>
              {status === "submitted" && (
                <button className="lock" aria-label={unlocked ? `Lock ${p.name}'s submission` : `Let ${p.name} resubmit`}
                  onClick={() => void setUnlocked(code, uid, !unlocked)}>{unlocked ? "🔓" : "🔒"}</button>
              )}
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
