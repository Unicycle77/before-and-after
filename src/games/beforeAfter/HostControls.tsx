import { patchDisplay, setDisplay } from "../../session";
import type { Display, Session } from "../../types";
import { allMedia, mediaOf } from "./data";

/** The host's phone, with a player picked: choose what the main screen shows (before / after / side by side / video). */
export function HostPlayer({ code, session, display, uid }: { code: string; session: Session; display: Display; uid: string }) {
  const show = (step: "before" | "after" | "both") => void setDisplay(code, { uid, step });
  const cls = (step: string) => (display.step === step ? "step active" : "step");
  const hasVideo = !!mediaOf(session, uid).video;
  return (
    <>
      <div className="steps two">
        <button className={cls("before")} onClick={() => show("before")}>Before</button>
        <button className={cls("after")} onClick={() => show("after")}>After</button>
      </div>
      <div className="steps">
        <button className={cls("both")} onClick={() => show("both")}>◫ Side by side</button>
      </div>
      <div className="steps">
        <button className={cls("video")} disabled={!hasVideo} onClick={() => void setDisplay(code, { uid, step: "video", playing: true })}>
          {hasVideo ? "▶ Video" : "No video submitted"}
        </button>
      </div>
      {/* Always rendered, so every control keeps its position on every view. */}
      <div className="steps two">
        <button disabled={display.step !== "video"} onClick={() => void patchDisplay(code, { playing: display.playing === false })}>
          {display.step === "video" && display.playing === false ? "▶ Play" : "⏸ Pause"}
        </button>
        <button disabled={display.step !== "video"} onClick={() => void patchDisplay(code, { playing: true, restartAt: Date.now() })}>↺ Restart</button>
      </div>
    </>
  );
}

/** The host's phone, above the player list: everyone's before & after on one screen. */
export function HostLobby({ code, session, display }: { code: string; session: Session; display: Display }) {
  const media = allMedia(session);
  return (
    <div className="steps">
      <button
        className={display.step === "review" ? "step active" : "step"}
        disabled={!Object.keys(session.players ?? {}).some((uid) => media[uid]?.before || media[uid]?.after)}
        onClick={() => void setDisplay(code, display.step === "review" ? { step: "list" } : { step: "review" })}
      >
        {display.step === "review" ? "✕ Close review" : "◫ Review everyone"}
      </button>
    </div>
  );
}
