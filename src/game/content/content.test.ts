/**
 * Content validity.
 *
 * A puzzle that cannot be solved must never ship, so every one is checked by
 * running its reference answer through the real engine rather than by
 * inspection.
 *
 * The three handcrafted bot formations that used to live here were deleted
 * along with them: "vs. AI" generates a fresh legal army every match, which
 * gives far more variety than three stored shapes, and the stored ones needed
 * re-authoring by hand every time the board changed. §E.4's ghost-army path
 * will harvest real player deployments, not hand-written ones.
 */

import { describe, expect, it } from "vitest";
import { simulateBattle } from "../engine/simulate.ts";
import { validateDeployment } from "../models/deployment.ts";
import type { Deployment } from "../types.ts";
import { PUZZLES, evaluatePuzzle } from "./puzzles.ts";

describe("puzzles", () => {
  it("ships five of them, with unique ids", () => {
    expect(PUZZLES).toHaveLength(5);
    expect(new Set(PUZZLES.map((p) => p.id)).size).toBe(5);
  });

  it.each(PUZZLES)("$name — the reference solution uses exactly the kit given", (puzzle) => {
    const counts = new Map<string, number>();
    for (const unit of puzzle.referenceSolution) {
      counts.set(unit.type, (counts.get(unit.type) ?? 0) + 1);
    }
    for (const entry of puzzle.kit) {
      expect(counts.get(entry.type) ?? 0, `${puzzle.id}: ${entry.type}`).toBe(entry.count);
    }
    expect(counts.size).toBe(puzzle.kit.length);
  });

  it.each(PUZZLES)("$name — the reference solution is a legal placement", (puzzle) => {
    const deployment: Deployment = {
      team: "A",
      units: [...(puzzle.fixed ?? []), ...puzzle.referenceSolution],
    };
    const result = validateDeployment(deployment, puzzle.kit);
    expect(result.errors).toEqual([]);
  });

  it.each(PUZZLES)("$name — IS SOLVABLE by its reference solution", (puzzle) => {
    const result = simulateBattle({
      playerA: { team: "A", units: [...(puzzle.fixed ?? []), ...puzzle.referenceSolution] },
      playerB: puzzle.enemy,
      seed: 1,
    });
    const outcome = evaluatePuzzle(puzzle, result);
    const failed = outcome.checks.filter((c) => !c.passed).map((c) => c.objective.label);
    expect(failed, `${puzzle.id} failed: ${failed.join("; ")}`).toEqual([]);
    expect(outcome.solved).toBe(true);
  });

  it.each(PUZZLES)("$name — resolves quickly enough to feel like a puzzle", (puzzle) => {
    const result = simulateBattle({
      playerA: { team: "A", units: [...(puzzle.fixed ?? []), ...puzzle.referenceSolution] },
      playerB: puzzle.enemy,
      seed: 1,
    });
    expect(result.durationSeconds).toBeLessThanOrEqual(45);
  });

  it("an empty deployment solves none of them", () => {
    for (const puzzle of PUZZLES) {
      const result = simulateBattle({
        playerA: { team: "A", units: [...(puzzle.fixed ?? [])] },
        playerB: puzzle.enemy,
        seed: 1,
      });
      expect(evaluatePuzzle(puzzle, result).solved, puzzle.id).toBe(false);
    }
  });
});
