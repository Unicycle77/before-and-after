import { useEffect, useState } from "react";
import { HostRemote } from "./HostRemote";
import { QrScannerModal } from "./QrScannerModal";
import { JoinError, claimController, extractCode, store, useSession, useUid } from "./session";

const KEY = "ba.remoteCode";

/** The host's phone (`/host`): same 4-letter code as players, but drives the main screen. */
export function HostPage() {
  const uid = useUid();
  const [code, setCode] = useState(() => store.get(KEY));
  const session = useSession(code || undefined);

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
      <HostRemote code={code} session={session} />
      <button className="link" onClick={disconnect}>Disconnect</button>
    </main>
  );
}

function Connect({ onConnected }: { onConnected: (code: string) => void }) {
  const [code, setCode] = useState(() => (new URLSearchParams(location.search).get("code") ?? "").toUpperCase().slice(0, 4));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string>();
  const [scanning, setScanning] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(undefined);
    try { onConnected(await claimController(code)); }
    catch (err) { setError(err instanceof JoinError ? err.message : "Something went wrong. Try again."); }
    finally { setBusy(false); }
  }

  return (
    <main className="join">
      <h1>Host remote</h1>
      <form onSubmit={(e) => void submit(e)}>
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
