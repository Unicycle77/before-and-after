import { useState } from "react";
import { GAMES, activeGame } from "./games";
import { removePlayer, setDisplay, setGame, setHideBlurbs, setShowDownload, setUnlocked, store } from "./session";
import type { Session } from "./types";

const GAMES_OPEN_KEY = "ba.hostGamesOpen";
const SETTINGS_OPEN_KEY = "ba.hostSettingsOpen";

/** A section the host can fold away; this phone remembers whether it's open. */
function useFold(key: string, openByDefault: boolean) {
  const [open, setOpen] = useState(() => {
    const saved = store.get(key);
    return saved ? saved === "yes" : openByDefault;
  });
  const onToggle = (e: React.SyntheticEvent<HTMLDetailsElement>) => {
    const now = e.currentTarget.open;
    setOpen(now);
    store.set(key, now ? "yes" : "no");
  };
  return { open, onToggle };
}

/**
 * The host's phone: pick a game, then a player, then the game's controls choose what the main screen shows.
 * The game section stays at the top of every view, so the host can switch games directly (or go back to picking one).
 */
export function HostRemote({ code, session }: { code: string; session: Session }) {
  const game = activeGame(session);
  // Both can be folded away to leave room for the players.
  const gamesFold = useFold(GAMES_OPEN_KEY, true);
  const settingsFold = useFold(SETTINGS_OPEN_KEY, false);
  const players = Object.entries(session.players ?? {});
  const display = session.display ?? { step: "list" as const };
  const current = display.uid ? session.players?.[display.uid] : undefined;

  const remove = (uid: string, name: string) => {
    if (confirm(`Remove ${name} and everything they submitted? They can then rejoin fresh.`)) void removePlayer(code, uid);
  };
  // Always first, so it keeps its place on every view. Inside a game its heading names the game.
  const gamePicker = (
    <details className="fold" {...gamesFold}>
      <summary><h2>{game ? `Game: ${game.name}` : "Pick a game"}</h2></summary>
      <div className="steps">
        {Object.values(GAMES).map((g) => (
          <button key={g.id} className={g.id === game?.id ? "step active" : "step"}
            onClick={() => { if (g.id !== game?.id) void setGame(code, g.id); }}>{g.name}</button>
        ))}
      </div>
    </details>
  );
  // Session-wide settings for the main screen, under the games on every view.
  const settings = (
    <details className="fold" {...settingsFold}>
      <summary><h2>Settings</h2></summary>
      <div className="steps">
        <button onClick={() => void setHideBlurbs(code, !session.hideBlurbs)}>
          {session.hideBlurbs ? "Show" : "Hide"} game descriptions on the main screen
        </button>
        <button onClick={() => void setShowDownload(code, !session.showDownload)}>
          {session.showDownload ? "Hide" : "Show"} download button on the main screen
        </button>
      </div>
    </details>
  );

  // Games on one side, players on the other: two columns on a wide screen (an iPad in landscape),
  // one column (games first) on a phone.
  const layout = (gameSide: React.ReactNode, playerSide: React.ReactNode) => (
    <section className="remote split">
      <div className="remote-col">{gamePicker}{gameSide}{settings}</div>
      <div className="remote-col">{playerSide}</div>
    </section>
  );

  if (!game) {
    return layout(
      null,
      <>
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
      </>,
    );
  }

  if (display.step !== "list" && display.uid && current) {
    return layout(
      null,
      <>
        <h2>{current.name}</h2>
        <game.HostPlayer code={code} session={session} display={display} uid={display.uid} />
        <button className="link" onClick={() => void setDisplay(code, { step: "list" })}>← Back to players</button>
      </>,
    );
  }

  return layout(
    <button className="link" onClick={() => void setGame(code, null)}>← Games</button>,
    <>
      <h2>Players ({players.length})</h2>
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
    </>,
  );
}
