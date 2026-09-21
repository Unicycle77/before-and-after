import { useEffect, useState } from "react";
import { StageControls } from "./StageControls";
import type { Display, Media, Player } from "./types";

/*
 * Layout unit `s` (px): every photo is 3s tall; its width is 3s x its own aspect ratio, so the
 * gold frame hugs portrait, landscape and square photos alike. Frames add 0.3s of border on
 * each side. A player's cell = two framed photos + a name plate (0.9s).
 */
const FRAME = 0.3;
const PIC_H = 3;
const CELL_H = PIC_H + 2 * FRAME + 0.9; // 4.5
const PAIR_GAP = 0.4;
const DEFAULT_RATIO = 4 / 3; // until a photo has loaded, or when a player has no photo
const MIN_RATIO = 0.4;
const MAX_RATIO = 3;
const PAD = 16;
const GAP = 14;

const clampRatio = (r: number) => Math.min(MAX_RATIO, Math.max(MIN_RATIO, r));
const framedWidth = (ratio: number) => PIC_H * ratio + 2 * FRAME;

function useViewport() {
  const [size, setSize] = useState({ w: window.innerWidth, h: window.innerHeight });
  useEffect(() => {
    const onResize = () => setSize({ w: window.innerWidth, h: window.innerHeight });
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);
  return size;
}

/** Aspect ratio (width / height) of each image URL, filled in as they load. */
function useRatios(urls: string[]) {
  const [ratios, setRatios] = useState<Record<string, number>>({});
  const key = urls.join("\n");
  useEffect(() => {
    for (const url of urls) {
      if (ratios[url] !== undefined) continue;
      const img = new Image();
      img.onload = () => {
        if (img.naturalWidth > 0 && img.naturalHeight > 0) {
          setRatios((r) => (r[url] === undefined ? { ...r, [url]: img.naturalWidth / img.naturalHeight } : r));
        }
      };
      img.src = url;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);
  return ratios;
}

/**
 * Picks the column count that lets everything be as large as possible. Columns are as wide as
 * their widest cell (in `s` units), so cells of different shapes are accounted for exactly.
 */
function bestLayout(cellUnits: number[], w: number, h: number) {
  const count = cellUnits.length;
  let best = { cols: 1, s: 0 };
  for (let cols = 1; cols <= Math.max(1, count); cols++) {
    const rows = Math.ceil(count / cols);
    const colWidths = new Array<number>(cols).fill(0);
    cellUnits.forEach((u, i) => { colWidths[i % cols] = Math.max(colWidths[i % cols]!, u); });
    const totalUnits = colWidths.reduce((a, b) => a + b, 0);
    const sw = (w - 2 * PAD - (cols - 1) * GAP) / totalUnits;
    const sh = (h - 2 * PAD - (rows - 1) * GAP) / (rows * CELL_H);
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

  const urls = entries.flatMap(([uid]) => [media[uid]?.before, media[uid]?.after].filter((u): u is string => !!u));
  const ratios = useRatios(urls);
  const ratioOf = (url?: string) => clampRatio((url && ratios[url]) || DEFAULT_RATIO);

  const cells = entries.map(([uid, p]) => ({
    uid, name: p.name,
    before: media[uid]?.before, after: media[uid]?.after,
    rb: ratioOf(media[uid]?.before), ra: ratioOf(media[uid]?.after),
  }));
  const { cols, s } = bestLayout(cells.map((c) => framedWidth(c.rb) + framedWidth(c.ra) + PAIR_GAP), w, h);

  return (
    <main className="stage review">
      {cells.length === 0 ? (
        <p className="muted">No photos to review yet.</p>
      ) : (
        <div className="review-grid" style={{ "--s": `${s}px`, gridTemplateColumns: `repeat(${cols}, auto)`, gap: GAP } as React.CSSProperties}>
          {cells.map((c, i) => (
            <div key={c.uid} className="review-cell" style={{ animationDelay: `${i * 0.08}s` }}>
              <div className="review-pair">
                <Pic src={c.before} ratio={c.rb} alt={`${c.name} before`} />
                <Pic src={c.after} ratio={c.ra} alt={`${c.name} after`} />
              </div>
              <div className="review-name">{c.name}</div>
            </div>
          ))}
        </div>
      )}
      <StageControls code={code} display={display} hasVideo={false} />
    </main>
  );
}

const Pic = ({ src, ratio, alt }: { src?: string; ratio: number; alt: string }) => (
  <div className="pic" style={{ "--r": ratio } as React.CSSProperties}>
    {src ? <img src={src} alt={alt} /> : <span>no photo</span>}
  </div>
);
