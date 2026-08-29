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
  /**
   * Nine rows, not fourteen.
   *
   * The original 6-deep zones with a 2-row gap left most of the board inert:
   * a soldier or MG placed on row 11 or deeper could reach ZERO enemy tiles,
   * so seven of your nine combat units were competing for two rows while four
   * rows held scenery. Useful infantry rows = weapon range - gap depth, so
   * narrowing the gap to one row is what actually widens the playable band.
   *
   * At 4 deep with a 1-row gap, a tank on the front rank also covers the whole
   * enemy zone — which closes the back-row HQ sanctuary organically, and let
   * the artificial "HQ may not sit on your back row" rule be deleted.
   */
  rows: 9,
  /** Rows 0-3 (displayed as 1-4) belong to Player B. */
  teamBRows: [0, 3] as const,
  /** Row 4 is no man's land. Nothing may ever be placed there (§B.1). */
  noMansLandRows: [4, 4] as const,
  /** Rows 5-8 (displayed as 6-9) belong to Player A. */
  teamARows: [5, 8] as const,
} as const;

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
