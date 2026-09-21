export type MediaKind = "before" | "after" | "video";

/** What the main screen is showing. Only host / first-player may write this. */
export type Step = "list" | "before" | "after" | "both" | "video";

export interface Display {
  uid?: string;
  step: Step;
  /** Video step only: the host remote's play/pause. Treated as playing when absent. */
  playing?: boolean;
  /** Video step only: set to a new timestamp to restart from the beginning. */
  restartAt?: number;
}

export interface Player {
  name: string;
  joinedAt: number;
}

/** Download URLs of a player's submissions. RTDB drops empty objects, so all optional. */
export type Media = Partial<Record<MediaKind, string>>;

export interface Session {
  hostUid: string;
  /** The host's phone (claimed via /host). Only it (and the main screen) can drive the display. */
  controllerUid?: string;
  players?: Record<string, Player>;
  media?: Record<string, Media>;
  display?: Display;
}
