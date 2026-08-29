/**
 * The reachability invariant. Roadmap Part I §B.12:
 *
 *   "Every tile in the enemy zone must be reachable by at least one weapon
 *    from at least one legal placement."
 *
 * The letter of that rule was once satisfied by the mortar alone, which is not
 * enough: if exactly ONE unit type in a 19-piece army can touch a tile, and
 * that unit is the squishiest thing on the board, that tile is a sanctuary in
 * every practical sense. On the old 6-deep board an HQ parked on the back row
 * was mortar-only, and had to be banned there by an explicit placement rule.
 *
 * The 12x9 board fixes it by geometry instead: with 4-deep zones and a 1-row
 * gap, a tank on the front rank covers the entire enemy zone, so every tile is
 * contestable and the placement rule was deleted.
 *
 * These tests measure reachability by BREADTH, not just existence.
 */

import { describe, expect, it } from "vitest";
import { BOARD, zoneOwner } from "../config/gameConfig.ts";
import { UNITS } from "../config/units.ts";
import { chebyshev } from "../engine/geometry.ts";
import type { UnitTypeId } from "../types.ts";

const WEAPONS: UnitTypeId[] = ["soldier", "mg", "tank", "mortar"];

/**
 * Which enemy weapon types could hit this tile from SOME legal placement in
 * their own zone, ignoring cover and facing (a best case for the attacker).
 */
function reachedBy(row: number, col: number, attacker: "A" | "B"): UnitTypeId[] {
  const hits: UnitTypeId[] = [];
  for (const type of WEAPONS) {
    const spec = UNITS[type];
    const min = spec.minRange ?? 1;
    const max = spec.maxRange ?? 0;
    let found = false;
    for (let r = 0; r < BOARD.rows && !found; r++) {
      if (zoneOwner(r) !== attacker) continue;
      for (let c = 0; c < BOARD.cols; c++) {
        const d = chebyshev(r, c, row, col);
        if (d >= min && d <= max) {
          found = true;
          break;
        }
      }
    }
    if (found) hits.push(type);
  }
  return hits;
}

describe("reachability of Blue's zone by Orange", () => {
  const rows: number[] = [];
  for (let r = BOARD.teamARows[0]; r <= BOARD.teamARows[1]; r++) rows.push(r);

  it("every tile is reachable — the §B.12 invariant", () => {
    for (const row of rows) {
      for (let col = 0; col < BOARD.cols; col++) {
        expect(reachedBy(row, col, "B").length, `row ${row} col ${col}`).toBeGreaterThan(0);
      }
    }
  });

  it("EVERY row is reachable by tanks, not just by the mortar", () => {
    // This is the guarantee the board shape buys, and the reason the old
    // "HQ may not sit on your back row" rule could be deleted. It fails if
    // anyone deepens a zone, widens no man's land, or shortens tank range.
    for (const row of rows) {
      expect(reachedBy(row, 5, "B"), `row ${row + 1}`).toContain("tank");
    }
  });

  it("documents the reach layering", () => {
    for (const row of rows) {
      console.log(`row ${String(row + 1).padStart(2)}: ${reachedBy(row, 5, "B").join(", ")}`);
    }
    // Infantry still cannot reach the rear — that layering is deliberate
    // (infantry hold the line, tanks reach mid, artillery reaches deep).
    const front = reachedBy(BOARD.teamARows[0], 5, "B");
    expect(front).toContain("soldier");
    const back = reachedBy(BOARD.teamARows[1], 5, "B");
    expect(back).not.toContain("soldier");
    expect(back).toContain("tank");
  });
});

describe("every legal HQ placement is contestable", () => {
  // A 2x2 HQ can be anchored anywhere its footprint fits inside the zone.
  const anchors: number[] = [];
  for (let r = BOARD.teamARows[0]; r <= BOARD.teamARows[1] - 1; r++) anchors.push(r);

  it("has four rows of zone and three legal anchors", () => {
    expect(BOARD.teamARows[1] - BOARD.teamARows[0] + 1).toBe(4);
    expect(anchors).toEqual([5, 6, 7]);
  });

  it.each(anchors)("an HQ anchored at row %i is reachable by tanks", (row) => {
    const tiles = [
      { row, col: 5 },
      { row: row + 1, col: 5 },
    ];
    expect(tiles.some((t) => reachedBy(t.row, t.col, "B").includes("tank"))).toBe(true);
  });
});
