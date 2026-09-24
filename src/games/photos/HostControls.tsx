import { setDisplay } from "../../session";
import type { Display, Session } from "../../types";
import { allPhotos, neighbour } from "./data";

/** The host's phone, with a player's photo on screen: step through everyone's, or show them all. */
export function HostPlayer({ code, session, uid }: { code: string; session: Session; display: Display; uid: string }) {
  const prev = neighbour(session, uid, -1);
  const next = neighbour(session, uid, 1);
  return (
    <>
      <div className="steps two">
        <button disabled={!prev} onClick={() => prev && void setDisplay(code, { uid: prev, step: "photo" })}>Previous</button>
        <button disabled={!next} onClick={() => next && void setDisplay(code, { uid: next, step: "photo" })}>Next</button>
      </div>
      <div className="steps">
        <button className="step" onClick={() => void setDisplay(code, { step: "grid" })}>◫ Show everyone</button>
      </div>
    </>
  );
}

/** The host's phone, above the player list: everyone's photo on one screen. */
export function HostLobby({ code, session, display }: { code: string; session: Session; display: Display }) {
  const photos = allPhotos(session);
  return (
    <div className="steps">
      <button
        className={display.step === "grid" ? "step active" : "step"}
        disabled={!Object.keys(session.players ?? {}).some((uid) => photos[uid]?.photo)}
        onClick={() => void setDisplay(code, display.step === "grid" ? { step: "list" } : { step: "grid" })}
      >
        {display.step === "grid" ? "✕ Close" : "◫ Show everyone"}
      </button>
    </div>
  );
}
