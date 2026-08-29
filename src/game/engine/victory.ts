/**
 * Victory, stalemate and the tiebreak ladder. Roadmap Part I §B.3.
 *
 * The rule that matters most here is #1: army destruction wins OUTRIGHT,
 * regardless of HQ HP. That closes the unreachable-HQ hole — since nothing
 * moves, a walled back-corner HQ must not be able to force a draw.
 */

import { RULES } from "../config/gameConfig.ts";
import type { Team, Unit, VictoryReason, Winner } from "../types.ts";
import type { BattleState } from "./state.ts";

export interface Verdict {
  readonly winner: Winner;
  readonly reason: VictoryReason;
}

function alive(state: BattleState, team: Team): Unit[] {
  return state.units.filter((u) => u.team === team && !u.destroyed);
}

/** A unit can fight if it deals damage. Sandbags and HQs cannot (§B.3). */
function combatCapableCount(state: BattleState, team: Team): number {
  let n = 0;
  for (const u of state.units) {
    if (u.team === team && !u.destroyed && (u.spec.damage ?? 0) > 0) n++;
  }
  return n;
}

export function hq(state: BattleState, team: Team): Unit | undefined {
  return state.units.find((u) => u.team === team && u.type === "hq");
}

function hqHp(state: BattleState, team: Team): number {
  const h = hq(state, team);
  return h === undefined || h.destroyed ? 0 : h.hp;
}

/**
 * An army with no HQ at all has not "lost its HQ" — it never had one.
 *
 * Classic mode always deploys one, but puzzle setups, test fixtures and the
 * balance sweep routinely run HQ-less armies, and they must be decided by army
 * destruction or the tiebreak ladder instead.
 */
function hqIsDestroyed(state: BattleState, team: Team): boolean {
  return hq(state, team)?.destroyed === true;
}

function survivingValue(state: BattleState, team: Team): number {
  let total = 0;
  for (const u of alive(state, team)) total += u.spec.value;
  return total;
}

/**
 * Tiebreak ladder for battles that end without an HQ kill or army destruction:
 *   (a) higher HQ HP  ->  (b) higher surviving tactical value  ->  (c) draw.
 */
function tiebreak(state: BattleState, reason: VictoryReason): Verdict {
  const aHq = hqHp(state, "A");
  const bHq = hqHp(state, "B");
  if (aHq !== bHq) return { winner: aHq > bHq ? "A" : "B", reason };

  const aValue = survivingValue(state, "A");
  const bValue = survivingValue(state, "B");
  if (aValue !== bValue) return { winner: aValue > bValue ? "A" : "B", reason };

  return { winner: "draw", reason };
}

/**
 * Evaluated after deaths resolve, every tick, in the priority order given
 * in §B.3. Returns null while the battle should continue.
 */
export function checkVictory(state: BattleState): Verdict | null {
  const aCombat = combatCapableCount(state, "A");
  const bCombat = combatCapableCount(state, "B");

  // 1. Army destruction wins outright — ahead of HQ HP, deliberately.
  //
  // Edge case worth knowing: if A's HQ dies on the same tick that B loses its
  // last combat unit, this rule hands the win to A even though A's HQ is gone.
  // That ordering is specified in §B.3; it is rare, and the alternative (HQ
  // first) would reopen the unreachable-HQ hole in the mirror case.
  if (aCombat === 0 && bCombat > 0) return { winner: "B", reason: "armyDestroyed" };
  if (bCombat === 0 && aCombat > 0) return { winner: "A", reason: "armyDestroyed" };
  if (aCombat === 0 && bCombat === 0) return tiebreak(state, "armyDestroyed");

  // 2. HQ destruction.
  const aHqDead = hqIsDestroyed(state, "A");
  const bHqDead = hqIsDestroyed(state, "B");
  if (aHqDead && bHqDead) return { winner: "draw", reason: "mutualHqDestruction" };
  if (aHqDead) return { winner: "B", reason: "hqDestroyed" };
  if (bHqDead) return { winner: "A", reason: "hqDestroyed" };

  // 3. Dead air: 100 consecutive ticks (5s) with zero damage.
  if (state.ticksSinceDamage >= RULES.deadAirTicks) return tiebreak(state, "deadAir");

  // 4. Hard cap: 1,200 ticks (60s), unconditional.
  if (state.tick >= RULES.maxTicks) return tiebreak(state, "timeCap");

  return null;
}
