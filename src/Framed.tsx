import { useState } from "react";

/**
 * Gold frame that hugs its media. Once the media's aspect ratio is known, it is
 * sized to be as large as the screen allows (see `.frame` in styles.css).
 */
export function Framed({ children }: { children: (setRatio: (r: number) => void) => React.ReactNode }) {
  const [ratio, setRatio] = useState<number>();
  return (
    <div className={ratio ? "frame ready" : "frame"} style={ratio ? ({ "--ratio": ratio } as React.CSSProperties) : undefined}>
      {children(setRatio)}
    </div>
  );
}
