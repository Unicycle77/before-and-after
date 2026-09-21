import type { Media } from "./types";

export type SubmissionStatus = "waiting" | "sending" | "submitted";

/**
 * One status per player. A submission is one video (uploaded first) whose first and last frames
 * are then uploaded as the Before and After, so "submitted" means the frames have landed too.
 * "sending" covers the moment in between (and any half-finished submission).
 */
export function submissionStatus(media: Media | undefined): SubmissionStatus {
  if (media?.before && media?.after) return "submitted";
  if (media?.video || media?.before || media?.after) return "sending";
  return "waiting";
}
