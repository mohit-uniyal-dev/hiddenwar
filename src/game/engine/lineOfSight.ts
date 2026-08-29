/**
 * Line of sight — the exact raycast rule from Roadmap Part I §B.5.
 *
 *   Supercover raycast, with diagonals blocked only by double walls.
 *
 * A shot is blocked if and only if:
 *   - the segment strictly passes through the INTERIOR of an intermediate tile
 *     containing an intact blocker, or
 *   - the segment passes exactly through a tile CORNER and BOTH diagonally
 *     adjacent tiles at that corner contain blockers.
 *
 * So shooting past a single sandbag corner is allowed; shooting through the
 * diagonal seam between two sandbags is not.
 *
 * Only sandbags and HQs block, and they block for both teams (§B.4). Living
 * units never block — friendly or enemy.
 *
 * Implementation is Dedu's integer supercover line. All arithmetic is integer,
 * so the traversal is bit-identical on every platform (§H.3).
 */

import type { Coord } from "../types.ts";

export type TraversalStep =
  /** The segment passes through this tile's interior. One blocker here blocks. */
  | { readonly kind: "tile"; readonly row: number; readonly col: number }
  /** The segment grazes a corner. Blocks only if BOTH tiles contain blockers. */
  | { readonly kind: "corner"; readonly a: Coord; readonly b: Coord };

/**
 * Every tile the segment from origin to target touches, in order, with corner
 * grazes reported separately from interior crossings.
 *
 * The origin tile is included as the first step and the target tile as the
 * last; callers are responsible for excluding them (see `hasLineOfSight`).
 */
export function traverse(origin: Coord, target: Coord): TraversalStep[] {
  const steps: TraversalStep[] = [];
  let y = origin.row;
  let x = origin.col;
  steps.push({ kind: "tile", row: y, col: x });

  let dy = target.row - origin.row;
  let dx = target.col - origin.col;
  if (dy === 0 && dx === 0) return steps;

  let ystep = 1;
  let xstep = 1;
  if (dy < 0) {
    ystep = -1;
    dy = -dy;
  }
  if (dx < 0) {
    xstep = -1;
    dx = -dx;
  }

  const ddy = 2 * dy;
  const ddx = 2 * dx;

  if (ddx >= ddy) {
    // Shallow: step along x, occasionally along y.
    let error = dx;
    let errorprev = dx;
    for (let i = 0; i < dx; i++) {
      x += xstep;
      error += ddy;
      if (error > ddx) {
        y += ystep;
        error -= ddx;
        const sum = error + errorprev;
        if (sum < ddx) {
          steps.push({ kind: "tile", row: y - ystep, col: x });
        } else if (sum > ddx) {
          steps.push({ kind: "tile", row: y, col: x - xstep });
        } else {
          // Exactly through the corner shared by these two tiles.
          steps.push({
            kind: "corner",
            a: { row: y - ystep, col: x },
            b: { row: y, col: x - xstep },
          });
        }
      }
      steps.push({ kind: "tile", row: y, col: x });
      errorprev = error;
    }
  } else {
    // Steep: step along y, occasionally along x.
    let error = dy;
    let errorprev = dy;
    for (let i = 0; i < dy; i++) {
      y += ystep;
      error += ddx;
      if (error > ddy) {
        x += xstep;
        error -= ddy;
        const sum = error + errorprev;
        if (sum < ddy) {
          steps.push({ kind: "tile", row: y, col: x - xstep });
        } else if (sum > ddy) {
          steps.push({ kind: "tile", row: y - ystep, col: x });
        } else {
          steps.push({
            kind: "corner",
            a: { row: y, col: x - xstep },
            b: { row: y - ystep, col: x },
          });
        }
      }
      steps.push({ kind: "tile", row: y, col: x });
      errorprev = error;
    }
  }

  return steps;
}

/**
 * Is the shot from `origin` to `target` unobstructed?
 *
 * `isBlocker` must return false for tiles occupied by the shooter and by the
 * intended target — otherwise a unit is blocked by itself, and a multi-tile
 * HQ shields its own far tiles.
 */
export function hasLineOfSight(
  origin: Coord,
  target: Coord,
  isBlocker: (row: number, col: number) => boolean,
): boolean {
  const steps = traverse(origin, target);
  for (const s of steps) {
    if (s.kind === "tile") {
      if (s.row === origin.row && s.col === origin.col) continue;
      if (s.row === target.row && s.col === target.col) continue;
      if (isBlocker(s.row, s.col)) return false;
    } else {
      // Corner graze: blocked only when BOTH diagonal neighbours block.
      if (isBlocker(s.a.row, s.a.col) && isBlocker(s.b.row, s.b.col)) return false;
    }
  }
  return true;
}
