import { onAuthStateChanged, signInAnonymously, type User } from "firebase/auth";
import { get, onValue, ref, remove, serverTimestamp, set, update } from "firebase/database";
import { useEffect, useState } from "react";
import { auth, db } from "./firebase";
import { GAME_IDS, type BeforeAfterMedia, type Display, type GameId, type Jukebox, type Session } from "./types";

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

/**
 * Main screen: picks up an existing session by its code, e.g. after "End session" or on another computer.
 * Taking it over moves `hostUid` to this browser, which sends the previous screen back to its start page.
 */
export async function resumeSession(rawCode: string): Promise<string> {
  const code = rawCode.trim().toUpperCase();
  const user = await ensureSignedIn();
  const hostUid = await get(ref(db(), `sessions/${code}/hostUid`));
  if (!hostUid.exists()) throw new JoinError(`No session found for code ${code}.`);
  if (hostUid.val() !== user.uid) await set(ref(db(), `sessions/${code}/hostUid`), user.uid);
  return code;
}

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
    await clearSubmissions(code, user.uid);
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
  if (current === user.uid) return code; // this phone already holds the slot
  try {
    await set(ref(db(), `sessions/${code}/controllerUid`), user.uid);
  } catch {
    throw new JoinError("Couldn't connect as host — someone else just did.");
  }
  return code;
}

/** Main screen: disconnects the current host remote so another phone can claim it. */
export const resetController = (code: string) => remove(ref(db(), `sessions/${code}/controllerUid`));

/** Host phone: gives up the remote slot, so the main screen shows the host QR again. */
export const releaseController = resetController;

/** Pulls a 4-char code from a scanned join URL (?code=ABCD) or a bare code. */
export function extractCode(text: string): string | null {
  try {
    const c = new URL(text).searchParams.get("code");
    if (c) return c.toUpperCase().slice(0, 4);
  } catch { /* not a URL */ }
  const t = text.trim().toUpperCase();
  return /^[A-Z0-9]{4}$/.test(t) ? t : null;
}

/** Clears what a player has submitted in every game (and any unlocks). */
const clearSubmissions = (code: string, uid: string) =>
  Promise.all(GAME_IDS.flatMap((game) => [
    remove(ref(db(), `sessions/${code}/games/${game}/media/${uid}`)),
    remove(ref(db(), `sessions/${code}/games/${game}/unlocked/${uid}`)),
  ]));

/** Removes a player *and* everything they submitted, so rejoining starts fresh. */
export const removePlayer = async (code: string, uid: string) => {
  await Promise.all([
    remove(ref(db(), `sessions/${code}/players/${uid}`)),
    clearSubmissions(code, uid),
  ]);
};

/**
 * Host: lets a player who has already submitted to a game send a new submission (or locks them again).
 * The player's phone clears the unlock itself once the new submission lands.
 */
export const setUnlocked = (code: string, game: GameId, uid: string, unlocked: boolean) => {
  const r = ref(db(), `sessions/${code}/games/${game}/unlocked/${uid}`);
  return unlocked ? set(r, true) : remove(r);
};

/** The game players see and the main screen shows; undefined on the game selection screen. */
export const activeGameId = (session: Session): GameId | undefined => session.game;

/**
 * Host: starts or switches to a game (players' phones switch to it, the main screen shows its lobby),
 * or with `null` goes back to the game selection screen. Nothing submitted to any game is lost.
 */
export const setGame = (code: string, game: GameId | null) =>
  update(ref(db(), `sessions/${code}`), { game, display: { step: "list" } });

/**
 * Main screen: moves a session from before there were games into the games layout, so it can be resumed.
 * Only the session's host can do this (it rewrites the whole session).
 */
export async function migrateLegacySession(code: string, session: Session): Promise<void> {
  if (!session.media && !session.unlocked) return;
  // They were playing Before & After, so carry on with it rather than landing on the game selection screen.
  const patch: Record<string, BeforeAfterMedia | boolean | string | null> = { media: null, unlocked: null, game: "beforeAfter" };
  for (const [uid, m] of Object.entries(session.media ?? {})) patch[`games/beforeAfter/media/${uid}`] = m;
  for (const [uid, u] of Object.entries(session.unlocked ?? {})) patch[`games/beforeAfter/unlocked/${uid}`] = u;
  await update(ref(db(), `sessions/${code}`), patch);
}

/** A player leaving on their own: same as being removed. */
export const leaveSession = removePlayer;

export const setDisplay = (code: string, display: Display) =>
  set(ref(db(), `sessions/${code}/display`), display);

export const setShowDownload = (code: string, show: boolean) =>
  set(ref(db(), `sessions/${code}/showDownload`), show);

export const setHideBlurbs = (code: string, hide: boolean) =>
  set(ref(db(), `sessions/${code}/hideBlurbs`), hide);

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
