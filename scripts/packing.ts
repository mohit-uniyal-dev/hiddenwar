/**
 * Is a 4x8 deployment zone big enough to hold an interesting packing puzzle?
 *
 *   node scripts/packing.ts [--boards 200] [--cap 2000000]
 *
 * The question behind the question: multi-tile pieces are only worth their cost
 * in art, rotation UI and drag ergonomics if the packing constraint actually
 * BINDS. Three ways that can go wrong, and only the middle one is a game:
 *
 *   FORCED      so few legal arrangements that the board plays itself.
 *   INTERESTING enough room to express a plan, not enough to have everything.
 *   INERT       so many arrangements that the shapes never stop you doing
 *               anything, and all the complexity bought nothing.
 *
 * Counting is exact, not sampled. Placement always fills the lowest empty cell
 * — either with a piece whose first cell lands there, or by spending one of a
 * bounded number of deliberate gaps — so every distinct arrangement is reached
 * exactly once and none is reached twice. Pieces of one type are counted, never
 * labelled, so five interchangeable soldiers do not inflate the total by 120.
 *
 * 1x1 pieces are handled arithmetically rather than searched: once the shaped
 * pieces are down, any subset of the remaining cells will hold them, so their
 * contribution is a binomial coefficient. Searching them would take exponential
 * time to rediscover that they never constrain anything — which is itself one
 * of the findings below.
 */

import { BOARD, hqAnchorsForSeed, terrainForSeed } from "../src/game/config/gameConfig.ts";
import { numberFlag } from "./experiment.ts";

const args = process.argv.slice(2);
const BOARDS = numberFlag(args, "boards", 200);
const CAP = numberFlag(args, "cap", 2_000_000);

const ROWS = 4;
const COLS = BOARD.cols;
const CELLS = ROWS * COLS;

type Cell = readonly [number, number];

/** All four rotations of a shape, normalised and de-duplicated. */
function orientations(cells: readonly Cell[]): Cell[][] {
  const seen = new Map<string, Cell[]>();
  let current = cells.map((c) => [c[0], c[1]] as Cell);
  for (let turn = 0; turn < 4; turn++) {
    const minR = Math.min(...current.map((c) => c[0]));
    const minC = Math.min(...current.map((c) => c[1]));
    const normalised = current
      .map((c) => [c[0] - minR, c[1] - minC] as Cell)
      .sort((a, b) => a[0] - b[0] || a[1] - b[1]);
    seen.set(JSON.stringify(normalised), normalised);
    current = current.map((c) => [c[1], -c[0]] as Cell);
  }
  return [...seen.values()];
}

interface Piece {
  readonly name: string;
  readonly count: number;
  readonly cells: readonly Cell[];
}

const O: Cell[] = [
  [0, 0],
  [0, 1],
  [1, 0],
  [1, 1],
];
const I3: Cell[] = [
  [0, 0],
  [0, 1],
  [0, 2],
];
const L3: Cell[] = [
  [0, 0],
  [1, 0],
  [1, 1],
];
const T4: Cell[] = [
  [0, 0],
  [0, 1],
  [0, 2],
  [1, 1],
];
const DOM: Cell[] = [
  [0, 0],
  [0, 1],
];
const S4: Cell[] = [
  [0, 1],
  [0, 2],
  [1, 0],
  [1, 1],
];
const ONE: Cell[] = [[0, 0]];

interface ShapeSet {
  readonly label: string;
  readonly pieces: readonly Piece[];
}

const SETS: readonly ShapeSet[] = [
  {
    label: "today (everything 1x1)",
    pieces: [
      { name: "soldier", count: 5, cells: ONE },
      { name: "mg", count: 2, cells: ONE },
      { name: "atgun", count: 1, cells: ONE },
      { name: "tank", count: 1, cells: ONE },
      { name: "mortar", count: 1, cells: ONE },
      { name: "sandbag", count: 6, cells: ONE },
    ],
  },
  {
    label: "shapes, 15 tiles",
    pieces: [
      { name: "tank", count: 1, cells: O },
      { name: "mortar", count: 1, cells: L3 },
      { name: "atgun", count: 1, cells: I3 },
      { name: "mg", count: 1, cells: L3 },
      { name: "squad", count: 1, cells: DOM },
      { name: "rifle", count: 3, cells: ONE },
    ],
  },
  {
    label: "shapes, 18 tiles",
    pieces: [
      { name: "tank", count: 1, cells: O },
      { name: "mortar", count: 1, cells: T4 },
      { name: "atgun", count: 1, cells: I3 },
      { name: "mg", count: 2, cells: L3 },
      { name: "squad", count: 2, cells: DOM },
    ],
  },
  {
    label: "shapes, 21 tiles",
    pieces: [
      { name: "tank", count: 1, cells: O },
      { name: "mortar", count: 1, cells: T4 },
      { name: "atgun", count: 1, cells: I3 },
      { name: "mg", count: 2, cells: L3 },
      { name: "squad", count: 2, cells: DOM },
      { name: "bunker", count: 1, cells: I3 },
    ],
  },
  {
    label: "mixed: heavies get shapes",
    pieces: [
      { name: "soldier", count: 5, cells: ONE },
      { name: "mg", count: 2, cells: DOM },
      { name: "atgun", count: 1, cells: I3 },
      { name: "tank", count: 1, cells: O },
      { name: "mortar", count: 1, cells: L3 },
      { name: "sandbag", count: 6, cells: ONE },
    ],
  },
  {
    label: "1x1 only, 21 tiles",
    pieces: [{ name: "rifle", count: 21, cells: ONE }],
  },
  {
    label: "1x1 only, 25 tiles",
    pieces: [{ name: "rifle", count: 25, cells: ONE }],
  },
  {
    label: "shapes, 25 tiles",
    pieces: [
      { name: "tank", count: 1, cells: O },
      { name: "mortar", count: 1, cells: T4 },
      { name: "atgun", count: 1, cells: I3 },
      { name: "mg", count: 2, cells: L3 },
      { name: "squad", count: 2, cells: DOM },
      { name: "bunker", count: 1, cells: S4 },
    ],
  },
];

/**
 * The oversupplied roster: deliberately more army than the zone can hold, so
 * the player has to leave something behind. That is the decision the whole
 * idea is for, and it cannot be measured by counting arrangements of a fixed
 * army — it needs counting which ARMIES are fieldable at all.
 */
const OVERSUPPLY: ShapeSet = {
  label: "oversupplied roster",
  pieces: [
    { name: "tank", count: 1, cells: O },
    { name: "mortar", count: 1, cells: T4 },
    { name: "atgun", count: 2, cells: I3 },
    { name: "mg", count: 2, cells: L3 },
    { name: "squad", count: 3, cells: DOM },
    { name: "bunker", count: 2, cells: S4 },
  ],
};

/** Blocked cells in Blue's zone for one board draw: node footprints and craters. */
function blockedFor(seed: number): boolean[] {
  const blocked = new Array<boolean>(CELLS).fill(false);
  const anchors = hqAnchorsForSeed(seed);
  const zoneTop = BOARD.teamARows[0];
  for (const node of anchors.A) {
    for (let r = node.row; r < node.row + 2; r++) {
      blocked[(r - zoneTop) * COLS + node.col] = true;
    }
  }
  for (const crater of terrainForSeed(seed, anchors)) {
    if (crater.row < zoneTop || crater.row > BOARD.teamARows[1]) continue;
    blocked[(crater.row - zoneTop) * COLS + crater.col] = true;
  }
  return blocked;
}

/** n choose k, exact for the sizes here. */
function choose(n: number, k: number): number {
  if (k < 0 || k > n) return 0;
  let out = 1;
  for (let i = 0; i < k; i++) out = (out * (n - i)) / (i + 1);
  return Math.round(out);
}

interface Shaped {
  readonly name: string;
  count: number;
  readonly forms: readonly Cell[][];
  readonly size: number;
}

/**
 * Count every distinct complete deployment, up to `cap`.
 *
 * `requireFrontRank` answers the question the archetype table cannot: with these
 * shapes, is the currently dominant formation — a unit in every column of the
 * rank nearest the enemy — still buildable at all?
 */
function countPackings(
  set: ShapeSet,
  blocked: readonly boolean[],
  cap: number,
  requireFrontRank: boolean,
): number {
  const shaped: Shaped[] = set.pieces
    .filter((p) => p.cells.length > 1)
    .map((p) => ({
      name: p.name,
      count: p.count,
      forms: orientations(p.cells),
      size: p.cells.length,
    }));
  const singles = set.pieces
    .filter((p) => p.cells.length === 1)
    .reduce((sum, p) => sum + p.count, 0);

  const free = blocked.filter((b) => !b).length;
  const shapedTiles = shaped.reduce((sum, p) => sum + p.count * p.size, 0);
  if (shapedTiles + singles > free) return 0;

  const grid = [...blocked];
  let total = 0;

  // Front-rank cells that must end up covered, if we are asking that question.
  const mustFill = new Set<number>();
  if (requireFrontRank) {
    for (let c = 0; c < COLS; c++) if (!blocked[c]) mustFill.add(c);
  }

  const search = (from: number, gaps: number): void => {
    if (total >= cap) return;
    if (shaped.every((p) => p.count === 0)) {
      // Whatever is still empty can hold the 1x1s, in any combination.
      let empty = 0;
      let unfilledFront = 0;
      for (let i = from; i < CELLS; i++) if (!grid[i]) empty++;
      if (requireFrontRank) {
        for (const cell of mustFill) if (!grid[cell]) unfilledFront++;
      }
      // Front-rank cells still open must be taken by 1x1s, so those are spoken
      // for; the rest are free choices.
      if (unfilledFront > singles) return;
      total += choose(empty - unfilledFront, singles - unfilledFront);
      if (total > cap) total = cap;
      return;
    }

    let cell = from;
    while (cell < CELLS && grid[cell]) cell++;
    if (cell >= CELLS) return;

    const row = Math.floor(cell / COLS);
    const col = cell % COLS;

    for (const piece of shaped) {
      if (piece.count === 0) continue;
      for (const form of piece.forms) {
        // Anchor so the form's first cell sits exactly on `cell`; that is what
        // makes every arrangement reachable by exactly one path.
        const [ar, ac] = form[0] as Cell;
        const baseR = row - ar;
        const baseC = col - ac;
        let fits = true;
        for (const [dr, dc] of form) {
          const r = baseR + dr;
          const c = baseC + dc;
          if (r < 0 || r >= ROWS || c < 0 || c >= COLS || grid[r * COLS + c]) {
            fits = false;
            break;
          }
        }
        if (!fits) continue;
        for (const [dr, dc] of form) grid[(baseR + dr) * COLS + baseC + dc] = true;
        piece.count--;
        search(cell + 1, gaps);
        piece.count++;
        for (const [dr, dc] of form) grid[(baseR + dr) * COLS + baseC + dc] = false;
        if (total >= cap) return;
      }
    }

    // Or deliberately leave this cell for a 1x1, or empty.
    if (gaps > 0) {
      grid[cell] = true;
      search(cell + 1, gaps - 1);
      grid[cell] = false;
    }
  };

  const slack = free - shapedTiles;
  search(0, slack);
  return total;
}

// ------------------------------------------------------------------ report

const seeds = Array.from({ length: BOARDS }, (_, i) => 4000 + i * 3);
const median = (xs: number[]): number => {
  const sorted = [...xs].sort((a, b) => a - b);
  return sorted[Math.floor(sorted.length / 2)] ?? 0;
};
const big = (n: number): string => (n >= CAP ? `>${(CAP / 1e6).toFixed(0)}M` : n.toLocaleString());

console.log(`\nPACKING FEASIBILITY  —  ${BOARDS} board draws, 4x${COLS} zone, 26 free tiles\n`);
console.log(
  `${"shape set".padEnd(28)} ${"tiles".padStart(6)} ${"solvable".padStart(9)} ${"arrangements".padStart(14)} ${"front line".padStart(11)}`,
);
console.log("-".repeat(74));

for (const set of SETS) {
  const tiles = set.pieces.reduce((sum, p) => sum + p.count * p.cells.length, 0);
  const counts: number[] = [];
  let solvable = 0;
  let frontLine = 0;

  for (const seed of seeds) {
    const blocked = blockedFor(seed);
    const n = countPackings(set, blocked, CAP, false);
    counts.push(n);
    if (n > 0) solvable++;
    if (countPackings(set, blocked, 1, true) > 0) frontLine++;
  }

  console.log(
    `${set.label.padEnd(28)} ${String(tiles).padStart(6)} ${`${((solvable / BOARDS) * 100).toFixed(0)}%`.padStart(9)} ${big(median(counts)).padStart(14)} ${`${((frontLine / BOARDS) * 100).toFixed(0)}%`.padStart(11)}`,
  );
}

console.log(
  "\nfront line = share of boards where a unit can still be placed in EVERY column\nof the rank nearest the enemy — the currently dominant shape.",
);

// ---------------------------------------------------- the oversupply decision

/** Every sub-roster of the offered pieces, as a count per piece type. */
function subRosters(set: ShapeSet): number[][] {
  let out: number[][] = [[]];
  for (const piece of set.pieces) {
    const next: number[][] = [];
    for (const prefix of out) {
      for (let n = 0; n <= piece.count; n++) next.push([...prefix, n]);
    }
    out = next;
  }
  return out;
}

const offeredTiles = OVERSUPPLY.pieces.reduce((sum, p) => sum + p.count * p.cells.length, 0);
console.log(`\n\nOVERSUPPLY  —  ${offeredTiles} tiles of army offered for a 26-tile zone\n`);

const fieldable: number[] = [];
const distinctArmies = new Set<string>();
let sampleBoard = "";

for (const seed of seeds.slice(0, Math.min(BOARDS, 30))) {
  const blocked = blockedFor(seed);
  const packable: number[][] = [];
  for (const roster of subRosters(OVERSUPPLY)) {
    const pieces = OVERSUPPLY.pieces
      .map((p, i) => ({ ...p, count: roster[i] ?? 0 }))
      .filter((p) => p.count > 0);
    if (pieces.length === 0) continue;
    const tiles = pieces.reduce((sum, p) => sum + p.count * p.cells.length, 0);
    if (tiles > 26) continue;
    if (countPackings({ label: "", pieces }, blocked, 1, false) > 0) packable.push(roster);
  }

  // Only MAXIMAL rosters are real choices: if you could still add a piece, you
  // would, so a roster with room to spare is not a decision, it is a mistake.
  const maximal = packable.filter(
    (roster) =>
      !packable.some(
        (other) =>
          other !== roster &&
          other.every((n, i) => n >= (roster[i] ?? 0)) &&
          other.some((n, i) => n > (roster[i] ?? 0)),
      ),
  );
  fieldable.push(maximal.length);
  for (const roster of maximal) distinctArmies.add(roster.join(","));
  if (sampleBoard === "") {
    sampleBoard = maximal
      .slice(0, 3)
      .map((roster) =>
        OVERSUPPLY.pieces
          .map((p, i) => `${roster[i] ?? 0}x${p.name}`)
          .filter((t) => !t.startsWith("0"))
          .join(" + "),
      )
      .join("\n    ");
  }
}

console.log(`  distinct maximal armies, per board   ${median(fieldable)} (median)`);
console.log(`  distinct maximal armies, all boards  ${distinctArmies.size}`);
console.log(`\n  three of them:\n    ${sampleBoard}\n`);
