/**
 * Match statistics for the battle report.
 *
 * Two of these rank ABOVE the original §52 metrics list, because they measure
 * the design's biggest risk directly (§D.2):
 *
 *   laneOpenings     target 2-4 per battle. Zero means the tuning is wrong.
 *   idleUnitPercent  target under 15%. Every unit that never fires is
 *                    planning effort with zero payoff.
 */

import { TICKS_PER_SECOND } from "../config/gameConfig.ts";
import type { Direction, Team, UnitTypeId } from "../types.ts";
import type { BattleState } from "./state.ts";

export interface UnitReport {
  readonly id: number;
  readonly type: UnitTypeId;
  readonly name: string;
  readonly team: Team;
  readonly row: number;
  readonly col: number;
  readonly facing: Direction;
  readonly damageDealt: number;
  readonly damageTaken: number;
  readonly kills: number;
  readonly shotsFired: number;
  readonly idleTicks: number;
  readonly idleSeconds: number;
  readonly survived: boolean;
  readonly destroyedAtTick: number | null;
  readonly hpRemaining: number;
  readonly maxHp: number;
}

export interface TeamStats {
  readonly damageDealt: number;
  readonly damageTaken: number;
  /** Damage absorbed by this team's structures — the value a wall actually bought. */
  readonly damageBlocked: number;
  readonly unitsLost: number;
  readonly unitsSurvived: number;
  readonly hqHpRemaining: number;
}

export interface MatchStats {
  readonly teams: Readonly<Record<Team, TeamStats>>;
  readonly units: readonly UnitReport[];
  readonly durationTicks: number;
  readonly durationSeconds: number;
  /** BLOCKER_BREACHED count — the drama-engine metric (§D.2). */
  readonly laneOpenings: number;
  /** Share of combat-capable units that never fired a shot (§D.2). */
  readonly idleUnitPercent: number;
}

export function buildStats(state: BattleState): MatchStats {
  const units: UnitReport[] = state.units.map((u) => ({
    id: u.id,
    type: u.type,
    name: u.spec.name,
    team: u.team,
    row: u.row,
    col: u.col,
    facing: u.facing,
    damageDealt: u.damageDealt,
    damageTaken: u.damageTaken,
    kills: u.kills,
    shotsFired: u.shotsFired,
    idleTicks: u.idleTicks,
    idleSeconds: u.idleTicks / TICKS_PER_SECOND,
    survived: !u.destroyed,
    destroyedAtTick: u.destroyedAtTick,
    hpRemaining: u.destroyed ? 0 : u.hp,
    maxHp: u.spec.hp,
  }));

  const teamStats = (team: Team): TeamStats => {
    let damageDealt = 0;
    let damageTaken = 0;
    let damageBlocked = 0;
    let unitsLost = 0;
    let unitsSurvived = 0;
    let hqHpRemaining = 0;
    for (const u of state.units) {
      if (u.team !== team) continue;
      damageDealt += u.damageDealt;
      damageTaken += u.damageTaken;
      if (u.spec.unitClass === "structure") damageBlocked += u.damageTaken;
      if (u.destroyed) unitsLost++;
      else unitsSurvived++;
      // Summed, not assigned: a side has TWO nodes, and reporting only the
      // last one understated a half-destroyed objective as a healthy one.
      if (u.type === "hq" && !u.destroyed) hqHpRemaining += u.hp;
    }
    return { damageDealt, damageTaken, damageBlocked, unitsLost, unitsSurvived, hqHpRemaining };
  };

  const combat = state.units.filter((u) => (u.spec.damage ?? 0) > 0);
  const neverFired = combat.filter((u) => u.shotsFired === 0).length;

  return {
    teams: { A: teamStats("A"), B: teamStats("B") },
    units,
    durationTicks: state.tick,
    durationSeconds: state.tick / TICKS_PER_SECOND,
    laneOpenings: state.events.filter((e) => e.type === "BLOCKER_BREACHED").length,
    idleUnitPercent: combat.length === 0 ? 0 : Math.round((neverFired / combat.length) * 100),
  };
}
