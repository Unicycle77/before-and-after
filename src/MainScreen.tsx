import { useEffect, useRef, useState } from "react";
import { Jukebox } from "./Jukebox";
import { Screen, screenState } from "./Screen";
import { JoinError, checkResume, createSession, ensureSignedIn, migrateLegacySession, resumeSession, store, useSession, useUid, watchHost } from "./session";

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
  /** A session another screen has (or had): take it over, or show it here as an extra screen? */
  const [choice, setChoice] = useState<string>();
  /** The session another screen just took over from this one. */
  const [lost, setLost] = useState<string>();
  // On the start page, sign in and follow who owns each recent session straight away: this warms up the
  // connection, and tapping a recent session can then answer instantly instead of looking it up first.
  const uid = useUid();
  const [owners, setOwners] = useState<Record<string, string | null>>({});
  const recentCodes = recent.map((r) => r.code).join(",");
  useEffect(() => {
    if (code) return;
    const unsubs = recentCodes.split(",").filter(Boolean)
      .map((c) => watchHost(c, (owner) => setOwners((o) => ({ ...o, [c]: owner }))));
    return () => unsubs.forEach((u) => u());
  }, [code, recentCodes]);
  const session = useSession(code || undefined);
  const remembered = useRef("");

  const remember = (c: string) => setRecent((r) => saveRecent([{ code: c, at: Date.now() }, ...r.filter((x) => x.code !== c)].slice(0, MAX_RECENT)));
  const forget = (c: string) => setRecent((r) => saveRecent(r.filter((x) => x.code !== c)));

  // Resume a stored session on refresh; drop it if it's gone or another screen has taken it over.
  useEffect(() => {
    if (!code || session === undefined) return;
    void ensureSignedIn().then((u) => {
      if (session === null || session.hostUid !== u.uid) {
        if (session) setLost(code);
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

  function fail(e: unknown, recentCode?: string) {
    // A recent session that has since been deleted: drop it from the list.
    if (recentCode && e instanceof JoinError) forget(recentCode);
    setError(e instanceof JoinError ? e.message : e instanceof Error ? e.message : String(e));
  }

  async function open(get: () => Promise<string>, recentCode?: string) {
    setError(undefined);
    setLost(undefined);
    setChoice(undefined);
    setBusy(true);
    try {
      const c = await get();
      store.set(KEY, c);
      setCode(c);
      setResumeCode("");
    } catch (e) {
      fail(e, recentCode);
    } finally { setBusy(false); }
  }

  /** Resuming a session this screen doesn't already own asks first, since taking it over sends the other screen back. */
  async function resume(raw: string, recentCode?: string) {
    setError(undefined);
    const known = owners[raw.trim().toUpperCase()];
    if (uid && known !== undefined) {
      if (known === null) { fail(new JoinError(`No session found for code ${raw.trim().toUpperCase()}.`), recentCode); return; }
      if (known !== uid) { setChoice(raw.trim().toUpperCase()); return; }
      await open(() => resumeSession(raw), recentCode);
      return;
    }
    setBusy(true);
    try {
      const { code: c, elsewhere } = await checkResume(raw);
      if (elsewhere) { setChoice(c); return; }
    } catch (e) {
      fail(e, recentCode);
      return;
    } finally { setBusy(false); }
    await open(() => resumeSession(raw), recentCode);
  }

  const showHere = (c: string) => location.assign(`/screen?code=${c}`);

  if (!code && choice) {
    return (
      <main className="center">
        <h1>Taskmaster</h1>
        <p>Session <strong className="recent-code">{choice}</strong> was last open on another screen.</p>
        <button className="big" disabled={busy} onClick={() => void open(() => resumeSession(choice))}>Take over here</button>
        <p className="muted small">This becomes the main screen, with the music. The other screen goes back to the start.</p>
        <button disabled={busy} onClick={() => showHere(choice)}>📺 Show it here too</button>
        <p className="muted small">An extra screen: shows the same thing, with sound, but controls nothing.</p>
        <button className="link" onClick={() => setChoice(undefined)}>Cancel</button>
        {error && <p className="error">{error}</p>}
      </main>
    );
  }

  if (!code) {
    return (
      <main className="center">
        <h1>Taskmaster</h1>
        <button className="big" disabled={busy} onClick={() => void open(createSession)}>Start a session</button>
        <form className="resume" onSubmit={(e) => { e.preventDefault(); void resume(resumeCode); }}>
          <label>Or resume a session
            <input value={resumeCode} onChange={(e) => setResumeCode(e.target.value.toUpperCase().slice(0, 4))}
              maxLength={4} autoComplete="off" placeholder="ABCD" />
          </label>
          <button type="submit" disabled={busy || resumeCode.length !== 4}>{busy ? "Checking…" : "Resume"}</button>
        </form>
        {recent.length > 0 && (
          <section className="recent">
            <h2 className="muted small">Recent sessions</h2>
            <ul>
              {recent.map((r) => (
                <li key={r.code}>
                  <button disabled={busy} onClick={() => void resume(r.code, r.code)}>
                    <span className="recent-code">{r.code}</span>
                    <span className="muted small">{ago(r.at)}</span>
                  </button>
                </li>
              ))}
            </ul>
          </section>
        )}
        {lost && (
          <p className="error">
            Session {lost} was resumed on another screen.{" "}
            <button className="link" onClick={() => showHere(lost)}>📺 Show it here as an extra screen</button>
          </p>
        )}
        {error && <p className="error">{error}</p>}
      </main>
    );
  }
  if (!session) return <main className="center"><p>Loading…</p></main>;

  const { onStage, videoPlaying } = screenState(session);
  return (
    <>
      <Screen code={code} session={session}
        footer={<button className="link" onClick={() => { store.set(KEY, ""); setCode(""); }}>End session</button>} />
      <Jukebox code={code} jukebox={session.jukebox} duck={videoPlaying} showUi={!onStage} />
    </>
  );
}
