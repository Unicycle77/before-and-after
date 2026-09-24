import { useEffect } from "react";
import { patchDisplay, setDisplay } from "../../session";
import { useStageBarVisible } from "../../stageBar";
import type { Display } from "../../types";

type StageStep = "before" | "after" | "both" | "video";
const ORDER: StageStep[] = ["before", "after", "both", "video"];
const LABEL: Record<StageStep, string> = { before: "Before", after: "After", both: "◫ Side by side", video: "▶ Video" };

/**
 * Backup controls for the main screen, for when someone clicks around on it instead of
 * using the host phone. Hidden until the mouse moves (then fades out again), plus keys:
 *   1 2 3 4 = Before / After / Side by side / Video     ← → = previous / next
 *   Space = play/pause video     R = restart video     Esc or Backspace = back to players
 */
export function StageControls({ code, display, hasVideo }: { code: string; display: Display; hasVideo: boolean }) {
  const uid = display.uid;
  const step = display.step as StageStep;
  const visible = useStageBarVisible();

  const review = display.step === "review";
  const available = ORDER.filter((s) => s !== "video" || hasVideo);
  const go = (next: StageStep) => { if (uid) void setDisplay(code, { uid, step: next, ...(next === "video" ? { playing: true } : {}) }); };
  const back = () => void setDisplay(code, { step: "list" });

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      if (review && e.key !== "Escape" && e.key !== "Backspace") return;
      const idx = available.indexOf(step);
      switch (e.key) {
        case "1": go("before"); break;
        case "2": go("after"); break;
        case "3": go("both"); break;
        case "4": if (hasVideo) go("video"); break;
        case "ArrowRight": case "PageDown": { const n = available[idx + 1]; if (n) go(n); break; }
        case "ArrowLeft": case "PageUp": { const p = available[idx - 1]; if (p) go(p); break; }
        case " ":
          if (step !== "video") return;
          void patchDisplay(code, { playing: display.playing === false });
          break;
        case "r": case "R":
          if (step === "video") void patchDisplay(code, { playing: true, restartAt: Date.now() });
          break;
        case "Escape": case "Backspace": back(); break;
        default: return;
      }
      e.preventDefault();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  return (
    <div className={visible ? "stage-controls show" : "stage-controls"} aria-hidden={!visible}>
      {!review && available.map((s) => (
        <button key={s} className={s === step ? "active" : ""} onClick={() => go(s)} tabIndex={visible ? 0 : -1}>{LABEL[s]}</button>
      ))}
      {!review && step === "video" && (
        <>
          <button onClick={() => void patchDisplay(code, { playing: display.playing === false })} tabIndex={visible ? 0 : -1}>
            {display.playing === false ? "▶ Play" : "⏸ Pause"}
          </button>
          <button onClick={() => void patchDisplay(code, { playing: true, restartAt: Date.now() })} tabIndex={visible ? 0 : -1}>↺ Restart</button>
        </>
      )}
      <button onClick={back} tabIndex={visible ? 0 : -1}>← Players</button>
    </div>
  );
}
