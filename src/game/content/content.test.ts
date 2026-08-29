/**
 * Content validity.
 *
 * Two things must never ship broken: a bot formation the rules would reject,
 * and a puzzle that cannot be solved. Both are checked by running the real
 * engine over the real data rather than by inspection.
 */

import { describe, expect, it } from "vitest";
import { simulateBattle } from "../engine/simulate.ts";
import { validateDeployment } from "../models/deployment.ts";
import type { Deployment } from "../types.ts";
import { BOTS } from "./bots.ts";
import { PUZZLES, evaluatePuzzle } from "./puzzles.ts";

describe("bot formations", () => {
  it("ships three of them", () => {
    expect(BOTS).toHaveLength(3);
    expect(new Set(BOTS.map((b) => b.id)).size).toBe(3);
  });

  it.each(BOTS)("$name is a legal Classic army", (bot) => {
    const result = validateDeployment(bot.deployment);
    expect(result.errors).toEqual([]);
    expect(result.ok).toBe(true);
  });

  it.each(BOTS)("$name actually fights — it deals damage", (bot) => {
    // A formation whose units all sit out of range is a punching bag, not an
    // opponent. Play it against a mirror of itself flipped to Blue.
    const mirror: Deployment = {
      team: "A",
      units: bot.deployment.units.map((unit) => ({
        ...unit,
        row: 13 - unit.row - (unit.type === "hq" ? 1 : 0),
        facing: unit.facing === "S" ? "N" : unit.facing === "N" ? "S" : unit.facing,
      })),
    };
    const result = simulateBattle({ playerA: mirror, playerB: bot.deployment, seed: 5 });
    expect(result.stats.teams.B.damageDealt).toBeGreaterThan(0);
  });
});

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
    const deployment: Deployment = { team: "A", units: puzzle.referenceSolution };
    const result = validateDeployment(deployment, puzzle.kit);
    expect(result.errors).toEqual([]);
  });

  it.each(PUZZLES)("$name — IS SOLVABLE by its reference solution", (puzzle) => {
    const result = simulateBattle({
      playerA: { team: "A", units: puzzle.referenceSolution },
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
      playerA: { team: "A", units: puzzle.referenceSolution },
      playerB: puzzle.enemy,
      seed: 1,
    });
    expect(result.durationSeconds).toBeLessThanOrEqual(45);
  });

  it("an empty deployment solves none of them", () => {
    for (const puzzle of PUZZLES) {
      const result = simulateBattle({
        playerA: { team: "A", units: [] },
        playerB: puzzle.enemy,
        seed: 1,
      });
      expect(evaluatePuzzle(puzzle, result).solved, puzzle.id).toBe(false);
    }
  });
});
