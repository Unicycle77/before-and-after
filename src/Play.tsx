import { useEffect, useState } from "react";
import { activeGame } from "./games";
import { QrScannerModal } from "./QrScannerModal";
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

  // Players only ever see the game the host has made active.
  const game = activeGame(session);
  return (
    <main className="phone">
      <header><strong>{session.players[uid]!.name}</strong><span className="muted"> · {code}</span></header>
      <game.Player key={game.id} code={code} uid={uid} session={session} />
      <button className="link" onClick={() => { void leaveSession(code, uid); leave(); }}>Leave session</button>
    </main>
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
