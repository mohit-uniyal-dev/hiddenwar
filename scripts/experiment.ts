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
} from "../src/game/config/gameConfig.ts";
import { UNITS } from "../src/game/config/units.ts";
import { mulberry32 } from "../src/game/rng/mulberry32.ts";

export interface Experiment {
  /** Draw the node anchors — variable gap by default, the old `>= 3` under --legacysep. */
  readonly anchors: (seed: number) => HqAnchors;
  /** Off under --blindgen, which is how the old idle-unit figure was produced. */
  readonly sightAware: boolean;
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

  // --mortarstruct 1 restores indirect fire's full damage against structures.
  const struct = numberFlag(args, "mortarstruct", -1);
  if (struct >= 0) {
    (UNITS.mortar as { structureMultiplier: number }).structureMultiplier = struct;
    parts.push(`mortar x${struct} vs structures`);
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
    anchors: legacySep ? legacyAnchorsForSeed : hqAnchorsForSeed,
    sightAware: !blindGen,
    label: parts.length === 0 ? "shipping config" : parts.join(", "),
  };
}
