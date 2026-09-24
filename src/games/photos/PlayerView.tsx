import { useEffect, useRef, useState } from "react";
import { submitMedia } from "../../media";
import { setUnlocked } from "../../session";
import { isLocked } from "../../submission";
import type { Session } from "../../types";
import { photoOf, photoStatus } from "./data";

/**
 * One photo per player, taken or chosen on the phone. Nothing is uploaded until they tap Submit;
 * once it's in they're locked until the host unlocks them, and a new photo locks them again.
 */
export function PlayerView({ code, uid, session }: { code: string; uid: string; session: Session }) {
  const photo = photoOf(session, uid);
  const unlocked = session.games?.photos?.unlocked?.[uid];
  const locked = isLocked(photoStatus(session, uid), unlocked);
  const [picked, setPicked] = useState<Picked>();
  const [progress, setProgress] = useState<number>();
  const [error, setError] = useState<string>();
  const camera = useRef<HTMLInputElement>(null);
  const library = useRef<HTMLInputElement>(null);
  const pickedRef = useRef<Picked>();
  pickedRef.current = picked;
  const uploading = progress !== undefined;

  useEffect(() => () => { if (pickedRef.current) URL.revokeObjectURL(pickedRef.current.url); }, []);

  // The host re-locked us before we submitted: drop the unsent photo.
  useEffect(() => { if (locked && !uploading) discard(); }, [locked]);

  function discard() {
    if (picked) URL.revokeObjectURL(picked.url);
    setPicked(undefined);
  }

  function choose(file: File | undefined) {
    if (!file) return;
    discard();
    setError(undefined);
    setPicked({ file, url: URL.createObjectURL(file) });
  }

  async function submit() {
    if (!picked) return;
    setError(undefined);
    setProgress(0);
    try {
      await submitMedia(code, "photos", uid, "photo", picked.file, setProgress);
      discard();
      if (unlocked) await setUnlocked(code, "photos", uid, false);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Upload failed. Try again.");
    } finally {
      setProgress(undefined);
    }
  }

  const shown = picked ? picked.url : photo;
  return (
    <section className="slot">
      <h2>Your photo {photo && !picked && !uploading ? "✓" : ""}</h2>
      {shown ? <img src={shown} alt="Your photo" /> : <div className="ph">No photo yet</div>}
      {picked && !uploading && !locked && <p className="slot-hint"><strong>Not submitted yet</strong> — tap Submit when you're happy.</p>}
      {uploading && <progress value={progress} max={1} />}

      {locked && !uploading ? (
        <p className="slot-hint">🔒 <strong>Submitted and locked.</strong> Ask the host if you need to change it.</p>
      ) : (
        <>
          {picked && <button className="big" disabled={uploading} onClick={() => void submit()}>{uploading ? "Submitting…" : "Submit"}</button>}
          <div className="row">
            <button disabled={uploading} onClick={() => camera.current?.click()}>{shown ? "Take another" : "Take photo"}</button>
            <button disabled={uploading} onClick={() => library.current?.click()}>Choose file</button>
          </div>
        </>
      )}
      <input ref={camera} type="file" accept="image/*" capture="environment" hidden onChange={(e) => { choose(e.target.files?.[0]); e.target.value = ""; }} />
      <input ref={library} type="file" accept="image/*" hidden onChange={(e) => { choose(e.target.files?.[0]); e.target.value = ""; }} />
      {error && <p className="error">{error}</p>}
    </section>
  );
}

interface Picked { file: File; url: string }
