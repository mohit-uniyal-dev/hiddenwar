/**
 * Seeded PRNG. Roadmap §B.8 / §H.3.
 *
 * Math.random() is banned inside src/game/. The engine draws from exactly one
 * stream, advanced only inside the simulation loop, and ONLY for tie-breaks
 * between equally-scored targets — there is no damage variance in the MVP
 * (§B.8.1).
 *
 * mulberry32 is integer-op only (imul, xor, shifts) plus one final division,
 * so it produces identical output on every JS engine.
 */

export interface Rng {
  /** Uniform float in [0, 1). */
  next(): number;
  /** Uniform integer in [0, bound). */
  nextInt(bound: number): number;
  /** Number of draws taken — useful for asserting RNG discipline in tests. */
  readonly draws: number;
}

export function mulberry32(seed: number): Rng {
  let a = seed >>> 0;
  let draws = 0;

  const next = (): number => {
    draws++;
    a = (a + 0x6d2b79f5) >>> 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };

  return {
    next,
    nextInt: (bound: number) => Math.floor(next() * bound),
    get draws() {
      return draws;
    },
  };
}
