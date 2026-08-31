/**
 * The generator feeds the balance sweep. If it can emit an illegal or
 * incomplete army, every number the sweep prints is quietly wrong — so this is
 * checked against the same validator the game uses.
 */

import { describe, expect, it } from "vitest";
import { hqAnchorsForSeed } from "../config/gameConfig.ts";
import { MVP_ARMY } from "../config/units.ts";
import { simulateBattle } from "../engine/simulate.ts";
import { validateDeployment } from "../models/deployment.ts";
import { mulberry32 } from "../rng/mulberry32.ts";
import type { Team } from "../types.ts";
import { ARCHETYPES, generateFormation } from "./formations.ts";

describe("formation generator", () => {
  it.each(ARCHETYPES)("$label produces legal, complete armies for both sides", (archetype) => {
    for (let seed = 0; seed < 60; seed++) {
      const anchors = hqAnchorsForSeed(seed);
      for (const team of ["A", "B"] as Team[]) {
        const formation = generateFormation(team, anchors, archetype, mulberry32(seed));
        const result = validateDeployment(formation, MVP_ARMY);
        expect(result.errors, `${archetype.id} ${team} seed ${seed}`).toEqual([]);
      }
    }
  });

  it("puts both HQ nodes on their drawn anchors", () => {
    for (let seed = 0; seed < 40; seed++) {
      const anchors = hqAnchorsForSeed(seed);
      for (const archetype of ARCHETYPES) {
        const formation = generateFormation("A", anchors, archetype, mulberry32(seed));
        const nodes = formation.units.filter((u) => u.type === "hq");
        expect(nodes).toHaveLength(2);
        for (const a of anchors.A) {
          expect(nodes.some((n) => n.row === a.row && n.col === a.col)).toBe(true);
        }
      }
    }
  });

  it("is reproducible from its seed", () => {
    const anchors = hqAnchorsForSeed(9);
    const archetype = ARCHETYPES[0];
    if (archetype === undefined) throw new Error("no archetypes");
    const a = generateFormation("A", anchors, archetype, mulberry32(9));
    const b = generateFormation("A", anchors, archetype, mulberry32(9));
    expect(a).toEqual(b);
  });

  it("generated matchups actually resolve", () => {
    for (let seed = 0; seed < 40; seed++) {
      const anchors = hqAnchorsForSeed(seed);
      const a = ARCHETYPES[seed % ARCHETYPES.length];
      const b = ARCHETYPES[(seed + 2) % ARCHETYPES.length];
      if (a === undefined || b === undefined) continue;
      const result = simulateBattle({
        playerA: generateFormation("A", anchors, a, mulberry32(seed)),
        playerB: generateFormation("B", anchors, b, mulberry32(seed + 500)),
        seed,
      });
      expect(result.endedAtTick).toBeGreaterThan(0);
      expect(result.durationSeconds).toBeLessThanOrEqual(60);
    }
  });
});
