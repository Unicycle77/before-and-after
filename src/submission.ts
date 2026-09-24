/** One status per player in each game; each game decides what counts as submitted. */
export type SubmissionStatus = "waiting" | "sending" | "submitted";

/** A player can't replace a finished submission until the host unlocks them. */
export const isLocked = (status: SubmissionStatus, unlocked: boolean | undefined) =>
  status === "submitted" && !unlocked;
