import { onAuthStateChanged, signInAnonymously, type User } from "firebase/auth";
import { get, onValue, ref, remove, serverTimestamp, set, update } from "firebase/database";
import { useEffect, useState } from "react";
import { auth, db } from "./firebase";
import type { Display, Jukebox, Session } from "./types";

let signIn: Promise<User> | undefined;

/** Anonymous auth; the uid persists in the browser so refreshes keep identity. */
export function ensureSignedIn(): Promise<User> {
  const a = auth();
  signIn ??= new Promise<User>((resolve, reject) => {
    const unsub = onAuthStateChanged(a, (user) => {
      if (user) {
        unsub();
        resolve(user);
      }
    });
    // If a persisted user exists, onAuthStateChanged fires with it; otherwise create one.
    a.authStateReady().then(() => {
      if (!a.currentUser) signInAnonymously(a).catch((e: unknown) => { signIn = undefined; reject(e); });
    });
  });
  return signIn;
}

export function useUid(): string | undefined {
  const [uid, setUid] = useState<string>();
  useEffect(() => {
    let live = true;
    ensureSignedIn().then((u) => live && setUid(u.uid), () => {});
    return () => { live = false; };
  }, []);
  return uid;
}

// Excludes visually ambiguous characters: 0/O, 1/I/L.
const ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";

async function freeCode(): Promise<string> {
  for (let i = 0; i < 25; i++) {
    let code = "";
    for (let j = 0; j < 4; j++) code += ALPHABET[Math.floor(Math.random() * ALPHABET.length)];
    if (!(await get(ref(db(), `sessions/${code}/hostUid`))).exists()) return code;
  }
  throw new Error("Could not find a free session code, please try again.");
}

/** Main screen: creates a session and returns its code. */
export async function createSession(): Promise<string> {
  const user = await ensureSignedIn();
  const code = await freeCode();
  await set(ref(db(), `sessions/${code}`), {
    hostUid: user.uid,
    createdAt: serverTimestamp(),
    display: { step: "list" },
  });
  return code;
}

export class JoinError extends Error {}

export async function joinSession(rawCode: string, rawName: string): Promise<string> {
  const code = rawCode.trim().toUpperCase();
  const name = rawName.trim();
  if (!name) throw new JoinError("Please enter a name.");
  const user = await ensureSignedIn();
  if (!(await get(ref(db(), `sessions/${code}/hostUid`))).exists()) {
    throw new JoinError(`No session found for code ${code}.`);
  }
  // A brand-new player starts clean: clear anything left behind by an earlier stint or a partial removal.
  // (Someone reconnecting with their player record still in place keeps their submission.)
  if (!(await get(ref(db(), `sessions/${code}/players/${user.uid}`))).exists()) {
    await remove(ref(db(), `sessions/${code}/media/${user.uid}`));
  }
  await set(ref(db(), `sessions/${code}/players/${user.uid}`), {
    name,
    joinedAt: serverTimestamp(),
  });
  return code;
}

/** Host phone: connects to a session as its remote controller (one per session). */
export async function claimController(rawCode: string): Promise<string> {
  const code = rawCode.trim().toUpperCase();
  const user = await ensureSignedIn();
  const snap = await get(ref(db(), `sessions/${code}`));
  if (!snap.exists()) throw new JoinError(`No session found for code ${code}.`);
  const current = (snap.val() as Session).controllerUid;
  if (current && current !== user.uid) {
    throw new JoinError("This session already has a host remote. Ask for it to be reset on the main screen.");
  }
  try {
    await set(ref(db(), `sessions/${code}/controllerUid`), user.uid);
  } catch {
    throw new JoinError("Couldn't connect as host — someone else just did.");
  }
  return code;
}

/** Main screen: disconnects the current host remote so another phone can claim it. */
export const resetController = (code: string) => remove(ref(db(), `sessions/${code}/controllerUid`));

/** Pulls a 4-char code from a scanned join URL (?code=ABCD) or a bare code. */
export function extractCode(text: string): string | null {
  try {
    const c = new URL(text).searchParams.get("code");
    if (c) return c.toUpperCase().slice(0, 4);
  } catch { /* not a URL */ }
  const t = text.trim().toUpperCase();
  return /^[A-Z0-9]{4}$/.test(t) ? t : null;
}

/** Removes a player *and* their submitted video/photos, so rejoining starts fresh. */
export const removePlayer = async (code: string, uid: string) => {
  await Promise.all([
    remove(ref(db(), `sessions/${code}/players/${uid}`)),
    remove(ref(db(), `sessions/${code}/media/${uid}`)),
  ]);
};

/** A player leaving on their own: same as being removed. */
export const leaveSession = removePlayer;

export const setDisplay = (code: string, display: Display) =>
  set(ref(db(), `sessions/${code}/display`), display);

export const setShowDownload = (code: string, show: boolean) =>
  set(ref(db(), `sessions/${code}/showDownload`), show);

/** Main screen: publishes the song titles found in the chosen music folder. */
export const publishTracks = (code: string, titles: string[]) =>
  set(ref(db(), `sessions/${code}/jukebox/tracks`), titles);

/** Main screen: publishes song lengths in seconds (same order as the titles); null clears them. */
export const publishDurations = (code: string, seconds: number[] | null) =>
  set(ref(db(), `sessions/${code}/jukebox/durations`), seconds);

/** Changes part of the jukebox playback state (current song, playing, volume). */
export const setJukeboxState = (code: string, patch: Partial<NonNullable<Jukebox["state"]>>) =>
  update(ref(db(), `sessions/${code}/jukebox/state`), patch);

/** Changes part of the display (e.g. play/pause) without resetting the rest. */
export const patchDisplay = (code: string, patch: Partial<Display>) =>
  update(ref(db(), `sessions/${code}/display`), patch);

/** `undefined` while loading, `null` if the session doesn't exist. */
export function useSession(code: string | undefined): Session | null | undefined {
  const [session, setSession] = useState<Session | null | undefined>();
  useEffect(() => {
    setSession(undefined);
    if (!code) return;
    return onValue(ref(db(), `sessions/${code}`), (s) => setSession(s.exists() ? (s.val() as Session) : null));
  }, [code]);
  return session;
}

/** Safe localStorage wrapper (private mode can throw). */
export const store = {
  get: (k: string) => { try { return localStorage.getItem(k) ?? ""; } catch { return ""; } },
  set: (k: string, v: string) => { try { v ? localStorage.setItem(k, v) : localStorage.removeItem(k); } catch { /* ignore */ } },
};
