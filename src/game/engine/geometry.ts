/**
 * Grid geometry and attack pattern footprints.
 * Roadmap Part I §B.0 (Chebyshev everywhere) and §B.13 (the MG cone).
 *
 * Integer arithmetic only. No Math.sqrt / sin / cos / pow — they are not
 * portable across JS engines, and a battle simulated on a phone must match
 * one simulated on the server exactly (§H.3).
 */

import { isInsideBoard } from "../config/gameConfig.ts";
import type { Coord, Direction } from "../types.ts";

/** Chebyshev (chessboard) distance. The one metric, used everywhere (§B.0). */
export function chebyshev(r0: number, c0: number, r1: number, c1: number): number {
  const dr = r0 > r1 ? r0 - r1 : r1 - r0;
  const dc = c0 > c1 ? c0 - c1 : c1 - c0;
  return dr > dc ? dr : dc;
}

/** Unit step vector for a facing. Row 0 is the top of the board. */
export function step(facing: Direction): { dr: number; dc: number } {
  switch (facing) {
    case "N":
      return { dr: -1, dc: 0 };
    case "S":
      return { dr: 1, dc: 0 };
    case "E":
      return { dr: 0, dc: 1 };
    case "W":
      return { dr: 0, dc: -1 };
  }
}

/** The perpendicular axis, used to widen the MG cone. */
function lateral(facing: Direction): { dr: number; dc: number } {
  switch (facing) {
    case "N":
    case "S":
      return { dr: 0, dc: 1 };
    case "E":
    case "W":
      return { dr: 1, dc: 0 };
  }
}

export const ROTATIONS: readonly Direction[] = ["N", "E", "S", "W"];

export function rotateCW(facing: Direction): Direction {
  const i = ROTATIONS.indexOf(facing);
  // biome-ignore lint/style/noNonNullAssertion: facing is always in ROTATIONS
  return ROTATIONS[(i + 1) % ROTATIONS.length]!;
}

/**
 * Straight line of width 1, from minRange to maxRange along the facing.
 * Used by the Soldier and the Tank.
 */
export function linePattern(
  origin: Coord,
  facing: Direction,
  minRange: number,
  maxRange: number,
): Coord[] {
  const { dr, dc } = step(facing);
  const tiles: Coord[] = [];
  for (let d = minRange; d <= maxRange; d++) {
    const row = origin.row + dr * d;
    const col = origin.col + dc * d;
    if (!isInsideBoard(row, col)) break;
    tiles.push({ row, col });
  }
  return tiles;
}

/**
 * The MG cone (§B.13).
 *
 * At distance d, lateral offsets satisfy |x| <= ceil(d / 2), which gives
 * widths 3, 3, 5, 5 at d = 1..4 — sixteen tiles in total.
 *
 * Facing N, the footprint is:
 *
 *     . X X X X X .      d=4   width 5
 *     . X X X X X .      d=3   width 5
 *     . . X X X . .      d=2   width 3
 *     . . X X X . .      d=1   width 3
 *     . . . M . . .
 */
export function conePattern(
  origin: Coord,
  facing: Direction,
  minRange: number,
  maxRange: number,
): Coord[] {
  const fwd = step(facing);
  const lat = lateral(facing);
  const tiles: Coord[] = [];
  for (let d = minRange; d <= maxRange; d++) {
    // ceil(d / 2) without floating point
    const halfWidth = (d + 1) >> 1;
    for (let x = -halfWidth; x <= halfWidth; x++) {
      const row = origin.row + fwd.dr * d + lat.dr * x;
      const col = origin.col + fwd.dc * d + lat.dc * x;
      if (isInsideBoard(row, col)) tiles.push({ row, col });
    }
  }
  return tiles;
}

/**
 * Indirect fire (§B.9). Omnidirectional: the mortar's candidate set is every
 * tile within [minRange, maxRange] regardless of facing, and it ignores line
 * of sight. Artillery does not have an arc.
 */
export function indirectPattern(origin: Coord, minRange: number, maxRange: number): Coord[] {
  const tiles: Coord[] = [];
  for (let row = origin.row - maxRange; row <= origin.row + maxRange; row++) {
    for (let col = origin.col - maxRange; col <= origin.col + maxRange; col++) {
      if (!isInsideBoard(row, col)) continue;
      const d = chebyshev(origin.row, origin.col, row, col);
      if (d >= minRange && d <= maxRange) tiles.push({ row, col });
    }
  }
  return tiles;
}

/** The 3x3 block centred on a tile — the mortar's splash footprint. */
export function splashArea(centre: Coord): Coord[] {
  const tiles: Coord[] = [];
  for (let row = centre.row - 1; row <= centre.row + 1; row++) {
    for (let col = centre.col - 1; col <= centre.col + 1; col++) {
      if (isInsideBoard(row, col)) tiles.push({ row, col });
    }
  }
  return tiles;
}

/** The tiles a unit occupies, anchored at its top-left. */
export function footprint(row: number, col: number, width: number, height: number): Coord[] {
  if (width === 1 && height === 1) return [{ row, col }];
  const tiles: Coord[] = [];
  for (let r = row; r < row + height; r++) {
    for (let c = col; c < col + width; c++) {
      tiles.push({ row: r, col: c });
    }
  }
  return tiles;
}
