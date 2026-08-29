/**
 * Arc previews for the deployment screen.
 *
 * "Attack previews are mandatory for making the game intuitive" (§16), and the
 * LOS-shadowed version is non-negotiable for the demo (§F.2) — it is the whole
 * readability thesis, and it makes the corner rule self-teaching.
 *
 * Note what the preview can and cannot know: during deployment the enemy half
 * is hidden, so it accounts for YOUR blockers only. That is honest — you cannot
 * see where they put their sandbags.
 */

import { isInsideBoard } from "../config/gameConfig.ts";
import { mulberry32 } from "../rng/mulberry32.ts";
import type { Coord, Deployment, PlacedUnit, Team } from "../types.ts";
import { buildState } from "./state.ts";
import { patternTiles, visibleTiles } from "./targeting.ts";

export interface ArcPreview {
  /** Tiles the weapon can actually hit right now. */
  readonly covered: Coord[];
  /** Tiles inside the footprint that its own side's cover shadows out. */
  readonly blocked: Coord[];
  /**
   * Tiles too CLOSE to hit — inside the weapon's minimum range.
   *
   * Only the mortar has one (min 3), and leaving it unmarked was actively
   * misleading: the hole around the tube read as "this weapon has no reach",
   * when in fact a mortar on the front row covers every tile of the enemy zone.
   */
  readonly deadZone: Coord[];
}

const EMPTY_PREVIEW: ArcPreview = { covered: [], blocked: [], deadZone: [] };

export function arcPreview(
  team: Team,
  ownUnits: readonly PlacedUnit[],
  candidate: PlacedUnit,
): ArcPreview {
  const roster = ownUnits.includes(candidate) ? [...ownUnits] : [...ownUnits, candidate];
  const index = roster.indexOf(candidate);
  if (index < 0) return EMPTY_PREVIEW;

  const own: Deployment = { team, units: roster };
  const enemy: Deployment = { team: team === "A" ? "B" : "A", units: [] };
  const state =
    team === "A" ? buildState(own, enemy, mulberry32(0)) : buildState(enemy, own, mulberry32(0));

  const unit = state.units.find(
    (u) => u.team === team && u.row === candidate.row && u.col === candidate.col,
  );
  if (unit === undefined || unit.spec.pattern === undefined) return EMPTY_PREVIEW;

  const all = patternTiles(unit);
  const covered = visibleTiles(state, unit);
  const key = (c: Coord) => `${c.row}:${c.col}`;
  const coveredKeys = new Set(covered.map(key));

  const minRange = unit.spec.minRange ?? 1;
  const deadZone: Coord[] = [];
  if (minRange > 1) {
    for (let row = candidate.row - minRange + 1; row <= candidate.row + minRange - 1; row++) {
      for (let col = candidate.col - minRange + 1; col <= candidate.col + minRange - 1; col++) {
        if (!isInsideBoard(row, col)) continue;
        if (row === candidate.row && col === candidate.col) continue;
        deadZone.push({ row, col });
      }
    }
  }

  return {
    covered,
    blocked: all.filter((c) => !coveredKeys.has(key(c))),
    deadZone,
  };
}
