/**
 * Core engine types.
 *
 * This file — and everything under src/game/ — is headless. No React, no DOM.
 * See roadmap Part II §H.4.
 */

export type Team = "A" | "B";

/** Four facings only. Roadmap §B.13 — permanently four, not eight. */
export type Direction = "N" | "E" | "S" | "W";

export type UnitTypeId = "soldier" | "mg" | "atgun" | "tank" | "mortar" | "sandbag" | "hq";

export type DamageType = "bullet" | "heavy" | "explosive" | "pierce";

/** Target classes for the damage multiplier table (§C.1). */
export type UnitClass = "infantry" | "armored" | "structure";

export type AttackPattern = "line" | "cone" | "indirect" | "none";

export type TargetPriority = "closest" | "highestHp" | "infantryFirst" | "cluster" | "none";

/** A tile coordinate. Row 0 is the top of the board (Player B's back row). */
export interface Coord {
  readonly row: number;
  readonly col: number;
}

/** Static, immutable definition of a unit type. Lives in config/units.ts. */
export interface UnitSpec {
  readonly id: UnitTypeId;
  readonly name: string;
  readonly hp: number;
  readonly unitClass: UnitClass;
  /** Tactical value — used by mortar cluster scoring and the tiebreak ladder (§B.9). */
  readonly value: number;
  readonly cost: number;
  /** Footprint width in tiles. */
  readonly width: number;
  /** Footprint height in tiles. HQ nodes are 1 wide by 2 deep. */
  readonly height: number;

  // --- combat (absent for structures) ---
  readonly damage?: number;
  readonly damageType?: DamageType;
  readonly minRange?: number;
  readonly maxRange?: number;
  /** Cooldown in ticks. Always an integer — §B.8. */
  readonly cooldownTicks?: number;
  readonly pattern?: AttackPattern;
  readonly priority?: TargetPriority;
  /** MG only: how many distinct targets one attack hits. */
  readonly maxTargets?: number;
  /** Mortar only: shell travel time in ticks. */
  readonly flightTicks?: number;
  /** Mortar only: fraction (out of 100) of centre damage dealt to the 8 neighbours. */
  readonly splashPercent?: number;
  /** Mortar only: fires over cover, and in all directions. */
  readonly ignoresLineOfSight?: boolean;
  /** Sandbags and HQs block line of sight — for both teams (§B.4). */
  readonly blocksLineOfSight?: boolean;
}

/** One unit as placed by a player, before the battle starts. */
export interface PlacedUnit {
  readonly type: UnitTypeId;
  readonly row: number;
  readonly col: number;
  readonly facing: Direction;
}

/** A complete army as submitted by one player. */
export interface Deployment {
  readonly team: Team;
  readonly units: readonly PlacedUnit[];
}

/** A unit inside a running simulation. Mutable — owned by the engine only. */
export interface Unit {
  readonly id: number;
  readonly type: UnitTypeId;
  readonly team: Team;
  readonly row: number;
  readonly col: number;
  readonly facing: Direction;
  readonly spec: UnitSpec;
  hp: number;
  destroyed: boolean;
  /** Tick at which this unit may next fire. */
  nextFireTick: number;
  // --- report accounting ---
  damageDealt: number;
  damageTaken: number;
  kills: number;
  /** Attacks actually made. A combat unit that ends on 0 is pure wasted planning (§D.2). */
  shotsFired: number;
  /** Ticks spent with a ready weapon and no valid target. */
  idleTicks: number;
  destroyedAtTick: number | null;
}

/** A mortar shell in flight. Tile-targeted, not unit-targeted (§B.7). */
export interface Shell {
  readonly sourceId: number;
  readonly team: Team;
  readonly row: number;
  readonly col: number;
  readonly landsAtTick: number;
  readonly damage: number;
  readonly damageType: DamageType;
  readonly splashPercent: number;
}

export type Winner = Team | "draw";

export type VictoryReason =
  | "hqDestroyed"
  | "armyDestroyed"
  | "deadAir"
  | "timeCap"
  | "mutualHqDestruction";
