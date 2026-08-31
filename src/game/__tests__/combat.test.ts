/**
 * Combat rules and the time-to-kill table.
 *
 * The TTK cases below are lifted straight from Roadmap §C.4. They exist to
 * check that the balance numbers the design doc claims are the numbers the
 * engine actually produces — the doc's arithmetic has been wrong before (§S2).
 */

import { describe, expect, it } from "vitest";
import { computeDamage, computeSplashDamage } from "../engine/damage.ts";
import type { BattleEvent } from "../engine/events.ts";
import { simulateBattle } from "../engine/simulate.ts";
import { deploy, idleGuard, u } from "./fixtures.ts";

const damageEvents = (events: readonly BattleEvent[]) =>
  events.filter((e): e is Extract<BattleEvent, { type: "DAMAGE" }> => e.type === "DAMAGE");

const deathOf = (events: readonly BattleEvent[], unitId: number) =>
  events.find((e) => e.type === "UNIT_DESTROYED" && e.unitId === unitId);

describe("damage multipliers (§C.1)", () => {
  it("bullet", () => {
    expect(computeDamage(10, "bullet", "infantry")).toBe(10);
    expect(computeDamage(10, "bullet", "armored")).toBe(3); // 2.5 rounds half-up
    expect(computeDamage(10, "bullet", "structure")).toBe(3);
  });

  it("heavy", () => {
    expect(computeDamage(40, "heavy", "infantry")).toBe(20);
    expect(computeDamage(40, "heavy", "armored")).toBe(40);
    expect(computeDamage(40, "heavy", "structure")).toBe(60); // one sandbag exactly
  });

  it("explosive", () => {
    expect(computeDamage(30, "explosive", "infantry")).toBe(30);
    expect(computeDamage(30, "explosive", "armored")).toBe(15);
    expect(computeDamage(30, "explosive", "structure")).toBe(30);
  });

  it("never falls below 1", () => {
    expect(computeDamage(1, "bullet", "armored")).toBe(1);
    expect(computeDamage(0, "bullet", "structure")).toBe(1);
  });

  it("splashes at 50%", () => {
    expect(computeSplashDamage(30, 50, "explosive", "infantry")).toBe(15);
    expect(computeSplashDamage(30, 50, "explosive", "armored")).toBe(8); // 7.5 -> 8
  });
});

describe("time to kill (§C.4)", () => {
  it("soldier vs soldier: mutual kill at tick 50 (2.5s)", () => {
    const result = simulateBattle({
      playerA: deploy("A", [u("soldier", 6, 3, "N")]),
      playerB: deploy("B", [u("soldier", 4, 3, "S")]),
      seed: 1,
    });
    // Two-phase resolution: simultaneous lethal hits BOTH land (§B.8).
    expect(result.endedAtTick).toBe(50);
    expect(result.winner).toBe("draw");
    expect(result.stats.units.every((unit) => !unit.survived)).toBe(true);
  });

  it("tank breaches a sandbag in two shells, opening a lane at tick 84 (4.2s)", () => {
    const result = simulateBattle({
      playerA: deploy("A", [u("tank", 7, 3, "N"), idleGuard("A")]),
      playerB: deploy("B", [u("sandbag", 4, 3), idleGuard("B")]),
      seed: 1,
    });
    const hits = damageEvents(result.events);
    expect(hits[0]?.tick).toBe(28);
    expect(hits[0]?.amount).toBe(60); // 40 heavy x1.5 vs structure

    /*
      Sandbags went 8 x 60 HP to 6 x 90, so a tank no longer removes a wall in
      one shell. That was deliberate: lane openings were running at ~10 a battle
      against a design target of 2-4, and an event that happens ten times is
      texture rather than a beat. Two shells at 2.8s is 4.2s a wall.
    */
    const breach = result.events.find((e) => e.type === "BLOCKER_BREACHED");
    expect(breach).toBeDefined();
    expect(breach?.tick).toBe(84);
    expect(result.stats.laneOpenings).toBe(1);
  });

  it("tank vs tank: three shots, mutual kill at tick 140 (7.0s)", () => {
    const result = simulateBattle({
      playerA: deploy("A", [u("tank", 7, 3, "N")]),
      playerB: deploy("B", [u("tank", 4, 3, "S")]),
      seed: 1,
    });
    expect(result.endedAtTick).toBe(140);
    expect(damageEvents(result.events).every((e) => e.amount === 40)).toBe(true);
  });

  it("soldier vs tank: 3 damage a shot — effectively hopeless", () => {
    const result = simulateBattle({
      playerA: deploy("A", [u("soldier", 6, 3, "N"), idleGuard("A")]),
      playerB: deploy("B", [u("tank", 4, 3, "W"), idleGuard("B")]),
      seed: 1,
    });
    const hits = damageEvents(result.events);
    expect(hits[0]?.amount).toBe(3);

    // 120 HP / 3 = 40 shots, one a second: the tank dies at tick 790 (39.5s).
    //
    // Worth being precise about, because §C.4 rounds this to "40s: soldiers
    // cannot realistically kill tanks". They can — just not inside a battle
    // where anything else is happening. Undisturbed for 39.5 seconds is not a
    // situation that survives contact with a real formation, but it IS inside
    // the 60s cap, so the claim is "too slow to matter", not "impossible".
    const tank = result.stats.units.find((unit) => unit.type === "tank");
    expect(tank?.destroyedAtTick).toBe(790);
  });

  it("MG hits three separate targets for 8 each, in one volley at tick 7", () => {
    const result = simulateBattle({
      playerA: deploy("A", [u("mg", 6, 4, "N"), idleGuard("A")]),
      playerB: deploy("B", [
        u("soldier", 4, 3, "W"),
        u("soldier", 4, 4, "W"),
        u("soldier", 4, 5, "W"),
      ]),
      seed: 1,
    });
    const firstVolley = damageEvents(result.events).filter((e) => e.tick === 7);
    expect(firstVolley).toHaveLength(3);
    expect(firstVolley.every((e) => e.amount === 8)).toBe(true);
    expect(new Set(firstVolley.map((e) => e.targetId)).size).toBe(3);
  });
});

describe("line of sight in combat (§B.4)", () => {
  it("living units never block — a soldier fires past a comrade", () => {
    const result = simulateBattle({
      playerA: deploy("A", [u("soldier", 7, 3, "N"), u("soldier", 6, 3, "N")]),
      playerB: deploy("B", [u("soldier", 4, 3, "W"), idleGuard("B")]),
      seed: 1,
    });
    const attackers = new Set(damageEvents(result.events).map((e) => e.sourceId));
    expect(attackers.size).toBe(2); // both A soldiers landed hits
  });

  it("your own sandbag blocks you — walling yourself in means you cannot shoot out", () => {
    const result = simulateBattle({
      playerA: deploy("A", [u("soldier", 7, 3, "N"), u("sandbag", 6, 3)]),
      playerB: deploy("B", [u("soldier", 4, 3, "W"), idleGuard("B")]),
      seed: 1,
    });
    expect(damageEvents(result.events)).toHaveLength(0);
    const blocked = result.stats.units.find((unit) => unit.type === "soldier" && unit.team === "A");
    expect(blocked?.shotsFired).toBe(0);
    expect(blocked?.idleTicks).toBeGreaterThan(0);
  });

  it("an enemy sandbag is a valid, if inefficient, target", () => {
    const result = simulateBattle({
      playerA: deploy("A", [u("soldier", 7, 3, "N"), idleGuard("A")]),
      playerB: deploy("B", [u("sandbag", 4, 3), u("soldier", 2, 3, "W")]),
      seed: 1,
    });
    const hits = damageEvents(result.events);
    expect(hits.length).toBeGreaterThan(0);
    expect(hits[0]?.amount).toBe(3); // 10 bullet x 0.25 vs structure
  });
});

describe("mortar (§B.9)", () => {
  it("targets the largest cluster by tactical value, not the nearest unit", () => {
    const result = simulateBattle({
      playerA: deploy("A", [u("mortar", 9, 5, "N"), idleGuard("A")]),
      playerB: deploy("B", [
        // Three clustered soldiers, value 15 total...
        u("soldier", 3, 3, "W"),
        u("soldier", 3, 4, "W"),
        u("soldier", 3, 5, "W"),
        // ...and one lone soldier, value 5, that must NOT be chosen.
        u("soldier", 0, 7, "W"),
      ]),
      seed: 1,
    });
    const shell = result.events.find((e) => e.type === "SHELL_FIRED");
    expect(shell).toBeDefined();
    if (shell?.type !== "SHELL_FIRED") throw new Error("no shell");
    expect(shell.tick).toBe(40); // first shot at 50% of an 80-tick cooldown
    expect(shell.landsAtTick).toBe(60); // 1.0s flight
    expect(shell.row).toBe(3);
    expect(shell.col).toBe(4); // centre of the cluster
  });

  it("deals full damage to the centre and 50% to the neighbours", () => {
    const result = simulateBattle({
      playerA: deploy("A", [u("mortar", 9, 5, "N"), idleGuard("A")]),
      playerB: deploy("B", [
        u("soldier", 3, 3, "W"),
        u("soldier", 3, 4, "W"),
        u("soldier", 3, 5, "W"),
      ]),
      seed: 1,
    });
    const landing = damageEvents(result.events).filter((e) => e.tick === 60);
    expect(landing).toHaveLength(3);
    const amounts = landing.map((e) => e.amount).sort((x, y) => x - y);
    expect(amounts).toEqual([15, 15, 30]);
  });

  it("damages a 2x2 HQ once per shell, not once per overlapping tile (§B.11)", () => {
    const result = simulateBattle({
      playerA: deploy("A", [u("mortar", 9, 5, "N"), idleGuard("A")]),
      playerB: deploy("B", [u("hq", 0, 5), idleGuard("B")]),
      seed: 1,
    });
    const hqUnit = result.stats.units.find((unit) => unit.type === "hq");
    expect(hqUnit).toBeDefined();
    const perLanding = new Map<number, number>();
    for (const e of damageEvents(result.events)) {
      if (e.targetId !== hqUnit?.id) continue;
      perLanding.set(e.tick, (perLanding.get(e.tick) ?? 0) + 1);
    }
    expect(perLanding.size).toBeGreaterThan(0);
    for (const count of perLanding.values()) expect(count).toBe(1);
  });

  it("ignores line of sight — it fires over cover", () => {
    const result = simulateBattle({
      playerA: deploy("A", [u("mortar", 9, 5, "N"), idleGuard("A")]),
      playerB: deploy("B", [u("sandbag", 4, 5), u("sandbag", 5, 5), u("soldier", 4, 5, "W")]),
      seed: 1,
    });
    const hits = damageEvents(result.events);
    expect(hits.length).toBeGreaterThan(0);
  });
});

describe("victory conditions (§B.3)", () => {
  it("army destruction wins outright, regardless of HQ HP", () => {
    const result = simulateBattle({
      playerA: deploy("A", [u("soldier", 6, 3, "N"), u("hq", 9, 5)]),
      // B's soldier faces west and can never fight back.
      playerB: deploy("B", [u("soldier", 4, 3, "W"), u("sandbag", 3, 3), u("hq", 0, 5)]),
      seed: 1,
    });
    expect(result.winner).toBe("A");
    expect(result.reason).toBe("armyDestroyed");
    // The losing HQ is untouched — this is the rule that closes the
    // unreachable-HQ hole (§S1.1).
    expect(result.stats.teams.B.hqHpRemaining).toBe(100);
  });

  it("HQ destruction ends the battle", () => {
    const result = simulateBattle({
      playerA: deploy("A", [u("tank", 6, 5, "N"), u("tank", 7, 5, "N"), idleGuard("A")]),
      playerB: deploy("B", [u("hq", 3, 5), idleGuard("B")]),
      seed: 1,
    });
    expect(result.winner).toBe("A");
    expect(result.reason).toBe("hqDestroyed");
    expect(result.events.some((e) => e.type === "HQ_DESTROYED")).toBe(true);
  });

  it("ends on dead air after 5 seconds with no damage", () => {
    const result = simulateBattle({
      playerA: deploy("A", [idleGuard("A")]),
      playerB: deploy("B", [idleGuard("B")]),
      seed: 1,
    });
    expect(result.reason).toBe("deadAir");
    expect(result.endedAtTick).toBe(99);
    expect(result.winner).toBe("draw");
  });

  it("breaks ties on HQ HP first", () => {
    const result = simulateBattle({
      playerA: deploy("A", [u("hq", 9, 5), idleGuard("A")]),
      playerB: deploy("B", [u("hq", 0, 5), u("soldier", 4, 3, "S"), idleGuard("B")]),
      seed: 1,
    });
    // Nobody can reach anybody; A and B both hold full HQs, so it falls through
    // to surviving tactical value, where B has one extra soldier.
    expect(result.reason).toBe("deadAir");
    expect(result.winner).toBe("B");
  });

  it("records a unit that never fired", () => {
    const result = simulateBattle({
      playerA: deploy("A", [idleGuard("A")]),
      playerB: deploy("B", [idleGuard("B")]),
      seed: 1,
    });
    expect(result.stats.idleUnitPercent).toBe(100);
    expect(deathOf(result.events, 0)).toBeUndefined();
  });
});
