/**
 * Damage resolution. Roadmap Part I §B.0 and §C.1.
 *
 * Type multipliers are the ONLY mitigation system. The flat armor stat from the
 * original notes is deleted (§B.10) — `max(1, dmg - armor)` makes massed chip
 * fire disproportionately good against heavy armor, because twenty attackers
 * each doing a guaranteed 1 damage defeat the armor entirely.
 */

import { DAMAGE_MULTIPLIERS } from "../config/gameConfig.ts";
import type { DamageType, UnitClass } from "../types.ts";

/**
 * Damage is computed in floats, rounded half-up, with a minimum of 1 (§B.0).
 *
 * Only `*` is used, which is exactly specified by IEEE-754 and therefore
 * portable. No pow/sqrt (§H.3).
 */
export function computeDamage(
  base: number,
  damageType: DamageType,
  targetClass: UnitClass,
): number {
  const multiplier = DAMAGE_MULTIPLIERS[damageType][targetClass];
  const rounded = Math.floor(base * multiplier + 0.5);
  return rounded < 1 ? 1 : rounded;
}

/** Splash damage to the 8 tiles around a shell's centre (§B.9). */
export function computeSplashDamage(
  base: number,
  splashPercent: number,
  damageType: DamageType,
  targetClass: UnitClass,
): number {
  const reduced = Math.floor((base * splashPercent) / 100 + 0.5);
  return computeDamage(reduced, damageType, targetClass);
}
