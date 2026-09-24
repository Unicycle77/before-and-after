import { activeGame } from "./games";
import { removePlayer, setDisplay, setShowDownload, setUnlocked } from "./session";
import type { Session } from "./types";

/** The host's phone: pick a player, then the active game's controls choose what the main screen shows. */
export function HostRemote({ code, session }: { code: string; session: Session }) {
  const game = activeGame(session);
  const players = Object.entries(session.players ?? {});
  const display = session.display ?? { step: "list" as const };
  const current = display.uid ? session.players?.[display.uid] : undefined;

  if (display.step !== "list" && display.uid && current) {
    return (
      <section className="remote">
        <h2>{current.name}</h2>
        <game.HostPlayer code={code} session={session} display={display} uid={display.uid} />
        <button className="link" onClick={() => void setDisplay(code, { step: "list" })}>← Back to players</button>
      </section>
    );
  }

  return (
    <section className="remote">
      <h2>Pick a player</h2>
      <game.HostLobby code={code} session={session} display={display} />
      {players.length === 0 && <p className="muted">No players yet.</p>}
      <ul className="picker">
        {players.map(([uid, p]) => {
          const status = game.status(session, uid);
          const unlocked = !!session.games?.[game.id]?.unlocked?.[uid];
          return (
            <li key={uid}>
              <button disabled={status !== "submitted"} onClick={() => void setDisplay(code, { uid, step: game.firstStep })}>
                <span>{p.name}</span>
                <span className="muted small">
                  {status === "submitted" ? "✓ submitted" : status === "sending" ? "sending…" : "waiting"}
                  {unlocked && " · 🔓 may resubmit"}
                </span>
              </button>
              {status === "submitted" && (
                <button className="lock" aria-label={unlocked ? `Lock ${p.name}'s submission` : `Let ${p.name} resubmit`}
                  onClick={() => void setUnlocked(code, game.id, uid, !unlocked)}>{unlocked ? "🔓" : "🔒"}</button>
              )}
              <button className="x" aria-label={`Remove ${p.name}`} onClick={() => { if (confirm(`Remove ${p.name} and everything they submitted? They can then rejoin fresh.`)) void removePlayer(code, uid); }}>×</button>
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
