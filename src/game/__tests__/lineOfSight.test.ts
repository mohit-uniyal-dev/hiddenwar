/**
 * The LOS raycast rule. Roadmap §B.4, §B.5.
 *
 * Supercover, with diagonals blocked only by DOUBLE walls: shooting past a
 * single sandbag corner is allowed, through a diagonal seam of two is not.
 */

import { describe, expect, it } from "vitest";
import { hasLineOfSight, traverse } from "../engine/lineOfSight.ts";
import type { Coord } from "../types.ts";

const at =
  (...blockers: Coord[]) =>
  (row: number, col: number): boolean =>
    blockers.some((b) => b.row === row && b.col === col);

const none = () => false;

describe("line of sight", () => {
  it("is clear across an empty board", () => {
    expect(hasLineOfSight({ row: 0, col: 0 }, { row: 5, col: 5 }, none)).toBe(true);
    expect(hasLineOfSight({ row: 8, col: 3 }, { row: 2, col: 9 }, none)).toBe(true);
  });

  it("is clear to a unit standing on the shooter's own tile", () => {
    expect(hasLineOfSight({ row: 4, col: 4 }, { row: 4, col: 4 }, at({ row: 4, col: 4 }))).toBe(
      true,
    );
  });

  it("is blocked by a blocker directly in the straight line", () => {
    expect(hasLineOfSight({ row: 8, col: 4 }, { row: 4, col: 4 }, at({ row: 6, col: 4 }))).toBe(
      false,
    );
  });

  it("ignores blockers on the origin and target tiles", () => {
    // The target itself must never block the shot that is aimed at it.
    expect(hasLineOfSight({ row: 8, col: 4 }, { row: 4, col: 4 }, at({ row: 4, col: 4 }))).toBe(
      true,
    );
  });

  it("is NOT blocked by a blocker beside the line", () => {
    expect(hasLineOfSight({ row: 8, col: 4 }, { row: 4, col: 4 }, at({ row: 6, col: 5 }))).toBe(
      true,
    );
  });

  describe("the corner rule", () => {
    // A perfect diagonal grazes corners the whole way. Between (4,4) and (6,6)
    // the segment passes exactly through the corner shared by (4,5)/(5,4)...
    const origin = { row: 4, col: 4 };
    const target = { row: 6, col: 6 };

    it("reports corner grazes rather than interior crossings on a pure diagonal", () => {
      const steps = traverse(origin, target);
      expect(steps.some((s) => s.kind === "corner")).toBe(true);
    });

    it("allows the shot past a SINGLE sandbag corner", () => {
      expect(hasLineOfSight(origin, target, at({ row: 5, col: 4 }))).toBe(true);
      expect(hasLineOfSight(origin, target, at({ row: 4, col: 5 }))).toBe(true);
    });

    it("blocks the shot through a DOUBLE diagonal seam", () => {
      expect(hasLineOfSight(origin, target, at({ row: 5, col: 4 }, { row: 4, col: 5 }))).toBe(
        false,
      );
    });
  });

  it("is symmetric — blockers block both ways", () => {
    const blockers = at({ row: 5, col: 4 }, { row: 4, col: 5 });
    const a = hasLineOfSight({ row: 4, col: 4 }, { row: 6, col: 6 }, blockers);
    const b = hasLineOfSight({ row: 6, col: 6 }, { row: 4, col: 4 }, blockers);
    expect(a).toBe(b);
  });

  describe("traversal", () => {
    it("starts at the origin and ends at the target", () => {
      const steps = traverse({ row: 2, col: 1 }, { row: 9, col: 6 });
      const first = steps[0];
      const last = steps[steps.length - 1];
      expect(first).toEqual({ kind: "tile", row: 2, col: 1 });
      expect(last).toEqual({ kind: "tile", row: 9, col: 6 });
    });

    it("handles a zero-length ray", () => {
      expect(traverse({ row: 3, col: 3 }, { row: 3, col: 3 })).toHaveLength(1);
    });

    it("works in every direction", () => {
      const targets: Coord[] = [
        { row: 0, col: 5 },
        { row: 10, col: 5 },
        { row: 5, col: 0 },
        { row: 5, col: 11 },
        { row: 0, col: 0 },
        { row: 10, col: 11 },
      ];
      for (const t of targets) {
        const steps = traverse({ row: 5, col: 5 }, t);
        const last = steps[steps.length - 1];
        expect(last).toEqual({ kind: "tile", row: t.row, col: t.col });
      }
    });
  });
});
