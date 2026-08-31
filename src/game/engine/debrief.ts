/**
 * The debrief: turning a loss into an edit.
 *
 * The report already said WHAT happened. This says what to do about it, and it
 * is the piece the whole loop rests on — "you lose, you change one thing, you
 * run it again" only works if the player can see what the one thing is. A
 * counter that exists but cannot be read might as well not exist.
 *
 * Two measurements shaped what is in here:
 *
 *   - Searching single-piece edits against a fixed opponent flips a loss to a
 *     win in a median of ONE move, and lifts the win rate by 50 points. Matches
 *     are decided by a small number of high-leverage placements, so the debrief
 *     hunts for those specific placements rather than offering general advice.
 *   - Objective damage is overwhelmingly indirect, so a player can lose without
 *     ever seeing a lane break. Lane-by-lane accounting is therefore not
 *     obvious from watching, and has to be stated.
 *
 * Headless, like everything in `game/` — no React, no DOM. The UI renders what
 * this returns and adds nothing of its own.
 */

import { BOARD, zoneOwner } from "../config/gameConfig.ts";
import { UNITS } from "../config/units.ts";
import { canPlace } from "../models/deployment.ts";
import type { Coord, Deployment, Team, UnitTypeId } from "../types.ts";
import type { BattleEvent } from "./events.ts";
import { footprint } from "./geometry.ts";
import { type BattleResult, simulateBattle } from "./simulate.ts";
import type { MatchStats } from "./stats.ts";

export interface LaneReport {
  readonly col: number;
  /** Damage this team's units dealt from this column. */
  readonly dealt: number;
  /** Damage this team took in this column. */
  readonly taken: number;
  readonly units: number;
  /** True when the column produced nothing at all — the actionable case. */
  readonly dead: boolean;
}

export interface NodeReport {
  readonly row: number;
  readonly col: number;
  readonly hpRemaining: number;
  readonly maxHp: number;
  readonly destroyedAtTick: number | null;
  /** The column most of the damage against it came from, if any stands out. */
  readonly threatColumn: number | null;
}

export interface Debrief {
  readonly team: Team;
  readonly lanes: readonly LaneReport[];
  readonly nodes: readonly NodeReport[];
  /** The gap the board drew between your two nodes — 2 or 3 (see NODE_SEPARATIONS). */
  readonly nodeGap: number;
  /** Plain-language findings, most actionable first. */
  readonly findings: readonly string[];
}

const other = (team: Team): Team => (team === "A" ? "B" : "A");

/**
 * Everything the losing player needs, computed from the event log.
 *
 * `team` is the player being debriefed, so the same battle produces two
 * different debriefs — which is correct, because they made different mistakes.
 */
export function buildDebrief(
  events: readonly BattleEvent[],
  stats: MatchStats,
  team: Team,
): Debrief {
  const byId = new Map(stats.units.map((u) => [u.id, u]));
  const mine = stats.units.filter((u) => u.team === team);

  // --- lanes ---------------------------------------------------------------
  const dealt = new Array<number>(BOARD.cols).fill(0);
  const taken = new Array<number>(BOARD.cols).fill(0);
  const counts = new Array<number>(BOARD.cols).fill(0);

  for (const u of mine) {
    if (u.type === "hq") continue;
    counts[u.col] = (counts[u.col] ?? 0) + 1;
  }
  for (const e of events) {
    if (e.type !== "DAMAGE") continue;
    const source = byId.get(e.sourceId);
    const target = byId.get(e.targetId);
    if (source?.team === team) dealt[source.col] = (dealt[source.col] ?? 0) + e.amount;
    if (target?.team === team) taken[target.col] = (taken[target.col] ?? 0) + e.amount;
  }

  const lanes: LaneReport[] = [];
  for (let col = 0; col < BOARD.cols; col++) {
    const units = counts[col] ?? 0;
    lanes.push({
      col,
      dealt: dealt[col] ?? 0,
      taken: taken[col] ?? 0,
      units,
      dead: units > 0 && (dealt[col] ?? 0) === 0,
    });
  }

  // --- nodes ---------------------------------------------------------------
  const nodeDamage = new Map<number, number[]>();
  for (const e of events) {
    if (e.type !== "DAMAGE") continue;
    const target = byId.get(e.targetId);
    if (target?.team !== team || target.type !== "hq") continue;
    const source = byId.get(e.sourceId);
    if (source === undefined) continue;
    const cols = nodeDamage.get(target.id) ?? new Array<number>(BOARD.cols).fill(0);
    cols[source.col] = (cols[source.col] ?? 0) + e.amount;
    nodeDamage.set(target.id, cols);
  }

  const nodes: NodeReport[] = mine
    .filter((u) => u.type === "hq")
    .map((u) => {
      const cols = nodeDamage.get(u.id) ?? [];
      const total = cols.reduce((a, b) => a + b, 0);
      let threatColumn: number | null = null;
      let best = 0;
      cols.forEach((amount, col) => {
        if (amount > best) {
          best = amount;
          threatColumn = col;
        }
      });
      // Only call it a threat lane if it genuinely dominated the damage.
      return {
        row: u.row,
        col: u.col,
        hpRemaining: u.hpRemaining,
        maxHp: u.maxHp,
        destroyedAtTick: u.destroyedAtTick,
        threatColumn: total > 0 && best >= total * 0.5 ? threatColumn : null,
      };
    });

  const cols = nodes.map((n) => n.col).sort((a, b) => a - b);
  const nodeGap = cols.length === 2 ? Math.abs((cols[1] ?? 0) - (cols[0] ?? 0)) : 0;

  // --- findings ------------------------------------------------------------
  const findings: string[] = [];

  const lost = nodes.filter((n) => n.destroyedAtTick !== null);
  if (lost.length > 0) {
    const first = lost[0];
    if (first !== undefined) {
      const where =
        first.threatColumn === null ? "" : ` — most of it down column ${first.threatColumn + 1}`;
      findings.push(
        `Your node in column ${first.col + 1} fell${where}. Nothing you place after the fact can move, so that lane had to be answered before you pressed Ready.`,
      );
    }
  }

  const deadLanes = lanes.filter((l) => l.dead);
  if (deadLanes.length > 0) {
    const list = deadLanes.map((l) => l.col + 1).join(", ");
    const n = deadLanes.reduce((sum, l) => sum + l.units, 0);
    findings.push(
      `${n} unit${n === 1 ? "" : "s"} in column${deadLanes.length === 1 ? "" : "s"} ${list} dealt no damage at all. Check what was standing in front of them.`,
    );
  }

  const empty = lanes.filter((l) => l.units === 0).map((l) => l.col + 1);
  if (empty.length > 0) {
    findings.push(
      `You left column${empty.length === 1 ? "" : "s"} ${empty.join(", ")} completely empty. Nothing moves, so an empty column is conceded for the whole battle.`,
    );
  }

  if (nodeGap > 0) {
    findings.push(
      nodeGap <= 2
        ? `Your nodes were only ${nodeGap} columns apart this match, so one massed push could threaten both. A force concentrated in the middle defends and attacks at the same time.`
        : `Your nodes were ${nodeGap} columns apart, so they are two separate fights. Force sent to one cannot help the other — units never move.`,
    );
  }

  const heaviest = [...lanes].sort((a, b) => b.taken - a.taken)[0];
  if (heaviest !== undefined && heaviest.taken > 0) {
    findings.push(
      `Column ${heaviest.col + 1} absorbed the most incoming fire (${heaviest.taken} damage).`,
    );
  }

  return { team, lanes, nodes, nodeGap, findings };
}

export interface SuggestedEdit {
  readonly unitIndex: number;
  readonly type: UnitTypeId;
  readonly from: Coord;
  readonly to: Coord;
  /** Whether this single move turns the loss into a win. */
  readonly wins: boolean;
}

/**
 * The single best one-piece change, found by actually replaying the battle.
 *
 * This is only affordable because the engine is headless and deterministic: a
 * whole match is well under a millisecond, so a few hundred replays is a
 * fraction of a second. Nothing here is a heuristic — every candidate is a real
 * battle, fought to its end, against the exact army the opponent committed.
 *
 * Deliberately limited to ONE move. The measured shape of this game is that a
 * single placement is usually enough to flip a result, and a suggestion the
 * player can hold in their head is worth more than an optimal army they cannot.
 */
export function bestSingleEdit(
  mine: Deployment,
  theirs: Deployment,
  seed: number,
  craters: readonly Coord[],
  original: BattleResult,
): SuggestedEdit | null {
  const team = mine.team;
  const play = (deployment: Deployment): BattleResult =>
    team === "A"
      ? simulateBattle({ playerA: deployment, playerB: theirs, seed, craters })
      : simulateBattle({ playerA: theirs, playerB: deployment, seed, craters });

  const margin = (r: BattleResult): number => {
    const win = r.winner === team ? 1000 : r.winner === "draw" ? 0 : -1000;
    const us = r.stats.teams[team].hqHpRemaining;
    const them = r.stats.teams[other(team)].hqHpRemaining;
    return win + us - them;
  };

  // Tiles that are free before we start, so the inner loop stays cheap.
  const occupied = new Set<number>();
  for (const c of craters) occupied.add(c.row * BOARD.cols + c.col);
  for (const u of mine.units) {
    for (const t of footprint(u.row, u.col, UNITS[u.type].width, UNITS[u.type].height)) {
      occupied.add(t.row * BOARD.cols + t.col);
    }
  }

  let best: SuggestedEdit | null = null;
  let bestMargin = margin(original);

  mine.units.forEach((unit, index) => {
    if (unit.type === "hq") return; // the nodes are drawn, not chosen
    for (let row = 0; row < BOARD.rows; row++) {
      if (zoneOwner(row) !== team) continue;
      for (let col = 0; col < BOARD.cols; col++) {
        if (occupied.has(row * BOARD.cols + col)) continue;
        if (!canPlace(team, unit.type, row, col, mine.units, index, craters)) continue;

        const moved: Deployment = {
          team,
          units: mine.units.map((u, i) => (i === index ? { ...u, row, col } : u)),
        };
        const result = play(moved);
        const score = margin(result);
        if (score > bestMargin) {
          bestMargin = score;
          best = {
            unitIndex: index,
            type: unit.type,
            from: { row: unit.row, col: unit.col },
            to: { row, col },
            wins: result.winner === team,
          };
        }
      }
    }
  });

  return best;
}
