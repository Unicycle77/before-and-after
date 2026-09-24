import { useEffect } from "react";
import { Framed } from "../../Framed";
import { Review } from "../../Review";
import { SafeImg } from "../../SafeImg";
import { setDisplay } from "../../session";
import { useStageBarVisible } from "../../stageBar";
import type { Display, Session } from "../../types";
import { allPhotos, neighbour, photoOf } from "./data";

/** Main screen: one player's photo in a gold frame, or everyone's on one screen. */
export function Stage({ code, session, display }: { code: string; session: Session; display: Display }) {
  const controls = <StageControls code={code} session={session} display={display} />;

  if (display.step === "grid" || !display.uid) {
    const photos = allPhotos(session);
    return <Review players={session.players ?? {}} photosOf={(uid) => [photos[uid]?.photo]} labels={["photo"]}>{controls}</Review>;
  }

  const name = session.players?.[display.uid]?.name ?? "";
  return (
    <main className="stage">
      {/* keyed by player, so each new photo is hung fresh */}
      <Framed key={display.uid}>
        {(setRatio) => (
          <SafeImg src={photoOf(session, display.uid!) ?? ""} alt={`${name} photo`}
            onLoad={(e) => setRatio(e.currentTarget.naturalWidth / e.currentTarget.naturalHeight)}
            onFail={() => setRatio(4 / 3)} />
        )}
      </Framed>
      <div className="stage-label"><span>photo</span> · {name}</div>
      {controls}
    </main>
  );
}

/**
 * Backup controls for the main screen (see Before & After's StageControls). Keys:
 *   ← → = previous / next player's photo     Esc or Backspace = back to players
 */
function StageControls({ code, session, display }: { code: string; session: Session; display: Display }) {
  const visible = useStageBarVisible();
  const uid = display.uid;
  const prev = uid ? neighbour(session, uid, -1) : undefined;
  const next = uid ? neighbour(session, uid, 1) : undefined;
  const show = (target: string | undefined) => { if (target) void setDisplay(code, { uid: target, step: "photo" }); };
  const back = () => void setDisplay(code, { step: "list" });

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      switch (e.key) {
        case "ArrowRight": case "PageDown": show(next); break;
        case "ArrowLeft": case "PageUp": show(prev); break;
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
      {uid && (
        <>
          <button disabled={!prev} onClick={() => show(prev)} tabIndex={tab}>Previous</button>
          <button disabled={!next} onClick={() => show(next)} tabIndex={tab}>Next</button>
          <button onClick={() => void setDisplay(code, { step: "grid" })} tabIndex={tab}>◫ Everyone</button>
        </>
      )}
      <button onClick={back} tabIndex={tab}>← Players</button>
    </div>
  );
}
