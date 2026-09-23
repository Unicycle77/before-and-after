import { QRCodeSVG } from "qrcode.react";
import { useEffect, useRef, useState } from "react";
import { DownloadZip } from "./DownloadZip";
import { Jukebox } from "./Jukebox";
import { Review } from "./Review";
import { StageControls } from "./StageControls";
import { submissionStatus } from "./submission";
import { SafeImg } from "./SafeImg";
import { playableVideoUrl, preloadImages, preloadVideo } from "./preload";
import { PUBLIC_URL, hostUrlFor, joinUrlFor } from "./firebase";
import { JoinError, createSession, ensureSignedIn, patchDisplay, resetController, resumeSession, setDisplay, store, useSession } from "./session";
import type { Display, Media, Player, Step } from "./types";

const KEY = "ba.hostCode";

export function MainScreen() {
  const [code, setCode] = useState(() => store.get(KEY));
  const [error, setError] = useState<string>();
  const [resumeCode, setResumeCode] = useState("");
  const [busy, setBusy] = useState(false);
  const session = useSession(code || undefined);

  // Warm the browser cache with every submitted photo so reveals appear instantly.
  const photoUrls = Object.values(session?.media ?? {})
    .flatMap((m) => [m.before, m.after])
    .filter((u): u is string => !!u)
    .join("\n");
  useEffect(() => {
    preloadImages(photoUrls.split("\n"));
  }, [photoUrls]);

  // Once a player is picked, start fetching their video in the background: by the time the host
  // gets to "Video" (after the before/after discussion) it plays instantly from memory.
  const pickedUid = session?.display?.uid;
  const pickedVideo = pickedUid ? session?.media?.[pickedUid]?.video : undefined;
  useEffect(() => { preloadVideo(pickedVideo); }, [pickedVideo]);

  // Resume a stored session on refresh; drop it if it's gone or another screen has taken it over.
  useEffect(() => {
    if (!code || session === undefined) return;
    void ensureSignedIn().then((u) => {
      if (session === null || session.hostUid !== u.uid) {
        if (session) setError(`Session ${code} was resumed on another screen.`);
        store.set(KEY, "");
        setCode("");
      }
    });
  }, [code, session]);

  async function open(get: () => Promise<string>) {
    setError(undefined);
    setBusy(true);
    try {
      const c = await get();
      store.set(KEY, c);
      setCode(c);
      setResumeCode("");
    } catch (e) {
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
  const videoPlaying = display.step === "video" && display.playing !== false;

  if (display.step === "review") {
    return (
      <>
        <Review code={code} players={session.players ?? {}} media={media} display={display} />
        <Jukebox code={code} jukebox={session.jukebox} duck={false} showUi={false} />
      </>
    );
  }

  if (display.step !== "list" && shown && shownMedia) {
    return (
      <>
        <Stage code={code} name={shown.name} step={display.step} media={shownMedia} display={display} />
        <Jukebox code={code} jukebox={session.jukebox} duck={videoPlaying} showUi={false} />
      </>
    );
  }

  return (
    <>
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

      <h2>
        Players ({players.length})
        {players.length > 0 && <span className="submitted-count"> · {players.filter(([uid]) => submissionStatus(media[uid]) === "submitted").length} submitted</span>}
      </h2>
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
      {session.showDownload && <DownloadZip code={code} players={session.players ?? {}} media={media} />}
      <button className="link" onClick={() => { store.set(KEY, ""); setCode(""); }}>End session</button>
    </main>
    <Jukebox code={code} jukebox={session.jukebox} duck={videoPlaying} showUi />
    </>
  );
}

function Tile({ player, media, onPick }: { player: Player; media: Media; onPick: () => void }) {
  const status = submissionStatus(media);
  return (
    <li>
      <button className="tile" disabled={status !== "submitted"} onClick={onPick}>
        <span className="name">{player.name}</span>
        {status === "submitted" ? <span className="stamp">✓ Submitted</span>
          : <span className="status">… {status === "sending" ? "sending" : "waiting"}</span>}
      </button>
    </li>
  );
}

/** Full-screen presentation of one player's before / after / video, in a gold frame. */
function Stage({ code, name, step, media, display }: { code: string; name: string; step: Exclude<Step, "list" | "review">; media: Media; display: Display }) {
  const both = step === "both";
  return (
    <main className={both ? "stage both" : "stage"}>
      {both ? (["before", "after"] as const).map((kind) => (
        <Framed key={kind}>
          {(setRatio) => (
            <SafeImg src={media[kind] ?? ""} alt={`${name} ${kind}`}
              onLoad={(e) => setRatio(e.currentTarget.naturalWidth / e.currentTarget.naturalHeight)}
              onFail={() => setRatio(4 / 3)} />
          )}
        </Framed>
      )) : step === "video" ? <Video key="video" src={media.video} playing={display.playing !== false} restartAt={display.restartAt}
          onEnded={() => void patchDisplay(code, { playing: false })} /> : (
        <Framed key={step}>
          {(setRatio) => (
            <SafeImg src={media[step] ?? ""} alt={`${name} ${step}`}
              onLoad={(e) => setRatio(e.currentTarget.naturalWidth / e.currentTarget.naturalHeight)}
              onFail={() => setRatio(4 / 3)} />
          )}
        </Framed>
      )}
      <div className="stage-label"><span>{both ? "before & after" : step}</span> · {name}</div>
      <StageControls code={code} display={display} hasVideo={!!media.video} />
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

/**
 * Video with no on-screen controls: the host's phone drives play/pause/restart via
 * `display`. Chrome blocks autoplay with sound until the page has had a click; if that
 * happens we start muted (so the host's Play still works) and unmute on the next click.
 */
function Video({ src, playing, restartAt, onEnded }: { src?: string; playing: boolean; restartAt?: number; onEnded: () => void }) {
  const ref = useRef<HTMLVideoElement>(null);
  const [muted, setMuted] = useState(false);
  // Use the preloaded in-memory copy if it is ready when the video starts; never swap sources mid-play.
  const [playable] = useState(() => (src ? playableVideoUrl(src) : ""));

  useEffect(() => {
    const v = ref.current;
    if (!v) return;
    if (!playing) { v.pause(); return; }
    v.play().catch(() => {
      v.muted = true;
      setMuted(true);
      v.play().catch(() => {});
    });
  }, [playing, src]);

  useEffect(() => {
    if (restartAt && ref.current) ref.current.currentTime = 0;
  }, [restartAt]);

  useEffect(() => {
    if (!muted) return;
    const unmute = () => { if (ref.current) ref.current.muted = false; setMuted(false); };
    document.addEventListener("click", unmute, { once: true });
    document.addEventListener("keydown", unmute, { once: true });
    return () => {
      document.removeEventListener("click", unmute);
      document.removeEventListener("keydown", unmute);
    };
  }, [muted]);

  if (!src) return <p className="muted">No video was submitted.</p>;
  return (
    <>
      <Framed>
        {(setRatio) => (
          <video ref={ref} src={playable} playsInline onEnded={onEnded}
            onLoadedMetadata={(e) => setRatio(e.currentTarget.videoWidth / e.currentTarget.videoHeight)} />
        )}
      </Framed>
      {muted && <div className="sound-hint">🔇 Click anywhere on this screen once to turn the sound on</div>}
    </>
  );
}
