/**
 * Handcrafted bot formations. Roadmap §F.2 and §53.
 *
 * NOT CURRENTLY WIRED TO ANY SCREEN. The "vs. AI" mode generates a fresh army
 * every match instead (see formations.ts), which gives far more variety than
 * three stored shapes. These are kept, and kept under test, because §E.4's
 * ghost-army path is exactly this: stored formations harvested from real play.
 * Delete them if that path is abandoned.
 *
 * These are stored formations, not an AI — which is exactly what §E.4 argues
 * the strongest version of this system is anyway. Every deployment a real
 * player submits is bot content; these three are just the seed.
 *
 * All three are legal full Classic armies for Orange (5 soldiers, 2 MGs,
 * 2 tanks, 1 mortar, 8 sandbags, 1 HQ), verified by test.
 */

import type { Deployment, Direction, PlacedUnit, UnitTypeId } from "../types.ts";

const S: Direction = "S";

function u(type: UnitTypeId, row: number, col: number, facing: Direction = S): PlacedUnit {
  return { type, row, col, facing };
}

export interface BotOpponent {
  readonly id: string;
  readonly name: string;
  readonly difficulty: "Easy" | "Medium";
  readonly blurb: string;
  /** What this formation gets wrong, revealed on the results screen. */
  readonly tell: string;
  readonly deployment: Deployment;
}

export const BOTS: readonly BotOpponent[] = [
  {
    id: "recruit",
    name: "The Recruit",
    difficulty: "Easy",
    blurb: "The whole front rank shoulder to shoulder, sandbags out on the flanks.",
    tell: "Their infantry sits in an unbroken line and their tanks flank the HQ — one mortar shell can catch three units at once.",
    deployment: {
      team: "B",
      units: [
        // Five soldiers in an unbroken row: textbook splash bait (§D.2).
        u("soldier", 3, 4),
        u("soldier", 3, 5),
        u("soldier", 3, 6),
        u("soldier", 3, 7),
        u("soldier", 3, 8),
        u("mg", 3, 3),
        u("mg", 3, 9),
        u("tank", 2, 4),
        u("mg", 2, 7),
        u("mortar", 2, 3),
        // Sandbags out on the wings, shielding nothing that matters.
        u("sandbag", 1, 0),
        u("sandbag", 1, 1),
        u("sandbag", 1, 2),
        u("sandbag", 1, 3),
        u("sandbag", 1, 8),
        u("sandbag", 1, 9),
        u("sandbag", 1, 10),
        u("sandbag", 1, 11),
        u("hq", 0, 5),
      ],
    },
  },

  {
    id: "the-line",
    name: "The Line",
    difficulty: "Medium",
    blurb: "A proper front rank, tanks split wide with clear lanes, HQ walled at the rear.",
    tell: "Their tanks sit on columns nothing blocks, and the HQ has cover on three sides.",
    deployment: {
      team: "B",
      units: [
        u("soldier", 3, 1),
        u("soldier", 3, 2),
        u("soldier", 3, 3),
        u("soldier", 3, 9),
        u("soldier", 3, 10),
        // MGs hold the centre, where their cones cover the most ground.
        u("mg", 3, 5),
        u("mg", 3, 6),
        // Columns 0 and 11 are empty top to bottom, so neither tank is ever
        // blocked by its own side (§B.4).
        u("tank", 2, 0),
        u("mg", 2, 11),
        u("mortar", 1, 2),
        u("sandbag", 2, 4),
        u("sandbag", 2, 5),
        u("sandbag", 2, 6),
        u("sandbag", 2, 7),
        u("sandbag", 0, 4),
        u("sandbag", 1, 4),
        u("sandbag", 0, 7),
        u("sandbag", 1, 7),
        u("hq", 0, 5),
      ],
    },
  },

  {
    id: "bunker",
    name: "The Bunker",
    difficulty: "Medium",
    blurb: "Every sandbag spent boxing in the HQ. Slow, stubborn, hard to finish.",
    tell: "Boxing the HQ in makes it the densest cluster on the board — which is exactly what a mortar aims at (§B.9).",
    deployment: {
      team: "B",
      units: [
        u("soldier", 3, 3),
        u("soldier", 3, 4),
        u("soldier", 3, 5),
        u("soldier", 3, 6),
        u("soldier", 3, 7),
        u("mg", 2, 1),
        u("mg", 2, 10),
        u("tank", 3, 0),
        u("mg", 3, 11),
        u("mortar", 0, 2),
        // A full box: four across the front, one down each flank.
        u("sandbag", 2, 4),
        u("sandbag", 2, 5),
        u("sandbag", 2, 6),
        u("sandbag", 2, 7),
        u("sandbag", 0, 4),
        u("sandbag", 1, 4),
        u("sandbag", 0, 7),
        u("sandbag", 1, 7),
        u("hq", 0, 5),
      ],
    },
  },
];

export function botById(id: string): BotOpponent | undefined {
  return BOTS.find((b) => b.id === id);
}
