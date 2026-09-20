import { QRCodeSVG } from "qrcode.react";
import { useEffect, useRef, useState } from "react";
import { PUBLIC_URL, joinUrlFor } from "./firebase";
import { createSession, ensureSignedIn, setDisplay, store, useSession } from "./session";
import type { Media, Player } from "./types";

const KEY = "ba.hostCode";

export function MainScreen() {
  const [code, setCode] = useState(() => store.get(KEY));
  const [error, setError] = useState<string>();
  const session = useSession(code || undefined);

  // Resume a stored session on refresh; drop it if it's gone or isn't ours.
  useEffect(() => {
    if (!code || session === undefined) return;
    void ensureSignedIn().then((u) => {
      if (session === null || session.hostUid !== u.uid) { store.set(KEY, ""); setCode(""); }
    });
  }, [code, session]);

  async function start() {
    setError(undefined);
    try {
      const c = await createSession();
      store.set(KEY, c);
      setCode(c);
    } catch (e) { setError(e instanceof Error ? e.message : String(e)); }
  }

  if (!code) {
    return (
      <main className="center">
        <h1>Before &amp; After</h1>
        <button className="big" onClick={() => void start()}>Start a session</button>
        {error && <p className="error">{error}</p>}
      </main>
    );
  }
  if (!session) return <main className="center"><p>Loading…</p></main>;

  const players = Object.entries(session.players ?? {});
  const media = session.media ?? {};
  const display = session.display ?? { step: "list" as const };
  const shown = display.uid ? session.players?.[display.uid] : undefined;
  const shownMedia = display.uid ? media[display.uid] : undefined;

  if (display.step !== "list" && shown && shownMedia) {
    return <Stage name={shown.name} step={display.step} media={shownMedia} />;
  }

  return (
    <main className="lobby">
      <header>
        <div>
          <h1>Before &amp; After</h1>
          <p className="muted">Go to <strong>{PUBLIC_URL.replace(/^https?:\/\//, "")}/play</strong> and enter</p>
          <p className="code">{code}</p>
        </div>
        <QRCodeSVG value={joinUrlFor(code)} size={150} bgColor="#fff" marginSize={2} />
      </header>

      <h2>Players ({players.length})</h2>
      {players.length === 0 && <p className="muted">Waiting for players to join…</p>}
      <ul className="tiles">
        {players.map(([uid, p]) => (
          <Tile key={uid} player={p} media={media[uid] ?? {}} isHost={uid === session.firstPlayerUid}
            onPick={() => void setDisplay(code, { uid, step: "before" })} />
        ))}
      </ul>
      <p className="muted small">
        {session.firstPlayerUid && session.players?.[session.firstPlayerUid]
          ? <>👑 {session.players[session.firstPlayerUid]!.name} is the host — controls are on their phone (you can also click a player here).</>
          : "The first player to join becomes the host and controls this screen from their phone."}
      </p>
      <button className="link" onClick={() => { store.set(KEY, ""); setCode(""); }}>End session</button>
    </main>
  );
}

function Tile({ player, media, isHost, onPick }: { player: Player; media: Media; isHost: boolean; onPick: () => void }) {
  const ready = !!media.before && !!media.after;
  return (
    <li>
      <button className="tile" disabled={!ready} onClick={onPick}>
        <span className="name">{isHost ? "👑 " : ""}{player.name}{player.connected === false ? " (away)" : ""}</span>
        <span className="chips">
          <Chip on={!!media.before}>Before</Chip><Chip on={!!media.after}>After</Chip><Chip on={!!media.video}>Video</Chip>
        </span>
      </button>
    </li>
  );
}

const Chip = ({ on, children }: { on: boolean; children: string }) => (
  <span className={on ? "chip on" : "chip"}>{on ? "✓" : "…"} {children}</span>
);

/** Full-screen presentation of one player's before / after / video. */
function Stage({ name, step, media }: { name: string; step: "before" | "after" | "video"; media: Media }) {
  return (
    <main className="stage">
      <div className="stage-label">{name} — {step.toUpperCase()}</div>
      {step === "video" ? <Video src={media.video} /> : <img key={step} src={media[step]} alt={`${name} ${step}`} />}
    </main>
  );
}

function Video({ src }: { src?: string }) {
  const ref = useRef<HTMLVideoElement>(null);
  const [blocked, setBlocked] = useState(false);
  useEffect(() => { ref.current?.play().catch(() => setBlocked(true)); }, [src]);
  if (!src) return <p className="muted">No video was submitted.</p>;
  return (
    <>
      <video ref={ref} src={src} controls playsInline autoPlay onPlay={() => setBlocked(false)} />
      {blocked && <button className="big overlay" onClick={() => void ref.current?.play()}>▶ Play video</button>}
    </>
  );
}
