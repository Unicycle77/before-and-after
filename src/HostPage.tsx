import { useEffect, useRef, useState } from "react";
import { HostRemote } from "./HostRemote";
import { JukeboxRemote } from "./JukeboxRemote";
import { QrScannerModal } from "./QrScannerModal";
import { JoinError, claimController, extractCode, releaseController, store, useSession, useUid } from "./session";

const KEY = "ba.remoteCode";

/** The host's phone (`/host`): same 4-letter code as players, but drives the main screen. */
export function HostPage() {
  const uid = useUid();
  const [code, setCode] = useState(() => store.get(KEY));
  const session = useSession(code || undefined);
  const [tab, setTab] = useState<"screen" | "music">("screen");

  const disconnect = () => { store.set(KEY, ""); setCode(""); };

  // Session gone, or the main screen reset our remote → back to code entry.
  useEffect(() => {
    if (!uid || session === undefined) return;
    if (session === null || session.controllerUid !== uid) disconnect();
  }, [uid, session]);

  if (!code) return <Connect onConnected={(c) => { store.set(KEY, c); setCode(c); }} />;
  if (!session || session.controllerUid !== uid) return <main className="center"><p>Connecting…</p></main>;

  return (
    <main className="phone">
      <header><strong>🎮 Host remote</strong><span className="muted"> · {code}</span></header>
      <nav className="tabs">
        <button className={tab === "screen" ? "active" : ""} onClick={() => setTab("screen")}>📺 Screen</button>
        <button className={tab === "music" ? "active" : ""} onClick={() => setTab("music")}>🎵 Jukebox</button>
      </nav>
      {tab === "screen" ? <HostRemote code={code} session={session} /> : <JukeboxRemote code={code} session={session} />}
      <button className="link" onClick={() => { void releaseController(code); disconnect(); }}>Disconnect</button>
    </main>
  );
}

function Connect({ onConnected }: { onConnected: (code: string) => void }) {
  const [code, setCode] = useState(() => (new URLSearchParams(location.search).get("code") ?? "").toUpperCase().slice(0, 4));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string>();
  const [scanning, setScanning] = useState(false);
  const autoTried = useRef(false);

  async function connect(c: string) {
    setBusy(true);
    setError(undefined);
    try { onConnected(await claimController(c)); }
    catch (err) { setError(err instanceof JoinError ? err.message : "Something went wrong. Try again."); }
    finally { setBusy(false); }
  }

  // Opened from the host QR on the main screen: connect straight away, so the QR disappears there.
  // The code is then dropped from the URL, so a later Disconnect doesn't reconnect on refresh.
  useEffect(() => {
    if (code.length !== 4 || autoTried.current) return;
    autoTried.current = true;
    history.replaceState(null, "", location.pathname);
    void connect(code);
  }, []);

  function submit(e: React.FormEvent) {
    e.preventDefault();
    void connect(code);
  }

  return (
    <main className="join">
      <h1>Host remote</h1>
      <form onSubmit={submit}>
        <label>Game code (from the main screen)
          <div className="row">
            <input value={code} onChange={(e) => setCode(e.target.value.toUpperCase().slice(0, 4))}
              maxLength={4} autoCapitalize="characters" autoComplete="off" placeholder="ABCD" required />
            <button type="button" aria-label="Scan QR code" onClick={() => setScanning(true)}>📷</button>
          </div>
        </label>
        <button type="submit" disabled={busy || code.length !== 4}>{busy ? "Connecting…" : "Connect"}</button>
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
