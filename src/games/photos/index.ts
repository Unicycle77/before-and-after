import type { Game } from "..";
import { allPhotos, photoOf, photoStatus } from "./data";
import { HostLobby, HostPlayer } from "./HostControls";
import { PlayerView } from "./PlayerView";
import { Stage } from "./Stage";

/** Each player submits one photo. */
export const photos: Game = {
  id: "photos",
  name: "Photos",
  blurb: "Everyone sends in one photo.",
  heading: "Photos",
  firstStep: "photo",
  status: photoStatus,
  photoUrls: (session) => Object.values(allPhotos(session)).map((m) => m.photo).filter((u): u is string => !!u),
  files: (session, uid) => {
    const url = photoOf(session, uid);
    return url ? [{ name: "photo", url }] : [];
  },
  Stage,
  Player: PlayerView,
  HostPlayer,
  HostLobby,
};
