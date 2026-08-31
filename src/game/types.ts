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

/**
 * Quarter turns clockwise applied to a unit's footprint.
 *
 * Distinct from `facing`, and deliberately so: facing decides where a weapon
 * shoots and is fixed by which side you are on, while orientation decides what
 * shape the piece occupies on the ground. A 1x1 unit has one orientation and
 * ignores this entirely.
 */
export type Orientation = 0 | 1 | 2 | 3;

/** Static, immutable definition of a unit type. Lives in config/units.ts. */
export interface UnitSpec {
  readonly id: UnitTypeId;
  readonly name: string;
  readonly hp: number;
  readonly unitClass: UnitClass;
  /** Tactical value — used by mortar cluster scoring and the tiebreak ladder (§B.9). */
  readonly value: number;
  readonly cost: number;
  /** Footprint width in tiles. Ignored when `cells` is given. */
  readonly width: number;
  /** Footprint height in tiles. HQ nodes are 1 wide by 2 deep. */
  readonly height: number;
  /**
   * An arbitrary footprint, as offsets from the anchor — an L, a T, a plus.
   * Omitted for the ordinary case, where width x height says it all.
   *
   * THE FIRST CELL IS THE WEAPON. Everything after it is hull: it occupies
   * ground, absorbs fire and blocks line of sight if the unit blocks at all,
   * but nothing is fired from it. That is what makes a shape mean something
   * rather than just cost more — an L can tuck its gun into a corner while its
   * hull screens the flank beside it, and rotating it chooses which.
   */
  readonly cells?: readonly Coord[];

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
  /**
   * Extra multiplier applied ONLY against structures, on top of the damage-type
   * table. Defaults to 1.
   *
   * This exists for indirect fire. A weapon that ignores line of sight can hit
   * an objective from anywhere, so with it in the army no formation ever has to
   * break through to score — and a game where breakthroughs are optional is
   * decided by attrition, which rewards spreading out and nothing else.
   */
  readonly structureMultiplier?: number;
  /** Sandbags and HQs block line of sight — for both teams (§B.4). */
  readonly blocksLineOfSight?: boolean;
}

/** One unit as placed by a player, before the battle starts. */
export interface PlacedUnit {
  readonly type: UnitTypeId;
  readonly row: number;
  readonly col: number;
  readonly facing: Direction;
  /** Quarter turns applied to the footprint. Absent means none. */
  readonly orientation?: Orientation;
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
  /** Quarter turns applied to the footprint. */
  readonly orientation: Orientation;
  /**
   * Every tile this unit stands on, resolved once at build time.
   *
   * Precomputed because it is read on the hot path — occupancy, range to each
   * cell of a target, clearing the grid on death — and recomputing a rotation
   * every tick would be both slower and a place for the shape to drift.
   */
  readonly tiles: readonly Coord[];
  /**
   * The tile this unit FIRES from: its first cell, not its anchor.
   *
   * For anything 1x1 these are the same tile, which is why the existing roster
   * is unaffected. For an L-shape the anchor is a corner of the bounding box
   * the unit may not even occupy, so measuring range or line of sight from it
   * would be wrong in a way that is very hard to see on screen.
   */
  readonly origin: Coord;
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
  /** Carried with the shell, because the tube that fired it may already be dead. */
  readonly structureMultiplier: number;
}

export type Winner = Team | "draw";

export type VictoryReason =
  | "hqDestroyed"
  | "armyDestroyed"
  | "deadAir"
  | "timeCap"
  | "mutualHqDestruction";
