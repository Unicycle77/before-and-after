import { useEffect, useState } from "react";

/**
 * The main screen's backup `.stage-controls` bar: shown while the mouse is moving, hidden
 * (along with the cursor) after a short pause.
 */
export function useStageBarVisible(): boolean {
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    let timer: number | undefined;
    const wake = () => {
      setVisible(true);
      document.body.classList.remove("idle-cursor");
      window.clearTimeout(timer);
      timer = window.setTimeout(() => { setVisible(false); document.body.classList.add("idle-cursor"); }, 2500);
    };
    window.addEventListener("mousemove", wake);
    return () => {
      window.removeEventListener("mousemove", wake);
      window.clearTimeout(timer);
      document.body.classList.remove("idle-cursor");
    };
  }, []);
  return visible;
}
