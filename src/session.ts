import { onAuthStateChanged, signInAnonymously, type User } from "firebase/auth";
import { get, onDisconnect, onValue, ref, remove, serverTimestamp, set } from "firebase/database";
import { useEffect, useState } from "react";
import { auth, db } from "./firebase";
import type { Display, Session } from "./types";

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
  await set(ref(db(), `sessions/${code}/players/${user.uid}`), {
    name,
    joinedAt: serverTimestamp(),
    connected: true,
  });
  void onDisconnect(ref(db(), `sessions/${code}/players/${user.uid}/connected`)).set(false);
  // First to join becomes the remote-control host. The rule only allows this
  // write while the field is empty, so a PERMISSION_DENIED just means someone beat us.
  try {
    await set(ref(db(), `sessions/${code}/firstPlayerUid`), user.uid);
  } catch { /* already claimed */ }
  return code;
}

export const leaveSession = (code: string, uid: string) =>
  remove(ref(db(), `sessions/${code}/players/${uid}`));

export const removePlayer = async (code: string, uid: string) => {
  await remove(ref(db(), `sessions/${code}/players/${uid}`));
  await remove(ref(db(), `sessions/${code}/media/${uid}`));
};

export const setDisplay = (code: string, display: Display) =>
  set(ref(db(), `sessions/${code}/display`), display);

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
