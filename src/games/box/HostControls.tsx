import { useState } from "react";
import { setDisplay } from "../../session";
import type { BoxKey, BoxRound, Display, Session } from "../../types";
import { decider, holderOf, newRound, openBox, roundOf, startRound, titleOf, useBoxSecret } from "./data";
import { OBJECTS, findObject } from "./objects";

/** Not used: this game never shows one player on their own. */
export const HostPlayer = () => null;

/** The host's phone, above the player list: set up a round, then follow it and open the boxes. */
export function HostLobby({ code, session, display }: { code: string; session: Session; display: Display }) {
  const round = roundOf(session);
  return round
    ? <RoundControls code={code} session={session} display={display} round={round} />
    : <Setup code={code} session={session} />;
}

type Placement = "random" | "a" | "b";

function Setup({ code, session }: { code: string; session: Session }) {
  const players = Object.entries(session.players ?? {}).sort(([, x], [, y]) => (x.joinedAt ?? 0) - (y.joinedAt ?? 0));
  const nameOf = (uid: string) => session.players?.[uid]?.name ?? "?";
  const [object, setObject] = useState(OBJECTS[0]?.id);
  // The two players, left then right on the stage. Picking a third replaces the earlier pick.
  const [chosen, setChosen] = useState<string[]>([]);
  const [peeker, setPeeker] = useState<string>();
  const [placement, setPlacement] = useState<Placement>("random");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string>();

  const here = chosen.filter((uid) => session.players?.[uid]);
  const toggle = (uid: string) => setChosen((c) => (c.includes(uid) ? c.filter((x) => x !== uid) : [...c, uid].slice(-2)));
  const [a, b] = here;
  const ready = !!object && !!a && !!b && !!peeker && here.includes(peeker);
  const objectName = findObject(object)?.name ?? "[BLANK]";

  async function start() {
    if (!ready || !object || !a || !b || !peeker) return;
    const inBox: BoxKey = placement === "a" ? "L" : placement === "b" ? "R" : Math.random() < 0.5 ? "L" : "R";
    setBusy(true);
    setError(undefined);
    try { await startRound(code, { object, players: { a, b }, peeker }, inBox); }
    catch { setError("Couldn't start the round. Try again."); }
    finally { setBusy(false); }
  }

  return (
    <div className="box-setup">
      <p className="muted small">1. What's in the box?</p>
      <div className="steps two">
        {OBJECTS.map((o) => (
          <button key={o.id} className={o.id === object ? "step active box-object" : "step box-object"} onClick={() => setObject(o.id)}>
            <img src={o.url} alt="" />{o.name}
          </button>
        ))}
      </div>
      <p className="muted small">2. Pick two players{here.length === 2 ? "" : ` (${here.length} of 2)`}</p>
      {players.length < 2 && <p className="muted small">Waiting for at least two players to join…</p>}
      <div className="steps two">
        {players.map(([uid, p]) => (
          <button key={uid} className={here.includes(uid) ? "step active" : "step"} onClick={() => toggle(uid)}>{p.name}</button>
        ))}
      </div>
      {a && b && (
        <>
          <p className="muted small">3. Who can look inside their box?</p>
          <div className="steps two">
            {[a, b].map((uid) => (
              <button key={uid} className={uid === peeker ? "step active" : "step"} onClick={() => setPeeker(uid)}>👀 {nameOf(uid)}</button>
            ))}
          </div>
          <p className="muted small">4. Whose box is the {objectName.toLowerCase()} in?</p>
          <div className="steps three">
            <button className={placement === "a" ? "step active" : "step"} onClick={() => setPlacement("a")}>{nameOf(a)}</button>
            <button className={placement === "random" ? "step active" : "step"} onClick={() => setPlacement("random")}>🎲 Random</button>
            <button className={placement === "b" ? "step active" : "step"} onClick={() => setPlacement("b")}>{nameOf(b)}</button>
          </div>
        </>
      )}
      <button className="big" disabled={!ready || busy} onClick={() => void start()}>{busy ? "Starting…" : `Start ${objectName} in a Box`}</button>
      {error && <p className="error">{error}</p>}
    </div>
  );
}

function RoundControls({ code, session, display, round }: { code: string; session: Session; display: Display; round: BoxRound }) {
  const nameOf = (uid: string) => session.players?.[uid]?.name ?? "?";
  const secret = useBoxSecret(code, true);
  const objectName = findObject(round.object)?.name ?? "?";
  const who = nameOf(decider(round));
  // The boxes in the order they stand on the stage now (left, right).
  const leftKey: BoxKey = round.decision === "swap" ? "R" : "L";
  const keys: BoxKey[] = [leftKey, leftKey === "L" ? "R" : "L"];
  const allOpen = !!round.revealed?.L && !!round.revealed?.R;
  const onStage = display.step === "boxes";

  return (
    <div className="box-setup">
      <p><strong>{titleOf(round)}</strong>: {nameOf(round.players.a)} vs {nameOf(round.players.b)}. 👀 {nameOf(round.peeker)} can peek.</p>
      <p className="muted small">
        {secret ? `Only you can see this: the ${objectName.toLowerCase()} is in ${nameOf(holderOf(round, secret.inBox))}'s box.` : "Checking which box it's in…"}
      </p>
      <p>
        {round.decision
          ? (round.decision === "swap" ? `${who} swapped!` : `${who} kept their box.`)
          : `Waiting for ${who} to swap or keep…`}
      </p>
      <div className="steps two">
        {keys.map((key) => (
          <button key={key} disabled={!round.decision || !!round.revealed?.[key] || !secret}
            onClick={() => secret && void openBox(code, key, secret.inBox)}>
            {round.revealed?.[key] ? "✓ Opened" : `Open ${nameOf(holderOf(round, key))}'s box`}
          </button>
        ))}
      </div>
      <button onClick={() => void setDisplay(code, onStage ? { step: "list" } : { step: "boxes" })}>
        {onStage ? "Show the players on the main screen" : "Show the boxes on the main screen"}
      </button>
      <button className="link" onClick={() => { if (allOpen || confirm("Start a new round? This one hasn't finished.")) void newRound(code); }}>
        New round
      </button>
    </div>
  );
}
