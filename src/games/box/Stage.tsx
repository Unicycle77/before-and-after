import { useEffect, useState } from "react";
import { setDisplay } from "../../session";
import { useStageBarVisible } from "../../stageBar";
import type { BoxKey, BoxRound, Display, Session } from "../../types";
import { decider, holderOf, openBox, roundOf, titleOf, useBoxSecret } from "./data";
import { BOX_ART, findObject } from "./objects";

/** How long the decision is announced before the boxes change places, and how long they take. */
const PAUSE_MS = 1600;
const CROSS_MS = 1500;

/** Main screen: the two boxes side by side, the players' names under them, then the swap and the reveals. */
export function Stage({ code, session, viewOnly }: { code: string; session: Session; display: Display; viewOnly: boolean }) {
  const round = roundOf(session);
  const nameOf = (uid: string) => session.players?.[uid]?.name ?? "?";
  if (!round) {
    return (
      <main className="stage boxes">
        <p className="muted">Waiting for the host to set up the boxes…</p>
        {!viewOnly && <StageControls code={code} round={undefined} nameOf={nameOf} />}
      </main>
    );
  }
  // A new round starts from scratch (boxes back in place, no animation).
  return <Round key={round.startedAt} code={code} round={round} nameOf={nameOf} viewOnly={viewOnly} />;
}

function Round({ code, round, nameOf, viewOnly }: { code: string; round: BoxRound; nameOf: (uid: string) => string; viewOnly: boolean }) {
  const object = findObject(round.object);
  // Where the boxes are drawn. A screen that opens after the decision shows them already swapped;
  // one that is watching announces the decision, pauses, then moves the boxes across.
  const [swapped, setSwapped] = useState(round.decision === "swap");
  const [crossing, setCrossing] = useState(false);
  useEffect(() => {
    if (round.decision !== "swap" || swapped) return;
    const start = window.setTimeout(() => { setSwapped(true); setCrossing(true); }, PAUSE_MS);
    const end = window.setTimeout(() => setCrossing(false), PAUSE_MS + CROSS_MS);
    return () => { window.clearTimeout(start); window.clearTimeout(end); };
  }, [round.decision]);

  const who = nameOf(decider(round));
  return (
    <main className="stage boxes">
      <h1 className="box-title">{titleOf(round)}</h1>
      {round.decision && (
        <div className="box-announce">{round.decision === "swap" ? `${who} swapped!` : `${who} kept their box.`}</div>
      )}
      <div className="box-table" style={{ "--cross-ms": `${CROSS_MS}ms` } as React.CSSProperties}>
        {(["L", "R"] as const).map((key) => {
          const right = (key === "R") !== swapped;
          return (
            <div key={key} className={`box-spot ${right ? "right" : "left"}${crossing ? (key === "L" ? " cross-over" : " cross-under") : ""}`}>
              <BoxFace revealed={round.revealed?.[key]} objectName={object?.name ?? "?"} objectUrl={object?.url} />
            </div>
          );
        })}
        {([["left", round.players.a], ["right", round.players.b]] as const).map(([side, uid]) => (
          <div key={side} className={`box-name ${side}`}>{nameOf(uid)}{uid === round.peeker && <span title="Looked inside"> 👀</span>}</div>
        ))}
      </div>
      {!viewOnly && <StageControls code={code} round={round} nameOf={nameOf} />}
    </main>
  );
}

/** A box: closed, or opened to show what was inside (the object, or nothing). */
function BoxFace({ revealed, objectName, objectUrl }: { revealed?: "object" | "empty"; objectName: string; objectUrl?: string }) {
  // The frame hugs the picture: it's sized from the picture's shape, known once it loads.
  const [ratio, setRatio] = useState<number>();
  if (revealed === "object") {
    return (
      <div className="box-reveal">
        <div className={ratio ? "box-prize ready" : "box-prize"} style={ratio ? ({ "--r": ratio } as React.CSSProperties) : undefined}>
          <img src={objectUrl} alt={objectName}
            onLoad={(e) => setRatio(e.currentTarget.naturalWidth / e.currentTarget.naturalHeight || 1)}
            onError={() => setRatio(1)} />
        </div>
        <div className="box-result">{objectName}!</div>
      </div>
    );
  }
  if (revealed === "empty") {
    return (
      <div className="box-reveal">
        <img className="box-art" src={BOX_ART.open} alt="An empty box" />
        <div className="box-result">Empty!</div>
      </div>
    );
  }
  return <img className="box-art" src={BOX_ART.closed} alt="A closed box" />;
}

/**
 * Backup controls for the main screen (the host phone does the same). Keys:
 *   1 / 2 = open the left / right box     Esc or Backspace = back to players
 */
function StageControls({ code, round, nameOf }: { code: string; round: BoxRound | undefined; nameOf: (uid: string) => string }) {
  const visible = useStageBarVisible();
  const secret = useBoxSecret(code, !!round);
  const leftKey: BoxKey = round?.decision === "swap" ? "R" : "L";
  const keys: BoxKey[] = [leftKey, leftKey === "L" ? "R" : "L"];
  const canOpen = (key: BoxKey) => !!round?.decision && !round.revealed?.[key] && !!secret;
  const open = (key: BoxKey) => { if (canOpen(key) && secret) void openBox(code, key, secret.inBox); };
  const back = () => void setDisplay(code, { step: "list" });

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      switch (e.key) {
        case "1": open(keys[0]!); break;
        case "2": open(keys[1]!); break;
        case "Escape": case "Backspace": back(); break;
        default: return;
      }
      e.preventDefault();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  const tab = visible ? 0 : -1;
  return (
    <div className={visible ? "stage-controls show" : "stage-controls"} aria-hidden={!visible}>
      {round && keys.map((key) => (
        <button key={key} disabled={!canOpen(key)} onClick={() => open(key)} tabIndex={tab}>Open {nameOf(holderOf(round, key))}'s box</button>
      ))}
      <button onClick={back} tabIndex={tab}>← Players</button>
    </div>
  );
}
