import { useState } from "react";
import { CorsError, downloadAllMedia } from "./download";
import type { Media, Player } from "./types";

/** Saves every submitted photo and video as one zip. */
export function DownloadZip({ code, players, media }: { code: string; players: Record<string, Player>; media: Record<string, Media> }) {
  const [progress, setProgress] = useState<[number, number]>();
  const [error, setError] = useState<string>();
  const fileCount = Object.keys(players).reduce((n, uid) => n + Object.keys(media[uid] ?? {}).length, 0);

  async function run() {
    setError(undefined);
    setProgress([0, fileCount]);
    try {
      await downloadAllMedia(code, players, media, (done, total) => setProgress([done, total]));
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
