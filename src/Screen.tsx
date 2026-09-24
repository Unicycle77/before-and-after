import { QRCodeSVG } from "qrcode.react";
import { useEffect, useState } from "react";
import { DownloadZip } from "./DownloadZip";
import { GAMES, activeGame } from "./games";
import { preloadImages } from "./preload";
import { PUBLIC_URL, hostUrlFor, joinUrlFor } from "./firebase";
import { resetController, setDisplay, setGame } from "./session";
import type { SubmissionStatus } from "./submission";
import type { GameId, Player, Session } from "./types";

/** What a screen shows for a session: the active game's stage, or the lobby. */
export function screenState(session: Session) {
  const game = activeGame(session);
  const display = session.display ?? { step: "list" as const };
  const videoPlaying = display.step === "video" && display.playing !== false;
  // A step without a player shows everyone; one with a player needs them to still be here and to have sent something.
  const onStage = !!game && display.step !== "list"
    && (!display.uid || (!!session.players?.[display.uid] && game.status?.(session, display.uid) !== "waiting"));
  return { game, display, videoPlaying, onStage };
}

/**
 * The lobby or the stage, as the main screen shows them. `viewOnly` is for extra screens (`/screen`):
 * the same picture, but nothing to click and no host setup (QR, remote status, download).
 * `footer` goes at the bottom of the lobby (e.g. End session).
 */
export function Screen({ code, session, viewOnly = false, footer }: {
  code: string; session: Session; viewOnly?: boolean; footer?: React.ReactNode;
}) {
  const { game, display, onStage } = screenState(session);
  const players = Object.entries(session.players ?? {});

  // Warm the browser cache with every photo submitted to the active game so reveals appear instantly.
  const photoUrls = game?.photoUrls(session).join("\n") ?? "";
  useEffect(() => {
    preloadImages(photoUrls.split("\n"));
  }, [photoUrls]);

  if (game && onStage) return <game.Stage code={code} session={session} display={display} viewOnly={viewOnly} />;

  return (
    <main className="lobby">
      <header>
        <div>
          <h1>{game ? game.heading(session) : "Taskmaster"}</h1>
          <p className="muted">Go to <strong>{PUBLIC_URL.replace(/^https?:\/\//, "")}/play</strong> and enter</p>
          <p className="code">{code}</p>
        </div>
        <div className="qrs">
          <figure>
            <QRCodeSVG value={joinUrlFor(code)} size={300} bgColor="#fff" marginSize={2} />
            <figcaption>Players scan here</figcaption>
          </figure>
          {!viewOnly && !session.controllerUid && (
            <figure className="host-qr">
              <QRCodeSVG value={hostUrlFor(code)} size={150} bgColor="#fff" marginSize={2} />
              <figcaption>Host scans here</figcaption>
            </figure>
          )}
        </div>
      </header>

      {!game && (
        <>
          <h2>Pick a game</h2>
          <GamePicks showBlurbs={!session.hideBlurbs} onPick={viewOnly ? undefined : (id) => void setGame(code, id)} />
        </>
      )}

      <h2>
        Players ({players.length})
        {game?.status && players.length > 0 && <span className="submitted-count"> · {players.filter(([uid]) => game.status?.(session, uid) === "submitted").length} submitted</span>}
      </h2>
      {players.length === 0 && <p className="muted">Waiting for players to join…</p>}
      <ul className="tiles">
        {players.map(([uid, p]) => (
          <Tile key={uid} player={p} status={game?.status?.(session, uid)}
            onPick={viewOnly || !game?.status ? undefined : () => void setDisplay(code, { uid, step: game.firstStep })} />
        ))}
      </ul>
      {!viewOnly && (
        <>
          <p className="muted small">
            {session.controllerUid
              ? <>🎮 Host remote connected. <button className="link" onClick={() => void resetController(code)}>Reset</button></>
              : <>Host: open <strong>{PUBLIC_URL.replace(/^https?:\/\//, "")}/host</strong> on your phone and enter the same code to control this screen.</>}
            {" "}{!game ? "You can also pick a game here." : game.status ? "You can also click a player here." : ""}
          </p>
          <p className="muted small">
            📺 To show this on another screen too, open <strong>{PUBLIC_URL.replace(/^https?:\/\//, "")}/screen</strong> there and enter the same code.
          </p>
          {game && <button className="link" onClick={() => void setGame(code, null)}>← Games</button>}
          {session.showDownload && <DownloadZip code={code} session={session} />}
        </>
      )}
      {footer}
    </main>
  );
}

/**
 * The game picker: index cards scattered at random angles (picked once, so they don't jump around).
 * Without `onPick` (a view-only screen) the cards are just shown.
 */
function GamePicks({ showBlurbs, onPick }: { showBlurbs: boolean; onPick?: (id: GameId) => void }) {
  const [scatter] = useState(() => Object.values(GAMES).map(() => ({
    "--tilt": `${(Math.random() * 7 - 3.5).toFixed(1)}deg`,
    "--dx": `${(Math.random() * 1.6 - 0.8).toFixed(2)}rem`,
    "--dy": `${(Math.random() * 1.6 - 0.8).toFixed(2)}rem`,
  })));
  return (
    <ul className="game-picks">
      {Object.values(GAMES).map((g, i) => (
        <li key={g.id}>
          <button className={onPick ? "game-card" : "game-card static"} style={scatter[i] as React.CSSProperties}
            tabIndex={onPick ? undefined : -1} onClick={() => onPick?.(g.id)}>
            {/* long titles are set smaller, so they stay on the title line */}
            <span className={g.name.length > 14 ? "name long" : "name"}>{g.name}</span>
            {showBlurbs && <span className="blurb">{g.blurb}</span>}
          </button>
        </li>
      ))}
    </ul>
  );
}

/**
 * A player in the lobby; on the game selection screen (no status) it's just their name.
 * Without `onPick` (a view-only screen) it can't be clicked but looks the same.
 */
function Tile({ player, status, onPick }: { player: Player; status?: SubmissionStatus; onPick?: () => void }) {
  return (
    <li>
      <button className={onPick ? "tile" : "tile static"} disabled={status !== "submitted"}
        tabIndex={onPick ? undefined : -1} onClick={onPick}>
        <span className="name">{player.name}</span>
        {status === "submitted" ? <span className="stamp">✓ Submitted</span>
          : status && <span className="status">… {status === "sending" ? "sending" : "waiting"}</span>}
      </button>
    </li>
  );
}
