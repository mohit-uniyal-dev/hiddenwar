/**
 * Board geometry and the simulation contract.
 * Roadmap Part I §B.0, §B.1, §B.3, §B.8.
 */

import { mulberry32 } from "../rng/mulberry32.ts";

export const CONFIG_VERSION = "1.1.0";

export const TICKS_PER_SECOND = 20;

/** Authoring helper. Every cooldown must land on a clean tick boundary (§H.3). */
export function toTicks(seconds: number): number {
  const ticks = seconds * TICKS_PER_SECOND;
  if (!Number.isInteger(ticks)) {
    throw new Error(
      `Cooldown ${seconds}s is not a whole number of ticks. Author stats in multiples of 0.05s.`,
    );
  }
  return ticks;
}

export const BOARD = {
  /**
   * Eight columns, eleven rows — portrait, for one-handed play.
   *
   * Narrowing is what buys touch ergonomics: at 12 columns a 360px phone gives
   * ~28px tiles, well under the 44px guidance in §E.6; at 8 it gives ~43px.
   * Height does NOT help — past about eleven rows the viewport becomes the
   * binding constraint and tiles start shrinking again, so going taller than
   * this would cost tile size rather than gain it.
   */
  cols: 8,
  rows: 11,
  /** Rows 0-4 (displayed as 1-5) belong to Player B. */
  teamBRows: [0, 4] as const,
  /** Row 5 is no man's land. Nothing may ever be placed there (§B.1). */
  noMansLandRows: [5, 5] as const,
  /** Rows 6-10 (displayed as 7-11) belong to Player A. */
  teamARows: [6, 10] as const,
} as const;

/** The HQ footprint. */
export const HQ_SIZE = 2;

export interface HqAnchors {
  readonly A: { readonly row: number; readonly col: number };
  readonly B: { readonly row: number; readonly col: number };
}

/**
 * Both HQs stand on the rear rank of their own zone, each in a column drawn
 * INDEPENDENTLY per match.
 *
 * The columns were mirrored at first, and that was a mistake: it made the lane
 * you must attack and the lane you must defend the same lane, so one stack of
 * units did both jobs at once. Measured over 150 matches per pairing, a
 * formation that simply piled everything into that column won 80% of the time
 * and nothing beat it.
 *
 * Drawing the two columns separately forces the choice the game is supposed to
 * be about — how much do you commit forward versus hold back — and dropped that
 * same formation to 56%, level with an ordinary front line.
 *
 * Fairness does not require identical columns, only identical *problems*: both
 * players face one objective to crack and one to hold, at a distance drawn from
 * the same distribution. The gap between the columns varies per match, which is
 * itself the interesting variable.
 *
 * §41's prescribed answer to solved formations is map variety, not dice. The
 * draw is seeded, so a match stays reproducible from one number, and the store
 * holds it steady across a rematch so edit-and-rerun still works.
 */
export function hqAnchorsForSeed(seed: number): HqAnchors {
  const rng = mulberry32(seed);
  const span = BOARD.cols - HQ_SIZE + 1;
  return {
    A: { row: BOARD.teamARows[1] - HQ_SIZE + 1, col: rng.nextInt(span) },
    B: { row: BOARD.teamBRows[0], col: rng.nextInt(span) },
  };
}

/** The centre position, used by hand-authored puzzles and as a fallback. */
export const HQ_ANCHOR: HqAnchors = {
  A: { row: 9, col: 3 },
  B: { row: 0, col: 3 },
};

export const RULES = {
  /** Hard cap: 1,200 ticks = 60 seconds (§B.3). */
  maxTicks: 1200,
  /** Battle ends after 100 consecutive ticks (5s) with zero damage (§B.3). */
  deadAirTicks: 100,
  /**
   * First shot fires at 50% of cooldown. Staggers the opening so the battle
   * ramps instead of alpha-striking, and desynchronises identical units (§B.8).
   */
  firstShotCooldownFraction: 0.5,
} as const;

/** Damage type multipliers (§C.1). This is the ONLY mitigation system — no flat armor. */
export const DAMAGE_MULTIPLIERS = {
  bullet: { infantry: 1.0, armored: 0.25, structure: 0.25 },
  heavy: { infantry: 0.5, armored: 1.0, structure: 1.5 },
  explosive: { infantry: 1.0, armored: 0.5, structure: 1.0 },
} as const;

export function isInsideBoard(row: number, col: number): boolean {
  return row >= 0 && row < BOARD.rows && col >= 0 && col < BOARD.cols;
}

export function isNoMansLand(row: number): boolean {
  return row >= BOARD.noMansLandRows[0] && row <= BOARD.noMansLandRows[1];
}

/** Which team may deploy on this row, or null for no man's land / off-board. */
export function zoneOwner(row: number): "A" | "B" | null {
  if (row >= BOARD.teamBRows[0] && row <= BOARD.teamBRows[1]) return "B";
  if (row >= BOARD.teamARows[0] && row <= BOARD.teamARows[1]) return "A";
  return null;
}
