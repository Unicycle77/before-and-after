import type { SubmissionStatus } from "../../submission";
import type { PhotosMedia, Session } from "../../types";

export const allPhotos = (session: Session): Record<string, PhotosMedia> => session.games?.photos?.media ?? {};

export const photoOf = (session: Session, uid: string): string | undefined => allPhotos(session)[uid]?.photo;

/** One photo per player: it's either in or it isn't (the upload finishes before its URL is published). */
export const photoStatus = (session: Session, uid: string): SubmissionStatus => (photoOf(session, uid) ? "submitted" : "waiting");

/** The player before / after `uid` who has a photo, in the order they joined (as on the "everyone" grid). */
export function neighbour(session: Session, uid: string, dir: 1 | -1): string | undefined {
  const order = Object.entries(session.players ?? {})
    .filter(([id]) => photoOf(session, id))
    .sort(([, a], [, b]) => (a.joinedAt ?? 0) - (b.joinedAt ?? 0))
    .map(([id]) => id);
  const i = order.indexOf(uid);
  return i < 0 ? undefined : order[i + dir];
}
