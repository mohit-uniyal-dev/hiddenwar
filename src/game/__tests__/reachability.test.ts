/**
 * The reachability invariant. Roadmap Part I §B.12:
 *
 *   "Every tile in the enemy zone must be reachable by at least one weapon
 *    from at least one legal placement."
 *
 * The letter of that rule is satisfied by the mortar alone — which turns out
 * not to be enough. If exactly ONE unit type in a 19-piece army can touch a
 * tile, and that unit is the squishiest thing on the board, then that tile is
 * a sanctuary in every practical sense.
 *
 * These tests measure reachability by BREADTH, not just existence.
 */

import { describe, expect, it } from "vitest";
import { BOARD, canAnchorHq, zoneOwner } from "../config/gameConfig.ts";
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

  it("satisfies the letter of the §B.12 invariant — every tile is reachable", () => {
    for (const row of rows) {
      for (let col = 0; col < BOARD.cols; col++) {
        expect(reachedBy(row, col, "B").length, `row ${row} col ${col}`).toBeGreaterThan(0);
      }
    }
  });

  it("documents how thin that reachability actually is", () => {
    const summary = rows.map((row) => ({
      row,
      displayRow: row + 1,
      weapons: reachedBy(row, 5, "B"),
    }));

    // Printed so the numbers are visible when the suite runs.
    for (const s of summary) {
      console.log(`row ${String(s.displayRow).padStart(2)}: ${s.weapons.join(", ")}`);
    }

    // The back two rows are mortar-only. One unit per army, 35 HP.
    const backRows = summary.filter((s) => s.weapons.length === 1);
    expect(backRows.map((s) => s.displayRow)).toEqual([13, 14]);
    for (const s of backRows) expect(s.weapons).toEqual(["mortar"]);
  });

  it("the back-row HQ anchor — now illegal — WOULD have been mortar-only", () => {
    // A 2x2 HQ anchored at row 12 occupies rows 12-13 (displayed 13-14).
    // Every one of its tiles sits outside tank range from any legal enemy tile,
    // which is exactly why canAnchorHq forbids it.
    for (const tile of [
      { row: 12, col: 5 },
      { row: 12, col: 6 },
      { row: 13, col: 5 },
      { row: 13, col: 6 },
    ]) {
      expect(reachedBy(tile.row, tile.col, "B")).toEqual(["mortar"]);
    }
    expect(canAnchorHq("A", 12)).toBe(false);
  });
});

/**
 * The guarantee the placement rule buys. This is the test that would fail if
 * anyone widened a deployment zone, moved no man's land, or changed a range —
 * any of which could silently reopen the sanctuary.
 */
describe("every LEGAL HQ placement is reachable by more than the mortar", () => {
  const cases: { team: "A" | "B"; row: number }[] = [];
  for (let row = 0; row < BOARD.rows; row++) {
    for (const team of ["A", "B"] as const) {
      if (canAnchorHq(team, row)) cases.push({ team, row });
    }
  }

  it("has legal anchors for both teams", () => {
    expect(cases.filter((c) => c.team === "A").map((c) => c.row)).toEqual([8, 9, 10, 11]);
    expect(cases.filter((c) => c.team === "B").map((c) => c.row)).toEqual([1, 2, 3, 4]);
  });

  it.each(cases)("$team HQ anchored at row $row can be reached by tanks", ({ team, row }) => {
    const enemy = team === "A" ? "B" : "A";
    // The HQ shares one HP pool across all four tiles, so ONE reachable tile
    // is enough for tanks to fight for the win condition.
    const tiles = [
      { row, col: 5 },
      { row: row + 1, col: 5 },
    ];
    const anyTankReach = tiles.some((t) => reachedBy(t.row, t.col, enemy).includes("tank"));
    expect(anyTankReach).toBe(true);
  });
});
