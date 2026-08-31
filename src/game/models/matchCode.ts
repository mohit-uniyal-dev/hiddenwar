/**
 * Match codes — a whole duel packed into a string you can send over WhatsApp.
 *
 * This is what makes the game playable against someone who is not holding your
 * phone, with no server and no account: the simulation is deterministic, so a
 * seed plus two deployments IS the match. Nothing else has to travel.
 *
 *   CHALLENGE   seed + your army      38 characters
 *   REPLAY      seed + both armies    66 characters
 *
 * A replay carries both sides rather than just the reply, so it is complete on
 * its own. That costs twenty bytes and buys the thing that actually matters
 * over a messaging app: a code still works when the other player has cleared
 * their browser, switched phones, or is opening it a week later.
 *
 * Two rules hold this together:
 *
 *   ORDER IS PRESERVED. Units are simulated in the order they were placed, and
 *   tie-breaks resolve by unit id, so re-sorting an army would produce a
 *   different battle from the same pieces. Encoding walks the array as-is.
 *
 *   A BAD CODE MUST FAIL LOUDLY. A truncated or edited code that decoded into
 *   a plausible-but-wrong board would be far worse than one that refuses: two
 *   players would watch different battles and have no way to tell. Hence a
 *   version byte, a checksum, and full validation of the decoded army.
 *
 * HQ nodes are deliberately not encoded. They are drawn from the seed, so
 * sending them would be sending a fact the other end can already derive — and
 * a code whose nodes disagreed with its seed would be unresolvable.
 */

import { BOARD, hqAnchorsForSeed, zoneOwner } from "../config/gameConfig.ts";
import type { Deployment, PlacedUnit, Team, UnitTypeId } from "../types.ts";
import { canPlace } from "./deployment.ts";

export const MATCH_CODE_VERSION = 1;

/**
 * The wire ordering of unit types, frozen independently of the roster.
 *
 * It deliberately does NOT read from PLACEABLE_ARMY: reordering that array is
 * a harmless refactor, but it would silently change what every code in the wild
 * decodes to. A test asserts this list still covers the roster exactly, so
 * adding a unit fails the build and forces a deliberate decision about the
 * version byte rather than quietly breaking old codes.
 */
export const CODE_TYPES: readonly UnitTypeId[] = [
  "soldier",
  "mg",
  "atgun",
  "tank",
  "mortar",
  "sandbag",
];

const TYPE_BITS = 3;
const ROW_BITS = 4;
const COL_BITS = 3;
const COUNT_BITS = 5;
const MAX_UNITS = (1 << COUNT_BITS) - 1;

// ---------------------------------------------------------------- bit packing

class BitWriter {
  private readonly bytes: number[] = [];
  private current = 0;
  private used = 0;

  write(value: number, bits: number): void {
    for (let i = bits - 1; i >= 0; i--) {
      this.current = (this.current << 1) | ((value >> i) & 1);
      this.used++;
      if (this.used === 8) {
        this.bytes.push(this.current);
        this.current = 0;
        this.used = 0;
      }
    }
  }

  finish(): number[] {
    if (this.used > 0) this.bytes.push(this.current << (8 - this.used));
    return this.bytes;
  }
}

class BitReader {
  private bit = 0;
  private readonly bytes: readonly number[];

  // Written out longhand rather than as a parameter property: Node's
  // strip-only TypeScript mode rejects those, and the balance harness runs the
  // engine straight through Node with no build step.
  constructor(bytes: readonly number[]) {
    this.bytes = bytes;
  }

  read(bits: number): number {
    let value = 0;
    for (let i = 0; i < bits; i++) {
      const byte = this.bytes[this.bit >> 3] ?? 0;
      value = (value << 1) | ((byte >> (7 - (this.bit & 7))) & 1);
      this.bit++;
    }
    return value;
  }

  get exhausted(): boolean {
    return this.bit > this.bytes.length * 8;
  }
}

// ---------------------------------------------------------------- base64url

const ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_";

/**
 * Hand-rolled rather than `btoa`, so the engine keeps its promise of depending
 * on nothing but the language — and so the URL-safe alphabet is used directly
 * instead of patched in afterwards.
 */
function toBase64Url(bytes: readonly number[]): string {
  let out = "";
  for (let i = 0; i < bytes.length; i += 3) {
    const a = bytes[i] ?? 0;
    const b = bytes[i + 1] ?? 0;
    const c = bytes[i + 2] ?? 0;
    const chunk = (a << 16) | (b << 8) | c;
    const left = bytes.length - i;
    out += ALPHABET[(chunk >> 18) & 63] ?? "";
    out += ALPHABET[(chunk >> 12) & 63] ?? "";
    if (left > 1) out += ALPHABET[(chunk >> 6) & 63] ?? "";
    if (left > 2) out += ALPHABET[chunk & 63] ?? "";
  }
  return out;
}

function fromBase64Url(text: string): number[] | null {
  const bytes: number[] = [];
  let acc = 0;
  let bits = 0;
  for (const char of text) {
    const value = ALPHABET.indexOf(char);
    if (value < 0) return null;
    acc = (acc << 6) | value;
    bits += 6;
    if (bits >= 8) {
      bits -= 8;
      bytes.push((acc >> bits) & 0xff);
    }
  }
  return bytes;
}

/** FNV-1a, truncated to a byte. Catches typos and truncation, not tampering. */
function checksum(bytes: readonly number[]): number {
  let hash = 0x811c9dc5;
  for (const byte of bytes) {
    hash ^= byte;
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }
  return hash & 0xff;
}

// ---------------------------------------------------------------- encoding

export interface MatchCodeData {
  readonly seed: number;
  /** Blue's placed units, HQ nodes excluded, in placement order. */
  readonly a: readonly PlacedUnit[];
  /** Orange's, or null for a challenge that is still waiting for an answer. */
  readonly b: readonly PlacedUnit[] | null;
}

/** Everything except the HQ nodes, which are derived from the seed. */
export function placedUnits(deployment: Deployment): PlacedUnit[] {
  return deployment.units.filter((u) => u.type !== "hq");
}

export function encodeMatchCode(data: MatchCodeData): string {
  const sides = data.b === null ? [data.a] : [data.a, data.b];
  for (const side of sides) {
    if (side.length > MAX_UNITS) throw new Error(`army too large to encode: ${side.length}`);
    /*
      Version 1 has no room for footprint rotation, and dropping it silently
      would be the worst possible failure: the code would decode into a legal
      army standing in subtly wrong shapes, and the two players would watch
      different battles with nothing to tell them apart. If shapes ship, this
      throw is the reminder that MATCH_CODE_VERSION has to move with them.
    */
    for (const unit of side) {
      if ((unit.orientation ?? 0) !== 0) {
        throw new Error("match code v1 cannot carry a rotated footprint");
      }
    }
  }

  const header = [
    MATCH_CODE_VERSION,
    data.b === null ? 0b01 : 0b11,
    (data.seed >>> 24) & 0xff,
    (data.seed >>> 16) & 0xff,
    (data.seed >>> 8) & 0xff,
    data.seed & 0xff,
  ];

  const writer = new BitWriter();
  for (const side of sides) {
    writer.write(side.length, COUNT_BITS);
    for (const unit of side) {
      const type = CODE_TYPES.indexOf(unit.type);
      if (type < 0) throw new Error(`unit type cannot be encoded: ${unit.type}`);
      writer.write(type, TYPE_BITS);
      writer.write(unit.row, ROW_BITS);
      writer.write(unit.col, COL_BITS);
    }
  }

  const body = writer.finish();
  const payload = [...header, ...body];
  return toBase64Url([...payload, checksum(payload)]);
}

export type DecodeResult =
  | { readonly ok: true; readonly match: MatchCodeData }
  | { readonly ok: false; readonly reason: string };

/**
 * Turn a code back into a match, refusing anything it cannot fully verify.
 *
 * The army is re-validated against the board rather than trusted: a code is
 * untrusted input that arrived over a chat app, and a deployment that overlaps
 * itself or stands in the wrong half would desynchronise the two players
 * silently rather than crash.
 */
export function decodeMatchCode(input: string): DecodeResult {
  const text = input.trim().replace(/^.*[#/?]c=/, "");
  if (text.length === 0) return { ok: false, reason: "That code is empty." };

  const bytes = fromBase64Url(text);
  if (bytes === null) return { ok: false, reason: "That does not look like a match code." };
  if (bytes.length < 8) return { ok: false, reason: "That code is incomplete." };

  const payload = bytes.slice(0, -1);
  if (checksum(payload) !== bytes[bytes.length - 1]) {
    return { ok: false, reason: "That code is damaged — some of it went missing in transit." };
  }

  const version = payload[0] ?? 0;
  if (version !== MATCH_CODE_VERSION) {
    return {
      ok: false,
      reason: `That code is from version ${version} of the game and this is version ${MATCH_CODE_VERSION}. One of you needs to reload.`,
    };
  }

  const flags = payload[1] ?? 0;
  const seed =
    (((payload[2] ?? 0) << 24) |
      ((payload[3] ?? 0) << 16) |
      ((payload[4] ?? 0) << 8) |
      (payload[5] ?? 0)) >>>
    0;

  const reader = new BitReader(payload.slice(6));
  const anchors = hqAnchorsForSeed(seed);
  const sides: PlacedUnit[][] = [];

  for (const team of ["A", "B"] as const) {
    if (team === "B" && (flags & 0b10) === 0) break;
    const count = reader.read(COUNT_BITS);
    // Nodes go down first, exactly as a live deployment builds itself, so the
    // reconstructed army has identical ordering — and therefore identical ids.
    const units: PlacedUnit[] = anchors[team].map((a) => ({
      type: "hq" as const,
      row: a.row,
      col: a.col,
      facing: "N" as const,
    }));
    const placed: PlacedUnit[] = [];

    for (let i = 0; i < count; i++) {
      const type = CODE_TYPES[reader.read(TYPE_BITS)];
      const row = reader.read(ROW_BITS);
      const col = reader.read(COL_BITS);
      if (type === undefined) return { ok: false, reason: "That code contains an unknown unit." };
      if (row >= BOARD.rows || col >= BOARD.cols || zoneOwner(row) !== team) {
        return { ok: false, reason: "That code puts a unit outside its own territory." };
      }
      if (!canPlace(team, type, row, col, units)) {
        return { ok: false, reason: "That code has units standing on top of each other." };
      }
      const unit: PlacedUnit = { type, row, col, facing: team === "A" ? "N" : "S" };
      units.push(unit);
      placed.push(unit);
    }
    if (reader.exhausted) return { ok: false, reason: "That code is incomplete." };
    sides.push(placed);
  }

  const a = sides[0];
  if (a === undefined) return { ok: false, reason: "That code has no army in it." };
  return { ok: true, match: { seed, a, b: sides[1] ?? null } };
}

/**
 * Rebuild a full deployment, nodes included, from decoded units.
 *
 * Craters are not applied here on purpose: they are drawn from the same seed,
 * so a code that placed a unit on terrain is caught by the caller re-validating
 * against the board it actually builds.
 */
export function deploymentFromCode(
  team: Team,
  seed: number,
  units: readonly PlacedUnit[],
): Deployment {
  const anchors = hqAnchorsForSeed(seed);
  return {
    team,
    units: [
      ...anchors[team].map((a) => ({
        type: "hq" as const,
        row: a.row,
        col: a.col,
        facing: "N" as const,
      })),
      ...units,
    ],
  };
}
