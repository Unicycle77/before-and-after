export type MediaKind = "before" | "after" | "video";

/** What the main screen is showing. Only host / first-player may write this. */
/** "review" = everyone's before & after on one screen (no uid). */
export type Step = "list" | "before" | "after" | "both" | "video" | "review";

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

export interface Jukebox {
  /** Song titles, published by the main screen (the files stay on that PC). */
  tracks?: string[];
  /** Song lengths in seconds, same order as `tracks` (0 = unknown). */
  durations?: number[];
  /** Playback state, written by the host remote (and by the main screen when a song ends). */
  state?: { current?: number; playing?: boolean; volume?: number; repeat?: boolean };
}

export interface Session {
  hostUid: string;
  /** The host's phone (claimed via /host). Only it (and the main screen) can drive the display. */
  controllerUid?: string;
  players?: Record<string, Player>;
  media?: Record<string, Media>;
  display?: Display;
  /** Host remote toggles this to reveal the download-all button on the main screen. */
  showDownload?: boolean;
  jukebox?: Jukebox;
}
