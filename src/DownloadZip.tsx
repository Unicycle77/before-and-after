import { useState } from "react";
import { CorsError, downloadAllMedia } from "./download";
import { GAMES } from "./games";
import type { Session } from "./types";

/** Saves every photo and video submitted in any of the session's games as one zip. */
export function DownloadZip({ code, session }: { code: string; session: Session }) {
  const players = session.players ?? {};
  const filesOf = (uid: string) => Object.values(GAMES).flatMap((game) => game.files(session, uid));
  const [progress, setProgress] = useState<[number, number]>();
  const [error, setError] = useState<string>();
  const fileCount = Object.keys(players).reduce((n, uid) => n + filesOf(uid).length, 0);

  async function run() {
    setError(undefined);
    setProgress([0, fileCount]);
    try {
      await downloadAllMedia(code, players, filesOf, (done, total) => setProgress([done, total]));
    } catch (e) {
      setError(
        e instanceof CorsError ? `${e.message} See "Downloading everything" in the README.`
          : e instanceof Error ? e.message : "Download failed.",
      );
    } finally {
      setProgress(undefined);
    }
  }

  return (
    <div className="download">
      <button disabled={fileCount === 0 || !!progress} onClick={() => void run()}>
        {progress ? `Zipping ${progress[0]} / ${progress[1]}…` : `⬇ Download all photos & videos (${fileCount})`}
      </button>
      {error && <p className="error small">{error}</p>}
    </div>
  );
}
