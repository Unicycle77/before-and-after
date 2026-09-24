import type { Game } from "..";
import { roundOf, titleOf } from "./data";
import { HostLobby, HostPlayer } from "./HostControls";
import { BOX_ART, OBJECTS } from "./objects";
import { PlayerView } from "./PlayerView";
import { Stage } from "./Stage";

/**
 * Two players, two boxes, one object: one player may look inside their box, the other chooses once to
 * swap boxes or keep theirs, then the host opens them on the stage. The host runs it; nobody submits anything.
 */
export const box: Game = {
  id: "box",
  name: "[BLANK] in a Box",
  blurb: "One peeks. One decides: swap or keep?",
  heading: (session) => titleOf(roundOf(session)),
  firstStep: "boxes",
  photoUrls: () => [BOX_ART.closed, BOX_ART.open, ...OBJECTS.map((o) => o.url)],
  files: () => [],
  Stage,
  Player: PlayerView,
  HostPlayer,
  HostLobby,
};
