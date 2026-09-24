import { useEffect, useState } from "react";
import { Screen } from "./Screen";
import { store, useSession } from "./session";

const KEY = "ba.viewCode";

/**
 * An extra screen (`/screen`), e.g. in another room: shows exactly what the main screen shows, with
 * sound, but controls nothing. The host phone (or the main screen) drives it. No music: the songs
 * only exist on the main screen's computer.
 */
export function ViewScreen() {
  const [code, setCode] = useState(() => {
    const fromUrl = (new URLSearchParams(location.search).get("code") ?? "").toUpperCase().slice(0, 4);
    return fromUrl.length === 4 ? fromUrl : store.get(KEY);
  });
  const session = useSession(code || undefined);
  const [error, setError] = useState<string>();
  // Browsers only play video with sound once the page has been clicked; after a refresh, ask for that click first.
  const [started, setStarted] = useState(() => navigator.userActivation?.hasBeenActive ?? false);

  const leave = () => { store.set(KEY, ""); setCode(""); };

  useEffect(() => {
    if (code) {
      store.set(KEY, code);
      // Drop the code from the URL, so a later Disconnect doesn't come straight back on refresh.
      if (location.search) history.replaceState(null, "", location.pathname);
    }
  }, [code]);

  useEffect(() => {
    if (code && session === null) { setError(`No session found for code ${code}.`); leave(); }
  }, [code, session]);

  if (!code) return <Connect error={error} onConnect={(c) => { setError(undefined); setStarted(true); setCode(c); }} />;
  if (!session) return <main className="center"><p>Connecting…</p></main>;

  return (
    <>
      <Screen code={code} session={session} viewOnly
        footer={<p className="muted small">📺 Extra screen: it follows the main screen. <button className="link" onClick={leave}>Disconnect</button></p>} />
      {!started && (
        <div className="start-overlay">
          <button className="big" onClick={() => setStarted(true)}>▶ Start the screen</button>
          <p className="muted small">One click, so videos can play with sound.</p>
        </div>
      )}
    </>
  );
}

function Connect({ error, onConnect }: { error?: string; onConnect: (code: string) => void }) {
  const [code, setCode] = useState("");
  return (
    <main className="join">
      <h1>Extra screen</h1>
      <form onSubmit={(e) => { e.preventDefault(); onConnect(code); }}>
        <label>Game code (from the main screen)
          <input value={code} onChange={(e) => setCode(e.target.value.toUpperCase().slice(0, 4))}
            maxLength={4} autoCapitalize="characters" autoComplete="off" placeholder="ABCD" required />
        </label>
        <button type="submit" className="big" disabled={code.length !== 4}>Show this session</button>
        {error && <p className="error">{error}</p>}
        <p className="muted small">This screen shows whatever the main screen shows, with sound. The host runs it from their phone as usual.</p>
      </form>
    </main>
  );
}
