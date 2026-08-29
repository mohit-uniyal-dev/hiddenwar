/**
 * Deriving a render frame from the event log.
 *
 * The renderer never simulates — it replays. This module turns "what tick are
 * we on" into "what should be on screen", which is why the battle report can
 * never disagree with what the player just watched (§H.4).
 *
 * Headless and pure, so it is unit-testable without a browser.
 */

import { TICKS_PER_SECOND } from "../config/gameConfig.ts";
import type { BattleEvent } from "./events.ts";
import type { UnitReport } from "./stats.ts";

/** How long a tracer stays on screen, in ticks. */
const TRACER_TICKS = 4;
/** How long an explosion stays on screen, in ticks. */
const EXPLOSION_TICKS = 8;

export interface FrameUnit {
  readonly report: UnitReport;
  readonly hp: number;
  readonly destroyed: boolean;
  /** 0..1, for the damage-state sprite swap. */
  readonly hpFraction: number;
  /** Ticks since this unit last took damage — drives the hit flash. */
  readonly ticksSinceHit: number | null;
}

export interface Tracer {
  readonly fromId: number;
  readonly toId: number;
  readonly age: number;
}

export interface FlyingShell {
  readonly sourceId: number;
  readonly row: number;
  readonly col: number;
  /** 0..1 along its arc. */
  readonly progress: number;
}

export interface Explosion {
  readonly row: number;
  readonly col: number;
  readonly age: number;
}

export interface Frame {
  readonly tick: number;
  readonly units: readonly FrameUnit[];
  readonly tracers: readonly Tracer[];
  readonly shells: readonly FlyingShell[];
  readonly explosions: readonly Explosion[];
  /** Summed tactical value still standing, per team. A heuristic for the HUD bar. */
  readonly strength: { readonly A: number; readonly B: number };
}

export interface PlaybackSource {
  readonly events: readonly BattleEvent[];
  readonly units: readonly UnitReport[];
  readonly endedAtTick: number;
}

/** Tactical values, mirrored from config so the renderer stays decoupled. */
const VALUE: Record<string, number> = {
  soldier: 5,
  mg: 12,
  tank: 20,
  mortar: 15,
  sandbag: 1,
  hq: 40,
};

export function frameAt(source: PlaybackSource, tick: number): Frame {
  const hp = new Map<number, number>();
  const destroyed = new Set<number>();
  const lastHit = new Map<number, number>();

  for (const u of source.units) hp.set(u.id, u.maxHp);

  const tracers: Tracer[] = [];
  const shells: FlyingShell[] = [];
  const explosions: Explosion[] = [];

  for (const event of source.events) {
    if (event.tick > tick) {
      // Shells fired in the future are irrelevant; everything else is ordered.
      continue;
    }
    switch (event.type) {
      case "DAMAGE": {
        hp.set(event.targetId, (hp.get(event.targetId) ?? 0) - event.amount);
        lastHit.set(event.targetId, event.tick);
        break;
      }
      case "UNIT_DESTROYED":
        destroyed.add(event.unitId);
        break;
      case "ATTACK": {
        const age = tick - event.tick;
        if (age <= TRACER_TICKS) {
          for (const targetId of event.targetIds) {
            tracers.push({ fromId: event.attackerId, toId: targetId, age });
          }
        }
        break;
      }
      case "SHELL_FIRED": {
        if (tick < event.landsAtTick) {
          const span = event.landsAtTick - event.tick;
          shells.push({
            sourceId: event.sourceId,
            row: event.row,
            col: event.col,
            progress: span === 0 ? 1 : (tick - event.tick) / span,
          });
        }
        break;
      }
      case "SHELL_LANDED": {
        const age = tick - event.tick;
        if (age <= EXPLOSION_TICKS) explosions.push({ row: event.row, col: event.col, age });
        break;
      }
      default:
        break;
    }
  }

  let strengthA = 0;
  let strengthB = 0;
  const units: FrameUnit[] = source.units.map((report) => {
    const isDead = destroyed.has(report.id);
    const current = isDead ? 0 : Math.max(0, hp.get(report.id) ?? report.maxHp);
    if (!isDead) {
      const value = VALUE[report.type] ?? 0;
      if (report.team === "A") strengthA += value;
      else strengthB += value;
    }
    const hitTick = lastHit.get(report.id);
    return {
      report,
      hp: current,
      destroyed: isDead,
      hpFraction: report.maxHp === 0 ? 0 : current / report.maxHp,
      ticksSinceHit: hitTick === undefined ? null : tick - hitTick,
    };
  });

  return {
    tick,
    units,
    tracers,
    shells,
    explosions,
    strength: { A: strengthA, B: strengthB },
  };
}

export function ticksToSeconds(ticks: number): number {
  return ticks / TICKS_PER_SECOND;
}

/**
 * The final shot that kills an HQ is the one slow-motion moment in the match —
 * exactly one, never more (§D.2).
 */
export function hqKillTick(source: PlaybackSource): number | null {
  const event = source.events.find((e) => e.type === "HQ_DESTROYED");
  return event === undefined ? null : event.tick;
}
