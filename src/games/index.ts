import type { ComponentType, ReactNode } from "react";
import { activeGameId } from "../session";
import type { SubmissionStatus } from "../submission";
import type { Display, GameId, Session, Step } from "../types";
import { beforeAfter } from "./beforeAfter";
import { photos } from "./photos";

/**
 * What a game plugs into the shared screens. The session, its players, the lobby, the jukebox and
 * the download-all button are shared; everything a player submits belongs to one game.
 */
export interface Game {
  id: GameId;
  name: string;
  /** One line on the game picker's card saying what players do. */
  blurb: string;
  /** The lobby's title while this game is on. */
  heading: ReactNode;
  /** Where picking a player (in the lobby or on the host phone) starts. */
  firstStep: Step;
  status(session: Session, uid: string): SubmissionStatus;
  /** Photos the main screen downloads ahead of time, so reveals appear instantly. */
  photoUrls(session: Session): string[];
  /** A player's files for the download-all zip, named without an extension (e.g. "before"). */
  files(session: Session, uid: string): { name: string; url: string }[];
  /** Main screen, for every step but "list". */
  Stage: ComponentType<{ code: string; session: Session; display: Display }>;
  /** The player's phone, below their name. */
  Player: ComponentType<{ code: string; uid: string; session: Session }>;
  /** Host phone: what the main screen shows of the picked player. */
  HostPlayer: ComponentType<{ code: string; session: Session; display: Display; uid: string }>;
  /** Host phone: the buttons above the player list (e.g. show everyone at once). */
  HostLobby: ComponentType<{ code: string; session: Session; display: Display }>;
}

/** In the order the game picker shows them. */
export const GAMES: Record<GameId, Game> = { photos, beforeAfter };

/** The game being played; undefined on the game selection screen. */
export const activeGame = (session: Session): Game | undefined => {
  const id = activeGameId(session);
  return id && GAMES[id];
};
