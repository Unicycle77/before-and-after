import { onValue, ref, remove, set } from "firebase/database";
import { useEffect, useState } from "react";
import { db } from "../../firebase";
import { setDisplay } from "../../session";
import type { BoxKey, BoxRound, BoxSecret, Session } from "../../types";
import { findObject } from "./objects";

export const roundOf = (session: Session): BoxRound | undefined => session.games?.box?.round;

/** "Carrot in a Box" once the host has picked the object; "[BLANK] in a Box" until then. */
export const titleOf = (round: BoxRound | undefined) => `${findObject(round?.object)?.name ?? "[BLANK]"} in a Box`;

/** Which box a player holds now: they start with their own (a: L, b: R) and trade them on a swap. */
export function boxOf(round: BoxRound, uid: string): BoxKey | undefined {
  const start: BoxKey | undefined = uid === round.players.a ? "L" : uid === round.players.b ? "R" : undefined;
  if (!start || round.decision !== "swap") return start;
  return start === "L" ? "R" : "L";
}

/** Who holds a box now. */
export const holderOf = (round: BoxRound, key: BoxKey): string =>
  (key === "L") === (round.decision !== "swap") ? round.players.a : round.players.b;

/** The player who decides: the one who can't peek. */
export const decider = (round: BoxRound): string => (round.peeker === round.players.a ? round.players.b : round.players.a);

/**
 * Which box holds the object. Only the host, the main screen and the peeker can read it (see the rules);
 * for anyone else, or before a round, this is null. Undefined while loading.
 */
export function useBoxSecret(code: string, enabled: boolean): BoxSecret | null | undefined {
  const [secret, setSecret] = useState<BoxSecret | null | undefined>(enabled ? undefined : null);
  useEffect(() => {
    if (!enabled) { setSecret(null); return; }
    setSecret(undefined);
    return onValue(ref(db(), `boxSecrets/${code}`), (s) => setSecret(s.exists() ? (s.val() as BoxSecret) : null), () => setSecret(null));
  }, [code, enabled]);
  return secret;
}

/** Host: sets up a round (the secret first, so the peeker can read it as soon as they're told they can peek). */
export async function startRound(code: string, round: Omit<BoxRound, "decision" | "revealed" | "startedAt">, inBox: BoxKey) {
  await set(ref(db(), `boxSecrets/${code}`), { inBox });
  await set(ref(db(), `sessions/${code}/games/box/round`), { ...round, startedAt: Date.now() });
  await setDisplay(code, { step: "boxes" });
}

/** The deciding player's one choice. */
export const decide = (code: string, choice: "swap" | "keep") =>
  set(ref(db(), `sessions/${code}/games/box/round/decision`), choice);

/** Host / main screen: opens a box on the stage, publishing what was in it. */
export const openBox = (code: string, key: BoxKey, inBox: BoxKey) =>
  set(ref(db(), `sessions/${code}/games/box/round/revealed/${key}`), key === inBox ? "object" : "empty");

/** Host: clears the round, ready to set up the next one. */
export async function newRound(code: string) {
  await setDisplay(code, { step: "list" });
  await Promise.all([remove(ref(db(), `sessions/${code}/games/box/round`)), remove(ref(db(), `boxSecrets/${code}`))]);
}
