/**
 * Command-line switches for A/B-ing balance changes that have already shipped.
 *
 * Everything here exists to answer "was that change actually the thing that
 * moved the number?" — so each switch restores the PREVIOUS behaviour rather
 * than introducing a new one. They are measurement scaffolding, not features,
 * and each one should be deleted once its question has an answer.
 */

import {
  BOARD,
  HQ_HEIGHT,
  type HqAnchors,
  hqAnchorsForSeed,
  terrainForSeed,
} from "../src/game/config/gameConfig.ts";
import { MVP_ARMY, UNITS } from "../src/game/config/units.ts";
import { mulberry32 } from "../src/game/rng/mulberry32.ts";
import type { Coord } from "../src/game/types.ts";

export interface Experiment {
  /** Draw the node anchors — variable gap by default, the old `>= 3` under --legacysep. */
  readonly anchors: (seed: number) => HqAnchors;
  /** Off under --blindgen, which is how the old idle-unit figure was produced. */
  readonly sightAware: boolean;
  /** Two per side and never in adjacent columns, or the old 2-3 anywhere. */
  readonly terrain: (seed: number, anchors: HqAnchors) => Coord[];
  readonly label: string;
}

/**
 * The node draw as it stood before the gap became variable: the first column
 * uniform, the second uniform among those at least three away.
 *
 * Kept here rather than in the engine because it is a baseline, not a mode. The
 * production draw has exactly one behaviour.
 */
function legacyAnchorsForSeed(seed: number): HqAnchors {
  const rng = mulberry32(seed);
  const rowA = BOARD.teamARows[1] - HQ_HEIGHT + 1;
  const rowB = BOARD.teamBRows[0];
  const pick = (): [number, number] => {
    const first = rng.nextInt(BOARD.cols);
    const legal: number[] = [];
    for (let c = 0; c < BOARD.cols; c++) {
      if (Math.abs(c - first) >= 3) legal.push(c);
    }
    const second = legal[rng.nextInt(legal.length)] ?? first;
    return first <= second ? [first, second] : [second, first];
  };
  const [a1, a2] = pick();
  const [b1, b2] = pick();
  return {
    A: [
      { row: rowA, col: a1 },
      { row: rowA, col: a2 },
    ],
    B: [
      { row: rowB, col: b1 },
      { row: rowB, col: b2 },
    ],
  };
}

/**
 * The production node draw with a different separation table, so the shape of
 * that distribution can be searched without editing the engine.
 */
function anchorsWithGaps(gaps: readonly number[]): (seed: number) => HqAnchors {
  return (seed: number): HqAnchors => {
    const gapRng = mulberry32((seed ^ 0x2545f491) >>> 0);
    const gap = gaps[gapRng.nextInt(gaps.length)] ?? 3;
    const rng = mulberry32(seed);
    const rowA = BOARD.teamARows[1] - HQ_HEIGHT + 1;
    const rowB = BOARD.teamBRows[0];
    const pick = (): [number, number] => {
      const first = rng.nextInt(BOARD.cols - gap);
      return [first, first + gap];
    };
    const [a1, a2] = pick();
    const [b1, b2] = pick();
    return {
      A: [
        { row: rowA, col: a1 },
        { row: rowA, col: a2 },
      ],
      B: [
        { row: rowB, col: b1 },
        { row: rowB, col: b2 },
      ],
    };
  };
}

/** Craters as they were drawn before the density and spacing rules. */
function legacyTerrainForSeed(seed: number, anchors: HqAnchors): Coord[] {
  const rng = mulberry32((seed ^ 0x7f4a7c15) >>> 0);
  const count = 2 + rng.nextInt(2);
  const blockedCols = new Set<number>();
  for (const side of [anchors.A, anchors.B]) for (const n of side) blockedCols.add(n.col);

  const candidates: Coord[] = [];
  for (const row of [BOARD.teamARows[0], BOARD.teamARows[0] + 1]) {
    for (let col = 0; col < BOARD.cols; col++) {
      if (!blockedCols.has(col)) candidates.push({ row, col });
    }
  }

  const craters: Coord[] = [];
  const taken = new Set<number>();
  for (let i = 0; i < count && candidates.length > 0; i++) {
    const pick = candidates[rng.nextInt(candidates.length)];
    if (pick === undefined) break;
    const key = pick.row * BOARD.cols + pick.col;
    if (taken.has(key)) continue;
    taken.add(key);
    craters.push(pick);
    craters.push({ row: BOARD.rows - 1 - pick.row, col: BOARD.cols - 1 - pick.col });
  }
  return craters;
}

export function numberFlag(args: string[], name: string, fallback: number): number {
  const i = args.indexOf(`--${name}`);
  if (i === -1) return fallback;
  const value = Number(args[i + 1]);
  return Number.isFinite(value) ? value : fallback;
}

/**
 * Reads the switches, MUTATES the unit table where a switch demands it, and
 * returns what the caller still has to honour itself.
 */
export function readExperiment(args: string[]): Experiment {
  const parts: string[] = [];

  const legacySep = args.includes("--legacysep");
  if (legacySep) parts.push("legacy node gap (>=3)");

  const blindGen = args.includes("--blindgen");
  if (blindGen) parts.push("blind placement");

  // --gaps 2,3 searches the separation distribution.
  const gapArg = args[args.indexOf("--gaps") + 1];
  const gaps =
    args.includes("--gaps") && gapArg !== undefined
      ? gapArg.split(",").map(Number).filter(Number.isFinite)
      : [];
  if (gaps.length > 0) parts.push(`node gaps {${gaps.join(",")}}`);

  const legacyCraters = args.includes("--legacycraters");
  if (legacyCraters) parts.push("legacy craters (2-3, any column)");

  // --mortarstruct 1 restores indirect fire's full damage against structures.
  const struct = numberFlag(args, "mortarstruct", -1);
  if (struct >= 0) {
    (UNITS.mortar as { structureMultiplier: number }).structureMultiplier = struct;
    parts.push(`mortar x${struct} vs structures`);
  }

  /*
    --blockers tank,mg  makes those units block line of sight like a sandbag.

    The engine already supports it fully: a destroyed unit's footprint is
    cleared, so a soldier shielded by a tank starts shooting the moment the tank
    dies. What that buys, if it works, is DEPTH — the one axis measured to be
    strictly dominant in one direction (`useful rows = range - gap` makes the
    front rank the only place worth standing). Cover turns a rear rank into a
    second wave that comes online when the first is destroyed.
  */
  const blockerArg = args[args.indexOf("--blockers") + 1];
  if (args.includes("--blockers") && blockerArg !== undefined) {
    for (const name of blockerArg.split(",")) {
      const spec = UNITS[name as keyof typeof UNITS];
      if (spec !== undefined) (spec as { blocksLineOfSight: boolean }).blocksLineOfSight = true;
    }
    parts.push(`${blockerArg} block sight`);
  }

  /*
    --shapes       give the heavy units real footprints and shrink the roster
                   to fit: 25 tiles of army in a 26-tile zone.
    --shapes-flat  the SAME roster with every piece back to 1x1 (11 tiles).

    Two flags rather than one because a shaped army is necessarily a smaller
    army — 25 tiles will not hold sixteen pieces — so comparing shapes against
    today's roster would confound the footprints with the composition change.
    The flat variant is the control that separates them.

    The first cell of each shape is the weapon; the rest is hull.
  */
  const shapes = args.includes("--shapes");
  const shapesFlat = args.includes("--shapes-flat");
  if (shapes || shapesFlat) {
    const counts: Record<string, number> = {
      // 22 of 26 tiles, chosen by measurement rather than taste: at 85% fill
      // 92% of armies still pack, and above it the success rate falls off a
      // cliff — 88% fill packs 64% of the time, 96% fill only 37%.
      soldier: 4,
      mg: 1,
      atgun: 1,
      tank: 1,
      mortar: 1,
      sandbag: 2,
    };
    // --army wins, so the same shapes can be measured at several densities.
    if (!args.includes("--army")) {
      for (const entry of MVP_ARMY) {
        const next = counts[entry.type];
        if (next !== undefined) (entry as { count: number }).count = next;
      }
    }
    if (shapes) {
      const cells: Record<string, ReadonlyArray<{ row: number; col: number }>> = {
        // L: gun at the elbow, hull down and to the right.
        mg: [
          { row: 0, col: 0 },
          { row: 1, col: 0 },
          { row: 1, col: 1 },
        ],
        // A long barrel: gun at one end.
        atgun: [
          { row: 0, col: 0 },
          { row: 0, col: 1 },
          { row: 0, col: 2 },
        ],
        // A square hull with the turret on one corner.
        tank: [
          { row: 0, col: 0 },
          { row: 0, col: 1 },
          { row: 1, col: 0 },
          { row: 1, col: 1 },
        ],
        // T: tube at one end of the baseplate.
        mortar: [
          { row: 0, col: 0 },
          { row: 0, col: 1 },
          { row: 0, col: 2 },
          { row: 1, col: 1 },
        ],
        // A two-tile stretch of wall.
        sandbag: [
          { row: 0, col: 0 },
          { row: 0, col: 1 },
        ],
      };
      for (const [type, shape] of Object.entries(cells)) {
        const spec = UNITS[type as keyof typeof UNITS];
        if (spec !== undefined) (spec as { cells: unknown }).cells = shape;
      }
    }
    parts.push(shapes ? "shaped roster (25 tiles)" : "flat roster (11 tiles)");
  }

  const atgun = numberFlag(args, "atgun", 0);
  if (atgun > 0) {
    (UNITS.atgun as { damage: number }).damage = atgun;
    parts.push(`AT gun ${atgun}`);
  }

  const sandbagHp = numberFlag(args, "sandbaghp", 0);
  if (sandbagHp > 0) {
    (UNITS.sandbag as { hp: number }).hp = sandbagHp;
    parts.push(`sandbag ${sandbagHp} HP`);
  }

  return {
    anchors: legacySep
      ? legacyAnchorsForSeed
      : gaps.length > 0
        ? anchorsWithGaps(gaps)
        : hqAnchorsForSeed,
    sightAware: !blindGen,
    terrain: legacyCraters ? legacyTerrainForSeed : terrainForSeed,
    label: parts.length === 0 ? "shipping config" : parts.join(", "),
  };
}
