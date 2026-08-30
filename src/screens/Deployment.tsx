import { useEffect, useMemo, useState } from "react";
import { ArmyPanel } from "../components/ArmyPanel.tsx";
import { Board, type RenderUnit, toRenderUnits } from "../components/Board.tsx";
import { botById } from "../game/content/bots.ts";
import { arcPreview } from "../game/engine/preview.ts";
import { canPlace } from "../game/models/deployment.ts";
import type { Coord, PlacedUnit } from "../game/types.ts";
import { activeKit, activePuzzle, useGame } from "../store/gameStore.ts";

export function DeploymentScreen() {
  const mode = useGame((s) => s.mode);
  const puzzleId = useGame((s) => s.puzzleId);
  const botId = useGame((s) => s.botId);
  const activeTeam = useGame((s) => s.activeTeam);
  const deployment = useGame((s) => s.deployments[s.activeTeam]);
  const enemyDeployment = useGame((s) => s.deployments[s.activeTeam === "A" ? "B" : "A"]);
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
  const backHome = useGame((s) => s.backHome);

  const kit = useMemo(() => activeKit({ mode, puzzleId }), [mode, puzzleId]);
  const puzzle = useMemo(() => activePuzzle({ mode, puzzleId }), [mode, puzzleId]);
  const bot = botId === null ? undefined : botById(botId);

  const [hovered, setHovered] = useState<Coord | null>(null);

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

  const preview = useMemo(() => {
    if (selectedUnit !== null) return arcPreview(activeTeam, deployment.units, selectedUnit);
    if (selectedType !== null && hovered !== null && hoverLegal) {
      return arcPreview(activeTeam, deployment.units, {
        type: selectedType,
        row: hovered.row,
        col: hovered.col,
        facing: selectedFacing,
      });
    }
    return { covered: [], blocked: [], deadZone: [] };
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

  // A puzzle's enemy is visible the whole time — solving it IS reading their
  // formation (§E.2). Outside puzzles only their HQ is public: it is placed
  // automatically at a published anchor, so both sides plan around a known
  // objective while lanes and facings stay secret.
  const enemyTeam = activeTeam === "A" ? "B" : "A";
  const visibleEnemy =
    puzzle !== null
      ? enemyDeployment.units
      : enemyDeployment.units.filter((unit) => unit.type === "hq");
  units.push(
    ...toRenderUnits(visibleEnemy, enemyTeam).map((u) => ({ ...u, key: `enemy-${u.key}` })),
  );

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
      {puzzle !== null && (
        <div className="panel brief">
          <h2>{puzzle.name}</h2>
          <p className="teaches">{puzzle.teaches}</p>
          <p className="brief-text">{puzzle.brief}</p>
          <h2>Objectives</h2>
          <ul className="objectives">
            {puzzle.objectives.map((o) => (
              <li key={o.label}>{o.label}</li>
            ))}
          </ul>
          <details>
            <summary>Hint</summary>
            <p className="brief-text">{puzzle.hint}</p>
          </details>
          <div className="row-actions">
            <button type="button" onClick={backHome}>
              Back
            </button>
          </div>
        </div>
      )}

      <div className="board-wrap">
        <div className={`battlefield-heading team-${activeTeam}`}>
          <span>
            <small>Planning phase</small>
            <strong>Build your formation</strong>
          </span>
          <span className="battlefield-objective">
            <b>Mission</b> Defend your HQ · Break their line
          </span>
        </div>
        <Board
          units={units}
          arc={preview.covered}
          arcBlocked={preview.blocked}
          arcDead={preview.deadZone}
          interactiveZone={activeTeam}
          hovered={hovered}
          hoverLegal={hoverLegal}
          onTileEnter={(row, col) => setHovered({ row, col })}
          onTileLeave={() => setHovered(null)}
          onTileClick={(row, col) => {
            const existing = deployment.units.findIndex((u) => u.row === row && u.col === col);
            if (selectedType !== null) place(row, col);
            else if (existing >= 0 && deployment.units[existing]?.type !== "hq") {
              selectPlaced(existing);
            }
          }}
          onUnitClick={(unit) => {
            if (selectedType !== null) {
              place(unit.row, unit.col);
              return;
            }
            // The HQ is automatic; there is nothing to adjust on it.
            if (unit.type === "hq") return;
            if (unit.index !== undefined && unit.team === activeTeam) selectPlaced(unit.index);
          }}
        />
        <p className="hint board-note">
          {puzzle !== null
            ? "The enemy formation is fully visible. Work out the placement that beats it."
            : `Both HQs are fixed and public — ${
                bot === undefined ? "your opponent's" : `${bot.name}'s`
              } units stay hidden until the reveal. You know what to attack and what to defend.`}
        </p>
      </div>

      <ArmyPanel
        team={activeTeam}
        kit={kit}
        readyLabel={mode === "hotseat" ? "Ready" : "Fight"}
        deployment={deployment}
        selectedType={selectedType}
        selectedUnit={selectedUnit}
        coverage={{
          covered: preview.covered.length,
          shadowed: preview.blocked.length,
          dead: preview.deadZone.length,
        }}
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
