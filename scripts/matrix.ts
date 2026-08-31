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

import { BOARD, hqAnchorsForSeed, terrainForSeed } from "../src/game/config/gameConfig.ts";
import { ARCHETYPES, generateFormation } from "../src/game/content/formations.ts";
import { UNITS } from "../src/game/config/units.ts";
import { simulateBattle } from "../src/game/engine/simulate.ts";
import { mulberry32 } from "../src/game/rng/mulberry32.ts";

import { applyArmyOverride } from "./armyOverride.ts";

const args = process.argv.slice(2);

/**
 * EXPERIMENT: AT gun damage per unit in lane. --atgun 20
 *
 * The density-scaling property is what makes this unit interesting, so the
 * ceiling is set by a soldier: 10 damage every 20 ticks = 0.5/tick. The AT gun
 * fires every 48 ticks, so at 24 damage it merely MATCHES a soldier against a
 * single target and beats it against two. Anything at or above 24 makes it a
 * strictly better soldier and the density trade-off disappears.
 */

const ARMY = applyArmyOverride(args);
const flag = (name: string, fallback: number): number => {
  const i = args.indexOf(`--${name}`);
  if (i === -1) return fallback;
  const v = Number(args[i + 1]);
  return Number.isFinite(v) ? v : fallback;
};

const ATGUN_DMG = flag("atgun", 0);
if (ATGUN_DMG > 0) {
  (UNITS.atgun as { damage: number }).damage = ATGUN_DMG;
}
const PER_PAIR = flag("matches", 400);
const SPLIT_HQ = flag("splithq", 0) === 1;

const label = (s: string, n: number) => s.slice(0, n).padEnd(n);
const header = ARCHETYPES.map((a) => label(a.id, 9)).join(" ");
console.log(`\nHEAD-TO-HEAD  —  ${PER_PAIR} matches per pair${SPLIT_HQ ? "  [SPLIT HQ]" : ""}`);
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
      const base = hqAnchorsForSeed(seed);
      // Draw BOTH columns independently, or the experiment is lopsided.
      const anchors = SPLIT_HQ
        ? {
            A: { row: base.A.row, col: mulberry32(seed * 2654435761).nextInt(BOARD.cols - 1) },
            B: { row: base.B.row, col: mulberry32(seed * 40503 + 7).nextInt(BOARD.cols - 1) },
          }
        : base;
      const craters = terrainForSeed(seed, anchors);
      const r = simulateBattle({
        playerA: generateFormation("A", anchors, rowArch, mulberry32(seed), craters),
        playerB: generateFormation("B", anchors, colArch, mulberry32(seed + 991), craters),
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
