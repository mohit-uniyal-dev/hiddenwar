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
    // Front rank — the only rows infantry can reach from.
    u("soldier", 5, 2),
    u("soldier", 5, 3),
    u("soldier", 5, 4),
    u("soldier", 5, 5),
    u("soldier", 5, 6),
    u("mg", 5, 7),
    u("mg", 5, 8),
    // Tanks behind the line: living units do not block, so the lanes stay open.
    u("tank", 6, 2),
    u("tank", 6, 8),
    u("mortar", 6, 5),
    u("sandbag", 7, 4),
    u("sandbag", 7, 5),
    u("sandbag", 7, 6),
    u("sandbag", 7, 7),
    u("sandbag", 8, 4),
    u("sandbag", 8, 5),
    u("sandbag", 8, 6),
    u("sandbag", 8, 7),
    u("hq", 7, 9),
  ]);
}

export function fullArmyB(): Deployment {
  return deploy("B", [
    u("soldier", 3, 2, "S"),
    u("soldier", 3, 3, "S"),
    u("soldier", 3, 4, "S"),
    u("soldier", 3, 5, "S"),
    u("soldier", 3, 6, "S"),
    u("mg", 3, 7, "S"),
    u("mg", 3, 8, "S"),
    u("tank", 2, 2, "S"),
    u("tank", 2, 8, "S"),
    u("mortar", 2, 5, "S"),
    u("sandbag", 1, 4),
    u("sandbag", 1, 5),
    u("sandbag", 1, 6),
    u("sandbag", 1, 7),
    u("sandbag", 0, 4),
    u("sandbag", 0, 5),
    u("sandbag", 0, 6),
    u("sandbag", 0, 7),
    u("hq", 0, 9),
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
