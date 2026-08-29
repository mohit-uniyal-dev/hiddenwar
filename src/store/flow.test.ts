/**
 * End-to-end hotseat flow, exercised headlessly.
 *
 * The store never touches the DOM, so the whole match loop — deploy, ready,
 * hand off, deploy, battle, report, rematch — is testable without a browser.
 */

import { beforeEach, describe, expect, it } from "vitest";
import { arcPreview } from "../game/engine/preview.ts";
import { validateDeployment } from "../game/models/deployment.ts";
import { isComplete, useGame } from "./gameStore.ts";

const store = () => useGame.getState();

describe("hotseat flow", () => {
  beforeEach(() => {
    store().backHome();
    store().startMatch();
  });

  it("starts on the deployment screen as Blue", () => {
    expect(store().phase).toBe("deploy");
    expect(store().activeTeam).toBe("A");
    expect(store().deployments.A.units).toHaveLength(0);
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
    // No man's land is rows 6-7 and is permanently off limits (§B.1).
    store().place(6, 3);
    store().place(7, 3);
    // The enemy half is not yours to fill.
    store().place(2, 3);
    expect(store().deployments.A.units).toHaveLength(0);

    store().place(9, 3);
    expect(store().deployments.A.units).toHaveLength(1);

    // One unit per tile, hard rule.
    store().place(9, 3);
    expect(store().deployments.A.units).toHaveLength(1);
  });

  it("never exceeds the fixed army allowance", () => {
    store().selectType("tank");
    for (let col = 0; col < 8; col++) store().place(9, col);
    const tanks = store().deployments.A.units.filter((u) => u.type === "tank");
    expect(tanks).toHaveLength(2);
  });

  it("rotates a placed unit through all four facings", () => {
    store().selectType("soldier");
    store().place(9, 3);
    store().selectPlaced(0);
    const seen = new Set<string>();
    for (let i = 0; i < 4; i++) {
      seen.add(store().deployments.A.units[0]?.facing ?? "");
      store().rotateSelected();
    }
    expect(seen).toEqual(new Set(["N", "E", "S", "W"]));
  });
});

describe("arc preview", () => {
  it("shows a soldier's four-tile firing line", () => {
    const preview = arcPreview("A", [], { type: "soldier", row: 9, col: 3, facing: "N" });
    expect(preview.covered).toHaveLength(4);
    expect(preview.covered.map((c) => c.row)).toEqual([8, 7, 6, 5]);
    expect(preview.blocked).toHaveLength(0);
  });

  it("shadows the lane behind your own sandbag — you cannot shoot through your wall", () => {
    const wall = { type: "sandbag" as const, row: 8, col: 3, facing: "N" as const };
    const shooter = { type: "soldier" as const, row: 9, col: 3, facing: "N" as const };
    const preview = arcPreview("A", [wall, shooter], shooter);
    // The ray stops at the wall: the sandbag tile is shown, nothing past it.
    expect(preview.covered).toHaveLength(1);
    expect(preview.covered[0]).toEqual({ row: 8, col: 3 });
    expect(preview.blocked.length).toBeGreaterThan(0);
  });

  it("gives the MG a 16-tile cone of widths 3,3,5,5", () => {
    const preview = arcPreview("A", [], { type: "mg", row: 9, col: 5, facing: "N" });
    const byRow = new Map<number, number>();
    for (const tile of preview.covered) byRow.set(tile.row, (byRow.get(tile.row) ?? 0) + 1);
    expect(byRow.get(8)).toBe(3);
    expect(byRow.get(7)).toBe(3);
    expect(byRow.get(6)).toBe(5);
    expect(byRow.get(5)).toBe(5);
    expect(preview.covered).toHaveLength(16);
  });

  it("gives the mortar an omnidirectional footprint that ignores cover", () => {
    const preview = arcPreview("A", [], { type: "mortar", row: 11, col: 5, facing: "N" });
    expect(preview.blocked).toHaveLength(0);
    // Chebyshev ring 3..10, clipped to the board.
    expect(preview.covered.length).toBeGreaterThan(60);
    expect(preview.covered.some((c) => c.row > 11)).toBe(true); // fires backwards too
  });

  it("returns nothing for a structure", () => {
    const preview = arcPreview("A", [], { type: "sandbag", row: 9, col: 3, facing: "N" });
    expect(preview.covered).toHaveLength(0);
  });
});
