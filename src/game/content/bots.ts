/**
 * Handcrafted bot formations. Roadmap §F.2 ("3 handcrafted bot formations")
 * and §53 (Easy / Medium).
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
    blurb: "Everything crammed into the front rows, HQ pushed up behind it.",
    tell: "Their infantry sits shoulder to shoulder and both tanks share a lane — one mortar shell hits three units at once.",
    deployment: {
      team: "B",
      units: [
        // Five soldiers in an unbroken row: textbook splash bait (§D.2).
        u("soldier", 5, 4),
        u("soldier", 5, 5),
        u("soldier", 5, 6),
        u("soldier", 5, 7),
        u("soldier", 5, 8),
        u("mg", 5, 3),
        u("mg", 5, 9),
        // Tanks adjacent rather than separated.
        u("tank", 4, 4),
        u("tank", 4, 7),
        u("mortar", 2, 5),
        // Sandbags parked uselessly behind the line, protecting nothing.
        u("sandbag", 1, 4),
        u("sandbag", 1, 5),
        u("sandbag", 1, 6),
        u("sandbag", 1, 7),
        u("sandbag", 2, 6),
        u("sandbag", 2, 7),
        u("sandbag", 2, 8),
        u("sandbag", 2, 9),
        // HQ far too far forward.
        u("hq", 3, 5),
      ],
    },
  },

  {
    id: "the-line",
    name: "The Line",
    difficulty: "Medium",
    blurb: "A proper front rank, tanks split wide with clear lanes, HQ walled at the rear.",
    tell: "Their tanks sit on the flanks where nothing blocks them, and the HQ has cover on three sides.",
    deployment: {
      team: "B",
      units: [
        u("soldier", 5, 1),
        u("soldier", 5, 2),
        u("soldier", 5, 3),
        u("soldier", 5, 9),
        u("soldier", 5, 10),
        // MGs hold the centre, where their cones cover the most ground.
        u("mg", 5, 5),
        u("mg", 5, 6),
        // Tanks on the flanks: columns 0 and 11 are empty all the way down,
        // so neither is ever blocked by its own side (§B.4).
        u("tank", 4, 0),
        u("tank", 4, 11),
        u("mortar", 3, 2),
        u("sandbag", 3, 4),
        u("sandbag", 3, 5),
        u("sandbag", 3, 6),
        u("sandbag", 3, 7),
        u("sandbag", 1, 4),
        u("sandbag", 2, 4),
        u("sandbag", 1, 7),
        u("sandbag", 2, 7),
        u("hq", 1, 5),
      ],
    },
  },

  {
    id: "bunker",
    name: "The Bunker",
    difficulty: "Medium",
    blurb: "Every sandbag spent walling the HQ. Slow, stubborn, and hard to finish.",
    tell: "Boxing the HQ in makes it the densest cluster on the board — which is precisely what a mortar aims at (§B.9).",
    deployment: {
      team: "B",
      units: [
        u("soldier", 5, 3),
        u("soldier", 5, 4),
        u("soldier", 5, 5),
        u("soldier", 5, 6),
        u("soldier", 5, 7),
        u("mg", 4, 3),
        u("mg", 4, 8),
        u("tank", 4, 0),
        u("tank", 4, 11),
        u("mortar", 1, 5),
        // A full box: four across the front, two down each flank.
        u("sandbag", 4, 4),
        u("sandbag", 4, 5),
        u("sandbag", 4, 6),
        u("sandbag", 4, 7),
        u("sandbag", 2, 4),
        u("sandbag", 3, 4),
        u("sandbag", 2, 7),
        u("sandbag", 3, 7),
        u("hq", 2, 5),
      ],
    },
  },
];

export function botById(id: string): BotOpponent | undefined {
  return BOTS.find((b) => b.id === id);
}
