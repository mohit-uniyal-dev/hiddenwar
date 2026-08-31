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
  return team === "A" ? u("soldier", 8, 0, "S") : u("soldier", 0, 0, "N");
}

/**
 * A realistic full-army formation for both sides on the 12x9 board.
 * Blue holds rows 5-8, Orange rows 0-3, no man's land is row 4.
 *
 * Deliberately leaves firing lanes: living units never block, but your own
 * sandbags do (§B.4).
 */
export function fullArmyA(): Deployment {
  return deploy("A", [
    u("soldier", 5, 1),
    u("soldier", 5, 2),
    u("soldier", 5, 3),
    u("soldier", 5, 4),
    u("soldier", 5, 5),
    u("mg", 6, 1),
    u("mg", 6, 5),
    u("atgun", 6, 3),
    u("tank", 6, 6),
    u("mortar", 7, 1),
    u("sandbag", 7, 6),
    u("sandbag", 8, 1),
    u("sandbag", 7, 0),
    u("sandbag", 8, 2),
    u("sandbag", 8, 5),
    u("sandbag", 8, 6),
    u("sandbag", 6, 0),
    u("hq", 7, 2),
    u("hq", 7, 5),
  ]);
}

export function fullArmyB(): Deployment {
  return deploy("B", [
    u("soldier", 3, 1, "S"),
    u("soldier", 3, 2, "S"),
    u("soldier", 3, 3, "S"),
    u("soldier", 3, 4, "S"),
    u("soldier", 3, 5, "S"),
    u("mg", 2, 1, "S"),
    u("mg", 2, 5, "S"),
    u("atgun", 2, 3, "S"),
    u("tank", 2, 6, "S"),
    u("mortar", 1, 1, "S"),
    u("sandbag", 1, 6),
    u("sandbag", 0, 1),
    u("sandbag", 1, 0),
    u("sandbag", 0, 2),
    u("sandbag", 0, 5),
    u("sandbag", 0, 6),
    u("sandbag", 2, 0),
    u("hq", 0, 2),
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
