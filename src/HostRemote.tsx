import { GAMES, activeGame } from "./games";
import { useState } from "react";
import { removePlayer, setDisplay, setGame, setHideBlurbs, setShowDownload, setUnlocked, store } from "./session";
import type { Session } from "./types";

const GAMES_OPEN_KEY = "ba.hostGamesOpen";

/**
 * The host's phone: pick a game, then a player, then the game's controls choose what the main screen shows.
 * Leaving a game goes back to picking one; games are never switched directly.
 */
export function HostRemote({ code, session }: { code: string; session: Session }) {
  const game = activeGame(session);
  // The game list can be folded away to leave room for the players; this phone remembers which.
  const [gamesOpen, setGamesOpen] = useState(() => store.get(GAMES_OPEN_KEY) !== "no");
  const players = Object.entries(session.players ?? {});
  const display = session.display ?? { step: "list" as const };
  const current = display.uid ? session.players?.[display.uid] : undefined;

  const remove = (uid: string, name: string) => {
    if (confirm(`Remove ${name} and everything they submitted? They can then rejoin fresh.`)) void removePlayer(code, uid);
  };
  const downloadToggle = (
    <button onClick={() => void setShowDownload(code, !session.showDownload)}>
      {session.showDownload ? "Hide" : "Show"} download button on the main screen
    </button>
  );

  if (!game) {
    return (
      <section className="remote">
        <details className="fold" open={gamesOpen}
          onToggle={(e) => { const open = e.currentTarget.open; setGamesOpen(open); store.set(GAMES_OPEN_KEY, open ? "" : "no"); }}>
          <summary><h2>Pick a game</h2></summary>
          <div className="steps">
            {Object.values(GAMES).map((g) => (
              <button key={g.id} className="step" onClick={() => void setGame(code, g.id)}>{g.name}</button>
            ))}
          </div>
        </details>
        <h2>Players ({players.length})</h2>
        {players.length === 0 && <p className="muted">No players yet.</p>}
        <ul className="picker">
          {players.map(([uid, p]) => (
            <li key={uid}>
              <button disabled><span>{p.name}</span></button>
              <button className="x" aria-label={`Remove ${p.name}`} onClick={() => remove(uid, p.name)}>×</button>
            </li>
          ))}
        </ul>
        <button onClick={() => void setHideBlurbs(code, !session.hideBlurbs)}>
          {session.hideBlurbs ? "Show" : "Hide"} game descriptions on the main screen
        </button>
        {downloadToggle}
      </section>
    );
  }

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
      <h2>{game.name}: pick a player</h2>
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
              <button className="x" aria-label={`Remove ${p.name}`} onClick={() => remove(uid, p.name)}>×</button>
            </li>
          );
        })}
      </ul>
      {downloadToggle}
      <button className="link" onClick={() => void setGame(code, null)}>← Games</button>
    </section>
  );
}
