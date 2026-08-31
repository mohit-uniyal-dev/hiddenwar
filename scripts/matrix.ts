/**
 * Archetype head-to-head matrix.
 *
 *   node scripts/matrix.ts [--matches 400] [--splithq 1]
 *
 * The sweep's overall win rate answers "does this shape beat the average
 * opponent". This answers the question that actually decides whether a shape is
 * a problem: "does anything beat it?" A shape that wins its column against
 * every opponent is dominant and needs a structural answer, not a tuning pass.
 */

import { ARCHETYPES, generateFormation } from "../src/game/content/formations.ts";
import { simulateBattle } from "../src/game/engine/simulate.ts";
import { mulberry32 } from "../src/game/rng/mulberry32.ts";

import { applyArmyOverride } from "./armyOverride.ts";
import { numberFlag, readExperiment } from "./experiment.ts";

const args = process.argv.slice(2);
const ARMY = applyArmyOverride(args);
const EXPERIMENT = readExperiment(args);
const PER_PAIR = numberFlag(args, "matches", 400);

const label = (s: string, n: number) => s.slice(0, n).padEnd(n);
const header = ARCHETYPES.map((a) => label(a.id, 9)).join(" ");
console.log(`\nHEAD-TO-HEAD  —  ${PER_PAIR} matches per pair`);
console.log(`config: ${EXPERIMENT.label}   army: ${ARMY}`);
console.log("row = Blue's shape, cell = Blue's win rate\n");
console.log(`${" ".repeat(11)}${header}`);

for (const rowArch of ARCHETYPES) {
  const cells: string[] = [];
  let wins = 0;
  let played = 0;
  for (const colArch of ARCHETYPES) {
    let w = 0;
    let drew = 0;
    for (let i = 0; i < PER_PAIR; i++) {
      const seed = i * 7919 + 13;
      const anchors = EXPERIMENT.anchors(seed);
      const craters = EXPERIMENT.terrain(seed, anchors);
      const sight = EXPERIMENT.sightAware;
      const r = simulateBattle({
        playerA: generateFormation("A", anchors, rowArch, mulberry32(seed), craters, sight),
        playerB: generateFormation("B", anchors, colArch, mulberry32(seed + 991), craters, sight),
        seed,
        craters,
      });
      if (r.winner === "A") w++;
      else if (r.winner === "draw") drew++;
    }
    wins += w;
    played += PER_PAIR;
    // Wins and draws, because a column of 0% that is really 100% draws reads
    // as annihilation when it is actually stalemate.
    cells.push(
      `${((w / PER_PAIR) * 100).toFixed(0)}/${((drew / PER_PAIR) * 100).toFixed(0)}`.padStart(9),
    );
  }
  console.log(
    `${label(rowArch.id, 11)}${cells.join(" ")}   | overall ${((wins / played) * 100).toFixed(0)}%`,
  );
}
console.log("");
