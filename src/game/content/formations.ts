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
import type { Deployment, Direction, PlacedUnit, Team, UnitTypeId } from "../types.ts";

export type ArchetypeId =
  | "line"
  | "turtle"
  | "spread"
  | "artillery"
  | "random"
  | "hqrush"
  | "hqguard";

interface Archetype {
  readonly id: ArchetypeId;
  readonly label: string;
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
    depths: { soldier: [0], mg: [0, 1], tank: [1, 0], mortar: [3, 2], sandbag: [1, 2] },
    sandbags: "guard",
  },
  {
    id: "turtle",
    label: "Turtle",
    depths: { soldier: [1, 2], mg: [1, 2], tank: [2, 1], mortar: [3], sandbag: [2, 3] },
    sandbags: "guard",
  },
  {
    id: "spread",
    label: "Spread",
    depths: { soldier: [0, 1, 2], mg: [0, 1], tank: [1, 2], mortar: [2, 3], sandbag: [1, 2, 3] },
    sandbags: "scatter",
  },
  {
    id: "artillery",
    label: "Artillery-heavy",
    depths: { soldier: [0, 1], mg: [1], tank: [2, 3], mortar: [2], sandbag: [0, 1] },
    sandbags: "scatter",
  },
  {
    id: "hqrush",
    label: "HQ rush",
    depths: { soldier: [0, 1], mg: [0, 1], tank: [1, 0], mortar: [2, 3], sandbag: [2, 3] },
    sandbags: "scatter",
    columnBias: "enemyHq",
  },
  {
    id: "hqguard",
    label: "HQ lane guard",
    depths: { soldier: [0, 1], mg: [0, 1], tank: [1, 2], mortar: [3], sandbag: [1, 2] },
    sandbags: "guard",
    columnBias: "ownHq",
  },
  {
    id: "random",
    label: "Random (control)",
    depths: {
      soldier: [0, 1, 2, 3],
      mg: [0, 1, 2, 3],
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

function biasCol(archetype: Archetype, anchors: HqAnchors, team: Team): number {
  const enemy = team === "A" ? anchors.B : anchors.A;
  const own = anchors[team];
  const target = archetype.columnBias === "ownHq" ? own : enemy;
  // Centre of the 2-wide footprint.
  return target.col;
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
): Deployment {
  const anchor = anchors[team];
  const units: PlacedUnit[] = [{ type: "hq", row: anchor.row, col: anchor.col, facing: "N" }];
  const facing: Direction = team === "A" ? "N" : "S";

  const tryPlace = (type: UnitTypeId, depths: number[], cols: number[]): boolean => {
    for (const depth of depths) {
      const row = rowAtDepth(team, depth);
      for (const col of cols) {
        if (canPlace(team, type, row, col, units)) {
          units.push({ type, row, col, facing: type === "sandbag" ? "N" : facing });
          return true;
        }
      }
    }
    return false;
  };

  // Sandbags that guard the HQ want the tiles between it and the enemy.
  const guardCols = shuffled(
    [anchor.col - 1, anchor.col, anchor.col + 1, anchor.col + 2].filter(
      (c) => c >= 0 && c < BOARD.cols,
    ),
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
          ? [...ALL_DEPTHS.filter((d) => rowAtDepth(team, d) !== anchor.row), ...preferred]
          : preferred;

      // Preferred depths first, then anywhere legal — never emit a short army.
      if (!tryPlace(entry.type, depths, cols)) {
        tryPlace(entry.type, shuffled(ALL_DEPTHS, rng), shuffled(ALL_COLS, rng));
      }
    }
  }

  return { team, units };
}
