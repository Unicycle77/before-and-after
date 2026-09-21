import { useEffect, useState } from "react";
import { StageControls } from "./StageControls";
import type { Display, Media, Player } from "./types";

// Layout units: one "unit" s = a 4:3 photo is 4s x 3s, plus a frame border of 0.3s on each side.
const PAIR_W = 9.6; // two framed photos (2 x 4.6s) + 0.4s gap
const CELL_H = 4.5; // framed photo (3.6s) + name plate (0.9s)
const PAD = 16;
const GAP = 14;

function useViewport() {
  const [size, setSize] = useState({ w: window.innerWidth, h: window.innerHeight });
  useEffect(() => {
    const onResize = () => setSize({ w: window.innerWidth, h: window.innerHeight });
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);
  return size;
}

/** Picks the column count that lets every player's pair be as large as possible. */
function bestLayout(count: number, w: number, h: number) {
  let best = { cols: 1, s: 0 };
  for (let cols = 1; cols <= Math.max(1, count); cols++) {
    const rows = Math.ceil(count / cols);
    const sw = (w - 2 * PAD - (cols - 1) * GAP) / cols / PAIR_W;
    const sh = (h - 2 * PAD - (rows - 1) * GAP) / rows / CELL_H;
    const s = Math.min(sw, sh);
    if (s > best.s + 0.01) best = { cols, s };
  }
  return { cols: best.cols, s: Math.max(6, Math.floor(best.s * 10) / 10) };
}

/** Every player's before and after (no videos) with their name, all on one screen. */
export function Review({ code, players, media, display }: {
  code: string; players: Record<string, Player>; media: Record<string, Media>; display: Display;
}) {
  const { w, h } = useViewport();
  const entries = Object.entries(players)
    .filter(([uid]) => media[uid]?.before || media[uid]?.after)
    .sort(([, a], [, b]) => (a.joinedAt ?? 0) - (b.joinedAt ?? 0));
  const { cols, s } = bestLayout(entries.length, w, h);

  return (
    <main className="stage review">
      {entries.length === 0 ? (
        <p className="muted">No photos to review yet.</p>
      ) : (
        <div className="review-grid" style={{ "--s": `${s}px`, gridTemplateColumns: `repeat(${cols}, auto)`, gap: GAP } as React.CSSProperties}>
          {entries.map(([uid, p], i) => (
            <div key={uid} className="review-cell" style={{ animationDelay: `${i * 0.08}s` }}>
              <div className="review-pair">
                <Pic src={media[uid]?.before} alt={`${p.name} before`} />
                <Pic src={media[uid]?.after} alt={`${p.name} after`} />
              </div>
              <div className="review-name">{p.name}</div>
            </div>
          ))}
        </div>
      )}
      <StageControls code={code} display={display} hasVideo={false} />
    </main>
  );
}

const Pic = ({ src, alt }: { src?: string; alt: string }) => (
  <div className="pic">{src ? <img src={src} alt={alt} /> : <span>no photo</span>}</div>
);
