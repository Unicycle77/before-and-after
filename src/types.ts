export type MediaKind = "before" | "after" | "video";

/** What the main screen is showing. Only host / first-player may write this. */
export type Step = "list" | MediaKind;

export interface Display {
  uid?: string;
  step: Step;
}

export interface Player {
  name: string;
  joinedAt: number;
  connected?: boolean;
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
