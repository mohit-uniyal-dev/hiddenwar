/**
 * Target selection. Roadmap Part I §B.6, §B.7, §B.9.
 *
 * Two rules govern everything here:
 *
 *   1. Facing is LOCKED at Ready, and the search cone and the fire cone are the
 *      same cone. A unit with nothing in its arc does nothing for the entire
 *      battle — and the report says so by name (§B.6).
 *
 *   2. There are no held targets, so there is no re-acquisition problem. On any
 *      tick where the cooldown is ready, a unit re-evaluates its priority
 *      function over ALL currently valid targets and fires that tick (§B.7).
 */

import type { Coord, Unit } from "../types.ts";
import { footprint } from "./geometry.ts";
import {
  chebyshev,
  conePattern,
  indirectPattern,
  linePattern,
  splashArea,
  step,
} from "./geometry.ts";
import { hasLineOfSight } from "./lineOfSight.ts";
import { type BattleState, isBlockerAt, unitAt } from "./state.ts";

/** The tiles a unit's weapon covers, ignoring occupancy. Used by the UI preview. */
export function patternTiles(unit: Unit): Coord[] {
  const { spec } = unit;
  const min = spec.minRange ?? 1;
  const max = spec.maxRange ?? 0;
  const origin = { row: unit.row, col: unit.col };
  switch (spec.pattern) {
    case "line":
      return linePattern(origin, unit.facing, min, max);
    case "cone":
      return conePattern(origin, unit.facing, min, max);
    case "indirect":
      return indirectPattern(origin, min, max);
    default:
      return [];
  }
}

/**
 * Build a blocker predicate that ignores the shooter's own tiles and the
 * target's own tiles. Without the exclusions a unit blocks itself, and a
 * multi-tile HQ shields its own far tiles.
 */
function blockerPredicate(
  state: BattleState,
  shooter: Unit,
  target: Unit,
): (row: number, col: number) => boolean {
  return (row, col) => {
    const occupant = unitAt(state, row, col);
    if (occupant === null) return false;
    if (occupant.id === shooter.id || occupant.id === target.id) return false;
    return occupant.spec.blocksLineOfSight === true;
  };
}

/**
 * Line-pattern candidates (Soldier, Tank).
 *
 * Walk outward along the facing. Living units never block, so the ray passes
 * over friendly and enemy infantry alike. The ray STOPS at the first blocker
 * (sandbag or HQ, either team): an enemy blocker is a valid — if inefficient —
 * target, a friendly blocker just blocks you (§B.5).
 */
function lineCandidates(state: BattleState, unit: Unit): Unit[] {
  const { dr, dc } = step(unit.facing);
  const min = unit.spec.minRange ?? 1;
  const max = unit.spec.maxRange ?? 0;
  const found: Unit[] = [];
  const seen = new Set<number>();

  for (let d = 1; d <= max; d++) {
    const row = unit.row + dr * d;
    const col = unit.col + dc * d;
    const occupant = unitAt(state, row, col);
    if (occupant === null) continue;

    const isEnemy = occupant.team !== unit.team;
    const blocks = occupant.spec.blocksLineOfSight === true;

    if (isEnemy && d >= min && !seen.has(occupant.id)) {
      seen.add(occupant.id);
      found.push(occupant);
    }
    // A blocker ends the ray whichever side owns it.
    if (blocks) break;
  }
  return found;
}

/** Cone-pattern candidates (Machine Gun). Every tile is LOS-checked. */
function coneCandidates(state: BattleState, unit: Unit): Unit[] {
  const found: Unit[] = [];
  const seen = new Set<number>();
  const origin = { row: unit.row, col: unit.col };

  for (const tile of patternTiles(unit)) {
    const occupant = unitAt(state, tile.row, tile.col);
    if (occupant === null || occupant.team === unit.team) continue;
    if (seen.has(occupant.id)) continue;
    if (!hasLineOfSight(origin, tile, blockerPredicate(state, unit, occupant))) continue;
    seen.add(occupant.id);
    found.push(occupant);
  }
  return found;
}

function distanceTo(unit: Unit, other: Unit): number {
  // Nearest tile of a multi-tile target.
  let best = Number.POSITIVE_INFINITY;
  for (const t of footprint(other.row, other.col, other.spec.width, other.spec.height)) {
    const d = chebyshev(unit.row, unit.col, t.row, t.col);
    if (d < best) best = d;
  }
  return best;
}

/**
 * Direct-fire target selection. Returns the units this unit shoots THIS tick —
 * one for a line weapon, up to `maxTargets` for the MG.
 *
 * Every comparator ends with `a.id - b.id` so no two units can ever compare
 * equal. This is what keeps iteration order stable (§B.8).
 */
export function selectDirectTargets(state: BattleState, unit: Unit): Unit[] {
  const pattern = unit.spec.pattern;
  const candidates =
    pattern === "line"
      ? lineCandidates(state, unit)
      : pattern === "cone"
        ? coneCandidates(state, unit)
        : [];

  if (candidates.length === 0) return [];

  const sorted = [...candidates];
  switch (unit.spec.priority) {
    case "closest":
      sorted.sort((a, b) => distanceTo(unit, a) - distanceTo(unit, b) || a.id - b.id);
      break;
    case "highestHp":
      sorted.sort(
        (a, b) => b.hp - a.hp || distanceTo(unit, a) - distanceTo(unit, b) || a.id - b.id,
      );
      break;
    case "infantryFirst": {
      // Priority-ordered sweep: infantry first, then nearest. If no infantry is
      // in the arc the MG falls through to any valid target — plinking a
      // sandbag for 2 is fine, because non-idle beats idle (§B.13).
      const rank = (u: Unit): number => (u.spec.unitClass === "infantry" ? 0 : 1);
      sorted.sort(
        (a, b) => rank(a) - rank(b) || distanceTo(unit, a) - distanceTo(unit, b) || a.id - b.id,
      );
      break;
    }
    default:
      sorted.sort((a, b) => a.id - b.id);
      break;
  }

  const max = unit.spec.maxTargets ?? 1;
  return sorted.slice(0, max);
}

export interface ClusterChoice {
  readonly tile: Coord;
  readonly score: number;
}

/**
 * The mortar's "largest cluster" rule, made concrete (§B.9).
 *
 *   Candidates: every tile containing an enemy unit within [min, max].
 *   Score(T):   sum of tactical value of every enemy whose footprint
 *               intersects the 3x3 block centred on T. A multi-tile HQ counts
 *               ONCE per shell, at value 40.
 *   Ties:       closest tile, then a seeded random pick.
 *
 * Counting the HQ at 40 is what makes a defended HQ usually the largest cluster
 * on the board — so the mortar becomes the natural turtle-breaker with no
 * special-case anti-turtle rule.
 */
export function selectClusterTile(state: BattleState, unit: Unit): ClusterChoice | null {
  const min = unit.spec.minRange ?? 1;
  const max = unit.spec.maxRange ?? 0;

  let best: ClusterChoice | null = null;
  let tied: ClusterChoice[] = [];

  for (const tile of indirectPattern({ row: unit.row, col: unit.col }, min, max)) {
    const occupant = unitAt(state, tile.row, tile.col);
    if (occupant === null || occupant.team === unit.team) continue;

    // Score the 3x3 block centred here.
    let score = 0;
    const counted = new Set<number>();
    for (const cell of splashArea(tile)) {
      const u = unitAt(state, cell.row, cell.col);
      if (u === null || u.team === unit.team || counted.has(u.id)) continue;
      counted.add(u.id);
      score += u.spec.value;
    }

    const choice: ClusterChoice = { tile, score };
    if (best === null || score > best.score) {
      best = choice;
      tied = [choice];
    } else if (score === best.score) {
      tied.push(choice);
    }
  }

  if (best === null) return null;
  if (tied.length === 1) return best;

  // Tie-break: closest tile first...
  let nearest = Number.POSITIVE_INFINITY;
  for (const c of tied) {
    const d = chebyshev(unit.row, unit.col, c.tile.row, c.tile.col);
    if (d < nearest) nearest = d;
  }
  const closest = tied.filter(
    (c) => chebyshev(unit.row, unit.col, c.tile.row, c.tile.col) === nearest,
  );
  if (closest.length === 1) return closest[0] ?? best;

  // ...then, and only then, the seeded RNG. This is the engine's ONLY use of
  // randomness (§B.8.1).
  const ordered = [...closest].sort((a, b) => a.tile.row - b.tile.row || a.tile.col - b.tile.col);
  const pick = ordered[state.rng.nextInt(ordered.length)];
  return pick ?? best;
}

/** Which tiles this unit could actually hit right now — for the UI arc preview. */
export function visibleTiles(state: BattleState, unit: Unit): Coord[] {
  if (unit.spec.ignoresLineOfSight === true) return patternTiles(unit);

  const origin = { row: unit.row, col: unit.col };
  const out: Coord[] = [];

  if (unit.spec.pattern === "line") {
    const { dr, dc } = step(unit.facing);
    const max = unit.spec.maxRange ?? 0;
    for (let d = 1; d <= max; d++) {
      const row = unit.row + dr * d;
      const col = unit.col + dc * d;
      if (row < 0 || col < 0) break;
      out.push({ row, col });
      if (isBlockerAt(state, row, col)) break; // the ray stops here
    }
    return out;
  }

  for (const tile of patternTiles(unit)) {
    const occupant = unitAt(state, tile.row, tile.col);
    const predicate = (row: number, col: number): boolean => {
      const u = unitAt(state, row, col);
      if (u === null) return false;
      if (u.id === unit.id) return false;
      if (occupant !== null && u.id === occupant.id) return false;
      return u.spec.blocksLineOfSight === true;
    };
    if (hasLineOfSight(origin, tile, predicate)) out.push(tile);
  }
  return out;
}
