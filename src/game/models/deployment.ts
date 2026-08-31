/**
 * Deployment construction and validation. Roadmap Part I §B.1, §B.2.
 *
 * This runs on the client for UX today, and must run on the server unchanged
 * when online play arrives (§I.4) — which is why it lives in the headless
 * engine rather than in a component.
 */

import { BOARD, isInsideBoard, zoneOwner } from "../config/gameConfig.ts";
import { MVP_ARMY, type Roster, UNITS } from "../config/units.ts";
import { footprint } from "../engine/geometry.ts";
import type { Deployment, PlacedUnit, Team, UnitTypeId } from "../types.ts";

export interface ValidationResult {
  readonly ok: boolean;
  readonly errors: readonly string[];
}

/** The tiles a placement would occupy, or null if any fall off the board. */
export function placementTiles(
  type: UnitTypeId,
  row: number,
  col: number,
): { row: number; col: number }[] | null {
  const tiles = footprint(row, col, UNITS[type].width, UNITS[type].height);
  for (const t of tiles) {
    if (!isInsideBoard(t.row, t.col)) return null;
  }
  return tiles;
}

/**
 * Can this unit legally go here?
 *
 * One unit per tile, hard rule, no stacking. Placement is legal anywhere in
 * your own 6 rows including the front row — but nothing may ever sit in no
 * man's land, and a 2x2 HQ must fit entirely inside the zone (§B.2).
 */
export function canPlace(
  team: Team,
  type: UnitTypeId,
  row: number,
  col: number,
  existing: readonly PlacedUnit[],
  ignoreIndex = -1,
): boolean {
  const tiles = placementTiles(type, row, col);
  if (tiles === null) return false;

  for (const t of tiles) {
    if (zoneOwner(t.row) !== team) return false;
  }

  const occupied = new Set<number>();
  existing.forEach((unit, index) => {
    if (index === ignoreIndex) return;
    for (const t of footprint(
      unit.row,
      unit.col,
      UNITS[unit.type].width,
      UNITS[unit.type].height,
    )) {
      occupied.add(t.row * BOARD.cols + t.col);
    }
  });

  for (const t of tiles) {
    if (occupied.has(t.row * BOARD.cols + t.col)) return false;
  }
  return true;
}

/** How many of each unit this roster allows. Defaults to the Classic army. */
export function expectedCounts(roster: Roster = MVP_ARMY): Map<UnitTypeId, number> {
  const counts = new Map<UnitTypeId, number>();
  for (const entry of roster) counts.set(entry.type, entry.count);
  return counts;
}

export function validateDeployment(
  deployment: Deployment,
  roster: Roster = MVP_ARMY,
): ValidationResult {
  const errors: string[] = [];
  const counts = new Map<UnitTypeId, number>();
  const occupied = new Map<number, number>();

  deployment.units.forEach((unit, index) => {
    counts.set(unit.type, (counts.get(unit.type) ?? 0) + 1);

    const tiles = placementTiles(unit.type, unit.row, unit.col);
    if (tiles === null) {
      errors.push(`${UNITS[unit.type].name} #${index} extends off the board.`);
      return;
    }
    for (const t of tiles) {
      const owner = zoneOwner(t.row);
      if (owner === null) {
        errors.push(`${UNITS[unit.type].name} #${index} is in no man's land.`);
        return;
      }
      if (owner !== deployment.team) {
        errors.push(`${UNITS[unit.type].name} #${index} is in the enemy zone.`);
        return;
      }
      const key = t.row * BOARD.cols + t.col;
      const other = occupied.get(key);
      if (other !== undefined) {
        errors.push(`${UNITS[unit.type].name} #${index} overlaps unit #${other}.`);
        return;
      }
      occupied.set(key, index);
    }
  });

  for (const [type, expected] of expectedCounts(roster)) {
    const actual = counts.get(type) ?? 0;
    if (actual !== expected) {
      errors.push(`Expected ${expected} x ${UNITS[type].name}, found ${actual}.`);
    }
  }

  return { ok: errors.length === 0, errors };
}

export function emptyDeployment(team: Team): Deployment {
  return { team, units: [] };
}
