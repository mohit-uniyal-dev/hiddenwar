/**
 * Battle state construction and tile lookups.
 *
 * Unit ids are assigned in a stable order — team A's deployment order, then
 * team B's — because iteration order must be deterministic and every targeting
 * tie-break ends with `a.id - b.id` (§B.8).
 */

import { BOARD, RULES } from "../config/gameConfig.ts";
import { UNITS } from "../config/units.ts";
import type { Rng } from "../rng/mulberry32.ts";
import type { Deployment, Shell, Team, Unit, VictoryReason, Winner } from "../types.ts";
import type { BattleEvent } from "./events.ts";
import { footprint } from "./geometry.ts";

const EMPTY = -1;

export interface BattleState {
  tick: number;
  readonly units: Unit[];
  /** row * cols + col -> unit id, or -1. */
  readonly occupancy: Int32Array;
  shells: Shell[];
  readonly events: BattleEvent[];
  readonly rng: Rng;
  /** Consecutive ticks with zero damage — drives the dead-air early end (§B.3). */
  ticksSinceDamage: number;
  /** Damage each team has dealt to enemy HQ nodes — the timeout tiebreak. */
  hqDamageDealt: { A: number; B: number };
  ended: boolean;
  winner: Winner | null;
  reason: VictoryReason | null;
}

export function tileIndex(row: number, col: number): number {
  return row * BOARD.cols + col;
}

export function buildState(a: Deployment, b: Deployment, rng: Rng): BattleState {
  const units: Unit[] = [];
  const occupancy = new Int32Array(BOARD.rows * BOARD.cols).fill(EMPTY);

  const add = (deployment: Deployment, team: Team): void => {
    for (const placed of deployment.units) {
      const spec = UNITS[placed.type];
      const id = units.length;
      const unit: Unit = {
        id,
        type: placed.type,
        team,
        row: placed.row,
        col: placed.col,
        facing: placed.facing,
        spec,
        hp: spec.hp,
        destroyed: false,
        nextFireTick:
          spec.cooldownTicks === undefined
            ? Number.POSITIVE_INFINITY
            : Math.floor(spec.cooldownTicks * RULES.firstShotCooldownFraction),
        damageDealt: 0,
        damageTaken: 0,
        kills: 0,
        shotsFired: 0,
        idleTicks: 0,
        destroyedAtTick: null,
      };
      units.push(unit);
      for (const t of footprint(placed.row, placed.col, spec.width, spec.height)) {
        occupancy[tileIndex(t.row, t.col)] = id;
      }
    }
  };

  // Team A first, then team B — the stable iteration order the RNG contract
  // depends on (§B.8).
  add(a, "A");
  add(b, "B");

  return {
    tick: 0,
    units,
    occupancy,
    shells: [],
    events: [],
    rng,
    ticksSinceDamage: 0,
    hqDamageDealt: { A: 0, B: 0 },
    ended: false,
    winner: null,
    reason: null,
  };
}

export function unitAt(state: BattleState, row: number, col: number): Unit | null {
  if (row < 0 || row >= BOARD.rows || col < 0 || col >= BOARD.cols) return null;
  const id = state.occupancy[tileIndex(row, col)];
  if (id === undefined || id === EMPTY) return null;
  const unit = state.units[id];
  if (unit === undefined || unit.destroyed) return null;
  return unit;
}

/**
 * Does an intact blocker stand here? Only sandbags and HQs block, and they
 * block for BOTH teams — walling yourself in means you cannot shoot out (§B.4).
 */
export function isBlockerAt(state: BattleState, row: number, col: number): boolean {
  const unit = unitAt(state, row, col);
  return unit !== null && unit.spec.blocksLineOfSight === true;
}

/** Remove a destroyed unit's footprint from the occupancy grid. */
export function clearFootprint(state: BattleState, unit: Unit): void {
  for (const t of footprint(unit.row, unit.col, unit.spec.width, unit.spec.height)) {
    if (state.occupancy[tileIndex(t.row, t.col)] === unit.id) {
      state.occupancy[tileIndex(t.row, t.col)] = EMPTY;
    }
  }
}
