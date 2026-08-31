/**
 * UI state. The engine knows nothing about this file — data flows one way:
 *
 *   React UI  --commands-->  Game Engine  --state/events-->  Renderer
 */

import { create } from "zustand";
import {
  BOARD,
  HQ_ANCHOR,
  type HqAnchors,
  hqAnchorsForSeed,
  terrainForSeed,
} from "../game/config/gameConfig.ts";
import { MVP_ARMY, PLACEABLE_ARMY, type Roster } from "../game/config/units.ts";
import {
  type ArchetypeId,
  DIFFICULTY_POOLS,
  type Difficulty,
  archetypeById,
  generateFormation,
} from "../game/content/formations.ts";
import { type Puzzle, puzzleById } from "../game/content/puzzles.ts";
import { type BattleResult, simulateBattle } from "../game/engine/simulate.ts";
import { canPlace, emptyDeployment, expectedCounts } from "../game/models/deployment.ts";
import { mulberry32 } from "../game/rng/mulberry32.ts";
import type { Coord, Deployment, Direction, PlacedUnit, Team, UnitTypeId } from "../game/types.ts";

export type Phase = "home" | "deploy" | "handoff" | "battle" | "results";
export type Mode = "hotseat" | "ai" | "puzzle";

interface GameState {
  phase: Phase;
  mode: Mode;
  /** Which tier the AI opponent was drawn from, and the shape it drew. */
  aiDifficulty: Difficulty | null;
  aiArchetype: ArchetypeId | null;
  puzzleId: string | null;
  /**
   * Drawn once per match and held steady across rematches, so the HQ column
   * varies between matches but edit-and-rerun still works (§D.2).
   */
  matchSeed: number;
  hqAnchors: HqAnchors;
  /** Indestructible cover drawn with the board, identical for both players. */
  craters: readonly Coord[];

  /** Whose deployment screen is showing. Always "A" outside hotseat. */
  activeTeam: Team;
  deployments: Record<Team, Deployment>;
  /** Each side's last formation, so a rematch can preload it (§D.2). */
  lastFormation: Record<Team, Deployment | null>;

  // --- deployment UI ---
  selectedType: UnitTypeId | null;
  selectedIndex: number | null;

  result: BattleResult | null;

  // --- actions ---
  startHotseat: () => void;
  startAi: (difficulty: Difficulty) => void;
  startPuzzle: (puzzleId: string) => void;
  rematch: () => void;
  backHome: () => void;
  selectType: (type: UnitTypeId | null) => void;
  selectPlaced: (index: number | null) => void;
  place: (row: number, col: number) => void;
  removeAt: (index: number) => void;
  /** Reposition an already-placed unit. Returns silently if the tile is illegal. */
  moveTo: (index: number, row: number, col: number) => void;
  clearAll: () => void;
  autoFill: () => void;
  ready: () => void;
  proceedToDeploy: () => void;
  finish: () => void;
}

function remaining(deployment: Deployment, kit: Roster): Map<UnitTypeId, number> {
  const left = expectedCounts(kit);
  for (const unit of deployment.units) {
    // Units outside this kit are pre-placed and fixed — the automatic HQ, or a
    // puzzle's starting pieces. They must not count against the allowance.
    if (!left.has(unit.type)) continue;
    left.set(unit.type, (left.get(unit.type) ?? 0) - 1);
  }
  return left;
}

/** A deployment seeded with the automatic HQ, ready for the player to build on. */
function withHq(team: Team, anchors: HqAnchors): Deployment {
  return {
    team,
    units: anchors[team].map((a) => ({
      type: "hq" as const,
      row: a.row,
      col: a.col,
      facing: "N" as const,
    })),
  };
}

let seedCounter = 0;

/**
 * A counter is mixed in because Date.now() has millisecond resolution: two
 * matches started in the same millisecond would otherwise draw the same seed,
 * and so the same board and the same AI opponent.
 */
function newSeed(): number {
  seedCounter = (seedCounter + 1) >>> 0;
  return ((Date.now() ^ Math.imul(seedCounter, 0x9e3779b1)) & 0x7fffffff) >>> 0;
}

export function remainingFor(deployment: Deployment, kit: Roster = MVP_ARMY) {
  return remaining(deployment, kit);
}

export function isComplete(deployment: Deployment, kit: Roster = MVP_ARMY): boolean {
  for (const count of remaining(deployment, kit).values()) {
    if (count !== 0) return false;
  }
  return true;
}

/** The roster the active player is placing: a puzzle's kit, or the Classic army. */
export function activeKit(state: {
  mode: Mode;
  puzzleId: string | null;
}): Roster {
  if (state.mode !== "puzzle" || state.puzzleId === null) return PLACEABLE_ARMY;
  return puzzleById(state.puzzleId)?.kit ?? PLACEABLE_ARMY;
}

export function activePuzzle(state: { mode: Mode; puzzleId: string | null }): Puzzle | null {
  if (state.mode !== "puzzle" || state.puzzleId === null) return null;
  return puzzleById(state.puzzleId) ?? null;
}

function defaultFacing(team: Team): Direction {
  return team === "A" ? "N" : "S";
}

const FRESH = {
  selectedType: null,
  selectedIndex: null,
  result: null,
};

export const useGame = create<GameState>((set, get) => ({
  phase: "home",
  mode: "hotseat",
  aiDifficulty: null,
  aiArchetype: null,
  puzzleId: null,
  activeTeam: "A",
  matchSeed: 0,
  hqAnchors: HQ_ANCHOR,
  craters: [],
  deployments: { A: emptyDeployment("A"), B: emptyDeployment("B") },
  lastFormation: { A: null, B: null },
  ...FRESH,

  startHotseat: () => {
    // A fresh draw each match: which lane you must force, and which you must
    // hold, changes every time (§41 — map variety, not dice).
    const matchSeed = newSeed();
    const hqAnchors = hqAnchorsForSeed(matchSeed);
    const craters = terrainForSeed(matchSeed, hqAnchors);
    set({
      phase: "deploy",
      mode: "hotseat",
      aiDifficulty: null,
      aiArchetype: null,
      puzzleId: null,
      activeTeam: "A",
      matchSeed,
      hqAnchors,
      craters,
      deployments: { A: withHq("A", hqAnchors), B: withHq("B", hqAnchors) },
      lastFormation: { A: null, B: null },
      ...FRESH,
    });
  },

  /**
   * The opposing army is generated, not stored — a fresh legal formation every
   * match, built by the same generator the balance sweep uses. Difficulty picks
   * which archetype pool it draws from, and those pools are ordered by measured
   * head-to-head win rate rather than by feel.
   */
  startAi: (difficulty) => {
    const matchSeed = newSeed();
    const hqAnchors = hqAnchorsForSeed(matchSeed);
    const craters = terrainForSeed(matchSeed, hqAnchors);
    const rng = mulberry32(matchSeed ^ 0x5bf03635);
    const pool = DIFFICULTY_POOLS[difficulty];
    const archetypeId = pool[rng.nextInt(pool.length)] ?? "line";
    const enemy = generateFormation("B", hqAnchors, archetypeById(archetypeId), rng, craters);

    set({
      phase: "deploy",
      mode: "ai",
      aiDifficulty: difficulty,
      aiArchetype: archetypeId,
      puzzleId: null,
      activeTeam: "A",
      matchSeed,
      hqAnchors,
      craters,
      // Their army is decided now but stays hidden until the reveal, exactly
      // as a human opponent's would.
      deployments: { A: withHq("A", hqAnchors), B: enemy },
      lastFormation: { A: null, B: null },
      ...FRESH,
    });
  },

  startPuzzle: (puzzleId) => {
    const puzzle = puzzleById(puzzleId);
    if (puzzle === undefined) return;
    set({
      phase: "deploy",
      mode: "puzzle",
      puzzleId,
      activeTeam: "A",
      matchSeed: newSeed(),
      aiDifficulty: null,
      aiArchetype: null,
      // Puzzles are designed scenarios: fixed ground, fixed objective.
      hqAnchors: HQ_ANCHOR,
      craters: [],
      // A puzzle's enemy is VISIBLE the whole time — that is the point of it.
      // `fixed` holds any pieces the scenario starts you with.
      deployments: { A: { team: "A", units: [...(puzzle.fixed ?? [])] }, B: puzzle.enemy },
      lastFormation: { A: null, B: null },
      ...FRESH,
    });
  },

  /**
   * Rematch reloads the previous formations, pre-placed for editing.
   *
   * This is the single most important interaction in the demo. Rebuilding
   * nineteen pieces from scratch kills the "I know exactly what I'd change"
   * impulse that the whole prototype exists to test (§D.2).
   */
  rematch: () => {
    const { lastFormation, mode, deployments, hqAnchors } = get();
    set({
      phase: "deploy",
      activeTeam: "A",
      // hqAnchors deliberately untouched: a rematch is the same battlefield
      // with your formation reloaded, which is the whole point (§D.2).
      deployments: {
        A: lastFormation.A ?? withHq("A", hqAnchors),
        // Bots and puzzles keep their fixed formation; hotseat reloads Orange's.
        B: mode === "hotseat" ? (lastFormation.B ?? withHq("B", hqAnchors)) : deployments.B,
      },
      ...FRESH,
    });
  },

  backHome: () => set({ phase: "home", result: null }),

  selectType: (type) => set({ selectedType: type, selectedIndex: null }),
  selectPlaced: (index) => set({ selectedIndex: index, selectedType: null }),
  /*
    Every weapon faces the enemy, and that is not a default — it is the only
    option. Facing was selectable and never worth changing: summed over every
    legal tile, a soldier, AT gun or tank facing anywhere but forward covers
    ZERO enemy tiles, and a machine gun covers 9 against 192 forward. A control
    whose alternatives are all wrong is not a choice, it is a trap, so it is
    gone. `facing` stays in the data model because the engine resolves arcs
    with it; nothing chooses it any more.
  */
  place: (row, col) => {
    const state = get();
    const { selectedType, activeTeam, deployments } = state;
    if (selectedType === null) return;
    const kit = activeKit(state);
    const deployment = deployments[activeTeam];
    if ((remaining(deployment, kit).get(selectedType) ?? 0) <= 0) return;
    if (!canPlace(activeTeam, selectedType, row, col, deployment.units, -1, state.craters)) return;

    const placed: PlacedUnit = {
      type: selectedType,
      row,
      col,
      facing: defaultFacing(activeTeam),
    };
    const units = [...deployment.units, placed];
    const stillLeft = (remaining({ ...deployment, units }, kit).get(selectedType) ?? 0) > 0;
    set({
      deployments: { ...deployments, [activeTeam]: { ...deployment, units } },
      selectedType: stillLeft ? selectedType : null,
    });
  },

  moveTo: (index, row, col) => {
    const { activeTeam, deployments } = get();
    const deployment = deployments[activeTeam];
    const unit = deployment.units[index];
    if (unit === undefined) return;
    // The HQ is placed automatically and cannot be picked up.
    if (unit.type === "hq") return;
    // `ignoreIndex` lets a unit overlap its own current tiles, so a one-tile
    // nudge is legal rather than colliding with where it already stands.
    if (!canPlace(activeTeam, unit.type, row, col, deployment.units, index, get().craters)) return;

    const units = deployment.units.map((u, i) => (i === index ? { ...u, row, col } : u));
    set({ deployments: { ...deployments, [activeTeam]: { ...deployment, units } } });
  },

  removeAt: (index) => {
    const { activeTeam, deployments } = get();
    const deployment = deployments[activeTeam];
    // The HQ is placed automatically and cannot be picked up.
    if (deployment.units[index]?.type === "hq") return;
    set({
      deployments: {
        ...deployments,
        [activeTeam]: { ...deployment, units: deployment.units.filter((_, i) => i !== index) },
      },
      selectedIndex: null,
    });
  },

  clearAll: () => {
    const { activeTeam, deployments } = get();
    const deployment = deployments[activeTeam];
    set({
      deployments: {
        ...deployments,
        // Clearing wipes what you placed; the fixed pieces stay put.
        [activeTeam]: { ...deployment, units: deployment.units.filter((u) => u.type === "hq") },
      },
      selectedIndex: null,
      selectedType: null,
    });
  },

  /** Drops every unplaced piece into the first legal tile. A playtest convenience. */
  autoFill: () => {
    const state = get();
    const { activeTeam, deployments } = state;
    const kit = activeKit(state);
    const deployment = deployments[activeTeam];
    const units: PlacedUnit[] = [...deployment.units];
    const rows = activeTeam === "A" ? [5, 6, 7, 8] : [3, 2, 1, 0];

    for (const [type, count] of remaining(deployment, kit)) {
      for (let n = 0; n < count; n++) {
        let placed = false;
        for (const row of rows) {
          if (placed) break;
          for (let col = 0; col < BOARD.cols; col++) {
            if (canPlace(activeTeam, type, row, col, units, -1, get().craters)) {
              units.push({ type, row, col, facing: defaultFacing(activeTeam) });
              placed = true;
              break;
            }
          }
        }
      }
    }
    set({ deployments: { ...deployments, [activeTeam]: { ...deployment, units } } });
  },

  /**
   * Ready is irreversible (§B.2).
   *
   * Once the last player commits, the whole battle is simulated immediately and
   * stored. Playback is then pure replay of the event log — the renderer never
   * simulates (§H.4).
   */
  ready: () => {
    const { activeTeam, deployments, mode } = get();
    if (mode === "hotseat" && activeTeam === "A") {
      set({ phase: "handoff", activeTeam: "B", selectedType: null, selectedIndex: null });
      return;
    }
    const result = simulateBattle({
      playerA: deployments.A,
      playerB: deployments.B,
      craters: get().craters,
      // The same seed that drew the HQ position, so one number reproduces the
      // whole match — battlefield and battle alike.
      seed: get().matchSeed,
    });
    set({
      phase: "battle",
      result,
      selectedType: null,
      selectedIndex: null,
      lastFormation: { A: deployments.A, B: deployments.B },
    });
  },

  proceedToDeploy: () => set({ phase: "deploy" }),

  finish: () => set({ phase: "results" }),
}));
