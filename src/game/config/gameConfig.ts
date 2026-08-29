/**
 * Board geometry and the simulation contract.
 * Roadmap Part I §B.0, §B.1, §B.3, §B.8.
 */

export const CONFIG_VERSION = "1.0.0";

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
  cols: 12,
  rows: 14,
  /** Rows 0-5 (displayed as 1-6) belong to Player B. */
  teamBRows: [0, 5] as const,
  /** Rows 6-7 are no man's land. Nothing may ever be placed here (§B.1). */
  noMansLandRows: [6, 7] as const,
  /** Rows 8-13 (displayed as 9-14) belong to Player A. */
  teamARows: [8, 13] as const,
} as const;

/** The HQ footprint. Kept here so placement rules do not import the unit table. */
export const HQ_SIZE = 2;

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

/**
 * May a 2x2 HQ be ANCHORED here?
 *
 * The HQ must leave at least one row of your own zone behind it — it cannot sit
 * on your back row.
 *
 * Without this rule the back two rows are reachable ONLY by the enemy mortar
 * (measured in reachability.test.ts): one unit type out of four, one unit out
 * of nineteen, with 35 HP. Killing that single mortar made an HQ parked there
 * permanently invulnerable, and since the tiebreak ladder checks HQ HP first,
 * an untouched HQ also won every stalemate automatically.
 *
 * It also restored an assumption the balance table already makes — §C.4 costs
 * out "Tank vs HQ: 4 shots, ~5.6s with both tanks", which only means anything
 * if tanks can reach the HQ.
 */
export function canAnchorHq(team: "A" | "B", row: number): boolean {
  if (team === "A") {
    // Blue's rear is the high rows; the enemy attacks from the north.
    return row >= BOARD.teamARows[0] && row + HQ_SIZE - 1 <= BOARD.teamARows[1] - 1;
  }
  return row - 1 >= BOARD.teamBRows[0] && row + HQ_SIZE - 1 <= BOARD.teamBRows[1];
}

/** Which team may deploy on this row, or null for no man's land / off-board. */
export function zoneOwner(row: number): "A" | "B" | null {
  if (row >= BOARD.teamBRows[0] && row <= BOARD.teamBRows[1]) return "B";
  if (row >= BOARD.teamARows[0] && row <= BOARD.teamARows[1]) return "A";
  return null;
}
