import { patchDisplay, removePlayer, setDisplay } from "./session";
import type { Session } from "./types";

/** The host's phone: pick a player, then advance before → after → video on the main screen. */
export function HostRemote({ code, session }: { code: string; session: Session }) {
  const players = Object.entries(session.players ?? {});
  const display = session.display ?? { step: "list" as const };
  const current = display.uid ? session.players?.[display.uid] : undefined;
  const currentMedia = display.uid ? session.media?.[display.uid] : undefined;

  if (display.step !== "list" && display.uid && current) {
    const uid = display.uid;
    return (
      <section className="remote">
        <h2>{current.name}</h2>
        <p className="muted">Main screen is showing: <strong>{display.step.toUpperCase()}</strong></p>
        {display.step === "before" && <button className="big" onClick={() => void setDisplay(code, { uid, step: "after" })}>Reveal AFTER ▶</button>}
        {display.step === "after" && (
          <>
            <p className="muted">Talk it over, then when everyone's ready:</p>
            <button className="big" disabled={!currentMedia?.video} onClick={() => void setDisplay(code, { uid, step: "video", playing: true })}>
              {currentMedia?.video ? "▶ Watch the video" : "No video submitted"}
            </button>
          </>
        )}
        {display.step === "video" && (
          <>
            <button className="big" onClick={() => void patchDisplay(code, { playing: display.playing === false })}>
              {display.playing === false ? "▶ Play" : "⏸ Pause"}
            </button>
            <button onClick={() => void patchDisplay(code, { playing: true, restartAt: Date.now() })}>↺ Restart video</button>
            <button onClick={() => void setDisplay(code, { uid, step: "after" })}>← Back to After</button>
          </>
        )}
        <button onClick={() => void setDisplay(code, { uid, step: "before" })}>Show Before again</button>
        <button onClick={() => void setDisplay(code, { step: "list" })}>← Back to players</button>
      </section>
    );
  }

  return (
    <section className="remote">
      <h2>Pick a player</h2>
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
              <button className="x" aria-label={`Remove ${p.name}`} onClick={() => { if (confirm(`Remove ${p.name}?`)) void removePlayer(code, uid); }}>×</button>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
