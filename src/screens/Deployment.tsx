import { useEffect, useMemo, useState } from "react";
import { ArmyPanel } from "../components/ArmyPanel.tsx";
import { Board, type RenderUnit, toRenderUnits } from "../components/Board.tsx";
import { arcPreview } from "../game/engine/preview.ts";
import { canPlace } from "../game/models/deployment.ts";
import type { Coord, PlacedUnit } from "../game/types.ts";
import { useGame } from "../store/gameStore.ts";

export function DeploymentScreen() {
  const activeTeam = useGame((s) => s.activeTeam);
  const deployment = useGame((s) => s.deployments[s.activeTeam]);
  const selectedType = useGame((s) => s.selectedType);
  const selectedFacing = useGame((s) => s.selectedFacing);
  const selectedIndex = useGame((s) => s.selectedIndex);
  const selectType = useGame((s) => s.selectType);
  const selectPlaced = useGame((s) => s.selectPlaced);
  const rotateSelected = useGame((s) => s.rotateSelected);
  const place = useGame((s) => s.place);
  const removeAt = useGame((s) => s.removeAt);
  const clearAll = useGame((s) => s.clearAll);
  const autoFill = useGame((s) => s.autoFill);
  const ready = useGame((s) => s.ready);

  const [hovered, setHovered] = useState<Coord | null>(null);

  // R rotates — before placing (sets the ghost's facing) or after (turns the
  // selected unit). Facing is the most-used control on this screen.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "r" || e.key === "R") {
        e.preventDefault();
        rotateSelected();
      }
      if (e.key === "Escape") {
        selectType(null);
        selectPlaced(null);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [rotateSelected, selectType, selectPlaced]);

  const selectedUnit: PlacedUnit | null =
    selectedIndex !== null ? (deployment.units[selectedIndex] ?? null) : null;

  const hoverLegal =
    selectedType !== null && hovered !== null
      ? canPlace(activeTeam, selectedType, hovered.row, hovered.col, deployment.units)
      : true;

  /**
   * The arc preview. Shown for a selected placed unit, or as a ghost under the
   * cursor while placing — so you can see the firing lane BEFORE you commit.
   */
  const preview = useMemo(() => {
    if (selectedUnit !== null) {
      return arcPreview(activeTeam, deployment.units, selectedUnit);
    }
    if (selectedType !== null && hovered !== null && hoverLegal) {
      const ghost: PlacedUnit = {
        type: selectedType,
        row: hovered.row,
        col: hovered.col,
        facing: selectedFacing,
      };
      return arcPreview(activeTeam, deployment.units, ghost);
    }
    return { covered: [], blocked: [] };
  }, [
    activeTeam,
    deployment.units,
    selectedUnit,
    selectedType,
    hovered,
    hoverLegal,
    selectedFacing,
  ]);

  const units: RenderUnit[] = toRenderUnits(deployment.units, activeTeam).map((u) => ({
    ...u,
    selected: u.index === selectedIndex,
  }));

  // The ghost unit under the cursor.
  if (selectedType !== null && hovered !== null && hoverLegal) {
    units.push({
      key: "ghost",
      type: selectedType,
      team: activeTeam,
      row: hovered.row,
      col: hovered.col,
      facing: selectedFacing,
    });
  }

  return (
    <div className="screen">
      <div className="board-wrap">
        <Board
          units={units}
          arc={preview.covered}
          arcBlocked={preview.blocked}
          interactiveZone={activeTeam}
          hovered={hovered}
          hoverLegal={hoverLegal}
          onTileEnter={(row, col) => setHovered({ row, col })}
          onTileLeave={() => setHovered(null)}
          onTileClick={(row, col) => {
            const existing = deployment.units.findIndex((u) => u.row === row && u.col === col);
            if (selectedType !== null) place(row, col);
            else if (existing >= 0) selectPlaced(existing);
          }}
          onUnitClick={(unit) => {
            if (selectedType !== null) {
              place(unit.row, unit.col);
              return;
            }
            if (unit.index !== undefined) selectPlaced(unit.index);
          }}
        />
        <p className="hint" style={{ color: "#cfc4ab", maxWidth: "44ch", textAlign: "center" }}>
          The hatched strip is no man's land — nothing can be placed there. Solid marks show where a
          unit can fire; faded marks are shadowed by your own cover.
        </p>
      </div>

      <ArmyPanel
        team={activeTeam}
        deployment={deployment}
        selectedType={selectedType}
        selectedUnit={selectedUnit}
        onSelectType={selectType}
        onRotate={rotateSelected}
        onRemove={() => selectedIndex !== null && removeAt(selectedIndex)}
        onClear={clearAll}
        onAutoFill={autoFill}
        onReady={ready}
      />
    </div>
  );
}
