import { useState } from "react";
import type { Session } from "../../types";
import { boxOf, decide, decider, roundOf, titleOf, useBoxSecret } from "./data";
import { BOX_ART, findObject } from "./objects";

/**
 * A player's phone. The two players in the round see their box: the peeker may look inside it as often
 * as they like until the decision; the other player chooses, once, to swap boxes or keep theirs.
 * Everyone else watches the main screen.
 */
export function PlayerView({ code, uid, session }: { code: string; uid: string; session: Session }) {
  const round = roundOf(session);
  const nameOf = (id: string) => session.players?.[id]?.name ?? "?";
  const isPeeker = !!round && round.peeker === uid;
  // Only the peeker is allowed to read which box holds the object.
  const secret = useBoxSecret(code, isPeeker);
  // Which round the box is open in, so a peek never carries over into the next round.
  const [peekedRound, setPeekedRound] = useState<number>();
  const peeking = !!round && peekedRound === round.startedAt;
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string>();

  if (!round) {
    return (
      <section className="slot">
        <h2>{titleOf(round)}</h2>
        <p className="slot-hint">Waiting for the host to pick two players…</p>
      </section>
    );
  }

  const title = titleOf(round);
  const mine = boxOf(round, uid);
  const { a, b } = round.players;
  if (!mine) {
    return (
      <section className="slot">
        <h2>{title}</h2>
        <p className="slot-hint"><strong>{nameOf(a)}</strong> and <strong>{nameOf(b)}</strong> are playing. Watch the main screen!</p>
      </section>
    );
  }

  const object = findObject(round.object);
  const objectName = object?.name ?? "?";
  const other = nameOf(uid === a ? b : a);
  const deciderName = nameOf(decider(round));
  const opened = round.revealed?.[mine];
  const hasObject = secret ? secret.inBox === mine : undefined;

  async function choose(choice: "swap" | "keep") {
    const question = choice === "swap" ? `Swap boxes with ${other}? You can't change your mind.` : `Keep your box? You can't change your mind.`;
    if (!confirm(question)) return;
    setBusy(true);
    setError(undefined);
    try { await decide(code, choice); }
    catch { setError("That didn't go through. Try again."); }
    finally { setBusy(false); }
  }

  // What the phone shows of the box: opened on the stage, peeked into, or closed.
  const showInside = opened !== undefined || (isPeeker && peeking && !round.decision && hasObject !== undefined);
  const inside = opened ? opened === "object" : hasObject;

  return (
    <section className="slot">
      <h2>{title}</h2>
      {showInside ? (
        inside ? (
          <>
            <img className="box-peek" src={object?.url} alt={objectName} />
            <p className="slot-hint"><strong>The {objectName.toLowerCase()} is in your box!</strong></p>
          </>
        ) : (
          <>
            <img className="box-art" src={BOX_ART.open} alt="An empty box" />
            <p className="slot-hint"><strong>Your box is empty.</strong></p>
          </>
        )
      ) : (
        <img className="box-art" src={BOX_ART.closed} alt="Your box, closed" />
      )}

      {opened === undefined && (isPeeker ? (
        round.decision ? (
          <p className="slot-hint">
            {round.decision === "swap" ? <>{deciderName} <strong>swapped</strong>: you now have their box.</> : <>{deciderName} <strong>kept their box</strong>.</>}
            {" "}Watch the main screen!
          </p>
        ) : (
          <>
            <p className="slot-hint">Only you can look inside. {other} has to decide whether to swap boxes with you.</p>
            <button className="big" disabled={hasObject === undefined} onClick={() => setPeekedRound(peeking ? undefined : round.startedAt)}>
              {peeking ? "Close the box" : "👀 Peek inside"}
            </button>
          </>
        )
      ) : (
        round.decision ? (
          <p className="slot-hint">🔒 <strong>{round.decision === "swap" ? `You swapped boxes with ${other}.` : "You kept your box."}</strong> Watch the main screen!</p>
        ) : (
          <>
            <p className="slot-hint">{other} has looked inside their box. The {objectName.toLowerCase()} is in one of the two boxes: swap boxes with {other}, or keep yours? You only get one go.</p>
            <div className="row">
              <button disabled={busy} onClick={() => void choose("swap")}>Swap boxes</button>
              <button disabled={busy} onClick={() => void choose("keep")}>Keep my box</button>
            </div>
          </>
        )
      ))}
      {opened !== undefined && <p className="slot-hint">Your box has been opened on the main screen.</p>}
      {error && <p className="error">{error}</p>}
    </section>
  );
}
