/**
 * UI state. The engine knows nothing about this file — data flows one way:
 *
 *   React UI  --commands-->  Game Engine  --state/events-->  Renderer
 */

import { create } from "zustand";
import { MVP_ARMY, type Roster, UNITS } from "../game/config/units.ts";
import { botById } from "../game/content/bots.ts";
import { type Puzzle, puzzleById } from "../game/content/puzzles.ts";
import { type BattleResult, simulateBattle } from "../game/engine/simulate.ts";
import { canPlace, emptyDeployment, expectedCounts } from "../game/models/deployment.ts";
import type { Deployment, Direction, PlacedUnit, Team, UnitTypeId } from "../game/types.ts";

export type Phase = "home" | "deploy" | "handoff" | "battle" | "results";
export type Mode = "hotseat" | "bot" | "puzzle";

interface GameState {
  phase: Phase;
  mode: Mode;
  botId: string | null;
  puzzleId: string | null;

  /** Whose deployment screen is showing. Always "A" outside hotseat. */
  activeTeam: Team;
  deployments: Record<Team, Deployment>;
  /** Each side's last formation, so a rematch can preload it (§D.2). */
  lastFormation: Record<Team, Deployment | null>;

  // --- deployment UI ---
  selectedType: UnitTypeId | null;
  selectedFacing: Direction;
  selectedIndex: number | null;

  result: BattleResult | null;

  // --- actions ---
  startHotseat: () => void;
  startBot: (botId: string) => void;
  startPuzzle: (puzzleId: string) => void;
  rematch: () => void;
  backHome: () => void;
  selectType: (type: UnitTypeId | null) => void;
  selectPlaced: (index: number | null) => void;
  setFacing: (facing: Direction) => void;
  rotateSelected: () => void;
  place: (row: number, col: number) => void;
  removeAt: (index: number) => void;
  clearAll: () => void;
  autoFill: () => void;
  ready: () => void;
  proceedToDeploy: () => void;
  finish: () => void;
}

const FACINGS: Direction[] = ["N", "E", "S", "W"];

function remaining(deployment: Deployment, kit: Roster): Map<UnitTypeId, number> {
  const left = expectedCounts(kit);
  for (const unit of deployment.units) {
    left.set(unit.type, (left.get(unit.type) ?? 0) - 1);
  }
  return left;
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
  if (state.mode !== "puzzle" || state.puzzleId === null) return MVP_ARMY;
  return puzzleById(state.puzzleId)?.kit ?? MVP_ARMY;
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
  selectedFacing: "N" as Direction,
  selectedIndex: null,
  result: null,
};

export const useGame = create<GameState>((set, get) => ({
  phase: "home",
  mode: "hotseat",
  botId: null,
  puzzleId: null,
  activeTeam: "A",
  deployments: { A: emptyDeployment("A"), B: emptyDeployment("B") },
  lastFormation: { A: null, B: null },
  ...FRESH,

  startHotseat: () =>
    set({
      phase: "deploy",
      mode: "hotseat",
      botId: null,
      puzzleId: null,
      activeTeam: "A",
      deployments: { A: emptyDeployment("A"), B: emptyDeployment("B") },
      lastFormation: { A: null, B: null },
      ...FRESH,
    }),

  startBot: (botId) => {
    const bot = botById(botId);
    if (bot === undefined) return;
    set({
      phase: "deploy",
      mode: "bot",
      botId,
      puzzleId: null,
      activeTeam: "A",
      // The bot's formation is loaded now but stays hidden until the reveal.
      deployments: { A: emptyDeployment("A"), B: bot.deployment },
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
      botId: null,
      activeTeam: "A",
      // A puzzle's enemy is VISIBLE the whole time — that is the point of it.
      deployments: { A: emptyDeployment("A"), B: puzzle.enemy },
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
    const { lastFormation, mode, deployments } = get();
    set({
      phase: "deploy",
      activeTeam: "A",
      deployments: {
        A: lastFormation.A ?? emptyDeployment("A"),
        // Bots and puzzles keep their fixed formation; hotseat reloads Orange's.
        B: mode === "hotseat" ? (lastFormation.B ?? emptyDeployment("B")) : deployments.B,
      },
      ...FRESH,
    });
  },

  backHome: () => set({ phase: "home", result: null }),

  selectType: (type) => set({ selectedType: type, selectedIndex: null }),
  selectPlaced: (index) => set({ selectedIndex: index, selectedType: null }),
  setFacing: (facing) => set({ selectedFacing: facing }),

  rotateSelected: () => {
    const { selectedIndex, activeTeam, deployments, selectedFacing } = get();
    if (selectedIndex === null) {
      set({ selectedFacing: FACINGS[(FACINGS.indexOf(selectedFacing) + 1) % 4] ?? "N" });
      return;
    }
    const deployment = deployments[activeTeam];
    const unit = deployment.units[selectedIndex];
    if (unit === undefined) return;
    const next = FACINGS[(FACINGS.indexOf(unit.facing) + 1) % 4] ?? "N";
    const units = deployment.units.map((x, i) =>
      i === selectedIndex ? { ...x, facing: next } : x,
    );
    set({ deployments: { ...deployments, [activeTeam]: { ...deployment, units } } });
  },

  place: (row, col) => {
    const state = get();
    const { selectedType, activeTeam, deployments, selectedFacing } = state;
    if (selectedType === null) return;
    const kit = activeKit(state);
    const deployment = deployments[activeTeam];
    if ((remaining(deployment, kit).get(selectedType) ?? 0) <= 0) return;
    if (!canPlace(activeTeam, selectedType, row, col, deployment.units)) return;

    const placed: PlacedUnit = {
      type: selectedType,
      row,
      col,
      facing: UNITS[selectedType].pattern === undefined ? "N" : selectedFacing,
    };
    const units = [...deployment.units, placed];
    const stillLeft = (remaining({ ...deployment, units }, kit).get(selectedType) ?? 0) > 0;
    set({
      deployments: { ...deployments, [activeTeam]: { ...deployment, units } },
      selectedType: stillLeft ? selectedType : null,
    });
  },

  removeAt: (index) => {
    const { activeTeam, deployments } = get();
    const deployment = deployments[activeTeam];
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
    set({
      deployments: { ...deployments, [activeTeam]: emptyDeployment(activeTeam) },
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
    const rows = activeTeam === "A" ? [8, 9, 10, 11, 12, 13] : [5, 4, 3, 2, 1, 0];

    for (const [type, count] of remaining(deployment, kit)) {
      for (let n = 0; n < count; n++) {
        let placed = false;
        for (const row of rows) {
          if (placed) break;
          for (let col = 0; col < 12; col++) {
            if (canPlace(activeTeam, type, row, col, units)) {
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
      // A fresh seed per match. Replays pin it, so any battle is reproducible.
      seed: (Date.now() & 0x7fffffff) >>> 0,
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
