/**
 * Tailoring gain — can a specific board be answered, or is one shape simply right?
 *
 *   node scripts/tailor.ts [--boards 40] [--edits 6] [--neighbours 400]
 *
 * This measures something the archetype table cannot, and it is the number that
 * decides whether a dominant shape is even a problem here.
 *
 * The archetype table asks "which shape beats the field?" — a ladder question.
 * This game's loop is not a ladder: you face one committed board, you lose, you
 * edit, you rerun. What that loop needs is that reading the enemy's board pays.
 * So: freeze an opponent, start from the generic best shape, and hill-climb
 * single-piece edits against that specific board.
 *
 *   HIGH gain, MANY edits    the board is a puzzle; a 67% opening bid is fine,
 *                            because reading beats bidding.
 *   LOW gain, FEW edits      the best answer barely depends on the opponent.
 *                            That kills edit-and-rerun no matter how flat the
 *                            archetype table looks.
 *
 * The hill-climb is a lower bound on what a person could find — it only ever
 * moves one piece at a time and never backtracks.
 */

import { BOARD, zoneOwner } from "../src/game/config/gameConfig.ts";
import { UNITS } from "../src/game/config/units.ts";
import {
  type ArchetypeId,
  archetypeById,
  generateFormation,
} from "../src/game/content/formations.ts";
import { simulateBattle } from "../src/game/engine/simulate.ts";
import { canPlace } from "../src/game/models/deployment.ts";
import { mulberry32 } from "../src/game/rng/mulberry32.ts";
import type { Coord, Deployment, PlacedUnit } from "../src/game/types.ts";

import { numberFlag, readExperiment } from "./experiment.ts";

const args = process.argv.slice(2);
const EXPERIMENT = readExperiment(args);
const BOARDS = numberFlag(args, "boards", 40);
const MAX_EDITS = numberFlag(args, "edits", 6);
const NEIGHBOURS = numberFlag(args, "neighbours", 400);
const idArg = args[args.indexOf("--vs") + 1];
const OPPONENT = (args.includes("--vs") && idArg !== undefined ? idArg : "line") as ArchetypeId;

/**
 * A graded score, because a win/loss bit gives a hill-climb nothing to climb.
 *
 * Node damage is the axis the tiebreak ladder already decides on, so a formation
 * that improves this is improving the thing that actually settles matches.
 */
function score(
  challenger: Deployment,
  opponent: Deployment,
  seed: number,
  craters: Coord[],
): number {
  const r = simulateBattle({ playerA: challenger, playerB: opponent, seed, craters });
  const decisive = r.winner === "A" ? 1000 : r.winner === "B" ? -1000 : 0;
  return decisive + (r.stats.teams.A.hqHpRemaining - r.stats.teams.B.hqHpRemaining);
}

function wins(
  challenger: Deployment,
  opponent: Deployment,
  seed: number,
  craters: Coord[],
): boolean {
  return simulateBattle({ playerA: challenger, playerB: opponent, seed, craters }).winner === "A";
}

/** Every legal single-piece move available to this army. */
function moves(deployment: Deployment, craters: Coord[]): Array<{ index: number; to: Coord }> {
  const out: Array<{ index: number; to: Coord }> = [];
  deployment.units.forEach((unit, index) => {
    if (unit.type === "hq") return; // nodes are drawn, not chosen
    for (let row = 0; row < BOARD.rows; row++) {
      if (zoneOwner(row) !== "A") continue;
      for (let col = 0; col < BOARD.cols; col++) {
        if (row === unit.row && col === unit.col) continue;
        if (!canPlace("A", unit.type, row, col, deployment.units, index, craters)) continue;
        out.push({ index, to: { row, col } });
      }
    }
  });
  return out;
}

function withMove(deployment: Deployment, index: number, to: Coord): Deployment {
  const units = deployment.units.map((u, i) =>
    i === index ? ({ ...u, row: to.row, col: to.col } as PlacedUnit) : u,
  );
  return { team: "A", units };
}

let genericWins = 0;
let tailoredWins = 0;
const editCounts: number[] = [];
const gains: number[] = [];
let sims = 0;
const started = Date.now();

for (let b = 0; b < BOARDS; b++) {
  const seed = 10_007 + b * 31;
  const anchors = EXPERIMENT.anchors(seed);
  const craters = EXPERIMENT.terrain(seed, anchors);
  const sight = EXPERIMENT.sightAware;

  const opponent = generateFormation(
    "B",
    anchors,
    archetypeById(OPPONENT),
    mulberry32(seed),
    craters,
    sight,
  );
  // The cached answer: the shape that wins most against the field, untailored.
  let current = generateFormation(
    "A",
    anchors,
    archetypeById("line"),
    mulberry32(seed + 7919),
    craters,
    sight,
  );

  const startScore = score(current, opponent, seed, craters);
  sims++;
  const genericWon = startScore > 0;
  if (genericWon) genericWins++;

  let best = startScore;
  let edits = 0;
  let firstWinAt = -1;

  for (let step = 0; step < MAX_EDITS; step++) {
    const all = moves(current, craters);
    // A deterministic sample, so a rerun of this script reproduces exactly.
    const rng = mulberry32(seed * 7 + step);
    const sample: Array<{ index: number; to: Coord }> = [];
    const pool = [...all];
    while (sample.length < Math.min(NEIGHBOURS, all.length) && pool.length > 0) {
      const i = rng.nextInt(pool.length);
      const picked = pool[i];
      if (picked !== undefined) sample.push(picked);
      pool.splice(i, 1);
    }

    let bestMove: { index: number; to: Coord } | null = null;
    let bestScore = best;
    for (const m of sample) {
      const candidate = withMove(current, m.index, m.to);
      const s = score(candidate, opponent, seed, craters);
      sims++;
      if (s > bestScore) {
        bestScore = s;
        bestMove = m;
      }
    }
    if (bestMove === null) break; // local optimum: nothing single-piece helps
    current = withMove(current, bestMove.index, bestMove.to);
    best = bestScore;
    edits++;
    if (firstWinAt === -1 && wins(current, opponent, seed, craters)) firstWinAt = edits;
  }

  const tailoredWon = wins(current, opponent, seed, craters);
  sims++;
  if (tailoredWon) tailoredWins++;
  if (!genericWon && tailoredWon) editCounts.push(firstWinAt === -1 ? edits : firstWinAt);
  gains.push(best - startScore);

  process.stdout.write(
    `board ${String(b + 1).padStart(3)}/${BOARDS}  generic ${genericWon ? "W" : "L"}` +
      `  tailored ${tailoredWon ? "W" : "L"}  edits ${edits}  margin ${startScore} -> ${best}\n`,
  );
}

const median = (xs: number[]): number => {
  if (xs.length === 0) return 0;
  const s = [...xs].sort((a, b) => a - b);
  return s[Math.floor(s.length / 2)] ?? 0;
};
const pct = (n: number): string => `${((n / BOARDS) * 100).toFixed(1)}%`;

console.log(`\nTAILORING GAIN  —  ${BOARDS} boards vs "${OPPONENT}", up to ${MAX_EDITS} edits`);
console.log(`config: ${EXPERIMENT.label}`);
console.log(`${sims} simulations in ${((Date.now() - started) / 1000).toFixed(1)}s\n`);
console.log(`  generic front line wins    ${pct(genericWins)}`);
console.log(`  tailored answer wins       ${pct(tailoredWins)}`);
console.log(
  `  TAILORING GAIN            ${(((tailoredWins - genericWins) / BOARDS) * 100).toFixed(1)} points   target >= 25`,
);
console.log(
  `  median edits to flip      ${median(editCounts)}   target >= 4   (${editCounts.length} boards flipped)`,
);
console.log(`  median margin improvement ${median(gains)}`);
console.log("\nA low gain means the best placement barely depends on the opponent, which is");
console.log("the one thing an edit-and-rerun loop cannot survive.\n");

// Referenced so the unit table is loaded and any config override applies.
void UNITS;
