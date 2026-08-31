/**
 * The debrief is the instrument that turns a loss into an edit, so its claims
 * have to be true. A debrief that points at the wrong lane is worse than none:
 * it spends the player's next attempt on a change that could not have helped.
 */

import { describe, expect, it } from "vitest";
import { BOARD, hqAnchorsForSeed, terrainForSeed } from "../config/gameConfig.ts";
import { archetypeById, generateFormation } from "../content/formations.ts";
import { bestSingleEdit, buildDebrief } from "../engine/debrief.ts";
import { simulateBattle } from "../engine/simulate.ts";
import { mulberry32 } from "../rng/mulberry32.ts";
import type { Coord, Deployment, PlacedUnit, Team } from "../types.ts";

function board(seed: number) {
  const anchors = hqAnchorsForSeed(seed);
  const craters = terrainForSeed(seed, anchors);
  return { anchors, craters };
}

function armies(seed: number, aId = "line", bId = "hqrush") {
  const { anchors, craters } = board(seed);
  const playerA = generateFormation(
    "A",
    anchors,
    archetypeById(aId as "line"),
    mulberry32(seed),
    craters,
  );
  const playerB = generateFormation(
    "B",
    anchors,
    archetypeById(bId as "hqrush"),
    mulberry32(seed + 7919),
    craters,
  );
  return { playerA, playerB, craters };
}

describe("buildDebrief", () => {
  it("reports one lane per column, whatever the formation", () => {
    const { playerA, playerB, craters } = armies(41);
    const result = simulateBattle({ playerA, playerB, seed: 41, craters });
    const debrief = buildDebrief(result.events, result.stats, "A");
    expect(debrief.lanes).toHaveLength(BOARD.cols);
    expect(debrief.lanes.map((l) => l.col)).toEqual([...Array(BOARD.cols).keys()]);
  });

  it("attributes damage to the column the SHOOTER stood in, not the target's", () => {
    // Two soldiers facing each other down one column, nothing else. Every point
    // of damage in the battle is dealt from, and taken in, that one column.
    const col = 3;
    const playerA: Deployment = {
      team: "A",
      units: [{ type: "soldier", row: 5, col, facing: "N" }],
    };
    const playerB: Deployment = {
      team: "B",
      units: [{ type: "soldier", row: 3, col, facing: "S" }],
    };
    const result = simulateBattle({ playerA, playerB, seed: 5 });
    const debrief = buildDebrief(result.events, result.stats, "A");
    const lane = debrief.lanes[col];
    expect(lane?.dealt).toBeGreaterThan(0);
    expect(lane?.taken).toBeGreaterThan(0);
    for (const other of debrief.lanes) {
      if (other.col === col) continue;
      expect(other.dealt).toBe(0);
      expect(other.taken).toBe(0);
    }
  });

  it("flags a unit that dealt nothing as a dead lane, and an unoccupied column as empty", () => {
    // A soldier walled in behind its own sandbag can never fire down its lane.
    const playerA: Deployment = {
      team: "A",
      units: [
        { type: "soldier", row: 7, col: 2, facing: "N" },
        { type: "sandbag", row: 6, col: 2, facing: "N" },
      ],
    };
    const playerB: Deployment = {
      team: "B",
      units: [{ type: "soldier", row: 0, col: 7, facing: "S" }],
    };
    const result = simulateBattle({ playerA, playerB, seed: 9 });
    const debrief = buildDebrief(result.events, result.stats, "A");
    expect(debrief.lanes[2]?.dead).toBe(true);
    expect(debrief.findings.some((f) => f.includes("dealt no damage at all"))).toBe(true);
    expect(debrief.findings.some((f) => f.includes("completely empty"))).toBe(true);
  });

  it("reads the node gap off the board, and says what that gap implies", () => {
    for (const seed of [3, 17, 88, 204]) {
      const { playerA, playerB, craters } = armies(seed);
      const result = simulateBattle({ playerA, playerB, seed, craters });
      const debrief = buildDebrief(result.events, result.stats, "A");
      expect([2, 3]).toContain(debrief.nodeGap);
      const line = debrief.findings.find((f) => f.includes("columns apart"));
      expect(line).toBeDefined();
      // The advice must match the board, not be generic.
      expect(line?.includes("threaten both")).toBe(debrief.nodeGap <= 2);
    }
  });

  it("debriefs the two sides differently — they made different mistakes", () => {
    const { playerA, playerB, craters } = armies(63);
    const result = simulateBattle({ playerA, playerB, seed: 63, craters });
    const a = buildDebrief(result.events, result.stats, "A");
    const b = buildDebrief(result.events, result.stats, "B");
    expect(a.team).toBe("A");
    expect(b.team).toBe("B");
    expect(a.lanes.map((l) => l.dealt)).not.toEqual(b.lanes.map((l) => l.dealt));
  });

  it("names the column a lost node was actually killed from", () => {
    // One tank, one lane, one node. There is exactly one possible answer.
    const col = 4;
    const playerA: Deployment = {
      team: "A",
      // A combat unit parked in a lane of its own: without one, army
      // destruction ends the battle on tick 0 and no damage is ever dealt.
      units: [
        { type: "hq", row: 7, col, facing: "N" },
        { type: "soldier", row: 8, col: 0, facing: "N" },
      ],
    };
    const playerB: Deployment = {
      team: "B",
      units: [{ type: "tank", row: 3, col, facing: "S" }],
    };
    const result = simulateBattle({ playerA, playerB, seed: 11 });
    const debrief = buildDebrief(result.events, result.stats, "A");
    expect(debrief.nodes[0]?.threatColumn).toBe(col);
  });
});

describe("bestSingleEdit", () => {
  const seed = 10_007;

  it("returns a legal move for a real army, or nothing at all", () => {
    const { playerA, playerB, craters } = armies(seed);
    const original = simulateBattle({ playerA, playerB, seed, craters });
    const edit = bestSingleEdit(playerA, playerB, seed, craters, original);
    if (edit === null) return; // a genuinely optimal placement is a valid answer

    const unit = playerA.units[edit.unitIndex] as PlacedUnit;
    expect(unit.type).not.toBe("hq"); // nodes are drawn, never moved
    expect(edit.from).toEqual({ row: unit.row, col: unit.col });
    // Inside Blue's own zone, and not onto a crater.
    expect(edit.to.row).toBeGreaterThanOrEqual(BOARD.teamARows[0]);
    expect(edit.to.row).toBeLessThanOrEqual(BOARD.teamARows[1]);
    expect(craters.some((c: Coord) => c.row === edit.to.row && c.col === edit.to.col)).toBe(false);
  });

  it("actually improves the result it claims to improve", () => {
    // The whole value of this feature is that it replays real battles rather
    // than guessing, so the suggestion must survive being replayed.
    let checked = 0;
    for (const s of [10_007, 10_038, 10_069, 10_100]) {
      const { playerA, playerB, craters } = armies(s);
      const original = simulateBattle({ playerA, playerB, seed: s, craters });
      const edit = bestSingleEdit(playerA, playerB, s, craters, original);
      if (edit === null) continue;
      checked++;

      const moved: Deployment = {
        team: "A",
        units: playerA.units.map((u, i) =>
          i === edit.unitIndex ? { ...u, row: edit.to.row, col: edit.to.col } : u,
        ),
      };
      const after = simulateBattle({ playerA: moved, playerB, seed: s, craters });
      const score = (r: typeof after, team: Team): number =>
        (r.winner === team ? 1000 : r.winner === "draw" ? 0 : -1000) +
        r.stats.teams[team].hqHpRemaining -
        r.stats.teams[team === "A" ? "B" : "A"].hqHpRemaining;

      expect(score(after, "A")).toBeGreaterThan(score(original, "A"));
      if (edit.wins) expect(after.winner).toBe("A");
    }
    expect(checked).toBeGreaterThan(0);
  });

  it("works for Orange as well as Blue", () => {
    const { playerA, playerB, craters } = armies(seed);
    const original = simulateBattle({ playerA, playerB, seed, craters });
    const edit = bestSingleEdit(playerB, playerA, seed, craters, original);
    if (edit === null) return;
    expect(edit.to.row).toBeGreaterThanOrEqual(BOARD.teamBRows[0]);
    expect(edit.to.row).toBeLessThanOrEqual(BOARD.teamBRows[1]);
  });
});
