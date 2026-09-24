import { GAMES, activeGame } from "./games";
import { useEffect, useState } from "react";
import { removePlayer, setDisplay, setGame, setHideBlurbs, setShowDownload, setUnlocked, store } from "./session";
import type { Session } from "./types";

const OPEN_KEY = "ba.hostOpenSection";
type Section = "games" | "players";

/**
 * The host's phone: pick a game, then a player, then the game's controls choose what the main screen shows.
 * Leaving a game goes back to picking one; games are never switched directly.
 */
export function HostRemote({ code, session }: { code: string; session: Session }) {
  const game = activeGame(session);
  // On the game selection view, "Pick a game" and "Players" fold like an accordion: at most one is open.
  // This phone remembers which ("none" = both folded).
  const [openSection, setOpenSection] = useState<Section | undefined>(() => {
    const saved = store.get(OPEN_KEY);
    return saved === "none" ? undefined : saved === "players" ? "players" : "games";
  });
  useEffect(() => { store.set(OPEN_KEY, openSection ?? "none"); }, [openSection]);
  // Also fires when the other section is closed for us; only the section's own state matters.
  const onToggle = (section: Section) => (e: React.SyntheticEvent<HTMLDetailsElement>) => {
    const open = e.currentTarget.open;
    setOpenSection((s) => (open ? section : s === section ? undefined : s));
  };
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
        <details className="fold" open={openSection === "games"} onToggle={onToggle("games")}>
          <summary><h2>Pick a game</h2></summary>
          <div className="steps">
            {Object.values(GAMES).map((g) => (
              <button key={g.id} className="step" onClick={() => void setGame(code, g.id)}>{g.name}</button>
            ))}
          </div>
        </details>
        <details className="fold" open={openSection === "players"} onToggle={onToggle("players")}>
          <summary><h2>Players ({players.length})</h2></summary>
          {players.length === 0 && <p className="muted">No players yet.</p>}
          <ul className="picker">
            {players.map(([uid, p]) => (
              <li key={uid}>
                <button disabled><span>{p.name}</span></button>
                <button className="x" aria-label={`Remove ${p.name}`} onClick={() => remove(uid, p.name)}>×</button>
              </li>
            ))}
          </ul>
        </details>
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
