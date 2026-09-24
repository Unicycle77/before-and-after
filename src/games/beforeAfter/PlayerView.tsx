import { useEffect, useRef, useState } from "react";
import { submitMedia } from "../../media";
import { setUnlocked } from "../../session";
import { isLocked } from "../../submission";
import type { Session } from "../../types";
import { mediaOf, submissionStatus } from "./data";
import { FrameError, extractFrames } from "./frames";

/**
 * Once submitted, the player is locked until the host unlocks them; a new submission locks them again.
 *
 * The player's whole submission is one video. Its first and last frames become the Before and After
 * (grabbed on the phone the moment a video is chosen), shown above the video so the player can check
 * them. Nothing is uploaded until they tap Submit; there are no standalone photos.
 */
export function PlayerView({ code, uid, session }: { code: string; uid: string; session: Session }) {
  const mine = mediaOf(session, uid);
  const unlocked = session.games?.beforeAfter?.unlocked?.[uid];
  const locked = isLocked(submissionStatus(mine), unlocked);
  const [picked, setPicked] = useState<Picked>();
  const [checking, setChecking] = useState(false);
  const [progress, setProgress] = useState<number>();
  const [error, setError] = useState<string>();
  const [detail, setDetail] = useState<string>();
  const camera = useRef<HTMLInputElement>(null);
  const library = useRef<HTMLInputElement>(null);
  const pickedRef = useRef<Picked>();
  pickedRef.current = picked;
  const uploading = progress !== undefined;

  useEffect(() => () => { if (pickedRef.current) revokePicked(pickedRef.current); }, []);

  // The host re-locked us before we submitted: drop the unsent video.
  useEffect(() => { if (locked && !uploading) discard(); }, [locked]);

  function discard() {
    if (picked) revokePicked(picked);
    setPicked(undefined);
  }

  async function choose(file: File | undefined) {
    if (!file) return;
    discard();
    setError(undefined);
    setDetail(undefined);
    setChecking(true);
    try {
      const { first, last } = await extractFrames(file);
      setPicked({
        file, first, last,
        videoUrl: URL.createObjectURL(file), firstUrl: URL.createObjectURL(first), lastUrl: URL.createObjectURL(last),
      });
    } catch (e) {
      setError(e instanceof FrameError ? e.message : "We couldn't read that video. Please record it again.");
      setDetail(e instanceof FrameError ? e.detail : undefined);
    } finally {
      setChecking(false);
    }
  }

  async function submit() {
    if (!picked) return;
    setError(undefined);
    setProgress(0);
    try {
      await submitMedia(code, "beforeAfter", uid, "video", picked.file, setProgress);
      await Promise.all([
        submitMedia(code, "beforeAfter", uid, "before", picked.first, () => {}, { alreadySized: true }),
        submitMedia(code, "beforeAfter", uid, "after", picked.last, () => {}, { alreadySized: true }),
      ]);
      discard();
      if (unlocked) await setUnlocked(code, "beforeAfter", uid, false);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Upload failed. Try again.");
    } finally {
      setProgress(undefined);
    }
  }

  const beforeUrl = picked ? picked.firstUrl : mine.before;
  const afterUrl = picked ? picked.lastUrl : mine.after;
  const videoUrl = picked ? picked.videoUrl : mine.video;
  const submitted = !picked && !!mine.video && !!mine.before && !!mine.after;

  return (
    <>
      <section className="slot">
        <h2>Your Before &amp; After</h2>
        <div className="pair-preview">
          <figure>{beforeUrl ? <img src={beforeUrl} alt="Before" /> : <div className="ph">Before</div>}<figcaption>Before</figcaption></figure>
          <figure>{afterUrl ? <img src={afterUrl} alt="After" /> : <div className="ph">After</div>}<figcaption>After</figcaption></figure>
        </div>
        <p className="muted small slot-hint">
          {picked ? "Taken from the first and last frame of your video. Happy with them?"
            : "These are taken automatically from the first and last frame of your video."}
        </p>
      </section>

      <section className="slot">
        <h2>Your video {submitted && !uploading ? "✓" : ""}</h2>
        {!videoUrl && <p className="muted small slot-hint">Start on your Before, finish on your After.</p>}
        {videoUrl && <video src={videoUrl} controls playsInline preload="metadata" />}
        {checking && <p className="muted small slot-hint">Checking your video…</p>}
        {picked && !uploading && !locked && <p className="slot-hint"><strong>Not submitted yet</strong> — tap Submit when you're happy.</p>}
        {uploading && <progress value={progress} max={1} />}

        {locked && !uploading ? (
          <p className="slot-hint">🔒 <strong>Submitted and locked.</strong> Ask the host if you need to change it.</p>
        ) : (
          <>
            {picked && <button className="big" disabled={uploading} onClick={() => void submit()}>{uploading ? "Submitting…" : "Submit"}</button>}
            <div className="row">
              <button disabled={uploading || checking} onClick={() => camera.current?.click()}>{videoUrl ? "Record again" : "Record"}</button>
              <button disabled={uploading || checking} onClick={() => library.current?.click()}>Choose file</button>
            </div>
          </>
        )}
        <input ref={camera} type="file" accept="video/*" capture="environment" hidden onChange={(e) => { void choose(e.target.files?.[0]); e.target.value = ""; }} />
        <input ref={library} type="file" accept="video/*" hidden onChange={(e) => { void choose(e.target.files?.[0]); e.target.value = ""; }} />
        {error && <p className="error">{error}</p>}
        {detail && <p className="muted small tech-detail">Technical details (send to the host): {detail}</p>}
      </section>
    </>
  );
}

interface Picked { file: File; first: Blob; last: Blob; videoUrl: string; firstUrl: string; lastUrl: string }
const revokePicked = (p: Picked) => [p.videoUrl, p.firstUrl, p.lastUrl].forEach((u) => URL.revokeObjectURL(u));
