import { QRCodeSVG } from "qrcode.react";
import { useEffect, useRef, useState } from "react";
import { PUBLIC_URL, hostUrlFor, joinUrlFor } from "./firebase";
import { createSession, ensureSignedIn, resetController, setDisplay, store, useSession } from "./session";
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
          <h1>Before <span className="amp">&amp;</span> After</h1>
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

      <h2>Players ({players.length})</h2>
      {players.length === 0 && <p className="muted">Waiting for players to join…</p>}
      <ul className="tiles">
        {players.map(([uid, p]) => (
          <Tile key={uid} player={p} media={media[uid] ?? {}}
            onPick={() => void setDisplay(code, { uid, step: "before" })} />
        ))}
      </ul>
      <p className="muted small">
        {session.controllerUid
          ? <>🎮 Host remote connected. <button className="link" onClick={() => void resetController(code)}>Reset</button></>
          : <>Host: open <strong>{PUBLIC_URL.replace(/^https?:\/\//, "")}/host</strong> on your phone and enter the same code to control this screen.</>}
        {" "}You can also click a player here.
      </p>
      <button className="link" onClick={() => { store.set(KEY, ""); setCode(""); }}>End session</button>
    </main>
  );
}

function Tile({ player, media, onPick }: { player: Player; media: Media; onPick: () => void }) {
  const ready = !!media.before && !!media.after;
  return (
    <li>
      <button className="tile" disabled={!ready} onClick={onPick}>
        <span className="name">{player.name}</span>
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

/** Full-screen presentation of one player's before / after / video, in a gold frame. */
function Stage({ name, step, media }: { name: string; step: "before" | "after" | "video"; media: Media }) {
  return (
    <main className="stage">
      {step === "video" ? <Video key="video" src={media.video} /> : (
        <Framed key={step}>
          {(setRatio) => (
            <img src={media[step]} alt={`${name} ${step}`}
              onLoad={(e) => setRatio(e.currentTarget.naturalWidth / e.currentTarget.naturalHeight)} />
          )}
        </Framed>
      )}
      <div className="stage-label"><span>{step}</span> · {name}</div>
    </main>
  );
}

/**
 * Gold frame that hugs its media. Once the media's aspect ratio is known, it is
 * sized to be as large as the screen allows (see `.frame` in styles.css).
 */
function Framed({ children }: { children: (setRatio: (r: number) => void) => React.ReactNode }) {
  const [ratio, setRatio] = useState<number>();
  return (
    <div className={ratio ? "frame ready" : "frame"} style={ratio ? ({ "--ratio": ratio } as React.CSSProperties) : undefined}>
      {children(setRatio)}
    </div>
  );
}

function Video({ src }: { src?: string }) {
  const ref = useRef<HTMLVideoElement>(null);
  const [blocked, setBlocked] = useState(false);
  useEffect(() => { ref.current?.play().catch(() => setBlocked(true)); }, [src]);
  if (!src) return <p className="muted">No video was submitted.</p>;
  return (
    <>
      <Framed>
        {(setRatio) => (
          <video ref={ref} src={src} controls playsInline autoPlay onPlay={() => setBlocked(false)}
            onLoadedMetadata={(e) => setRatio(e.currentTarget.videoWidth / e.currentTarget.videoHeight)} />
        )}
      </Framed>
      {blocked && <button className="big overlay" onClick={() => void ref.current?.play()}>▶ Play video</button>}
    </>
  );
}
