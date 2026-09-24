import { QRCodeSVG } from "qrcode.react";
import { useEffect, useRef, useState } from "react";
import { DownloadZip } from "./DownloadZip";
import { GAMES, activeGame } from "./games";
import { Jukebox } from "./Jukebox";
import { preloadImages } from "./preload";
import { PUBLIC_URL, hostUrlFor, joinUrlFor } from "./firebase";
import { JoinError, createSession, ensureSignedIn, migrateLegacySession, resetController, resumeSession, setDisplay, setGame, store, useSession } from "./session";
import type { SubmissionStatus } from "./submission";
import type { Player } from "./types";

const KEY = "ba.hostCode";
const RECENT_KEY = "ba.recentSessions";
const MAX_RECENT = 6;

/** Sessions this screen has hosted, newest first (kept in localStorage). */
interface Recent { code: string; at: number }

function loadRecent(): Recent[] {
  try {
    const list: unknown = JSON.parse(store.get(RECENT_KEY) || "[]");
    return Array.isArray(list) ? list.filter((r): r is Recent => typeof r?.code === "string" && typeof r?.at === "number") : [];
  } catch { return []; }
}

function saveRecent(list: Recent[]): Recent[] {
  store.set(RECENT_KEY, list.length ? JSON.stringify(list) : "");
  return list;
}

const agoFormat = new Intl.RelativeTimeFormat(undefined, { numeric: "auto" });
function ago(at: number): string {
  const mins = Math.round((at - Date.now()) / 60000);
  if (mins > -60) return agoFormat.format(mins, "minute");
  const hours = Math.round(mins / 60);
  if (hours > -24) return agoFormat.format(hours, "hour");
  return agoFormat.format(Math.round(hours / 24), "day");
}

export function MainScreen() {
  const [code, setCode] = useState(() => store.get(KEY));
  const [error, setError] = useState<string>();
  const [resumeCode, setResumeCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [recent, setRecent] = useState(loadRecent);
  const session = useSession(code || undefined);
  const remembered = useRef("");

  const remember = (c: string) => setRecent((r) => saveRecent([{ code: c, at: Date.now() }, ...r.filter((x) => x.code !== c)].slice(0, MAX_RECENT)));
  const forget = (c: string) => setRecent((r) => saveRecent(r.filter((x) => x.code !== c)));

  // Warm the browser cache with every photo submitted to the active game so reveals appear instantly.
  const photoUrls = (session && activeGame(session)?.photoUrls(session).join("\n")) || "";
  useEffect(() => {
    preloadImages(photoUrls.split("\n"));
  }, [photoUrls]);

  // Resume a stored session on refresh; drop it if it's gone or another screen has taken it over.
  useEffect(() => {
    if (!code || session === undefined) return;
    void ensureSignedIn().then((u) => {
      if (session === null || session.hostUid !== u.uid) {
        if (session) setError(`Session ${code} was resumed on another screen.`);
        else forget(code);
        store.set(KEY, "");
        setCode("");
      } else {
        // A session from before there were games: move its data into the games layout.
        void migrateLegacySession(code, session);
        if (remembered.current !== code) {
          remembered.current = code;
          remember(code);
        }
      }
    });
  }, [code, session]);

  async function open(get: () => Promise<string>, recentCode?: string) {
    setError(undefined);
    setBusy(true);
    try {
      const c = await get();
      store.set(KEY, c);
      setCode(c);
      setResumeCode("");
    } catch (e) {
      // A recent session that has since been deleted: drop it from the list.
      if (recentCode && e instanceof JoinError) forget(recentCode);
      setError(e instanceof JoinError ? e.message : e instanceof Error ? e.message : String(e));
    } finally { setBusy(false); }
  }

  if (!code) {
    return (
      <main className="center">
        <h1>Before &amp; After</h1>
        <button className="big" disabled={busy} onClick={() => void open(createSession)}>Start a session</button>
        <form className="resume" onSubmit={(e) => { e.preventDefault(); void open(() => resumeSession(resumeCode)); }}>
          <label>Or resume a session
            <input value={resumeCode} onChange={(e) => setResumeCode(e.target.value.toUpperCase().slice(0, 4))}
              maxLength={4} autoComplete="off" placeholder="ABCD" />
          </label>
          <button type="submit" disabled={busy || resumeCode.length !== 4}>Resume</button>
        </form>
        {recent.length > 0 && (
          <section className="recent">
            <h2 className="muted small">Recent sessions</h2>
            <ul>
              {recent.map((r) => (
                <li key={r.code}>
                  <button disabled={busy} onClick={() => void open(() => resumeSession(r.code), r.code)}>
                    <span className="recent-code">{r.code}</span>
                    <span className="muted small">{ago(r.at)}</span>
                  </button>
                </li>
              ))}
            </ul>
          </section>
        )}
        {error && <p className="error">{error}</p>}
      </main>
    );
  }
  if (!session) return <main className="center"><p>Loading…</p></main>;

  const game = activeGame(session);
  const players = Object.entries(session.players ?? {});
  const display = session.display ?? { step: "list" as const };
  const videoPlaying = display.step === "video" && display.playing !== false;
  // A step without a player shows everyone; one with a player needs them to still be here and to have sent something.
  const onStage = !!game && display.step !== "list"
    && (!display.uid || (!!session.players?.[display.uid] && game.status(session, display.uid) !== "waiting"));

  if (game && onStage) {
    return (
      <>
        <game.Stage code={code} session={session} display={display} />
        <Jukebox code={code} jukebox={session.jukebox} duck={videoPlaying} showUi={false} />
      </>
    );
  }

  return (
    <>
    <main className="lobby">
      <header>
        <div>
          <h1>{game ? game.heading : <>Before <span className="amp">&amp;</span> After</>}</h1>
          <p className="muted">Go to <strong>{PUBLIC_URL.replace(/^https?:\/\//, "")}/play</strong> and enter</p>
          <p className="code">{code}</p>
        </div>
        <div className="qrs">
          <figure>
            <QRCodeSVG value={joinUrlFor(code)} size={300} bgColor="#fff" marginSize={2} />
            <figcaption>Players scan here</figcaption>
          </figure>
          {!session.controllerUid && (
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
          <div className="game-picks">
            {Object.values(GAMES).map((g) => (
              <button key={g.id} className="big" onClick={() => void setGame(code, g.id)}>{g.name}</button>
            ))}
          </div>
        </>
      )}

      <h2>
        Players ({players.length})
        {game && players.length > 0 && <span className="submitted-count"> · {players.filter(([uid]) => game.status(session, uid) === "submitted").length} submitted</span>}
      </h2>
      {players.length === 0 && <p className="muted">Waiting for players to join…</p>}
      <ul className="tiles">
        {players.map(([uid, p]) => (
          <Tile key={uid} player={p} status={game?.status(session, uid)}
            onPick={() => { if (game) void setDisplay(code, { uid, step: game.firstStep }); }} />
        ))}
      </ul>
      <p className="muted small">
        {session.controllerUid
          ? <>🎮 Host remote connected. <button className="link" onClick={() => void resetController(code)}>Reset</button></>
          : <>Host: open <strong>{PUBLIC_URL.replace(/^https?:\/\//, "")}/host</strong> on your phone and enter the same code to control this screen.</>}
        {" "}{game ? "You can also click a player here." : "You can also pick a game here."}
      </p>
      {game && <button className="link" onClick={() => void setGame(code, null)}>← Games</button>}
      {session.showDownload && <DownloadZip code={code} session={session} />}
      <button className="link" onClick={() => { store.set(KEY, ""); setCode(""); }}>End session</button>
    </main>
    <Jukebox code={code} jukebox={session.jukebox} duck={videoPlaying} showUi />
    </>
  );
}

/** A player in the lobby; on the game selection screen (no status) it's just their name. */
function Tile({ player, status, onPick }: { player: Player; status?: SubmissionStatus; onPick: () => void }) {
  return (
    <li>
      <button className="tile" disabled={status !== "submitted"} onClick={onPick}>
        <span className="name">{player.name}</span>
        {status === "submitted" ? <span className="stamp">✓ Submitted</span>
          : status && <span className="status">… {status === "sending" ? "sending" : "waiting"}</span>}
      </button>
    </li>
  );
}
