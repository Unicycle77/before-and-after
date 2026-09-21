import { useEffect, useState } from "react";

/**
 * An <img> that retries a couple of times if the load fails (Storage hiccups, a photo that
 * hasn't finished propagating), then shows a placeholder instead of the browser's broken-image icon.
 * `onFail` fires once it gives up so a parent waiting on `onLoad` can stop waiting.
 */
export function SafeImg({ src, alt, onLoad, onFail }: {
  src: string;
  alt: string;
  onLoad?: (e: React.SyntheticEvent<HTMLImageElement>) => void;
  onFail?: () => void;
}) {
  const [attempt, setAttempt] = useState(0);
  const [failed, setFailed] = useState(false);

  useEffect(() => { setAttempt(0); setFailed(false); }, [src]);

  if (failed) return <span className="img-failed">photo unavailable</span>;

  const url = attempt === 0 ? src : `${src}${src.includes("?") ? "&" : "?"}retry=${attempt}`;
  return (
    <img
      src={url}
      alt={alt}
      decoding="async"
      onLoad={onLoad}
      onError={() => {
        if (attempt < 2) window.setTimeout(() => setAttempt((a) => a + 1), 700 * (attempt + 1));
        else { setFailed(true); onFail?.(); }
      }}
    />
  );
}
