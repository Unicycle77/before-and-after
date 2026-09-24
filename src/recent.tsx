import { store } from "./session";

/** A session this device has opened, newest first (kept in localStorage). */
export interface Recent { code: string; at: number }

/** Sessions this device has hosted as the main screen. */
export const HOSTED_KEY = "ba.recentSessions";
/** Sessions this device has watched as an extra screen. */
export const WATCHED_KEY = "ba.recentWatched";
/** Sessions this device has controlled as the host remote. */
export const REMOTE_KEY = "ba.recentRemote";
const MAX_RECENT = 6;

export function loadRecent(key: string): Recent[] {
  try {
    const list: unknown = JSON.parse(store.get(key) || "[]");
    return Array.isArray(list) ? list.filter((r): r is Recent => typeof r?.code === "string" && typeof r?.at === "number") : [];
  } catch { return []; }
}

export function saveRecent(key: string, list: Recent[]): Recent[] {
  store.set(key, list.length ? JSON.stringify(list) : "");
  return list;
}

/** Puts `code` at the front of the list (opened just now). */
export const withRecent = (list: Recent[], code: string): Recent[] =>
  [{ code, at: Date.now() }, ...list.filter((r) => r.code !== code)].slice(0, MAX_RECENT);

export const withoutRecent = (list: Recent[], code: string): Recent[] => list.filter((r) => r.code !== code);

/** Several lists as one, newest first, each session once. */
export function mergeRecent(...lists: Recent[][]): Recent[] {
  const newest = new Map<string, Recent>();
  for (const r of lists.flat()) if ((newest.get(r.code)?.at ?? -1) < r.at) newest.set(r.code, r);
  return [...newest.values()].sort((a, b) => b.at - a.at).slice(0, MAX_RECENT);
}

const agoFormat = new Intl.RelativeTimeFormat(undefined, { numeric: "auto" });
function ago(at: number): string {
  const mins = Math.round((at - Date.now()) / 60000);
  if (mins > -60) return agoFormat.format(mins, "minute");
  const hours = Math.round(mins / 60);
  if (hours > -24) return agoFormat.format(hours, "hour");
  return agoFormat.format(Math.round(hours / 24), "day");
}

/** The start pages' one-tap list of recent sessions. */
export function RecentList({ recent, busy, onPick }: { recent: Recent[]; busy: boolean; onPick: (code: string) => void }) {
  if (recent.length === 0) return null;
  return (
    <section className="recent">
      <h2 className="muted small">Recent sessions</h2>
      <ul>
        {recent.map((r) => (
          <li key={r.code}>
            <button disabled={busy} onClick={() => onPick(r.code)}>
              <span className="recent-code">{r.code}</span>
              <span className="muted small">{ago(r.at)}</span>
            </button>
          </li>
        ))}
      </ul>
    </section>
  );
}
