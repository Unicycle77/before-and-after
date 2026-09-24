import type { Game } from "..";
import { KINDS, allMedia, mediaOf, submissionStatus } from "./data";
import { HostLobby, HostPlayer } from "./HostControls";
import { PlayerView } from "./PlayerView";
import { Stage } from "./Stage";

/** Each player records one video; its first and last frames become their Before and After. */
export const beforeAfter: Game = {
  id: "beforeAfter",
  name: "Before & After",
  blurb: "Everyone films one video, from before to after.",
  heading: <>Before <span className="amp">&amp;</span> After</>,
  firstStep: "before",
  status: (session, uid) => submissionStatus(mediaOf(session, uid)),
  photoUrls: (session) => Object.values(allMedia(session)).flatMap((m) => [m.before, m.after]).filter((u): u is string => !!u),
  files: (session, uid) => KINDS.flatMap((kind) => {
    const url = mediaOf(session, uid)[kind];
    return url ? [{ name: kind, url }] : [];
  }),
  Stage,
  Player: PlayerView,
  HostPlayer,
  HostLobby,
};
