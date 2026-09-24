import type { SubmissionStatus } from "../../submission";
import type { BeforeAfterMedia, Session } from "../../types";

export const KINDS = ["before", "after", "video"] as const;

export const allMedia = (session: Session): Record<string, BeforeAfterMedia> => session.games?.beforeAfter?.media ?? {};

export const mediaOf = (session: Session, uid: string): BeforeAfterMedia => allMedia(session)[uid] ?? {};

/**
 * A submission is one video (uploaded first) whose first and last frames are then uploaded as the
 * Before and After, so "submitted" means the frames have landed too. "sending" covers the moment
 * in between (and any half-finished submission).
 */
export function submissionStatus(media: BeforeAfterMedia | undefined): SubmissionStatus {
  if (media?.before && media?.after) return "submitted";
  if (media?.video || media?.before || media?.after) return "sending";
  return "waiting";
}
