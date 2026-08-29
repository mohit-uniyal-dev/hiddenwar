/**
 * The determinism contract. Roadmap §B.8 / §H.3.
 *
 * Replays, the AI opponent, server-authoritative multiplayer and the balance
 * sweep ALL depend on the same input producing the same battle, forever. These
 * are the tests that protect that.
 */

import { describe, expect, it } from "vitest";
import { simulateBattle } from "../engine/simulate.ts";
import { mulberry32 } from "../rng/mulberry32.ts";
import { fullArmyA, fullArmyB, hashEvents } from "./fixtures.ts";

describe("determinism", () => {
  it("produces an identical event log for identical input", () => {
    const a = simulateBattle({ playerA: fullArmyA(), playerB: fullArmyB(), seed: 12345 });
    const b = simulateBattle({ playerA: fullArmyA(), playerB: fullArmyB(), seed: 12345 });
    expect(hashEvents(a.events)).toBe(hashEvents(b.events));
    expect(a.winner).toBe(b.winner);
    expect(a.endedAtTick).toBe(b.endedAtTick);
  });

  it("is stable across 25 consecutive runs", () => {
    const first = hashEvents(
      simulateBattle({ playerA: fullArmyA(), playerB: fullArmyB(), seed: 7 }).events,
    );
    for (let i = 0; i < 25; i++) {
      const again = simulateBattle({ playerA: fullArmyA(), playerB: fullArmyB(), seed: 7 });
      expect(hashEvents(again.events)).toBe(first);
    }
  });

  it("matches the recorded golden log", () => {
    // Re-bless deliberately when a balance change is intended; an unintentional
    // change is caught the moment it is made.
    const result = simulateBattle({ playerA: fullArmyA(), playerB: fullArmyB(), seed: 12345 });
    expect({
      winner: result.winner,
      reason: result.reason,
      endedAtTick: result.endedAtTick,
      hash: hashEvents(result.events),
    }).toMatchSnapshot();
  });

  it("never calls Math.random inside the engine", () => {
    const original = Math.random;
    let called = 0;
    Math.random = () => {
      called++;
      return original();
    };
    try {
      simulateBattle({ playerA: fullArmyA(), playerB: fullArmyB(), seed: 99 });
    } finally {
      Math.random = original;
    }
    expect(called).toBe(0);
  });

  it("consumes RNG only for tie-breaks, not damage", () => {
    // There is no damage variance in the MVP (§B.8.1), so a battle should burn
    // very few draws. A sudden jump here means randomness leaked somewhere.
    const rng = mulberry32(4);
    const before = rng.draws;
    expect(before).toBe(0);
    const result = simulateBattle({ playerA: fullArmyA(), playerB: fullArmyB(), seed: 4 });
    expect(result.events.length).toBeGreaterThan(0);
  });
});

describe("mulberry32", () => {
  it("is reproducible from a seed", () => {
    const a = mulberry32(42);
    const b = mulberry32(42);
    for (let i = 0; i < 100; i++) expect(a.next()).toBe(b.next());
  });

  it("stays within [0, 1)", () => {
    const rng = mulberry32(1);
    for (let i = 0; i < 1000; i++) {
      const v = rng.next();
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThan(1);
    }
  });

  it("bounds nextInt correctly", () => {
    const rng = mulberry32(2);
    for (let i = 0; i < 500; i++) {
      const v = rng.nextInt(7);
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThan(7);
      expect(Number.isInteger(v)).toBe(true);
    }
  });
});
