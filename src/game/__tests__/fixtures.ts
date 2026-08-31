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
  return team === "A" ? u("soldier", 10, 0, "S") : u("soldier", 0, 0, "N");
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
    // Front rank — the only rows infantry can reach from.
    u("soldier", 6, 1),
    u("soldier", 6, 2),
    u("soldier", 6, 3),
    u("soldier", 6, 4),
    u("soldier", 6, 5),
    u("mg", 7, 1),
    u("mg", 7, 3),
    u("mg", 7, 5),
    // Column 6 is clear top to bottom, so the tank is never self-blocked.
    u("tank", 7, 6),
    u("mortar", 8, 1),
    u("sandbag", 8, 2),
    u("sandbag", 8, 3),
    u("sandbag", 8, 4),
    u("sandbag", 8, 5),
    u("sandbag", 9, 1),
    u("sandbag", 9, 2),
    u("sandbag", 9, 5),
    u("sandbag", 9, 6),
    u("hq", 9, 3),
  ]);
}

export function fullArmyB(): Deployment {
  return deploy("B", [
    u("soldier", 4, 1, "S"),
    u("soldier", 4, 2, "S"),
    u("soldier", 4, 3, "S"),
    u("soldier", 4, 4, "S"),
    u("soldier", 4, 5, "S"),
    u("mg", 3, 1, "S"),
    u("mg", 3, 3, "S"),
    u("mg", 3, 5, "S"),
    u("tank", 3, 6, "S"),
    u("mortar", 2, 1, "S"),
    u("sandbag", 2, 2),
    u("sandbag", 2, 3),
    u("sandbag", 2, 4),
    u("sandbag", 2, 5),
    u("sandbag", 1, 1),
    u("sandbag", 1, 2),
    u("sandbag", 1, 5),
    u("sandbag", 1, 6),
    u("hq", 0, 3),
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
