import { useEffect, useRef, useState } from "react";
import { QrScannerModal } from "./QrScannerModal";
import { submitMedia } from "./media";
import { JoinError, extractCode, joinSession, leaveSession, store, useSession, useUid } from "./session";
import type { MediaKind } from "./types";

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

function PlayerHome({ code, uid, name, session, onLeave }: {
  code: string; uid: string; name: string; session: NonNullable<ReturnType<typeof useSession>>; onLeave: () => void;
}) {
  const mine = session.media?.[uid] ?? {};
  return (
    <main className="phone">
      <header><strong>{name}</strong><span className="muted"> · {code}</span></header>
      <Slot code={code} uid={uid} kind="before" label="Before" url={mine.before} />
      <Slot code={code} uid={uid} kind="after" label="After" url={mine.after} />
      <Slot code={code} uid={uid} kind="video" label="What happened in between" url={mine.video} />
      <button className="link" onClick={onLeave}>Leave session</button>
    </main>
  );
}

/** One submission (photo or video) with camera + library pickers and upload progress. */
function Slot({ code, uid, kind, label, url }: { code: string; uid: string; kind: MediaKind; label: string; url?: string }) {
  const [progress, setProgress] = useState<number>();
  const [error, setError] = useState<string>();
  const camera = useRef<HTMLInputElement>(null);
  const library = useRef<HTMLInputElement>(null);
  const accept = kind === "video" ? "video/*" : "image/*";
  const uploading = progress !== undefined;

  async function pick(file: File | undefined) {
    if (!file) return;
    setError(undefined);
    setProgress(0);
    try { await submitMedia(code, uid, kind, file, setProgress); }
    catch (e) { setError(e instanceof Error ? e.message : "Upload failed. Try again."); }
    finally { setProgress(undefined); }
  }

  return (
    <section className="slot">
      <h2>{label} {url && !uploading ? "✓" : ""}</h2>
      {url && (kind === "video" ? <video src={url} controls playsInline preload="metadata" /> : <img src={url} alt={label} />)}
      {uploading && <progress value={progress} max={1} />}
      <div className="row">
        <button disabled={uploading} onClick={() => camera.current?.click()}>{url ? "Retake" : kind === "video" ? "Record" : "Take photo"}</button>
        <button disabled={uploading} onClick={() => library.current?.click()}>Choose file</button>
      </div>
      <input ref={camera} type="file" accept={accept} capture="environment" hidden onChange={(e) => { void pick(e.target.files?.[0]); e.target.value = ""; }} />
      <input ref={library} type="file" accept={accept} hidden onChange={(e) => { void pick(e.target.files?.[0]); e.target.value = ""; }} />
      {error && <p className="error">{error}</p>}
    </section>
  );
}
