/**
 * Footprint shapes and rotation.
 *
 * The property that matters most here is that the WEAPON stays the weapon. A
 * shape's first cell is where it fires from, so any rotation that re-sorted the
 * cells would silently move a unit's gun to its hull — a bug that would be
 * nearly invisible on screen and would quietly corrupt every arc, range check
 * and line-of-sight test in the engine.
 */

import { describe, expect, it } from "vitest";
import { UNITS } from "../config/units.ts";
import { footprint, shapeOffsets, tilesOf, weaponTile } from "../engine/geometry.ts";
import type { Coord } from "../types.ts";

const key = (cells: readonly Coord[]) =>
  [...cells]
    .sort((a, b) => a.row - b.row || a.col - b.col)
    .map((c) => `${c.row},${c.col}`)
    .join(" ");

/** An L: gun at the elbow, hull running down and right. */
const L: Coord[] = [
  { row: 0, col: 0 },
  { row: 1, col: 0 },
  { row: 1, col: 1 },
];

describe("shape offsets", () => {
  it("matches the old rectangle footprint when no shape is given", () => {
    for (const [w, h] of [
      [1, 1],
      [1, 2],
      [2, 2],
      [3, 1],
    ] as const) {
      expect(key(shapeOffsets({ width: w, height: h }))).toBe(key(footprint(0, 0, w, h)));
    }
  });

  it("leaves every current unit exactly as it was", () => {
    // The whole roster is 1x1 apart from the HQ, so this refactor must be a
    // no-op for all of it — which is what lets the golden log stay unchanged.
    for (const spec of Object.values(UNITS)) {
      expect(key(shapeOffsets(spec))).toBe(key(footprint(0, 0, spec.width, spec.height)));
    }
  });

  it("keeps the weapon cell first through every rotation", () => {
    for (let turns = 0; turns < 4; turns++) {
      const cells = shapeOffsets({ width: 2, height: 2, cells: L }, turns);
      expect(cells).toHaveLength(3);
      // The gun is the cell with no neighbour on one arm — for this L, the one
      // that is alone in its row or column. Simplest check: it is index 0, and
      // weaponTile agrees with it.
      const first = cells[0];
      expect(first).toBeDefined();
      expect(weaponTile(5, 3, { width: 2, height: 2, cells: L }, turns)).toEqual({
        row: 5 + (first?.row ?? 0),
        col: 3 + (first?.col ?? 0),
      });
    }
  });

  it("normalises every rotation into the top-left corner", () => {
    // Placement, occupancy and hit-testing all treat the anchor as the top-left
    // of the bounding box, so no rotation may produce a negative offset.
    for (let turns = 0; turns < 4; turns++) {
      const cells = shapeOffsets({ width: 2, height: 2, cells: L }, turns);
      expect(Math.min(...cells.map((c) => c.row))).toBe(0);
      expect(Math.min(...cells.map((c) => c.col))).toBe(0);
    }
  });

  it("returns to where it started after four quarter turns", () => {
    const spec = { width: 3, height: 2, cells: L };
    expect(shapeOffsets(spec, 4)).toEqual(shapeOffsets(spec, 0));
    expect(shapeOffsets(spec, 5)).toEqual(shapeOffsets(spec, 1));
  });

  it("gives an L four distinct orientations and a square only one", () => {
    const shapes = new Set<string>();
    for (let turns = 0; turns < 4; turns++) {
      shapes.add(key(shapeOffsets({ width: 2, height: 2, cells: L }, turns)));
    }
    expect(shapes.size).toBe(4);

    const squares = new Set<string>();
    for (let turns = 0; turns < 4; turns++) {
      squares.add(key(shapeOffsets({ width: 2, height: 2 }, turns)));
    }
    expect(squares.size).toBe(1);
  });

  it("never overlaps itself, whatever the rotation", () => {
    for (let turns = 0; turns < 4; turns++) {
      const tiles = tilesOf(4, 2, { width: 2, height: 2, cells: L }, turns);
      expect(new Set(tiles.map((t) => `${t.row},${t.col}`)).size).toBe(tiles.length);
    }
  });

  it("places the shape relative to the anchor, not the origin", () => {
    const tiles = tilesOf(6, 3, { width: 2, height: 2, cells: L }, 0);
    expect(key(tiles)).toBe(
      key([
        { row: 6, col: 3 },
        { row: 7, col: 3 },
        { row: 7, col: 4 },
      ]),
    );
  });
});
