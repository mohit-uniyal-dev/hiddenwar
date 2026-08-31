/**
 * Balance sweep. Roadmap §I.6 and §52.
 *
 *   pnpm balance:sweep [--matches 5000] [--seed 1]
 *
 * Plays thousands of matches between generated formations and prints the
 * metrics the design doc asks for. This exists because the engine is headless
 * and deterministic — the whole tool is a loop around `simulateBattle`, with no
 * browser, no renderer and no mocking.
 *
 * What it is good for: extremes. A unit that never kills anything, a unit that
 * shows up in every win, a duration distribution that misses its target.
 *
 * What it cannot tell you: whether deployment is fun. Formations come from
 * archetypes with jitter, not from people. Treat it as a smoke alarm, not a
 * verdict — and read §51's playtest questions for the things it cannot measure.
 */

import { UNITS } from "../src/game/config/units.ts";
import { ARCHETYPES, generateFormation } from "../src/game/content/formations.ts";
import { simulateBattle } from "../src/game/engine/simulate.ts";
import { mulberry32 } from "../src/game/rng/mulberry32.ts";
import type { Deployment, UnitTypeId } from "../src/game/types.ts";

import { applyArmyOverride } from "./armyOverride.ts";
import { numberFlag, readExperiment } from "./experiment.ts";

const args = process.argv.slice(2);
const ARMY = applyArmyOverride(args);
const EXPERIMENT = readExperiment(args);
const MATCHES = numberFlag(args, "matches", 5000);
const BASE_SEED = numberFlag(args, "seed", 1);

const TARGET_MIN = 15;
const TARGET_MAX = 30;

interface UnitStat {
  damage: number;
  kills: number;
  idleTicks: number;
  appearances: number;
  neverFired: number;
  inWinner: number;
}

const perUnit = new Map<UnitTypeId, UnitStat>();
const stat = (type: UnitTypeId): UnitStat => {
  let s = perUnit.get(type);
  if (s === undefined) {
    s = { damage: 0, kills: 0, idleTicks: 0, appearances: 0, neverFired: 0, inWinner: 0 };
    perUnit.set(type, s);
  }
  return s;
};

/**
 * Mean shoulder-to-shoulder pairs per formation.
 *
 * This is the premise check for a lateral-splash weapon, and it is the number
 * the AT gun never had: that unit was specified against a column eight deep,
 * the board caps a column at four, and real formations average 2.7 — so it was
 * aimed at a shape that does not exist. Before anything is built to punish a
 * solid line, the line has to be measurably solid.
 */
const adjacencyByArchetype = new Map<string, { pairs: number; armies: number }>();

function adjacency(id: string, deployment: Deployment): void {
  const combat = deployment.units.filter((u) => (UNITS[u.type].damage ?? 0) > 0);
  let pairs = 0;
  for (const a of combat) {
    for (const b of combat) {
      if (a.row === b.row && b.col === a.col + 1) pairs++;
    }
  }
  const row = adjacencyByArchetype.get(id) ?? { pairs: 0, armies: 0 };
  row.pairs += pairs;
  row.armies++;
  adjacencyByArchetype.set(id, row);
}

const durations: number[] = [];
const reasons = new Map<string, number>();
const archetypeWins = new Map<string, { played: number; won: number; drawn: number }>();
let totalDamage = 0;
/** Which unit types actually damage an HQ — the objective decides matches. */
const hqDamageBySource = new Map<UnitTypeId, number>();
let hqDamageTotal = 0;
let totalLaneOpenings = 0;
let totalIdlePercent = 0;
let draws = 0;

const started = Date.now();

for (let i = 0; i < MATCHES; i++) {
  const seed = BASE_SEED + i;
  const rng = mulberry32(seed ^ 0x9e3779b9);
  const anchors = EXPERIMENT.anchors(seed);
  const gap = Math.abs((anchors.A[0]?.col ?? 0) - (anchors.A[1]?.col ?? 0));

  const archA = ARCHETYPES[rng.nextInt(ARCHETYPES.length)];
  const archB = ARCHETYPES[rng.nextInt(ARCHETYPES.length)];
  if (archA === undefined || archB === undefined) continue;

  const craters = EXPERIMENT.terrain(seed, anchors);
  const sight = EXPERIMENT.sightAware;
  const playerA = generateFormation("A", anchors, archA, rng, craters, sight);
  const playerB = generateFormation("B", anchors, archB, rng, craters, sight);
  const result = simulateBattle({ playerA, playerB, seed, craters });

  adjacency(archA.id, playerA);
  adjacency(archB.id, playerB);

  durations.push(result.durationSeconds);
  reasons.set(result.reason, (reasons.get(result.reason) ?? 0) + 1);
  totalLaneOpenings += result.stats.laneOpenings;
  totalIdlePercent += result.stats.idleUnitPercent;
  if (result.winner === "draw") draws++;

  for (const [arch, team] of [
    [archA, "A"],
    [archB, "B"],
  ] as const) {
    for (const key of [arch.id, `${arch.id}@${gap}`]) {
      let row = archetypeWins.get(key);
      if (row === undefined) {
        row = { played: 0, won: 0, drawn: 0 };
        archetypeWins.set(key, row);
      }
      row.played++;
      if (result.winner === team) row.won++;
      else if (result.winner === "draw") row.drawn++;
    }
  }

  // Attribute every point of HQ damage to the unit type that dealt it.
  const typeOf = new Map(result.stats.units.map((u) => [u.id, u.type]));
  const hqIds = new Set(result.stats.units.filter((u) => u.type === "hq").map((u) => u.id));
  for (const e of result.events) {
    if (e.type !== "DAMAGE" || !hqIds.has(e.targetId)) continue;
    const src = typeOf.get(e.sourceId);
    if (src === undefined) continue;
    hqDamageBySource.set(src, (hqDamageBySource.get(src) ?? 0) + e.amount);
    hqDamageTotal += e.amount;
  }

  for (const unit of result.stats.units) {
    const s = stat(unit.type);
    s.appearances++;
    s.damage += unit.damageDealt;
    s.kills += unit.kills;
    s.idleTicks += unit.idleTicks;
    totalDamage += unit.damageDealt;
    if ((UNITS[unit.type].damage ?? 0) > 0 && unit.shotsFired === 0) s.neverFired++;
    if (result.winner === unit.team) s.inWinner++;
  }
}

// ------------------------------------------------------------------ output

durations.sort((a, b) => a - b);
const pct = (p: number): number => durations[Math.floor((durations.length - 1) * p)] ?? 0;
const mean = durations.reduce((a, b) => a + b, 0) / (durations.length || 1);
const inTarget = durations.filter((d) => d >= TARGET_MIN && d <= TARGET_MAX).length;

const bar = (value: number, max: number, width = 24): string => {
  const n = max === 0 ? 0 : Math.round((value / max) * width);
  return "#".repeat(n).padEnd(width, ".");
};
const pc = (n: number, total: number): string =>
  `${((n / (total || 1)) * 100).toFixed(1).padStart(5)}%`;

console.log(`\nBALANCE SWEEP  —  ${MATCHES} matches, base seed ${BASE_SEED}`);
console.log(`config: ${EXPERIMENT.label}   army: ${ARMY}`);
console.log(`ran in ${((Date.now() - started) / 1000).toFixed(1)}s\n`);

console.log("DURATION                                    target 15-30s");
console.log(`  mean    ${mean.toFixed(1)}s`);
console.log(`  median  ${pct(0.5).toFixed(1)}s`);
console.log(`  p10     ${pct(0.1).toFixed(1)}s`);
console.log(`  p90     ${pct(0.9).toFixed(1)}s`);
console.log(`  longest ${(durations[durations.length - 1] ?? 0).toFixed(1)}s`);
console.log(`  within target  ${pc(inTarget, durations.length)}   <-- the number to move\n`);

console.log("HOW MATCHES ENDED");
const reasonMax = Math.max(...reasons.values());
for (const [reason, n] of [...reasons].sort((a, b) => b[1] - a[1])) {
  console.log(`  ${reason.padEnd(22)} ${pc(n, MATCHES)}  ${bar(n, reasonMax)}`);
}
console.log(`  draws                  ${pc(draws, MATCHES)}\n`);

// NOTE: "share of winning armies" is deliberately absent. With a fixed army
// every side fields every unit, so it is ~50% for everything and says nothing.
// It only becomes a real signal once draft mode lets compositions differ.
console.log("PER UNIT                 dmg share   kills/match   never fired   avg idle");
// Derived, not hardcoded: a hardcoded list silently omitted the AT Gun when it
// was added, so the one unit under test was missing from its own report.
const types = Object.keys(UNITS) as UnitTypeId[];
for (const type of types) {
  const s = perUnit.get(type);
  if (s === undefined) continue;
  const combat = (UNITS[type].damage ?? 0) > 0;
  const share = pc(s.damage, totalDamage);
  const kpm = (s.kills / MATCHES).toFixed(2).padStart(6);
  const never = combat ? pc(s.neverFired, s.appearances) : "    —";
  const idle = combat ? `${(s.idleTicks / s.appearances / 20).toFixed(1)}s` : "—";
  console.log(
    `  ${UNITS[type].name.padEnd(14)} ${share.padStart(12)} ${kpm}       ${never.padStart(8)}   ${idle.padStart(9)}`,
  );
}

console.log("");
console.log("WHO ACTUALLY KILLS HQs      (the objective is what decides it)");
for (const [type, dmg] of [...hqDamageBySource].sort((a, b) => b[1] - a[1])) {
  console.log(`  ${UNITS[type].name.padEnd(14)} ${pc(dmg, hqDamageTotal)} of all HQ damage`);
}

console.log("\nARCHETYPE WIN RATE       (a dominant shape here is a solved-formation warning)");
const aggregate = [...archetypeWins].filter(([id]) => !id.includes("@"));
for (const [id, row] of aggregate.sort((a, b) => b[1].won / b[1].played - a[1].won / a[1].played)) {
  const label = ARCHETYPES.find((a) => a.id === id)?.label ?? id;
  console.log(
    `  ${label.padEnd(18)} ${pc(row.won, row.played)} won   ${pc(row.drawn, row.played)} drawn   (${row.played} armies)`,
  );
}

/*
  The same table split by how far apart the nodes were drawn.

  This is the column that matters most now. An aggregate win rate cannot tell a
  shape that is mildly good everywhere from one that is unbeatable on half the
  boards and poor on the rest — and only the second of those is a real game. If
  a shape holds the same rate across every gap, the board draw is not reaching
  the decision and the variance is buying nothing.
*/
const gaps = [...new Set([...archetypeWins.keys()].flatMap((k) => k.split("@")[1] ?? []))].sort();
if (gaps.length > 1) {
  console.log(`\nBY NODE GAP             ${gaps.map((g) => `gap ${g}`.padStart(9)).join("")}`);
  for (const [id] of aggregate) {
    const label = ARCHETYPES.find((a) => a.id === id)?.label ?? id;
    const cells = gaps.map((g) => {
      const row = archetypeWins.get(`${id}@${g}`);
      return row === undefined ? "—".padStart(9) : pc(row.won, row.played).padStart(9);
    });
    console.log(`  ${label.padEnd(20)}${cells.join("")}`);
  }
}

console.log("\nSHOULDER-TO-SHOULDER    mean adjacent combat pairs per army");
console.log("                        (premise check before any lateral-splash weapon)");
for (const [id, row] of [...adjacencyByArchetype].sort(
  (a, b) => b[1].pairs / b[1].armies - a[1].pairs / a[1].armies,
)) {
  const label = ARCHETYPES.find((a) => a.id === id)?.label ?? id;
  console.log(`  ${label.padEnd(18)} ${(row.pairs / row.armies).toFixed(2)}`);
}

console.log("\nWATCH-PHASE HEALTH (§D.2)");
console.log(`  lane openings / match   ${(totalLaneOpenings / MATCHES).toFixed(2)}   target 2-4`);
console.log(
  `  idle units              ${(totalIdlePercent / MATCHES).toFixed(1)}%   target under 15%`,
);
console.log("");
