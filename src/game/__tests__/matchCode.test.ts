/**
 * A match code is the only thing that travels between two players, so the bar
 * is higher than "it round-trips": a code must reproduce the battle EXACTLY,
 * and a code that cannot must refuse rather than approximate.
 *
 * The failure this is really guarding against is silent divergence — two people
 * watching different battles from what they think is the same code, with
 * nothing on screen to tell them.
 */

import { describe, expect, it } from "vitest";
import { hqAnchorsForSeed, terrainForSeed } from "../config/gameConfig.ts";
import { PLACEABLE_ARMY } from "../config/units.ts";
import { archetypeById, generateFormation } from "../content/formations.ts";
import { simulateBattle } from "../engine/simulate.ts";
import {
  CODE_TYPES,
  MATCH_CODE_VERSION,
  decodeMatchCode,
  deploymentFromCode,
  encodeMatchCode,
  placedUnits,
} from "../models/matchCode.ts";
import { mulberry32 } from "../rng/mulberry32.ts";

function armies(seed: number) {
  const anchors = hqAnchorsForSeed(seed);
  const craters = terrainForSeed(seed, anchors);
  return {
    craters,
    playerA: generateFormation("A", anchors, archetypeById("line"), mulberry32(seed), craters),
    playerB: generateFormation(
      "B",
      anchors,
      archetypeById("hqrush"),
      mulberry32(seed + 13),
      craters,
    ),
  };
}

describe("match codes", () => {
  it("covers exactly the placeable roster, so no code can lose a unit type", () => {
    /*
      CODE_TYPES is frozen independently of the roster on purpose. If a unit is
      ever added, this fails — which is the point: the fix is a deliberate
      decision about MATCH_CODE_VERSION, not a quiet append that makes every
      code already in circulation decode to the wrong army.
    */
    const roster = PLACEABLE_ARMY.map((e) => e.type).sort();
    expect([...CODE_TYPES].sort()).toEqual(roster);
    expect(CODE_TYPES.length).toBeLessThanOrEqual(8); // 3 bits on the wire
  });

  it("reproduces the identical battle from a replay code", () => {
    // The whole feature in one assertion.
    for (const seed of [1, 4242, 99_999, 0x7ffffffe]) {
      const { playerA, playerB, craters } = armies(seed);
      const original = simulateBattle({ playerA, playerB, seed, craters });

      const code = encodeMatchCode({
        seed,
        a: placedUnits(playerA),
        b: placedUnits(playerB),
      });
      const decoded = decodeMatchCode(code);
      expect(decoded.ok).toBe(true);
      if (!decoded.ok) return;

      const replay = simulateBattle({
        playerA: deploymentFromCode("A", decoded.match.seed, decoded.match.a),
        playerB: deploymentFromCode("B", decoded.match.seed, decoded.match.b ?? []),
        seed: decoded.match.seed,
        craters: terrainForSeed(decoded.match.seed, hqAnchorsForSeed(decoded.match.seed)),
      });

      expect(replay.winner).toBe(original.winner);
      expect(replay.reason).toBe(original.reason);
      expect(replay.endedAtTick).toBe(original.endedAtTick);
      expect(replay.events.length).toBe(original.events.length);
    }
  });

  it("preserves placement ORDER, because unit ids decide tie-breaks", () => {
    const seed = 777;
    const { playerA } = armies(seed);
    const code = encodeMatchCode({ seed, a: placedUnits(playerA), b: null });
    const decoded = decodeMatchCode(code);
    expect(decoded.ok).toBe(true);
    if (!decoded.ok) return;
    expect(decoded.match.a.map((u) => `${u.type}@${u.row},${u.col}`)).toEqual(
      placedUnits(playerA).map((u) => `${u.type}@${u.row},${u.col}`),
    );
  });

  it("rebuilds the HQ nodes from the seed rather than carrying them", () => {
    const seed = 31337;
    const { playerA } = armies(seed);
    const code = encodeMatchCode({ seed, a: placedUnits(playerA), b: null });
    const decoded = decodeMatchCode(code);
    expect(decoded.ok).toBe(true);
    if (!decoded.ok) return;

    expect(decoded.match.a.some((u) => u.type === "hq")).toBe(false);
    const rebuilt = deploymentFromCode("A", seed, decoded.match.a);
    expect(rebuilt.units).toEqual(playerA.units);
  });

  it("keeps a challenge shorter than a replay, and both short enough to text", () => {
    const seed = 555;
    const { playerA, playerB } = armies(seed);
    const challenge = encodeMatchCode({ seed, a: placedUnits(playerA), b: null });
    const replay = encodeMatchCode({ seed, a: placedUnits(playerA), b: placedUnits(playerB) });
    expect(challenge.length).toBeLessThan(replay.length);
    expect(replay.length).toBeLessThanOrEqual(72);
  });

  it("marks a challenge as having no answer yet", () => {
    const seed = 8;
    const { playerA } = armies(seed);
    const decoded = decodeMatchCode(encodeMatchCode({ seed, a: placedUnits(playerA), b: null }));
    expect(decoded.ok).toBe(true);
    if (!decoded.ok) return;
    expect(decoded.match.b).toBeNull();
  });

  it("accepts a code pasted as a whole share link", () => {
    const seed = 606;
    const { playerA } = armies(seed);
    const code = encodeMatchCode({ seed, a: placedUnits(playerA), b: null });
    for (const wrapper of [
      `https://example.github.io/hiddenwar/#c=${code}`,
      `  https://example.github.io/hiddenwar/?c=${code}  `,
      code,
    ]) {
      expect(decodeMatchCode(wrapper).ok).toBe(true);
    }
  });

  describe("refuses what it cannot verify", () => {
    const seed = 2024;
    const good = (() => {
      const { playerA, playerB } = armies(seed);
      return encodeMatchCode({ seed, a: placedUnits(playerA), b: placedUnits(playerB) });
    })();

    it("catches a truncated code", () => {
      const result = decodeMatchCode(good.slice(0, good.length - 4));
      expect(result.ok).toBe(false);
    });

    it("catches an edited character", () => {
      // Flip one character; the checksum is what stands between the two players
      // and watching different battles.
      let caught = 0;
      for (let i = 0; i < good.length; i++) {
        const original = good[i] ?? "A";
        const swapped = original === "A" ? "B" : "A";
        const tampered = good.slice(0, i) + swapped + good.slice(i + 1);
        if (!decodeMatchCode(tampered).ok) caught++;
      }
      // Not every single-character edit is detectable by one byte of checksum,
      // but the overwhelming majority must be.
      expect(caught / good.length).toBeGreaterThan(0.9);
    });

    it("rejects a code from a FUTURE version, and names both versions", () => {
      /*
        The realistic version-skew case: one player has the page open from
        before a deploy and the other has reloaded. A stale client must say so
        rather than decode a newer layout into a wrong-but-plausible board.

        Built properly — bump the version byte AND fix up the checksum — so this
        exercises the version check rather than tripping the corruption check on
        the way past it.
      */
      const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_";
      const bytes: number[] = [];
      let acc = 0;
      let bits = 0;
      for (const ch of good) {
        acc = (acc << 6) | alphabet.indexOf(ch);
        bits += 6;
        if (bits >= 8) {
          bits -= 8;
          bytes.push((acc >> bits) & 0xff);
        }
      }
      const payload = bytes.slice(0, -1);
      payload[0] = MATCH_CODE_VERSION + 1;
      let hash = 0x811c9dc5;
      for (const b of payload) {
        hash ^= b;
        hash = Math.imul(hash, 0x01000193) >>> 0;
      }
      const rebuilt = [...payload, hash & 0xff];
      let out = "";
      for (let i = 0; i < rebuilt.length; i += 3) {
        const chunk =
          ((rebuilt[i] ?? 0) << 16) | ((rebuilt[i + 1] ?? 0) << 8) | (rebuilt[i + 2] ?? 0);
        const left = rebuilt.length - i;
        out += alphabet[(chunk >> 18) & 63];
        out += alphabet[(chunk >> 12) & 63];
        if (left > 1) out += alphabet[(chunk >> 6) & 63];
        if (left > 2) out += alphabet[chunk & 63];
      }

      const result = decodeMatchCode(out);
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.reason).toContain(String(MATCH_CODE_VERSION + 1));
        expect(result.reason).toContain("reload");
      }
    });

    it("rejects junk without throwing", () => {
      for (const junk of ["", "   ", "!!!!", "hello world", "%%%%%%%%", "AAAA"]) {
        const result = decodeMatchCode(junk);
        expect(result.ok).toBe(false);
        if (!result.ok) expect(result.reason.length).toBeGreaterThan(0);
      }
    });
  });
});
