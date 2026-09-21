import { useEffect, useRef, useState } from "react";
import { QrScannerModal } from "./QrScannerModal";
import { extractFrames } from "./frames";
import { submitMedia } from "./media";
import { JoinError, extractCode, joinSession, leaveSession, store, useSession, useUid } from "./session";

const CODE_KEY = "ba.playCode";
const NAME_KEY = "ba.playName";

export function Play() {
  const uid = useUid();
  const [code, setCode] = useState(() => store.get(CODE_KEY));
  const session = useSession(code || undefined);

  const leave = () => { store.set(CODE_KEY, ""); setCode(""); };

  // If the session vanished or we were removed, fall back to the join screen.
  useEffect(() => {
    if (!uid || session === undefined) return;
    if (session === null || !session.players?.[uid]) leave();
  }, [uid, session]);

  if (!code) return <Join onJoined={(c) => { store.set(CODE_KEY, c); setCode(c); }} />;
  if (!uid || !session?.players?.[uid]) return <main className="center"><p>Loading…</p></main>;

  return (
    <PlayerHome
      code={code} uid={uid} name={session.players[uid]!.name} session={session}
      onLeave={() => { void leaveSession(code, uid); leave(); }}
    />
  );
}

function Join({ onJoined }: { onJoined: (code: string) => void }) {
  const [code, setCode] = useState(() => (new URLSearchParams(location.search).get("code") ?? "").toUpperCase().slice(0, 4));
  const [name, setName] = useState(() => store.get(NAME_KEY));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string>();
  const [scanning, setScanning] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(undefined);
    try {
      const c = await joinSession(code, name);
      store.set(NAME_KEY, name.trim());
      onJoined(c);
    } catch (err) {
      setError(err instanceof JoinError ? err.message : "Something went wrong. Try again.");
    } finally { setBusy(false); }
  }

  return (
    <main className="join">
      <h1>Before &amp; After</h1>
      <form onSubmit={(e) => void submit(e)}>
        <label>Game code
          <div className="row">
            <input value={code} onChange={(e) => setCode(e.target.value.toUpperCase().slice(0, 4))}
              maxLength={4} autoCapitalize="characters" autoComplete="off" placeholder="ABCD" required />
            <button type="button" aria-label="Scan QR code" onClick={() => setScanning(true)}>📷</button>
          </div>
        </label>
        <label>Your name
          <input value={name} onChange={(e) => setName(e.target.value)} maxLength={20} autoComplete="off" placeholder="Nickname" required />
        </label>
        <button type="submit" disabled={busy || code.length !== 4}>{busy ? "Joining…" : "Join"}</button>
        {error && <p className="error">{error}</p>}
      </form>
      {scanning && <QrScannerModal onClose={() => setScanning(false)} onScan={(t) => {
        setScanning(false);
        const c = extractCode(t);
        if (c) { setCode(c); setError(undefined); }
      }} />}
    </main>
  );
}

/**
 * The player's whole submission is one video. Its first and last frames become the Before and After
 * (grabbed on the phone the moment a video is chosen), shown above the video so the player can check
 * them. Nothing is uploaded until they tap Submit; there are no standalone photos.
 */
export function PlayerHome({ code, uid, name, session, onLeave }: {
  code: string; uid: string; name: string; session: NonNullable<ReturnType<typeof useSession>>; onLeave: () => void;
}) {
  const mine = session.media?.[uid] ?? {};
  const [picked, setPicked] = useState<Picked>();
  const [checking, setChecking] = useState(false);
  const [progress, setProgress] = useState<number>();
  const [error, setError] = useState<string>();
  const camera = useRef<HTMLInputElement>(null);
  const library = useRef<HTMLInputElement>(null);
  const pickedRef = useRef<Picked>();
  pickedRef.current = picked;
  const uploading = progress !== undefined;

  useEffect(() => () => { if (pickedRef.current) revokePicked(pickedRef.current); }, []);

  function discard() {
    if (picked) revokePicked(picked);
    setPicked(undefined);
  }

  async function choose(file: File | undefined) {
    if (!file) return;
    discard();
    setError(undefined);
    setChecking(true);
    try {
      const { first, last } = await extractFrames(file);
      setPicked({
        file, first, last,
        videoUrl: URL.createObjectURL(file), firstUrl: URL.createObjectURL(first), lastUrl: URL.createObjectURL(last),
      });
    } catch {
      setError("We couldn't read that video. Please record it again.");
    } finally {
      setChecking(false);
    }
  }

  async function submit() {
    if (!picked) return;
    setError(undefined);
    setProgress(0);
    try {
      await submitMedia(code, uid, "video", picked.file, setProgress);
      await Promise.all([
        submitMedia(code, uid, "before", picked.first, () => {}, { alreadySized: true }),
        submitMedia(code, uid, "after", picked.last, () => {}, { alreadySized: true }),
      ]);
      discard();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Upload failed. Try again.");
    } finally {
      setProgress(undefined);
    }
  }

  const beforeUrl = picked ? picked.firstUrl : mine.before;
  const afterUrl = picked ? picked.lastUrl : mine.after;
  const videoUrl = picked ? picked.videoUrl : mine.video;
  const submitted = !picked && !!mine.video && !!mine.before && !!mine.after;

  return (
    <main className="phone">
      <header><strong>{name}</strong><span className="muted"> · {code}</span></header>

      <section className="slot">
        <h2>Your Before &amp; After</h2>
        <div className="pair-preview">
          <figure>{beforeUrl ? <img src={beforeUrl} alt="Before" /> : <div className="ph">Before</div>}<figcaption>Before</figcaption></figure>
          <figure>{afterUrl ? <img src={afterUrl} alt="After" /> : <div className="ph">After</div>}<figcaption>After</figcaption></figure>
        </div>
        <p className="muted small slot-hint">
          {picked ? "Taken from the first and last frame of your video. Happy with them?"
            : "These are taken automatically from the first and last frame of your video."}
        </p>
      </section>

      <section className="slot">
        <h2>Your video {submitted && !uploading ? "✓" : ""}</h2>
        {!videoUrl && <p className="muted small slot-hint">Start on your Before, finish on your After.</p>}
        {videoUrl && <video src={videoUrl} controls playsInline preload="metadata" />}
        {checking && <p className="muted small slot-hint">Checking your video…</p>}
        {picked && !uploading && <p className="slot-hint"><strong>Not submitted yet</strong> — tap Submit when you're happy.</p>}
        {uploading && <progress value={progress} max={1} />}

        {picked && <button className="big" disabled={uploading} onClick={() => void submit()}>{uploading ? "Submitting…" : "Submit"}</button>}
        <div className="row">
          <button disabled={uploading || checking} onClick={() => camera.current?.click()}>{videoUrl ? "Record again" : "Record"}</button>
          <button disabled={uploading || checking} onClick={() => library.current?.click()}>Choose file</button>
        </div>
        <input ref={camera} type="file" accept="video/*" capture="environment" hidden onChange={(e) => { void choose(e.target.files?.[0]); e.target.value = ""; }} />
        <input ref={library} type="file" accept="video/*" hidden onChange={(e) => { void choose(e.target.files?.[0]); e.target.value = ""; }} />
        {error && <p className="error">{error}</p>}
      </section>

      <button className="link" onClick={onLeave}>Leave session</button>
    </main>
  );
}

interface Picked { file: File; first: Blob; last: Blob; videoUrl: string; firstUrl: string; lastUrl: string }
const revokePicked = (p: Picked) => [p.videoUrl, p.firstUrl, p.lastUrl].forEach((u) => URL.revokeObjectURL(u));
