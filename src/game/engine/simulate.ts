/**
 * The battle simulation. Roadmap Part I §B.8, Part II §H.4.
 *
 * This function runs a complete battle with no DOM, no React and no browser.
 * Everything downstream — replays, the AI, server-authoritative multiplayer,
 * the balance sweep — is a consumer of its event log.
 *
 * Two-phase tick resolution, so there is no turn-order advantage:
 *
 *   Phase 1  every ready unit selects a target and computes damage against the
 *            board state AS OF THE START OF THE TICK
 *   Phase 2  all damage applies
 *   Phase 3  deaths resolve
 *
 * Two units that deal lethal damage to each other on the same tick both die.
 * Mutual kills are legal and correct.
 */

import { CONFIG_VERSION, TICKS_PER_SECOND } from "../config/gameConfig.ts";
import { mulberry32 } from "../rng/mulberry32.ts";
import type { Coord, DamageType, Deployment, Shell, Team, Unit } from "../types.ts";
import { computeDamage, computeSplashDamage } from "./damage.ts";
import type { BattleEvent } from "./events.ts";
import { footprint, splashArea } from "./geometry.ts";
import { type BattleState, buildState, clearFootprint, unitAt } from "./state.ts";
import type { MatchStats } from "./stats.ts";
import { buildStats } from "./stats.ts";
import { selectClusterTile, selectDirectTargets } from "./targeting.ts";
import { checkVictory, hq } from "./victory.ts";

export interface SimulateInput {
  readonly playerA: Deployment;
  readonly playerB: Deployment;
  readonly seed: number;
  /** Indestructible cover for this match. Empty unless the caller supplies it. */
  readonly craters?: readonly Coord[];
}

export interface BattleResult {
  readonly winner: Team | "draw";
  readonly reason: string;
  readonly endedAtTick: number;
  readonly durationSeconds: number;
  readonly events: readonly BattleEvent[];
  readonly stats: MatchStats;
  /** Pinned so a replay is never re-run against different numbers (§I.5). */
  readonly configVersion: string;
  readonly seed: number;
}

interface PendingDamage {
  readonly sourceId: number;
  readonly targetId: number;
  readonly amount: number;
  readonly damageType: DamageType;
}

export function simulateBattle(input: SimulateInput): BattleResult {
  const rng = mulberry32(input.seed);
  const state = buildState(input.playerA, input.playerB, rng, input.craters ?? []);

  while (!state.ended) {
    runTick(state);
  }

  const events = state.events;
  return {
    winner: state.winner ?? "draw",
    reason: state.reason ?? "timeCap",
    endedAtTick: state.tick,
    durationSeconds: state.tick / TICKS_PER_SECOND,
    events,
    stats: buildStats(state),
    configVersion: CONFIG_VERSION,
    seed: input.seed,
  };
}

function runTick(state: BattleState): void {
  const tick = state.tick;
  const pending: PendingDamage[] = [];

  // ---- Phase 1a: shells that land this tick -------------------------------
  // Resolved against the start-of-tick board. The shell is tile-targeted, so
  // it damages whatever stands there at landing — even if the units it was
  // aimed at died in flight (§B.7).
  const landing = state.shells.filter((s) => s.landsAtTick === tick);
  if (landing.length > 0) {
    state.shells = state.shells.filter((s) => s.landsAtTick !== tick);
    for (const shell of landing) {
      state.events.push({
        type: "SHELL_LANDED",
        tick,
        sourceId: shell.sourceId,
        row: shell.row,
        col: shell.col,
      });
      collectShellDamage(state, shell, pending);
    }
  }

  // ---- Phase 1b: every ready unit selects and fires ------------------------
  // state.units is already in (team, deploymentIndex) order, which is the
  // stable iteration order the RNG contract depends on (§B.8).
  for (const unit of state.units) {
    if (unit.destroyed) continue;
    const cooldown = unit.spec.cooldownTicks;
    if (cooldown === undefined) continue; // structures never fire
    if (unit.nextFireTick > tick) continue;

    if (unit.spec.pattern === "indirect") {
      const choice = selectClusterTile(state, unit);
      if (choice === null) {
        unit.idleTicks++;
        continue;
      }
      const flight = unit.spec.flightTicks ?? 0;
      const shell: Shell = {
        sourceId: unit.id,
        team: unit.team,
        row: choice.tile.row,
        col: choice.tile.col,
        landsAtTick: tick + flight,
        damage: unit.spec.damage ?? 0,
        damageType: unit.spec.damageType ?? "explosive",
        splashPercent: unit.spec.splashPercent ?? 0,
        structureMultiplier: unit.spec.structureMultiplier ?? 1,
      };
      state.shells.push(shell);
      state.events.push({
        type: "SHELL_FIRED",
        tick,
        sourceId: unit.id,
        row: shell.row,
        col: shell.col,
        landsAtTick: shell.landsAtTick,
      });
      unit.shotsFired++;
      unit.nextFireTick = tick + cooldown;
      continue;
    }

    const targets = selectDirectTargets(state, unit);
    if (targets.length === 0) {
      // A ready weapon with nothing in its arc. This is the number that decides
      // whether the watch phase is worth watching (§D.2) — track every tick.
      unit.idleTicks++;
      continue;
    }

    const base = unit.spec.damage ?? 0;
    const damageType = unit.spec.damageType ?? "bullet";
    for (const target of targets) {
      pending.push({
        sourceId: unit.id,
        targetId: target.id,
        amount: computeDamage(
          base,
          damageType,
          target.spec.unitClass,
          unit.spec.structureMultiplier ?? 1,
        ),
        damageType,
      });
    }
    state.events.push({
      type: "ATTACK",
      tick,
      attackerId: unit.id,
      targetIds: targets.map((t) => t.id),
    });
    unit.shotsFired++;
    unit.nextFireTick = tick + cooldown;
  }

  // ---- Phase 2: apply all damage ------------------------------------------
  for (const hit of pending) {
    const target = state.units[hit.targetId];
    const source = state.units[hit.sourceId];
    if (target === undefined || target.destroyed) continue;
    target.hp -= hit.amount;
    target.damageTaken += hit.amount;
    if (target.type === "hq" && source !== undefined) {
      state.hqDamageDealt[source.team] += hit.amount;
    }
    if (source !== undefined) source.damageDealt += hit.amount;
    state.events.push({
      type: "DAMAGE",
      tick,
      sourceId: hit.sourceId,
      targetId: hit.targetId,
      amount: hit.amount,
      damageType: hit.damageType,
    });
    // Deaths are deferred to phase 3 so simultaneous lethal hits both land.
    if (target.hp <= 0 && source !== undefined) {
      source.kills++;
    }
  }

  // ---- Phase 3: resolve deaths --------------------------------------------
  for (const unit of state.units) {
    if (unit.destroyed || unit.hp > 0) continue;
    unit.destroyed = true;
    unit.hp = 0;
    unit.destroyedAtTick = tick;
    clearFootprint(state, unit);
    state.events.push({ type: "UNIT_DESTROYED", tick, unitId: unit.id, killerId: -1 });
    if (unit.spec.blocksLineOfSight === true) {
      // A lane just opened. This is the drama engine — dormant units can now
      // acquire targets they never had (§D.2).
      state.events.push({
        type: "BLOCKER_BREACHED",
        tick,
        unitId: unit.id,
        row: unit.row,
        col: unit.col,
      });
    }
    if (unit.type === "hq") {
      state.events.push({ type: "HQ_DESTROYED", tick, team: unit.team });
    }
  }

  state.ticksSinceDamage = pending.length > 0 ? 0 : state.ticksSinceDamage + 1;

  // ---- Victory ------------------------------------------------------------
  const verdict = checkVictory(state);
  if (verdict !== null) {
    state.ended = true;
    state.winner = verdict.winner;
    state.reason = verdict.reason;
    state.events.push({
      type: "BATTLE_END",
      tick,
      winner: verdict.winner,
      reason: verdict.reason,
    });
    return;
  }

  state.tick = tick + 1;
}

/**
 * A shell damages the centre tile in full and the 8 surrounding tiles at 50%.
 * A unit standing on several affected tiles — the 2x2 HQ — is damaged ONCE,
 * at the highest applicable amount (§B.9, §B.11).
 */
function collectShellDamage(state: BattleState, shell: Shell, pending: PendingDamage[]): void {
  const best = new Map<number, number>();

  const consider = (row: number, col: number, amount: (u: Unit) => number): void => {
    const target = unitAt(state, row, col);
    // No friendly fire in the MVP (§B.9).
    if (target === null || target.team === shell.team) return;
    const value = amount(target);
    const existing = best.get(target.id);
    if (existing === undefined || value > existing) best.set(target.id, value);
  };

  consider(shell.row, shell.col, (u) =>
    computeDamage(shell.damage, shell.damageType, u.spec.unitClass, shell.structureMultiplier),
  );
  for (const cell of splashArea({ row: shell.row, col: shell.col })) {
    if (cell.row === shell.row && cell.col === shell.col) continue;
    consider(cell.row, cell.col, (u) =>
      computeSplashDamage(
        shell.damage,
        shell.splashPercent,
        shell.damageType,
        u.spec.unitClass,
        shell.structureMultiplier,
      ),
    );
  }

  // Sorted so the pending list is order-stable regardless of Map insertion.
  const ids = [...best.keys()].sort((a, b) => a - b);
  for (const id of ids) {
    pending.push({
      sourceId: shell.sourceId,
      targetId: id,
      amount: best.get(id) ?? 0,
      damageType: shell.damageType,
    });
  }
}

/** Re-exported so callers do not need to reach into victory.ts. */
export { hq, footprint };
