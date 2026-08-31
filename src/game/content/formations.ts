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

import { BOARD, type HqAnchors, zoneOwner } from "../config/gameConfig.ts";
import { PLACEABLE_ARMY, UNITS } from "../config/units.ts";
import { conePattern, footprint, indirectPattern, linePattern } from "../engine/geometry.ts";
import { hasLineOfSight } from "../engine/lineOfSight.ts";
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
 * Can a unit standing here actually shoot into enemy territory?
 *
 * This is the check a player makes for free by looking at the arc-preview
 * overlay, and the generator used to skip it entirely — so it parked soldiers
 * behind craters and in rear rows whose range stops short of the enemy zone.
 * That inflated the idle-unit metric to 22.8% and made it unreadable: the
 * number was measuring the generator, not the design.
 *
 * Only public information is used, which is what keeps this honest — terrain,
 * your own units, and the enemy nodes, whose positions are published. The
 * opponent's formation is hidden and stays hidden.
 */
function hasFiringLine(
  team: Team,
  type: UnitTypeId,
  row: number,
  col: number,
  facing: Direction,
  blocks: ReadonlySet<number>,
): boolean {
  const spec = UNITS[type];
  if ((spec.damage ?? 0) === 0) return true; // sandbags and nodes never fire
  const min = spec.minRange ?? 1;
  const max = spec.maxRange ?? 1;
  const enemy: Team = team === "A" ? "B" : "A";
  const origin: Coord = { row, col };

  // Indirect fire ignores cover, so reach is the whole question.
  if (spec.ignoresLineOfSight === true) {
    return indirectPattern(origin, min, max).some((t) => zoneOwner(t.row) === enemy);
  }

  const tiles =
    spec.pattern === "cone"
      ? conePattern(origin, facing, min, max)
      : linePattern(origin, facing, min, max);
  return tiles.some(
    (t) =>
      zoneOwner(t.row) === enemy &&
      hasLineOfSight(origin, t, (r, c) => blocks.has(r * BOARD.cols + c)),
  );
}

/**
 * Build one legal army for a team, in the shape of the given archetype.
 *
 * Nodes go down first at the drawn anchors, then sandbags, then the guns. That
 * order matters: sandbags block line of sight, so a weapon cannot be checked
 * for a clear shot until the walls it must shoot around are already standing.
 *
 * Each unit takes the first tile that is legal AND has a firing line, working
 * down its archetype's preferred depths; it falls back to merely legal rather
 * than failing, so a generator can never emit an incomplete army.
 */
export function generateFormation(
  team: Team,
  anchors: HqAnchors,
  archetype: Archetype,
  rng: Rng,
  craters: readonly Coord[] = [],
  /** Off only for the harness, to measure how much of "idle units" was the tool. */
  sightAware = true,
): Deployment {
  const nodes = anchors[team];
  const units: PlacedUnit[] = nodes.map((a) => ({
    type: "hq" as const,
    row: a.row,
    col: a.col,
    facing: "N" as const,
  }));
  const facing: Direction = team === "A" ? "N" : "S";

  // Everything that stops a bullet: terrain, plus every node on the board —
  // the enemy's are published, so accounting for them is not cheating.
  const blocks = new Set<number>();
  for (const c of craters) blocks.add(c.row * BOARD.cols + c.col);
  for (const side of [anchors.A, anchors.B]) {
    for (const n of side) {
      for (const t of footprint(n.row, n.col, UNITS.hq.width, UNITS.hq.height)) {
        blocks.add(t.row * BOARD.cols + t.col);
      }
    }
  }

  const tryPlace = (
    type: UnitTypeId,
    depths: number[],
    cols: number[],
    requireSight: boolean,
  ): boolean => {
    const unitFacing: Direction = type === "sandbag" ? "N" : facing;
    for (const depth of depths) {
      const row = rowAtDepth(team, depth);
      for (const col of cols) {
        if (!canPlace(team, type, row, col, units, -1, craters)) continue;
        if (requireSight && !hasFiringLine(team, type, row, col, unitFacing, blocks)) continue;
        units.push({ type, row, col, facing: unitFacing });
        if (UNITS[type].blocksLineOfSight === true) blocks.add(row * BOARD.cols + col);
        return true;
      }
    }
    return false;
  };

  // Sandbags that guard the HQ want the tiles between the nodes and the enemy.
  const guardCols = shuffled(
    nodes.flatMap((a) => [a.col - 1, a.col, a.col + 1]).filter((c) => c >= 0 && c < BOARD.cols),
    rng,
  );

  /*
    The control archetype opts out of the sight check on purpose. Its whole job
    is to be incoherent — it is the baseline every other shape is measured
    against, and a "random" formation that quietly places well is not a baseline.
  */
  const smart = sightAware && archetype.id !== "random";

  // Walls first, then guns: see the note on ordering above.
  const ordered = [
    ...PLACEABLE_ARMY.filter((e) => e.type === "sandbag"),
    ...PLACEABLE_ARMY.filter((e) => e.type !== "sandbag"),
  ];

  for (const entry of ordered) {
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

      // Preferred depths with a clear shot, then preferred depths anywhere,
      // then anywhere legal at all — never emit a short army.
      if (smart && tryPlace(entry.type, depths, cols, true)) continue;
      if (tryPlace(entry.type, depths, cols, false)) continue;
      tryPlace(entry.type, shuffled(ALL_DEPTHS, rng), shuffled(ALL_COLS, rng), false);
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
