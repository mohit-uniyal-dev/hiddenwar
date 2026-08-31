/**
 * How full can a shaped army be before it stops fitting in practice?
 *
 *   node scripts/density.ts
 *
 * There are two very different capacity numbers, and only the second one is a
 * game. `scripts/packing.ts` counts arrangements that EXIST — at 25 of 26 tiles
 * there are still hundreds. This measures how often an army can be laid down by
 * placing one piece at a time and not looking back, which is what a person with
 * a thumb and a phone is actually doing.
 *
 * The gap between the two is the whole finding: a solution space can be large
 * and still be unreachable.
 */

import { hqAnchorsForSeed, terrainForSeed } from "../src/game/config/gameConfig.ts";
import { PLACEABLE_ARMY, UNITS } from "../src/game/config/units.ts";
import { ARCHETYPES, generateFormation } from "../src/game/content/formations.ts";
import { mulberry32 } from "../src/game/rng/mulberry32.ts";

import { readExperiment } from "./experiment.ts";

// Installs the shaped footprints; the counts are overridden per row below.
readExperiment(["--shapes"]);

type Counts = Record<string, number>;

const ROSTERS: ReadonlyArray<{ label: string; counts: Counts }> = [
  {
    label: "4 rifle 2 mg 1 at 1 tank 1 mtr 2 bag",
    counts: { soldier: 4, mg: 2, atgun: 1, tank: 1, mortar: 1, sandbag: 2 },
  },
  {
    label: "4 rifle 2 mg 1 at 1 tank 1 mtr 1 bag",
    counts: { soldier: 4, mg: 2, atgun: 1, tank: 1, mortar: 1, sandbag: 1 },
  },
  {
    label: "4 rifle 1 mg 1 at 1 tank 1 mtr 2 bag",
    counts: { soldier: 4, mg: 1, atgun: 1, tank: 1, mortar: 1, sandbag: 2 },
  },
  {
    label: "3 rifle 1 mg 1 at 1 tank 1 mtr 2 bag",
    counts: { soldier: 3, mg: 1, atgun: 1, tank: 1, mortar: 1, sandbag: 2 },
  },
  {
    label: "4 rifle 1 mg 1 at 1 tank 1 mtr 1 bag",
    counts: { soldier: 4, mg: 1, atgun: 1, tank: 1, mortar: 1, sandbag: 1 },
  },
  {
    label: "3 rifle 1 mg 1 at 1 tank 1 mtr 1 bag",
    counts: { soldier: 3, mg: 1, atgun: 1, tank: 1, mortar: 1, sandbag: 1 },
  },
  {
    label: "2 rifle 1 mg 1 at 1 tank 1 mtr 1 bag",
    counts: { soldier: 2, mg: 1, atgun: 1, tank: 1, mortar: 1, sandbag: 1 },
  },
  {
    label: "2 rifle 1 mg 1 at 1 tank 0 mtr 1 bag",
    counts: { soldier: 2, mg: 1, atgun: 1, tank: 1, mortar: 0, sandbag: 1 },
  },
];

const tilesOfType = (type: string): number => {
  const spec = UNITS[type as keyof typeof UNITS];
  return spec.cells?.length ?? spec.width * spec.height;
};

console.log("\nPRACTICAL CAPACITY  —  can a shaped army actually be laid down?\n");
console.log(
  `${"roster".padEnd(38)} ${"pieces".padStart(6)} ${"tiles".padStart(6)} ${"fill".padStart(6)} ${"complete".padStart(9)} ${"placed".padStart(8)}`,
);
console.log("-".repeat(80));

for (const roster of ROSTERS) {
  for (const entry of PLACEABLE_ARMY) {
    const next = roster.counts[entry.type];
    if (next !== undefined) (entry as { count: number }).count = next;
  }

  const pieces = PLACEABLE_ARMY.reduce((sum, e) => sum + e.count, 0);
  const tiles = PLACEABLE_ARMY.reduce((sum, e) => sum + e.count * tilesOfType(e.type), 0);

  let complete = 0;
  let attempts = 0;
  let placedTotal = 0;

  for (let i = 0; i < 400; i++) {
    const seed = 900 + i;
    const anchors = hqAnchorsForSeed(seed);
    const craters = terrainForSeed(seed, anchors);
    for (const archetype of ARCHETYPES) {
      const army = generateFormation(
        "A",
        anchors,
        archetype,
        mulberry32(seed * 31 + archetype.id.length),
        craters,
      );
      const placed = army.units.filter((u) => u.type !== "hq").length;
      placedTotal += placed;
      attempts++;
      if (placed >= pieces) complete++;
    }
  }

  console.log(
    `${roster.label.padEnd(38)} ${String(pieces).padStart(6)} ${String(tiles).padStart(6)} ${`${Math.round((tiles / 26) * 100)}%`.padStart(6)} ${`${((complete / attempts) * 100).toFixed(0)}%`.padStart(9)} ${(placedTotal / attempts).toFixed(2).padStart(8)}`,
  );
}

console.log(
  "\ncomplete = share of armies where every piece found a legal tile, placing\none at a time without backtracking — the way a person deploys.\n",
);
