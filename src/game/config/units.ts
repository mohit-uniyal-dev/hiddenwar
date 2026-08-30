/**
 * The MVP army. Roadmap Part I §C.2.
 *
 * Every number here is playtest-tunable. The tuning levers, in preferred order,
 * are documented in §C.5 — and the tank cooldown is deliberately NOT one of them:
 * the sandbag breach cadence is the drama engine (§D.2).
 */

import type { UnitSpec, UnitTypeId } from "../types.ts";
import { toTicks } from "./gameConfig.ts";

export const UNITS: Record<UnitTypeId, UnitSpec> = {
  soldier: {
    id: "soldier",
    name: "Soldier",
    hp: 30,
    unitClass: "infantry",
    value: 5,
    cost: 5,
    size: 1,
    damage: 10,
    damageType: "bullet",
    minRange: 1,
    // Range 4, not 3: with a 2-row no man's land, range 3 threatens only the
    // enemy front row and too many soldiers never fired (§C.3).
    maxRange: 4,
    cooldownTicks: toTicks(1.0), // 20
    pattern: "line",
    priority: "closest",
  },

  mg: {
    id: "mg",
    name: "Machine Gun",
    hp: 50,
    unitClass: "infantry",
    value: 12,
    cost: 12,
    size: 1,
    // 8 damage to EACH of up to 3 distinct targets in the cone (§B.13).
    // This is what makes it a formation-punisher rather than a fast soldier.
    damage: 8,
    maxTargets: 3,
    damageType: "bullet",
    minRange: 1,
    maxRange: 4,
    cooldownTicks: toTicks(0.7), // 14
    pattern: "cone",
    priority: "infantryFirst",
  },

  tank: {
    id: "tank",
    name: "Tank",
    hp: 120,
    unitClass: "armored",
    value: 20,
    cost: 20,
    size: 1,
    // 40 heavy x 1.5 vs structure = 60 = exactly one sandbag. The breach
    // cadence depends on this equality holding (§D.2).
    damage: 40,
    damageType: "heavy",
    minRange: 1,
    maxRange: 6,
    cooldownTicks: toTicks(2.8), // 56
    pattern: "line",
    priority: "highestHp",
  },

  mortar: {
    id: "mortar",
    name: "Mortar",
    hp: 35,
    unitClass: "infantry",
    value: 15,
    cost: 15,
    size: 1,
    damage: 30,
    splashPercent: 50,
    damageType: "explosive",
    minRange: 3,
    // Range 10, not 7: at 7, rows 0-1 were a mathematically unreachable
    // sanctuary for the HQ. Nothing moves, so an unreachable tile is a
    // broken tile (§B.12).
    maxRange: 10,
    cooldownTicks: toTicks(4.0), // 80
    pattern: "indirect",
    priority: "cluster",
    flightTicks: toTicks(1.0), // 20
    ignoresLineOfSight: true,
  },

  sandbag: {
    id: "sandbag",
    name: "Sandbag",
    hp: 60,
    unitClass: "structure",
    value: 1,
    cost: 3,
    size: 1,
    blocksLineOfSight: true,
  },

  hq: {
    id: "hq",
    name: "HQ",
    hp: 200,
    unitClass: "structure",
    // Value 40 is load-bearing: it makes a defended HQ the largest cluster on
    // the board, so the mortar becomes the turtle-breaker with no special-case
    // rule (§B.9).
    value: 40,
    cost: 0,
    size: 2,
    blocksLineOfSight: true,
  },
};

/** A set of units a player is given to place. Classic mode uses MVP_ARMY;
 *  puzzles hand out much smaller, deliberately shaped kits. */
export type Roster = ReadonlyArray<{ readonly type: UnitTypeId; readonly count: number }>;

/** The fixed army both players receive in Classic mode (§C.2). */
/**
 * One tank, not two.
 *
 * The second tank was what made an HQ rush unbeatable. §C.4 costs the objective
 * at "9.8s solo, ~5.6s with both tanks" — two tanks aligned on the enemy HQ
 * column finish it before the rest of the board becomes relevant, and measured
 * head to head, nothing countered that. Cutting to one tank gives the defence
 * time to answer, which turns a dedicated lane guard from a coin flip into a
 * decisive counter (94% to 4%).
 *
 * The freed slot goes to a third machine gun — the only weapon whose cone
 * covers neighbouring columns, so lanes support each other rather than each
 * fighting alone.
 */
export const MVP_ARMY: Roster = [
  { type: "soldier", count: 5 },
  { type: "mg", count: 3 },
  { type: "tank", count: 1 },
  { type: "mortar", count: 1 },
  { type: "sandbag", count: 8 },
  { type: "hq", count: 1 },
];

/**
 * What a player actually places. The HQ is excluded because it is positioned
 * automatically at a published location — see HQ_ANCHOR in gameConfig.
 */
export const PLACEABLE_ARMY: Roster = MVP_ARMY.filter((entry) => entry.type !== "hq");

/** A unit can fight if it has non-zero damage (§B.3). Sandbags and HQs cannot. */
export function isCombatCapable(type: UnitTypeId): boolean {
  const damage = UNITS[type].damage;
  return damage !== undefined && damage > 0;
}
