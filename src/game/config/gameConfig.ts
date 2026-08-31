/**
 * Board geometry and the simulation contract.
 * Roadmap Part I §B.0, §B.1, §B.3, §B.8.
 */

import { mulberry32 } from "../rng/mulberry32.ts";
import type { Coord } from "../types.ts";

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
   * Eight columns, nine rows — portrait, for one-handed play.
   *
   * Narrowing is what buys touch ergonomics: at 12 columns a 360px phone gives
   * ~28px tiles, well under the 44px guidance; at 8 it gives ~43px. Height does
   * not help — past about eleven rows the viewport binds and tiles shrink again.
   *
   * Zones are FOUR rows deep, not five, and that is load-bearing:
   * `useful infantry rows = weapon range - gap depth`, so at 4 deep the enemy
   * HQ's near tile falls inside soldier range from the front rank. At 5 deep it
   * does not, and infantry was locked out of the win condition entirely —
   * measured at 0% of all HQ damage for both soldiers and machine guns.
   */
  cols: 8,
  rows: 9,
  /** Rows 0-3 (displayed as 1-4) belong to Player B. */
  teamBRows: [0, 3] as const,
  /** Row 4 is no man's land. Nothing may ever be placed there. */
  noMansLandRows: [4, 4] as const,
  /** Rows 5-8 (displayed as 6-9) belong to Player A. */
  teamARows: [5, 8] as const,
} as const;

/** The HQ footprint. */
/** A node is one column wide and two rows deep. */
export const HQ_WIDTH = 1;
export const HQ_HEIGHT = 2;

export interface Anchor {
  readonly row: number;
  readonly col: number;
}

/** Each side defends TWO nodes. Both must fall for the objective to be lost. */
export interface HqAnchors {
  readonly A: readonly Anchor[];
  readonly B: readonly Anchor[];
}

/**
 * How far apart the two nodes stand, drawn per match and applied to BOTH sides.
 *
 * This was a fixed `>= 3` and that constant was the problem. With the gap always
 * wide, a force that concentrates enough to kill one node is *guaranteed* to be
 * stranded from the other — and a punishment that is certain is not a risk, it
 * is a rule. Concentration stopped being a bet and simply became wrong, which
 * left "cover the whole width" correct on every board. Measured: the old
 * dominant (stacking) fell from 70.7% to 51.8%, and a broad front rank took its
 * place at 71.0%. Two eras, two shapes, the same ~70% — the endpoint of a
 * monotone axis, whichever end happens to be uphill.
 *
 * Drawing the gap per match bends the axis instead of flipping it, and it does:
 * at gap 2 a concentrated push wins 60.3% and the broad front 63.2%, at gap 3
 * concentration falls to 49.8% while the front rises to 70.1%. A seventeen-point
 * swing between two board draws is the first time in this game's life that the
 * right shape has depended on something a player can read.
 *
 * The table is {2, 3} and not the wider {2..5} it started as, because that was
 * measured too. Gaps of 4 and 5 are where the broad front is most dominant
 * (70-71%), so including them only diluted the effect: over 2500 matches a
 * side, {2,3} beat {2,3,4,5} on the dominant shape (63.8% vs 66.7%), on pace
 * (42.6% vs 38.6% of matches in the 15-30s band) and on timeouts (10.0% vs
 * 13.5%). Two genuinely different problems beat four barely-different ones.
 *
 * The DISTANCE is mirrored, never the columns. Mirrored columns made the lane
 * you attack and the lane you defend the same lane — one stack did both jobs,
 * measured at 80% with no counter. A shared distance carries none of that: it
 * only guarantees both players face the same problem.
 */
export const NODE_SEPARATIONS = [2, 3] as const;

/** The gap drawn for a match. Public because the harness buckets results by it. */
export function nodeSeparationForSeed(seed: number): number {
  // Its own stream: changing the separation table must not shift the columns.
  const rng = mulberry32((seed ^ 0x2545f491) >>> 0);
  return NODE_SEPARATIONS[rng.nextInt(NODE_SEPARATIONS.length)] ?? 3;
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
  const rowA = BOARD.teamARows[1] - HQ_HEIGHT + 1;
  const rowB = BOARD.teamBRows[0];

  /*
    Two nodes per side, EXACTLY `gap` columns apart on both sides, with the pair
    positioned independently.

    Two objectives turn deployment into a Colonel Blotto problem — hidden
    allocation of force across multiple fronts — which has no pure-strategy
    equilibrium. Every split is a bet about the opponent's split, which is
    exactly the read-dependent decision a single objective could never produce.

    It works here precisely BECAUSE units never move: a stack that kills one
    node is then permanently stranded and can never touch the other. The
    no-movement rule, which was the cause of the solved formation, becomes the
    thing that forces force division.

    The gap is what decides how hard that stranding bites, so it is drawn per
    match rather than fixed — see NODE_SEPARATIONS.
  */
  const gap = nodeSeparationForSeed(seed);
  const pick = (): [number, number] => {
    // `first` ranges over the positions where a pair of this width still fits.
    const first = rng.nextInt(BOARD.cols - gap);
    return [first, first + gap];
  };

  const [a1, a2] = pick();
  const [b1, b2] = pick();
  return {
    A: [
      { row: rowA, col: a1 },
      { row: rowA, col: a2 },
    ],
    B: [
      { row: rowB, col: b1 },
      { row: rowB, col: b2 },
    ],
  };
}

/** The centre position, used by hand-authored puzzles and as a fallback. */
/** Centre-ish positions, used by hand-authored puzzles and as a fallback. */
export const HQ_ANCHOR: HqAnchors = {
  A: [
    { row: 7, col: 2 },
    { row: 7, col: 5 },
  ],
  B: [
    { row: 0, col: 2 },
    { row: 0, col: 5 },
  ],
};

export const RULES = {
  /** Hard cap: 900 ticks = 45 seconds. Timeout is decided on node damage. */
  maxTicks: 900,
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
  /**
   * Pierce ignores armour class almost entirely — its counterplay is geometry
   * (spread out, or screen the lane), not unit type.
   */
  pierce: { infantry: 1.0, armored: 1.0, structure: 0.75 },
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

/**
 * Craters — permanent, indestructible cover drawn per match.
 *
 * They exist to stop any single formation from being the cached answer: a broad
 * even line cannot cover eight columns when three of them are blocked, and each
 * seed poses a different geometric question. They also make two players' boards
 * *look* different, which matters more than it sounds — visual convergence is
 * identity death for an expressive system.
 *
 * The pattern is rotated 180 degrees rather than reflected, so each side faces
 * the same relative problem from its own end of the board. Craters block line of
 * sight for both sides; the mortar ignores them, as it ignores all cover.
 *
 * Excluded from the rear ranks, so they can never pre-shield an objective, and
 * from node columns, so the approach to a node is never blocked before a shot is
 * fired.
 */
export function terrainForSeed(seed: number, anchors: HqAnchors): Coord[] {
  // A stream of its own, so adding or removing craters cannot shift the HQ draw.
  const rng = mulberry32((seed ^ 0x7f4a7c15) >>> 0);
  /*
    Exactly two per side, not two-or-three.

    The third crater was the marginal one and it cost pace: matches landing in
    the 15-30s band fell from 40.1% to 27.8% when craters arrived, and idle
    units tripled. Two still pose a different geometric question every seed,
    which is the whole reason craters exist.
  */
  const count = 2;

  const blockedCols = new Set<number>();
  for (const side of [anchors.A, anchors.B]) for (const n of side) blockedCols.add(n.col);

  // Blue's forward rows only; each pick is mirrored into Orange's half.
  const rows: number[] = [BOARD.teamARows[0], BOARD.teamARows[0] + 1];
  const candidates: Coord[] = [];
  for (const row of rows) {
    for (let col = 0; col < BOARD.cols; col++) {
      if (blockedCols.has(col)) continue;
      candidates.push({ row, col });
    }
  }

  const craters: Coord[] = [];
  // No two craters in the same or an adjacent column: two side-by-side blockers
  // wall off a quadrant of the board, and a draw that can silently delete a
  // flank is a draw that decides the match before either player places a unit.
  const usedCols = new Set<number>();
  for (let i = 0; i < count && candidates.length > 0; i++) {
    const open = candidates.filter(
      (c) => !usedCols.has(c.col) && !usedCols.has(c.col - 1) && !usedCols.has(c.col + 1),
    );
    if (open.length === 0) break;
    const pick = open[rng.nextInt(open.length)];
    if (pick === undefined) break;
    usedCols.add(pick.col);
    craters.push(pick);
    // 180-degree rotation onto the other half.
    craters.push({ row: BOARD.rows - 1 - pick.row, col: BOARD.cols - 1 - pick.col });
  }
  return craters;
}
