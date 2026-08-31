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

/** Every HQ node a team owns. Losing the objective means losing them ALL. */
export function hqNodes(state: BattleState, team: Team): Unit[] {
  return state.units.filter((u) => u.team === team && u.type === "hq");
}

export function hq(state: BattleState, team: Team): Unit | undefined {
  return hqNodes(state, team)[0];
}

function hqHp(state: BattleState, team: Team): number {
  let total = 0;
  for (const node of hqNodes(state, team)) if (!node.destroyed) total += node.hp;
  return total;
}

/**
 * The objective falls only when EVERY node does.
 *
 * An army with no nodes at all has not "lost its objective" — it never had one;
 * puzzles, fixtures and the sweep run node-less armies, and those are decided by
 * army destruction or the tiebreak ladder instead.
 *
 * The "destroy either node" version must never ship: attack would simply
 * concentrate on whichever node is less defensible, which is strictly worse
 * than a single HQ. Requiring both is what forces an attacker to divide, and
 * since units never move, the force that kills the first node is then stranded
 * and can never help against the second.
 */
function hqIsDestroyed(state: BattleState, team: Team): boolean {
  const nodes = hqNodes(state, team);
  return nodes.length > 0 && nodes.every((n) => n.destroyed);
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
  /*
    Node damage first, and this is what stops a timeout rewarding the
    concentrator. Winning one lane earns exactly one node and a pile of stranded
    units; the clock then works AGAINST you, because the opponent's untouched
    front keeps chipping the other objective.
  */
  const aDealt = state.hqDamageDealt.A;
  const bDealt = state.hqDamageDealt.B;
  if (aDealt !== bDealt) return { winner: aDealt > bDealt ? "A" : "B", reason };

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
