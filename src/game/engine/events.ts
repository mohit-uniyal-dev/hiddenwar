/**
 * The battle event log. Roadmap Part III §46 and Part II §H.4.
 *
 * The simulation produces events; it never animates. The renderer and the
 * battle report are two independent consumers of this one log, which is why
 * the report's numbers can never disagree with what the player just watched.
 */

import type { DamageType, Team, VictoryReason, Winner } from "../types.ts";

export type BattleEvent =
  /** Direct fire. Hitscan in the simulation — the projectile is animation only. */
  | {
      readonly type: "ATTACK";
      readonly tick: number;
      readonly attackerId: number;
      readonly targetIds: readonly number[];
    }
  /** A mortar shell leaves the tube, aimed at a TILE, not a unit (§B.7). */
  | {
      readonly type: "SHELL_FIRED";
      readonly tick: number;
      readonly sourceId: number;
      readonly row: number;
      readonly col: number;
      readonly landsAtTick: number;
    }
  | {
      readonly type: "SHELL_LANDED";
      readonly tick: number;
      readonly sourceId: number;
      readonly row: number;
      readonly col: number;
    }
  | {
      readonly type: "DAMAGE";
      readonly tick: number;
      readonly sourceId: number;
      readonly targetId: number;
      readonly amount: number;
      readonly damageType: DamageType;
    }
  | {
      readonly type: "UNIT_DESTROYED";
      readonly tick: number;
      readonly unitId: number;
      readonly killerId: number;
    }
  /** A lane opened. This is the drama engine — track it (§D.2). */
  | {
      readonly type: "BLOCKER_BREACHED";
      readonly tick: number;
      readonly unitId: number;
      readonly row: number;
      readonly col: number;
    }
  | {
      readonly type: "HQ_DESTROYED";
      readonly tick: number;
      readonly team: Team;
    }
  | {
      readonly type: "BATTLE_END";
      readonly tick: number;
      readonly winner: Winner;
      readonly reason: VictoryReason;
    };
