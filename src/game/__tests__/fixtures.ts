import type { Deployment, Direction, PlacedUnit, Team, UnitTypeId } from "../types.ts";

export function u(type: UnitTypeId, row: number, col: number, facing: Direction = "N"): PlacedUnit {
  return { type, row, col, facing };
}

export function deploy(team: Team, units: PlacedUnit[]): Deployment {
  return { team, units };
}

/**
 * A combat unit parked in a corner facing off-board, so it has no targets ever.
 *
 * Needed because army destruction wins outright the moment a side has zero
 * combat-capable units (§B.3) — without a token combatant, a side made only of
 * sandbags loses at tick 0 and the test never runs.
 */
export function idleGuard(team: Team): PlacedUnit {
  return team === "A" ? u("soldier", 13, 0, "S") : u("soldier", 0, 0, "N");
}

/**
 * A realistic full-army formation for both sides, used by the golden
 * determinism snapshot. Deliberately leaves firing lanes: living units never
 * block, but the team's own sandbags do (§B.4).
 */
export function fullArmyA(): Deployment {
  return deploy("A", [
    u("soldier", 8, 2),
    u("soldier", 8, 3),
    u("soldier", 8, 4),
    u("soldier", 8, 5),
    u("soldier", 8, 6),
    u("mg", 8, 7),
    u("mg", 8, 8),
    u("tank", 9, 2),
    u("tank", 9, 8),
    u("sandbag", 10, 4),
    u("sandbag", 10, 5),
    u("sandbag", 10, 6),
    u("sandbag", 10, 7),
    u("sandbag", 11, 4),
    u("sandbag", 11, 5),
    u("sandbag", 11, 6),
    u("sandbag", 11, 7),
    u("mortar", 11, 2),
    u("hq", 12, 5),
  ]);
}

export function fullArmyB(): Deployment {
  return deploy("B", [
    u("soldier", 5, 2, "S"),
    u("soldier", 5, 3, "S"),
    u("soldier", 5, 4, "S"),
    u("soldier", 5, 5, "S"),
    u("soldier", 5, 6, "S"),
    u("mg", 5, 7, "S"),
    u("mg", 5, 8, "S"),
    u("tank", 4, 2, "S"),
    u("tank", 4, 8, "S"),
    u("sandbag", 3, 4),
    u("sandbag", 3, 5),
    u("sandbag", 3, 6),
    u("sandbag", 3, 7),
    u("sandbag", 2, 4),
    u("sandbag", 2, 5),
    u("sandbag", 2, 6),
    u("sandbag", 2, 7),
    u("mortar", 2, 2, "S"),
    u("hq", 0, 5),
  ]);
}

/** Stable digest of an event log — the determinism contract's fingerprint. */
export function hashEvents(events: readonly unknown[]): string {
  const json = JSON.stringify(events);
  let h1 = 0x811c9dc5;
  let h2 = 0x01000193;
  for (let i = 0; i < json.length; i++) {
    const c = json.charCodeAt(i);
    h1 = Math.imul(h1 ^ c, 0x01000193) >>> 0;
    h2 = Math.imul(h2 + c, 0x85ebca6b) >>> 0;
  }
  return `${h1.toString(16).padStart(8, "0")}${h2.toString(16).padStart(8, "0")}:${json.length}`;
}
