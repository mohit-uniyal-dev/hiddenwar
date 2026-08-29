/**
 * Puzzle mode. Roadmap §E.2 and §F.2.
 *
 * A fixed, VISIBLE enemy formation; you deploy a small kit; win the simulation.
 *
 * This is the highest value-per-line feature in the whole roadmap, because it
 * is four things at once: the tutorial engine, daily-retention content on a
 * platform with no install and no push notifications, a free global leaderboard
 * (everyone gets the same seed), and single-player content that sidesteps the
 * cold-start matchmaking problem entirely.
 *
 * The five here form a deliberate curriculum — facing, then cones, then cover,
 * then the HQ, then artillery reach.
 */

import type { Roster } from "../config/units.ts";
import type { BattleResult } from "../engine/simulate.ts";
import type { Deployment, Direction, PlacedUnit, UnitTypeId } from "../types.ts";

function u(type: UnitTypeId, row: number, col: number, facing: Direction = "N"): PlacedUnit {
  return { type, row, col, facing };
}

export type ObjectiveKind =
  | "win"
  | "destroyAllEnemies"
  | "destroyEnemyHq"
  | "hqSurvives"
  | "loseAtMost";

export interface Objective {
  readonly kind: ObjectiveKind;
  readonly label: string;
  /** For "loseAtMost": the maximum number of your units that may be destroyed. */
  readonly value?: number;
}

export interface Puzzle {
  readonly id: string;
  readonly name: string;
  /** What this puzzle exists to teach. */
  readonly teaches: string;
  readonly brief: string;
  readonly hint: string;
  readonly kit: Roster;
  readonly enemy: Deployment;
  readonly objectives: readonly Objective[];
  /**
   * A known-good answer. Kept in the data rather than the test file so the
   * suite can prove every puzzle is actually solvable before it ships — an
   * unsolvable tutorial is worse than no tutorial.
   */
  readonly referenceSolution: readonly PlacedUnit[];
}

/**
 * An inert sentry parked in a corner facing off-board.
 *
 * Several puzzles need the enemy to keep at least one combat-capable unit
 * alive, because army destruction wins outright (§B.3) and would otherwise end
 * the battle before the real objective could be attempted.
 */
const SENTRY = u("soldier", 0, 0, "N");

export const PUZZLES: readonly Puzzle[] = [
  {
    id: "line-of-fire",
    name: "Line of Fire",
    teaches: "Facing and range",
    brief:
      "One soldier, one target. A soldier fires in a straight line along its facing, out to 4 tiles — and nothing else.",
    hint: "No man's land eats two rows of that range. Place well forward, and check the arc preview before you commit.",
    kit: [{ type: "soldier", count: 1 }],
    enemy: {
      team: "B",
      // Facing west, into empty board: it will never shoot back.
      units: [u("soldier", 5, 5, "W")],
    },
    objectives: [{ kind: "destroyAllEnemies", label: "Destroy the enemy force" }],
    referenceSolution: [u("soldier", 8, 5, "N")],
  },

  {
    id: "wide-angle",
    name: "Wide Angle",
    teaches: "The machine gun cone",
    brief:
      "Two targets, four columns apart, and one machine gun. Its cone starts narrow and widens with distance: 3, 3, 5, 5 tiles.",
    hint: "At point blank the cone is only 3 wide. You need the far end of it, where it opens to 5.",
    kit: [{ type: "mg", count: 1 }],
    enemy: {
      team: "B",
      units: [u("soldier", 5, 3, "W"), u("soldier", 5, 7, "E")],
    },
    objectives: [{ kind: "destroyAllEnemies", label: "Destroy BOTH targets" }],
    referenceSolution: [u("mg", 8, 5, "N")],
  },

  {
    id: "break-the-line",
    name: "Break the Line",
    teaches: "Cover, and what breaks it",
    brief:
      "A sandbag wall, and a soldier sheltering behind it. Rifle fire barely scratches sandbags — a tank shell removes one outright.",
    hint: "Your soldiers will happily plink at the wall for 3 damage a shot. Put the tank where it matters and let it do the work.",
    kit: [
      { type: "tank", count: 1 },
      { type: "soldier", count: 2 },
    ],
    enemy: {
      team: "B",
      units: [u("sandbag", 5, 4), u("sandbag", 5, 5), u("sandbag", 5, 6), u("soldier", 4, 5, "S")],
    },
    // Only the defender has to fall — the flanking sandbags may be left standing.
    objectives: [{ kind: "win", label: "Win the battle" }],
    referenceSolution: [u("tank", 8, 5, "N"), u("soldier", 8, 3, "N"), u("soldier", 8, 7, "N")],
  },

  {
    id: "under-fire",
    name: "Under Fire",
    teaches: "Silencing artillery",
    brief:
      "An enemy mortar is ranged in on your half, and it fires over cover — sandbags will not save your HQ. It is also the flimsiest thing on the board at 35 HP.",
    hint: "Two rifles in the same column both reach it, and living units never block each other. Kill it before it ever fires.",
    kit: [
      { type: "soldier", count: 2 },
      { type: "hq", count: 1 },
    ],
    enemy: {
      team: "B",
      units: [u("mortar", 5, 5, "S"), SENTRY],
    },
    objectives: [
      { kind: "hqSurvives", label: "Your HQ survives" },
      { kind: "loseAtMost", label: "Lose no units", value: 0 },
    ],
    referenceSolution: [u("soldier", 8, 5, "N"), u("soldier", 9, 5, "N"), u("hq", 11, 9)],
  },

  {
    id: "deep-strike",
    name: "Deep Strike",
    teaches: "Artillery reach",
    brief:
      "Their HQ is dug in at the back of their zone. Rifles reach two enemy rows, tanks reach four — only the mortar reaches all six.",
    hint: "The mortar has a maximum range as well as a minimum. Sitting at the very back of your own zone puts the target out of reach.",
    kit: [{ type: "mortar", count: 1 }],
    enemy: {
      team: "B",
      units: [u("hq", 1, 5), SENTRY],
    },
    objectives: [{ kind: "destroyEnemyHq", label: "Destroy the enemy HQ" }],
    referenceSolution: [u("mortar", 8, 5, "N")],
  },
];

export function puzzleById(id: string): Puzzle | undefined {
  return PUZZLES.find((p) => p.id === id);
}

export interface ObjectiveResult {
  readonly objective: Objective;
  readonly passed: boolean;
}

export interface PuzzleOutcome {
  readonly solved: boolean;
  readonly checks: readonly ObjectiveResult[];
}

/** The player is always team A in a puzzle. */
export function evaluatePuzzle(puzzle: Puzzle, result: BattleResult): PuzzleOutcome {
  const lost = result.stats.units.filter((unit) => unit.team === "A" && !unit.survived).length;
  const enemyHqGone = result.stats.units.some(
    (unit) => unit.team === "B" && unit.type === "hq" && !unit.survived,
  );
  const everyEnemyGone = result.stats.units
    .filter((unit) => unit.team === "B")
    .every((unit) => !unit.survived);

  const checks = puzzle.objectives.map((objective): ObjectiveResult => {
    switch (objective.kind) {
      case "win":
        return { objective, passed: result.winner === "A" };
      case "destroyAllEnemies":
        return { objective, passed: everyEnemyGone };
      case "destroyEnemyHq":
        return { objective, passed: enemyHqGone };
      case "hqSurvives":
        return {
          objective,
          passed: result.stats.teams.A.hqHpRemaining > 0,
        };
      case "loseAtMost":
        return { objective, passed: lost <= (objective.value ?? 0) };
    }
  });

  return { solved: checks.every((c) => c.passed), checks };
}
