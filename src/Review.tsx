import { useEffect, useState } from "react";
import { SafeImg } from "./SafeImg";
import type { Player } from "./types";

/*
 * Every player gets the SAME cell, so nothing moves or resizes as photos load. Layout unit `s` (px):
 * each photo has a slot of 4s x 3s; the gold frame hugs the photo's own shape, scaled to fit inside
 * that slot and centered. Frames add 0.3s of border per side, so a slot is 4.6s x 3.6s, a cell is
 * one slot per photo (with a gap between) + a name plate.
 */
const FRAME = 0.3;
const SLOT_W = 4;
const SLOT_H = 3;
const PAIR_GAP = 0.4;
/** Width of a cell holding `n` photos side by side: 9.6 for a pair, 4.6 for one. */
const cellWidth = (n: number) => n * (SLOT_W + 2 * FRAME) + (n - 1) * PAIR_GAP;
const CELL_H = SLOT_H + 2 * FRAME + 0.9; // 4.5 (framed slot + name plate)
const DEFAULT_RATIO = SLOT_W / SLOT_H;
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

/** Picks the column count that lets the (uniform) cells be as large as possible. */
function bestLayout(count: number, cellW: number, w: number, h: number) {
  let best = { cols: 1, s: 0 };
  for (let cols = 1; cols <= Math.max(1, count); cols++) {
    const rows = Math.ceil(count / cols);
    const sw = (w - 2 * PAD - (cols - 1) * GAP) / cols / cellW;
    const sh = (h - 2 * PAD - (rows - 1) * GAP) / rows / CELL_H;
    const s = Math.min(sw, sh);
    if (s > best.s + 0.01) best = { cols, s };
  }
  return { cols: best.cols, s: Math.max(6, Math.floor(best.s * 10) / 10) };
}

/**
 * Everyone's photos with their name, all on one screen: `photosOf` gives each player's photos
 * (the same number for everyone, e.g. [before, after]). Players with none are left out.
 * `children` are the stage's backup controls.
 */
export function Review({ players, photosOf, labels, children }: {
  players: Record<string, Player>;
  photosOf: (uid: string) => (string | undefined)[];
  /** What each photo is, for alt text (e.g. ["before", "after"]). */
  labels: string[];
  children?: React.ReactNode;
}) {
  const { w, h } = useViewport();
  const entries = Object.entries(players)
    .filter(([uid]) => photosOf(uid).some((u) => u))
    .sort(([, a], [, b]) => (a.joinedAt ?? 0) - (b.joinedAt ?? 0));
  const cellW = cellWidth(labels.length);
  const { cols, s } = bestLayout(entries.length, cellW, w, h);

  // Hold everything back until every photo has loaded (or failed), then show it all at once.
  // After 10s we show what we have rather than wait forever; once shown, it stays shown.
  const urls = entries.flatMap(([uid]) => photosOf(uid).filter((u): u is string => !!u));
  const [settled, setSettled] = useState<Set<string>>(new Set());
  const [timedOut, setTimedOut] = useState(false);
  const [revealed, setRevealed] = useState(false);
  useEffect(() => {
    const t = window.setTimeout(() => setTimedOut(true), 10_000);
    return () => window.clearTimeout(t);
  }, []);
  const settledCount = urls.filter((u) => settled.has(u)).length;
  useEffect(() => {
    if (!revealed && entries.length > 0 && (settledCount >= urls.length || timedOut)) setRevealed(true);
  }, [revealed, entries.length, settledCount, urls.length, timedOut]);
  const onSettled = (url: string) => setSettled((prev) => (prev.has(url) ? prev : new Set(prev).add(url)));

  return (
    <main className="stage review">
      {entries.length === 0 ? (
        <p className="muted">No photos to review yet.</p>
      ) : (
        <div
          className={revealed ? "review-grid revealed" : "review-grid"}
          // Exactly `cols` cells wide (+1px slack for rounding), so rows wrap at the right place and each row is centered.
          style={{ "--s": `${s}px`, "--cw": cellW, width: Math.ceil(cols * cellW * s + (cols - 1) * GAP) + 1, gap: GAP } as React.CSSProperties}
        >
          {entries.map(([uid, p]) => (
            <div key={uid} className="review-cell">
              <div className="review-pair">
                {photosOf(uid).map((src, i) => (
                  <Pic key={labels[i]} src={src} alt={`${p.name} ${labels[i]}`} onSettled={onSettled} />
                ))}
              </div>
              <div className="review-name">{p.name}</div>
            </div>
          ))}
        </div>
      )}
      {!revealed && entries.length > 0 && <div className="review-loading">Loading photos… {settledCount} / {urls.length}</div>}
      {children}
    </main>
  );
}

/** A fixed slot; the frame inside it hugs the photo, shrunk to fit and centered. */
function Pic({ src, alt, onSettled }: { src?: string; alt: string; onSettled: (url: string) => void }) {
  const [ratio, setRatio] = useState<number | undefined>(src ? undefined : DEFAULT_RATIO);
  useEffect(() => { setRatio(src ? undefined : DEFAULT_RATIO); }, [src]);

  const r = ratio ?? DEFAULT_RATIO;
  const style = { "--pw": Math.min(SLOT_W, SLOT_H * r), "--ph": Math.min(SLOT_H, SLOT_W / r) } as React.CSSProperties;
  return (
    <div className="review-slot">
      {/* hidden until the photo's shape is known, so it appears once at its final size */}
      <div className={ratio ? "pic ready" : "pic"} style={style}>
        {src ? (
          <SafeImg
            src={src}
            alt={alt}
            onLoad={(e) => { setRatio(e.currentTarget.naturalWidth / e.currentTarget.naturalHeight || DEFAULT_RATIO); onSettled(src); }}
            onFail={() => { setRatio(DEFAULT_RATIO); onSettled(src); }}
          />
        ) : (
          <span>no photo</span>
        )}
      </div>
    </div>
  );
}
