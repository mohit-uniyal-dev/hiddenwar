/**
 * UI state. The engine knows nothing about this file — data flows one way:
 *
 *   React UI  --commands-->  Game Engine  --state/events-->  Renderer
 */

import { create } from "zustand";
import { UNITS } from "../game/config/units.ts";
import { type BattleResult, simulateBattle } from "../game/engine/simulate.ts";
import { canPlace, emptyDeployment, expectedCounts } from "../game/models/deployment.ts";
import type { Deployment, Direction, PlacedUnit, Team, UnitTypeId } from "../game/types.ts";

export type Phase = "home" | "deploy" | "handoff" | "battle" | "results";

interface GameState {
  phase: Phase;
  /** Whose deployment screen is showing. */
  activeTeam: Team;
  deployments: Record<Team, Deployment>;
  /** The formation each player ends the match with, so a rematch can preload it (§D.2). */
  lastFormation: Record<Team, Deployment | null>;

  // --- deployment UI ---
  selectedType: UnitTypeId | null;
  selectedFacing: Direction;
  /** Index into the active team's placed units, for rotate/remove. */
  selectedIndex: number | null;

  result: BattleResult | null;

  // --- actions ---
  startMatch: () => void;
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

function remaining(deployment: Deployment): Map<UnitTypeId, number> {
  const left = expectedCounts();
  for (const unit of deployment.units) {
    left.set(unit.type, (left.get(unit.type) ?? 0) - 1);
  }
  return left;
}

export function remainingFor(deployment: Deployment): Map<UnitTypeId, number> {
  return remaining(deployment);
}

export function isComplete(deployment: Deployment): boolean {
  for (const count of remaining(deployment).values()) {
    if (count !== 0) return false;
  }
  return true;
}

/** Default facing: toward the enemy. */
function defaultFacing(team: Team): Direction {
  return team === "A" ? "N" : "S";
}

export const useGame = create<GameState>((set, get) => ({
  phase: "home",
  activeTeam: "A",
  deployments: { A: emptyDeployment("A"), B: emptyDeployment("B") },
  lastFormation: { A: null, B: null },
  selectedType: null,
  selectedFacing: "N",
  selectedIndex: null,
  result: null,

  startMatch: () =>
    set({
      phase: "deploy",
      activeTeam: "A",
      deployments: { A: emptyDeployment("A"), B: emptyDeployment("B") },
      selectedType: null,
      selectedFacing: "N",
      selectedIndex: null,
      result: null,
    }),

  /**
   * Rematch reloads BOTH players' previous formations, pre-placed for editing.
   *
   * This is the single most important interaction in the demo. Rebuilding 19
   * pieces from scratch kills the "I know exactly what I'd change" impulse
   * that the whole prototype is trying to test (§D.2).
   */
  rematch: () => {
    const { lastFormation } = get();
    set({
      phase: "deploy",
      activeTeam: "A",
      deployments: {
        A: lastFormation.A ?? emptyDeployment("A"),
        B: lastFormation.B ?? emptyDeployment("B"),
      },
      selectedType: null,
      selectedFacing: "N",
      selectedIndex: null,
      result: null,
    });
  },

  backHome: () => set({ phase: "home", result: null }),

  selectType: (type) => set({ selectedType: type, selectedIndex: null }),
  selectPlaced: (index) => set({ selectedIndex: index, selectedType: null }),
  setFacing: (facing) => set({ selectedFacing: facing }),

  rotateSelected: () => {
    const { selectedIndex, activeTeam, deployments, selectedFacing } = get();
    if (selectedIndex === null) {
      const next = FACINGS[(FACINGS.indexOf(selectedFacing) + 1) % 4] ?? "N";
      set({ selectedFacing: next });
      return;
    }
    const deployment = deployments[activeTeam];
    const unit = deployment.units[selectedIndex];
    if (unit === undefined) return;
    const next = FACINGS[(FACINGS.indexOf(unit.facing) + 1) % 4] ?? "N";
    const units = deployment.units.map((u, i) =>
      i === selectedIndex ? { ...u, facing: next } : u,
    );
    set({ deployments: { ...deployments, [activeTeam]: { ...deployment, units } } });
  },

  place: (row, col) => {
    const { selectedType, activeTeam, deployments, selectedFacing } = get();
    if (selectedType === null) return;
    const deployment = deployments[activeTeam];
    const left = remaining(deployment).get(selectedType) ?? 0;
    if (left <= 0) return;
    if (!canPlace(activeTeam, selectedType, row, col, deployment.units)) return;

    const placed: PlacedUnit = {
      type: selectedType,
      row,
      col,
      // Structures have no facing that matters; keep it canonical.
      facing: UNITS[selectedType].pattern === undefined ? "N" : selectedFacing,
    };
    const units = [...deployment.units, placed];
    const stillLeft = (remaining({ ...deployment, units }).get(selectedType) ?? 0) > 0;
    set({
      deployments: { ...deployments, [activeTeam]: { ...deployment, units } },
      selectedType: stillLeft ? selectedType : null,
    });
  },

  removeAt: (index) => {
    const { activeTeam, deployments } = get();
    const deployment = deployments[activeTeam];
    const units = deployment.units.filter((_, i) => i !== index);
    set({
      deployments: { ...deployments, [activeTeam]: { ...deployment, units } },
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

  /** Fills every unplaced piece into the first legal tile. A playtest convenience. */
  autoFill: () => {
    const { activeTeam, deployments } = get();
    const deployment = deployments[activeTeam];
    const units: PlacedUnit[] = [...deployment.units];
    const rows = activeTeam === "A" ? [8, 9, 10, 11, 12, 13] : [5, 4, 3, 2, 1, 0];

    for (const [type, count] of remaining(deployment)) {
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
   * When the second player commits, the whole battle is simulated immediately
   * and stored. Playback is then pure replay of the event log — the renderer
   * never simulates (§H.4).
   */
  ready: () => {
    const { activeTeam, deployments } = get();
    if (activeTeam === "A") {
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

  /** Playback finished — show the debrief. */
  finish: () => set({ phase: "results" }),
}));
