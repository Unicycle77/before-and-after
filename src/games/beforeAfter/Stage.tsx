import { useEffect, useRef, useState } from "react";
import { Framed } from "../../Framed";
import { Review } from "../../Review";
import { SafeImg } from "../../SafeImg";
import { playableVideoUrl, preloadVideo } from "../../preload";
import { patchDisplay } from "../../session";
import type { Display, Session } from "../../types";
import { allMedia, mediaOf } from "./data";
import { StageControls } from "./StageControls";

/** Main screen: one player's before / after / video in a gold frame, or everyone's on one screen. */
export function Stage({ code, session, display, viewOnly }: { code: string; session: Session; display: Display; viewOnly: boolean }) {
  // Once a player is picked, start fetching their video in the background: by the time the host
  // gets to "Video" (after the before/after discussion) it plays instantly from memory.
  const video = display.uid ? mediaOf(session, display.uid).video : undefined;
  useEffect(() => { preloadVideo(video); }, [video]);

  if (display.step === "review" || !display.uid) {
    const media = allMedia(session);
    return (
      <Review players={session.players ?? {}} photosOf={(uid) => [media[uid]?.before, media[uid]?.after]} labels={["before", "after"]}>
        {!viewOnly && <StageControls code={code} display={display} hasVideo={false} />}
      </Review>
    );
  }

  const name = session.players?.[display.uid]?.name ?? "";
  const media = mediaOf(session, display.uid);
  const step = display.step;
  const both = step === "both";
  return (
    <main className={both ? "stage both" : "stage"}>
      {both ? (["before", "after"] as const).map((kind) => (
        <Framed key={kind}>
          {(setRatio) => (
            <SafeImg src={media[kind] ?? ""} alt={`${name} ${kind}`}
              onLoad={(e) => setRatio(e.currentTarget.naturalWidth / e.currentTarget.naturalHeight)}
              onFail={() => setRatio(4 / 3)} />
          )}
        </Framed>
      )) : step === "video" ? <Video key="video" src={media.video} playing={display.playing !== false} restartAt={display.restartAt}
          onEnded={() => { if (!viewOnly) void patchDisplay(code, { playing: false }); }} /> : step === "before" || step === "after" ? (
        <Framed key={step}>
          {(setRatio) => (
            <SafeImg src={media[step] ?? ""} alt={`${name} ${step}`}
              onLoad={(e) => setRatio(e.currentTarget.naturalWidth / e.currentTarget.naturalHeight)}
              onFail={() => setRatio(4 / 3)} />
          )}
        </Framed>
      ) : null}
      <div className="stage-label"><span>{both ? "before & after" : step}</span> · {name}</div>
      {!viewOnly && <StageControls code={code} display={display} hasVideo={!!media.video} />}
    </main>
  );
}

/**
 * Video with no on-screen controls: the host's phone drives play/pause/restart via
 * `display`. Chrome blocks autoplay with sound until the page has had a click; if that
 * happens we start muted (so the host's Play still works) and unmute on the next click.
 */
function Video({ src, playing, restartAt, onEnded }: { src?: string; playing: boolean; restartAt?: number; onEnded: () => void }) {
  const ref = useRef<HTMLVideoElement>(null);
  const [muted, setMuted] = useState(false);
  // Use the preloaded in-memory copy if it is ready when the video starts; never swap sources mid-play.
  const [playable] = useState(() => (src ? playableVideoUrl(src) : ""));

  useEffect(() => {
    const v = ref.current;
    if (!v) return;
    if (!playing) { v.pause(); return; }
    v.play().catch(() => {
      v.muted = true;
      setMuted(true);
      v.play().catch(() => {});
    });
  }, [playing, src]);

  useEffect(() => {
    if (restartAt && ref.current) ref.current.currentTime = 0;
  }, [restartAt]);

  useEffect(() => {
    if (!muted) return;
    const unmute = () => { if (ref.current) ref.current.muted = false; setMuted(false); };
    document.addEventListener("click", unmute, { once: true });
    document.addEventListener("keydown", unmute, { once: true });
    return () => {
      document.removeEventListener("click", unmute);
      document.removeEventListener("keydown", unmute);
    };
  }, [muted]);

  if (!src) return <p className="muted">No video was submitted.</p>;
  return (
    <>
      <Framed>
        {(setRatio) => (
          <video ref={ref} src={playable} playsInline onEnded={onEnded}
            onLoadedMetadata={(e) => setRatio(e.currentTarget.videoWidth / e.currentTarget.videoHeight)} />
        )}
      </Framed>
      {muted && <div className="sound-hint">🔇 Click anywhere on this screen once to turn the sound on</div>}
    </>
  );
}
