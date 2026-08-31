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
    width: 1,
    height: 1,
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
    width: 1,
    height: 1,
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

  /**
   * The answer to concentration.
   *
   * Every other weapon deals fixed damage per shot, so a ten-unit column is no
   * harder to shoot at than a two-unit one — stacking had no cost, and stacking
   * the enemy HQ's lane was the measured dominant strategy at ~70% win rate.
   * Buffing splash could not fix it: one mortar's throughput cannot scale to
   * tax a ten-unit stack however hard it hits.
   *
   * The AT gun's per-shot output is LINEAR IN STACK SIZE — 12 to every unit in
   * its lane. Against eight deep that is 96 a shot; against a dispersed line,
   * 12. It also fires only along its facing and holds fire at an empty lane, so
   * placing it is a public bet on where the enemy committed: the first piece in
   * the game whose value depends mainly on the opponent's hidden choice.
   */
  atgun: {
    id: "atgun",
    name: "AT Gun",
    hp: 40,
    unitClass: "infantry",
    value: 14,
    cost: 14,
    width: 1,
    height: 1,
    /*
      22, not 12. A 4-deep zone caps a column at four units and formations
      actually average 2.7, so the original 12 (sized for an 8-deep stack) left
      the gun weaker than a soldier. 22 over a 48-tick cooldown is 0.458
      damage/tick per target against a soldier's 0.5, so it is still the worse
      pick against a lone target and only pays when it catches a cluster —
      which is the whole point of the unit.
    */
    damage: 22,
    // Hits everything in the lane, so the cap is effectively the board.
    maxTargets: 99,
    damageType: "pierce",
    minRange: 1,
    maxRange: 8,
    cooldownTicks: toTicks(2.4), // 48
    pattern: "line",
    priority: "closest",
  },

  tank: {
    id: "tank",
    name: "Tank",
    hp: 120,
    unitClass: "armored",
    value: 20,
    cost: 20,
    width: 1,
    height: 1,
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
    width: 1,
    height: 1,
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
    /*
      90, not 60, and six of them rather than eight.
      Lane openings were running at ~10 a battle against a design target of 2-4.
      A mid-battle event that happens ten times is texture, not a beat — scarcity
      is the resource. Fewer, tougher walls also free two tiles of a zone that
      craters are about to take back.
    */
    hp: 90,
    unitClass: "structure",
    value: 1,
    cost: 3,
    width: 1,
    height: 1,
    blocksLineOfSight: true,
  },

  hq: {
    id: "hq",
    name: "HQ Node",
    hp: 100,
    unitClass: "structure",
    // Value 40 is load-bearing: it makes a defended HQ the largest cluster on
    // the board, so the mortar becomes the turtle-breaker with no special-case
    // rule (§B.9).
    value: 40,
    cost: 0,
    // A node is one column wide and two rows deep: two of them cost the same
    // four tiles the old single 2x2 HQ did.
    width: 1,
    height: 2,
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
  { type: "mg", count: 2 },
  { type: "atgun", count: 1 },
  { type: "tank", count: 1 },
  { type: "mortar", count: 1 },
  { type: "sandbag", count: 6 },
  // Two nodes, and BOTH must fall. Total structure HP is unchanged at 200.
  { type: "hq", count: 2 },
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
