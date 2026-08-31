/**
 * Formation generation for the balance sweep.
 *
 * A caveat worth stating plainly, because it bounds everything the sweep can
 * tell you: **uniformly random formations are not how humans play.** A sweep
 * over pure noise would measure the game nobody is playing. So formations are
 * generated from archetypes — the shapes people actually build — with jitter,
 * and pure random is kept only as a control to compare against.
 *
 * The sweep is good at extremes: a unit that never kills anything, a unit that
 * appears in every win, a duration distribution that misses its target. It is
 * not a substitute for playtesting, and it cannot tell you whether deployment
 * is fun.
 */

import { BOARD, type HqAnchors } from "../config/gameConfig.ts";
import { PLACEABLE_ARMY } from "../config/units.ts";
import { canPlace } from "../models/deployment.ts";
import type { Rng } from "../rng/mulberry32.ts";
import type { Coord, Deployment, Direction, PlacedUnit, Team, UnitTypeId } from "../types.ts";

export type ArchetypeId =
  | "line"
  | "turtle"
  | "spread"
  | "artillery"
  | "random"
  | "hqrush"
  | "hqguard";

export interface Archetype {
  readonly id: ArchetypeId;
  readonly label: string;
  /** Shown after the battle: how this shape plays, and where it is weak. */
  readonly tell: string;
  /** Preferred depths (0 = front rank of your zone, 3 = rear) per unit type. */
  readonly depths: Record<Exclude<UnitTypeId, "hq">, number[]>;
  /** "guard" hugs the HQ with sandbags; "scatter" spreads them. */
  readonly sandbags: "guard" | "scatter";
  /**
   * Bias every unit toward a column. Line weapons only ever hit the column they
   * face down, so aligning them with the enemy HQ is the obvious way to convert
   * a known objective into a win — this is here to measure whether that obvious
   * play is also the dominant one.
   */
  readonly columnBias?: "enemyHq" | "ownHq";
}

export const ARCHETYPES: readonly Archetype[] = [
  {
    id: "line",
    label: "Front line",
    tell: "Holds the whole width of the front rank. Solid everywhere, concentrated nowhere — it rarely masses enough force on one lane to finish an objective quickly.",
    depths: {
      atgun: [0, 1],
      soldier: [0],
      mg: [0, 1],
      tank: [1, 0],
      mortar: [3, 2],
      sandbag: [1, 2],
    },
    sandbags: "guard",
  },
  {
    id: "turtle",
    label: "Turtle",
    tell: "Sits back and waits. Ceding the front rank means most of its army spends the battle out of range of anything.",
    depths: {
      atgun: [1, 2],
      soldier: [1, 2],
      mg: [1, 2],
      tank: [2, 1],
      mortar: [4],
      sandbag: [2, 3],
    },
    sandbags: "guard",
  },
  {
    id: "spread",
    label: "Spread",
    tell: "Deliberately dispersed to blunt splash. Safe from the mortar, but thin in every individual lane.",
    depths: {
      atgun: [0, 1],
      soldier: [0, 1, 2],
      mg: [0, 1],
      tank: [1, 2],
      mortar: [2, 3],
      sandbag: [1, 2, 3, 4],
    },
    sandbags: "scatter",
  },
  {
    id: "artillery",
    label: "Artillery-heavy",
    tell: "Leads with the mortar and keeps the rest back. Strong chip damage, but almost nothing contesting the ground in between.",
    depths: { atgun: [1, 2], soldier: [0, 1], mg: [1], tank: [2, 3], mortar: [2], sandbag: [0, 1] },
    sandbags: "scatter",
  },
  {
    id: "hqrush",
    label: "HQ rush",
    tell: "Everything aligned on your HQ's column. Brutal if the lane opens — and it collapses against a defence that concentrates on the same lane.",
    depths: {
      atgun: [0, 1],
      soldier: [0, 1],
      mg: [0, 1],
      tank: [1, 0],
      mortar: [3, 4],
      sandbag: [2, 3],
    },
    sandbags: "scatter",
    columnBias: "enemyHq",
  },
  {
    id: "hqguard",
    label: "HQ lane guard",
    tell: "Everything massed on its own HQ's column. Nearly unbreakable head-on, but it concedes the rest of the board, so it struggles to reach your objective.",
    depths: {
      atgun: [1, 0],
      soldier: [0, 1],
      mg: [0, 1],
      tank: [1, 2],
      mortar: [4],
      sandbag: [1, 2],
    },
    sandbags: "guard",
    columnBias: "ownHq",
  },
  {
    id: "random",
    label: "Random (control)",
    tell: "No particular shape at all. Unpredictable, and usually incoherent.",
    depths: {
      soldier: [0, 1, 2, 3],
      mg: [0, 1, 2, 3],
      atgun: [0, 1, 2, 3],
      tank: [0, 1, 2, 3],
      mortar: [0, 1, 2, 3],
      sandbag: [0, 1, 2, 3],
    },
    sandbags: "scatter",
  },
];

export function archetypeById(id: ArchetypeId): Archetype {
  return ARCHETYPES.find((a) => a.id === id) ?? (ARCHETYPES[0] as Archetype);
}

/** With two nodes a side, "the HQ column" is the midpoint between them. */
function biasCol(archetype: Archetype, anchors: HqAnchors, team: Team): number {
  const target =
    archetype.columnBias === "ownHq" ? anchors[team] : anchors[team === "A" ? "B" : "A"];
  const cols = target.map((a) => a.col);
  const sum = cols.reduce((x, y) => x + y, 0);
  return Math.round(sum / Math.max(1, cols.length));
}

/** Depth 0 is the rank nearest the enemy, whichever side you are on. */
function rowAtDepth(team: Team, depth: number): number {
  return team === "A" ? BOARD.teamARows[0] + depth : BOARD.teamBRows[1] - depth;
}

function shuffled(values: number[], rng: Rng): number[] {
  const out = [...values];
  for (let i = out.length - 1; i > 0; i--) {
    const j = rng.nextInt(i + 1);
    const a = out[i];
    const b = out[j];
    if (a !== undefined && b !== undefined) {
      out[i] = b;
      out[j] = a;
    }
  }
  return out;
}

const ALL_COLS = Array.from({ length: BOARD.cols }, (_, i) => i);
/** Depth 0 is the rank nearest the enemy; zones are four rows deep. */
const ALL_DEPTHS = [0, 1, 2, 3];

/**
 * Build one legal army for a team, in the shape of the given archetype.
 *
 * The HQ goes down first at the drawn anchor, then each unit takes the first
 * legal tile from its preferred depths — falling back to any depth rather than
 * failing, so a generator can never emit an incomplete army.
 */
export function generateFormation(
  team: Team,
  anchors: HqAnchors,
  archetype: Archetype,
  rng: Rng,
  craters: readonly Coord[] = [],
): Deployment {
  const nodes = anchors[team];
  const units: PlacedUnit[] = nodes.map((a) => ({
    type: "hq" as const,
    row: a.row,
    col: a.col,
    facing: "N" as const,
  }));
  const facing: Direction = team === "A" ? "N" : "S";

  const tryPlace = (type: UnitTypeId, depths: number[], cols: number[]): boolean => {
    for (const depth of depths) {
      const row = rowAtDepth(team, depth);
      for (const col of cols) {
        if (canPlace(team, type, row, col, units, -1, craters)) {
          units.push({ type, row, col, facing: type === "sandbag" ? "N" : facing });
          return true;
        }
      }
    }
    return false;
  };

  // Sandbags that guard the HQ want the tiles between the nodes and the enemy.
  const guardCols = shuffled(
    nodes.flatMap((a) => [a.col - 1, a.col, a.col + 1]).filter((c) => c >= 0 && c < BOARD.cols),
    rng,
  );

  for (const entry of PLACEABLE_ARMY) {
    for (let n = 0; n < entry.count; n++) {
      const preferred = archetype.depths[entry.type as Exclude<UnitTypeId, "hq">];
      const spread = shuffled(ALL_COLS, rng);
      const biased =
        archetype.columnBias === undefined
          ? spread
          : // Nearest columns to the target lane first, ties broken by the
            // shuffle so formations still vary between matches.
            [...spread].sort(
              (x, y) =>
                Math.abs(x - biasCol(archetype, anchors, team)) -
                Math.abs(y - biasCol(archetype, anchors, team)),
            );
      const cols =
        entry.type === "sandbag" && archetype.sandbags === "guard" && n < guardCols.length
          ? [...guardCols, ...biased]
          : biased;

      const depths =
        entry.type === "sandbag" && archetype.sandbags === "guard"
          ? [
              ...ALL_DEPTHS.filter((d) => !nodes.some((a) => rowAtDepth(team, d) === a.row)),
              ...preferred,
            ]
          : preferred;

      // Preferred depths first, then anywhere legal — never emit a short army.
      if (!tryPlace(entry.type, depths, cols)) {
        tryPlace(entry.type, shuffled(ALL_DEPTHS, rng), shuffled(ALL_COLS, rng));
      }
    }
  }

  return { team, units };
}

export type Difficulty = "easy" | "medium" | "hard";

/**
 * Difficulty tiers, drawn from measured head-to-head win rates rather than
 * guesswork — see `scripts/matrix.ts`. Overall win rate against the full field:
 *
 *   turtle 25%   artillery 27%   random 38%
 *   spread 54%   line 61%        hqguard 63%   hqrush 67%
 *
 * So the tiers are not a difficulty slider bolted on top of one AI; they are
 * genuinely different opponents that happen to be ordered by how well they
 * actually perform.
 */
export const DIFFICULTY_POOLS: Record<Difficulty, readonly ArchetypeId[]> = {
  easy: ["turtle", "artillery"],
  medium: ["random", "spread"],
  hard: ["line", "hqguard", "hqrush"],
};

export const DIFFICULTIES: ReadonlyArray<{
  readonly id: Difficulty;
  readonly label: string;
  readonly blurb: string;
}> = [
  { id: "easy", label: "Recruit", blurb: "Hangs back and lets you dictate the fight." },
  { id: "medium", label: "Regular", blurb: "Competent, unpredictable shapes." },
  { id: "hard", label: "Veteran", blurb: "Masses force on a lane and commits to it." },
];
