/**
 * End-to-end hotseat flow, exercised headlessly.
 *
 * The store never touches the DOM, so the whole match loop — deploy, ready,
 * hand off, deploy, battle, report, rematch — is testable without a browser.
 */

import { beforeEach, describe, expect, it } from "vitest";
import {
  BOARD,
  NODE_MIN_SEPARATION,
  hqAnchorsForSeed,
  zoneOwner,
} from "../game/config/gameConfig.ts";
import { DIFFICULTY_POOLS } from "../game/content/formations.ts";
import { evaluatePuzzle, puzzleById } from "../game/content/puzzles.ts";
import { arcPreview } from "../game/engine/preview.ts";
import { simulateBattle } from "../game/engine/simulate.ts";
import { validateDeployment } from "../game/models/deployment.ts";
import { activeKit, isComplete, useGame } from "./gameStore.ts";

const store = () => useGame.getState();

describe("hotseat flow", () => {
  beforeEach(() => {
    store().backHome();
    store().startHotseat();
  });

  it("starts with BOTH HQ nodes already standing", () => {
    expect(store().phase).toBe("deploy");
    expect(store().activeTeam).toBe("A");
    // Nodes are placed automatically — the player never positions them.
    expect(store().deployments.A.units).toHaveLength(2);
    expect(store().deployments.A.units.every((u) => u.type === "hq")).toBe(true);
    expect(store().deployments.B.units.every((u) => u.type === "hq")).toBe(true);
  });

  it("puts two nodes a side on the rear rank of each zone", () => {
    const { hqAnchors } = store();
    expect(hqAnchors.A).toHaveLength(2);
    expect(hqAnchors.B).toHaveLength(2);
    for (const a of hqAnchors.B) expect(a.row).toBe(BOARD.teamBRows[0]);
    for (const a of hqAnchors.A) expect(a.row).toBe(BOARD.teamARows[1] - 1);
  });

  it("keeps the two nodes far enough apart to be separate fronts", () => {
    for (let seed = 0; seed < 400; seed++) {
      const drawn = hqAnchorsForSeed(seed);
      for (const side of [drawn.A, drawn.B]) {
        const cols = side.map((n) => n.col);
        // Adjacent nodes collapse back into a single front, which is the whole
        // thing twin objectives exist to prevent.
        expect(Math.abs((cols[0] ?? 0) - (cols[1] ?? 0))).toBeGreaterThanOrEqual(
          NODE_MIN_SEPARATION,
        );
      }
    }
  });

  it("does not lock the two sides together", () => {
    // Mirrored columns made the lane you attack and the lane you defend the
    // same lane, so one stack did both jobs — measured at an 80% win rate with
    // no counter. They must be able to differ.
    let differed = 0;
    for (let seed = 0; seed < 200; seed++) {
      const drawn = hqAnchorsForSeed(seed);
      if (drawn.A.some((x, i) => x.col !== drawn.B[i]?.col)) differed++;
    }
    expect(differed).toBeGreaterThan(120);
  });

  it("keeps every node inside its own zone for every possible draw", () => {
    for (let seed = 0; seed < 500; seed++) {
      const drawn = hqAnchorsForSeed(seed);
      for (const n of drawn.A) {
        expect(n.col).toBeGreaterThanOrEqual(0);
        expect(n.col).toBeLessThan(BOARD.cols);
        expect(zoneOwner(n.row)).toBe("A");
        expect(zoneOwner(n.row + 1)).toBe("A");
      }
      for (const n of drawn.B) {
        expect(zoneOwner(n.row)).toBe("B");
        expect(zoneOwner(n.row + 1)).toBe("B");
      }
    }
  });

  it("varies the column across matches", () => {
    const seen = new Set<number>();
    for (let seed = 0; seed < 200; seed++) {
      for (const n of hqAnchorsForSeed(seed).A) seen.add(n.col);
    }
    // The whole point is that the lane you must force changes between matches.
    expect(seen.size).toBeGreaterThan(5);
  });

  it("holds the drawn position steady across a rematch", () => {
    const before = store().hqAnchors;
    store().autoFill();
    store().ready();
    store().proceedToDeploy();
    store().autoFill();
    store().ready();
    store().finish();
    store().rematch();
    // A rematch is the same battlefield with your formation reloaded — moving
    // the objective would break edit-and-rerun (§D.2).
    expect(store().hqAnchors).toEqual(before);
    expect(store().deployments.A.units.filter((u) => u.type === "hq")).toHaveLength(2);
  });

  it("does not hand the player an HQ to place", () => {
    const kit = activeKit(store());
    expect(kit.some((entry) => entry.type === "hq")).toBe(false);
    // ...and the pre-placed HQ must not count against the allowance.
    expect(isComplete(store().deployments.A, kit)).toBe(false);
    store().autoFill();
    expect(isComplete(store().deployments.A, kit)).toBe(true);
  });

  it("refuses to remove or overwrite an HQ node", () => {
    const before = store().deployments.A.units;
    const anchor = store().hqAnchors.A[0];
    if (anchor === undefined) throw new Error("no node");
    store().removeAt(0);
    expect(store().deployments.A.units).toEqual(before);

    store().selectType("soldier");
    store().place(anchor.row, anchor.col);
    expect(store().deployments.A.units).toEqual(before);
  });

  it("clearing keeps the HQ and wipes everything else", () => {
    store().autoFill();
    expect(store().deployments.A.units.length).toBeGreaterThan(2);
    store().clearAll();
    expect(store().deployments.A.units).toHaveLength(2);
    expect(store().deployments.A.units.every((u) => u.type === "hq")).toBe(true);
  });

  it("auto-fill produces a legal, complete army for both teams", () => {
    store().autoFill();
    const a = store().deployments.A;
    expect(isComplete(a)).toBe(true);
    expect(validateDeployment(a)).toEqual({ ok: true, errors: [] });

    store().ready();
    store().proceedToDeploy();
    store().autoFill();
    const b = store().deployments.B;
    expect(isComplete(b)).toBe(true);
    expect(validateDeployment(b)).toEqual({ ok: true, errors: [] });
  });

  it("runs the full loop through to a report", () => {
    store().autoFill();
    store().ready();
    expect(store().phase).toBe("handoff");
    expect(store().activeTeam).toBe("B");

    store().proceedToDeploy();
    store().autoFill();
    store().ready();

    expect(store().phase).toBe("battle");
    const result = store().result;
    expect(result).not.toBeNull();
    expect(result?.events.length).toBeGreaterThan(0);
    expect(["A", "B", "draw"]).toContain(result?.winner);

    store().finish();
    expect(store().phase).toBe("results");
  });

  it("rematch reloads BOTH formations pre-placed for editing", () => {
    store().autoFill();
    store().ready();
    store().proceedToDeploy();
    store().autoFill();
    const beforeA = store().deployments.A.units;
    const beforeB = store().deployments.B.units;
    store().ready();
    store().finish();

    store().rematch();
    // This is the interaction the whole prototype hangs on (§D.2) — a blank
    // board between attempts kills the "I know what I'd change" impulse.
    expect(store().phase).toBe("deploy");
    expect(store().activeTeam).toBe("A");
    expect(store().deployments.A.units).toEqual(beforeA);
    expect(store().deployments.B.units).toEqual(beforeB);
    expect(isComplete(store().deployments.A)).toBe(true);
  });

  it("refuses illegal placements", () => {
    store().selectType("soldier");
    // No man's land is row 4 and is permanently off limits.
    store().place(4, 3);
    // The enemy half is not yours to fill.
    store().place(2, 3);
    // Only the two automatic nodes are on the board.
    expect(store().deployments.A.units).toHaveLength(2);

    store().place(5, 3);
    expect(store().deployments.A.units).toHaveLength(3);

    // One unit per tile, hard rule.
    store().place(5, 3);
    expect(store().deployments.A.units).toHaveLength(3);
  });

  it("never exceeds the fixed army allowance", () => {
    store().selectType("mg");
    for (let col = 0; col < 8; col++) store().place(5, col);
    expect(store().deployments.A.units.filter((u) => u.type === "mg")).toHaveLength(2);

    store().selectType("tank");
    for (let col = 0; col < 6; col++) store().place(5, col);
    expect(store().deployments.A.units.filter((u) => u.type === "tank")).toHaveLength(1);
  });

  it("repositions a placed unit by moving it to an empty tile", () => {
    store().selectType("soldier");
    store().place(5, 3);
    const index = store().deployments.A.units.findIndex((u) => u.type === "soldier");

    // The HQ occupies a random 2x2 footprint on the rear ranks (rows 7-8), so
    // rows 5-6 are always clear and this test cannot become seed-dependent.
    store().moveTo(index, 6, 4);
    expect(store().deployments.A.units[index]).toMatchObject({ row: 6, col: 4 });

    // Facing survives the move — repositioning is not a re-placement.
    expect(store().deployments.A.units[index]?.facing).toBe("N");
  });

  it("refuses moves onto illegal ground", () => {
    store().selectType("soldier");
    store().place(5, 3);
    store().selectType("soldier");
    store().place(5, 5);
    const index = store().deployments.A.units.findIndex((u) => u.type === "soldier");
    const before = store().deployments.A.units[index];

    store().moveTo(index, 4, 3); // no man's land
    store().moveTo(index, 2, 3); // enemy half
    store().moveTo(index, 5, 5); // occupied by the other soldier
    expect(store().deployments.A.units[index]).toEqual(before);
  });

  it("lets a unit shuffle within its own footprint", () => {
    store().selectType("soldier");
    store().place(5, 3);
    const index = store().deployments.A.units.findIndex((u) => u.type === "soldier");
    // A one-tile nudge must not collide with where the unit already stands.
    store().moveTo(index, 6, 4);
    expect(store().deployments.A.units[index]).toMatchObject({ row: 6, col: 4 });
  });

  it("never lets an HQ node be dragged off its anchor", () => {
    const before = store().deployments.A.units.filter((u) => u.type === "hq");
    store().moveTo(0, 6, 1);
    store().moveTo(1, 6, 1);
    expect(store().deployments.A.units.filter((u) => u.type === "hq")).toEqual(before);
  });

  it("rotates a placed unit through all four facings", () => {
    store().selectType("soldier");
    store().place(5, 3);
    const index = store().deployments.A.units.findIndex((u) => u.type === "soldier");
    store().selectPlaced(index);
    const seen = new Set<string>();
    for (let i = 0; i < 4; i++) {
      seen.add(store().deployments.A.units[index]?.facing ?? "");
      store().rotateSelected();
    }
    expect(seen).toEqual(new Set(["N", "E", "S", "W"]));
  });
});

describe("arc preview", () => {
  it("shows a soldier's four-tile firing line", () => {
    const preview = arcPreview("A", [], { type: "soldier", row: 8, col: 3, facing: "N" });
    expect(preview.covered).toHaveLength(4);
    expect(preview.covered.map((c) => c.row)).toEqual([7, 6, 5, 4]);
    expect(preview.blocked).toHaveLength(0);
  });

  it("shadows the lane behind your own sandbag — you cannot shoot through your wall", () => {
    const wall = { type: "sandbag" as const, row: 7, col: 3, facing: "N" as const };
    const shooter = { type: "soldier" as const, row: 8, col: 3, facing: "N" as const };
    const preview = arcPreview("A", [wall, shooter], shooter);
    // The ray stops at the wall: the sandbag tile is shown, nothing past it.
    expect(preview.covered).toHaveLength(1);
    expect(preview.covered[0]).toEqual({ row: 7, col: 3 });
    expect(preview.blocked.length).toBeGreaterThan(0);
  });

  it("gives the MG a 16-tile cone of widths 3,3,5,5", () => {
    const preview = arcPreview("A", [], { type: "mg", row: 8, col: 5, facing: "N" });
    const byRow = new Map<number, number>();
    for (const tile of preview.covered) byRow.set(tile.row, (byRow.get(tile.row) ?? 0) + 1);
    expect(byRow.get(7)).toBe(3);
    expect(byRow.get(6)).toBe(3);
    expect(byRow.get(5)).toBe(5);
    expect(byRow.get(4)).toBe(5);
    expect(preview.covered).toHaveLength(16);
  });

  it("gives the mortar an omnidirectional footprint that ignores cover", () => {
    const preview = arcPreview("A", [], { type: "mortar", row: 8, col: 5, facing: "N" });
    expect(preview.blocked).toHaveLength(0);
    // Chebyshev ring 3..10, clipped to the board.
    expect(preview.covered.length).toBeGreaterThan(50);
    expect(preview.covered.some((c) => c.row === 0)).toBe(true); // reaches their back row
  });

  it("returns nothing for a structure", () => {
    const preview = arcPreview("A", [], { type: "sandbag", row: 6, col: 3, facing: "N" });
    expect(preview.covered).toHaveLength(0);
  });
});

describe("vs AI mode", () => {
  beforeEach(() => {
    store().backHome();
    store().startAi("hard");
  });

  it("generates a complete, legal opposing army", () => {
    expect(store().phase).toBe("deploy");
    expect(store().mode).toBe("ai");
    expect(store().activeTeam).toBe("A");
    // Generated, not stored — and it must satisfy the same rules a human does.
    expect(validateDeployment(store().deployments.B).errors).toEqual([]);
  });

  it("draws a different opponent on each new match, even started back to back", () => {
    const shapes = new Set<string>();
    const layouts = new Set<string>();
    for (let i = 0; i < 12; i++) {
      store().backHome();
      store().startAi("hard");
      shapes.add(store().aiArchetype ?? "");
      layouts.add(JSON.stringify(store().deployments.B.units));
    }
    expect(shapes.size).toBeGreaterThan(1);
    expect(layouts.size).toBeGreaterThan(1);
  });

  it.each(["easy", "medium", "hard"] as const)("%s draws from its own pool", (difficulty) => {
    store().backHome();
    store().startAi(difficulty);
    const picked = store().aiArchetype;
    expect(picked).not.toBeNull();
    expect(DIFFICULTY_POOLS[difficulty]).toContain(picked);
    expect(store().aiDifficulty).toBe(difficulty);
  });

  it("skips the handoff and fights immediately on Ready", () => {
    store().autoFill();
    store().ready();
    expect(store().phase).toBe("battle");
    expect(store().result).not.toBeNull();
  });

  it("keeps the same opponent on a rematch, and reloads only your side", () => {
    store().autoFill();
    const mine = store().deployments.A.units;
    const theirs = store().deployments.B.units;
    store().ready();
    store().finish();
    store().rematch();
    expect(store().deployments.A.units).toEqual(mine);
    expect(store().deployments.B.units).toEqual(theirs);
  });

  it("puts the AI's HQ on its own drawn column, independent of yours", () => {
    const { hqAnchors } = store();
    const nodes = store().deployments.B.units.filter((u) => u.type === "hq");
    expect(nodes).toHaveLength(2);
    for (const a of hqAnchors.B) {
      expect(nodes.some((n) => n.row === a.row && n.col === a.col)).toBe(true);
    }
  });
});

describe("puzzle mode", () => {
  beforeEach(() => {
    store().backHome();
    store().startPuzzle("wide-angle");
  });

  it("shows the enemy formation and hands you only the kit", () => {
    expect(store().mode).toBe("puzzle");
    expect(store().deployments.B.units).toHaveLength(2);
    const kit = activeKit(store());
    expect(kit).toEqual([{ type: "mg", count: 1 }]);
  });

  it("caps placement at the kit, not the Classic army", () => {
    store().selectType("mg");
    store().place(5, 5);
    store().place(6, 2);
    expect(store().deployments.A.units.filter((u) => u.type === "mg")).toHaveLength(1);
    expect(isComplete(store().deployments.A, activeKit(store()))).toBe(true);
  });

  it("refuses units that are not in the kit", () => {
    store().selectType("tank");
    store().place(5, 5);
    expect(store().deployments.A.units.filter((u) => u.type === "tank")).toHaveLength(0);
  });

  it("is solved by the reference solution and unsolved by a bad one", () => {
    const puzzle = puzzleById("wide-angle");
    if (puzzle === undefined) throw new Error("missing puzzle");

    const good = simulateBattle({
      playerA: { team: "A", units: [...(puzzle.fixed ?? []), ...puzzle.referenceSolution] },
      playerB: puzzle.enemy,
      seed: 1,
    });
    expect(evaluatePuzzle(puzzle, good).solved).toBe(true);

    // Same MG, one column off: the cone now misses the right-hand target.
    const bad = simulateBattle({
      playerA: { team: "A", units: [{ type: "mg", row: 6, col: 3, facing: "N" }] },
      playerB: puzzle.enemy,
      seed: 1,
    });
    expect(evaluatePuzzle(puzzle, bad).solved).toBe(false);
  });
});
