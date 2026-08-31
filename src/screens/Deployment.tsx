import { useCallback, useEffect, useMemo, useState } from "react";
import { ArmyPanel } from "../components/ArmyPanel.tsx";
import { Board, type RenderUnit, toRenderUnits } from "../components/Board.tsx";
import { DisplayControls } from "../components/DisplayControls.tsx";
import { UNITS } from "../game/config/units.ts";
import { arcPreview } from "../game/engine/preview.ts";
import { canPlace } from "../game/models/deployment.ts";
import type { Coord, Direction, PlacedUnit, UnitTypeId } from "../game/types.ts";
import { activeKit, activePuzzle, useGame } from "../store/gameStore.ts";

/**
 * Movement past this many pixels turns a tap into a drag.
 *
 * Generous on purpose: a finger rarely lands and lifts on the exact same pixel,
 * and treating that jitter as a drag is what made tapping a unit feel
 * unreliable.
 */
const DRAG_SLOP = 10;

interface DragState {
  readonly type: UnitTypeId;
  readonly facing: Direction;
  /** Index of the placed unit being moved, or null when dragging from the roster. */
  readonly fromIndex: number | null;
  readonly tile: Coord | null;
  readonly moved: boolean;
  readonly startX: number;
  readonly startY: number;
}

/**
 * The board tile under a screen coordinate.
 *
 * Hit-testing rather than event targets, because a pointer gesture stays bound
 * to the element it started on — the tile under the finger has to be looked up.
 */
function tileFromPoint(x: number, y: number): Coord | null {
  const el = document.elementFromPoint(x, y);
  const tile = el instanceof Element ? el.closest("[data-row]") : null;
  if (tile === null) return null;
  const row = Number(tile.getAttribute("data-row"));
  const col = Number(tile.getAttribute("data-col"));
  return Number.isFinite(row) && Number.isFinite(col) ? { row, col } : null;
}

/** Index of the unit occupying a tile, accounting for the 2x2 HQ. */
function unitIndexAt(units: readonly PlacedUnit[], row: number, col: number): number {
  return units.findIndex((u) => {
    const { width, height } = UNITS[u.type];
    return row >= u.row && row < u.row + height && col >= u.col && col < u.col + width;
  });
}

export function DeploymentScreen() {
  const mode = useGame((s) => s.mode);
  const puzzleId = useGame((s) => s.puzzleId);
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
  const moveTo = useGame((s) => s.moveTo);
  const clearAll = useGame((s) => s.clearAll);
  const autoFill = useGame((s) => s.autoFill);
  const ready = useGame((s) => s.ready);
  const backHome = useGame((s) => s.backHome);

  const kit = useMemo(() => activeKit({ mode, puzzleId }), [mode, puzzleId]);
  const puzzle = useMemo(() => activePuzzle({ mode, puzzleId }), [mode, puzzleId]);

  const [hovered, setHovered] = useState<Coord | null>(null);

  /**
   * One pointer gesture, covering mouse, touch and pen.
   *
   * This is what makes the arc preview reachable on a phone at all: hover does
   * not exist on touch, so without a drag there was no way to see a unit's
   * firing lane BEFORE committing it to a tile. The same gesture repositions a
   * unit that is already on the board.
   */
  const [drag, setDrag] = useState<DragState | null>(null);

  const beginDrag = useCallback(
    (type: UnitTypeId, facing: Direction, fromIndex: number | null, event: React.PointerEvent) => {
      setDrag({
        type,
        facing,
        fromIndex,
        tile: null,
        moved: false,
        startX: event.clientX,
        startY: event.clientY,
      });
    },
    [],
  );

  useEffect(() => {
    if (drag === null) return;

    const move = (event: PointerEvent) => {
      // A few pixels of slop, so a tap stays a tap.
      const far =
        Math.abs(event.clientX - drag.startX) > DRAG_SLOP ||
        Math.abs(event.clientY - drag.startY) > DRAG_SLOP;
      const tile = tileFromPoint(event.clientX, event.clientY);
      setDrag((d) => (d === null ? d : { ...d, tile, moved: d.moved || far }));
    };

    const finish = (event: PointerEvent) => {
      const tile = tileFromPoint(event.clientX, event.clientY);
      setDrag((d) => {
        // A gesture that never moved is a tap — leave it to the click handler.
        if (d === null || !d.moved || tile === null) return null;

        if (d.fromIndex === null) {
          place(tile.row, tile.col);
          return null;
        }

        // A drag that ends on the tile it started from is a tap with a shaky
        // finger, not a move. Without this it "moved" the unit onto itself —
        // a no-op that also skipped selection, so the arc preview appeared on
        // some taps and not others.
        const held = deployment.units[d.fromIndex];
        if (held !== undefined && held.row === tile.row && held.col === tile.col) {
          selectPlaced(d.fromIndex);
          return null;
        }

        moveTo(d.fromIndex, tile.row, tile.col);
        return null;
      });
    };

    const cancel = () => setDrag(null);

    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", finish);
    window.addEventListener("pointercancel", cancel);
    return () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", finish);
      window.removeEventListener("pointercancel", cancel);
    };
  }, [drag, place, moveTo, selectPlaced, deployment.units]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "r" || e.key === "R") {
        e.preventDefault();
        rotateSelected();
      }
      if (e.key === "Escape") {
        selectType(null);
        selectPlaced(null);
        setDrag(null);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [rotateSelected, selectType, selectPlaced]);

  const selectedUnit: PlacedUnit | null =
    selectedIndex !== null ? (deployment.units[selectedIndex] ?? null) : null;

  /** Where the piece under the cursor or finger would land, if anywhere. */
  const dragTile = drag?.moved ? drag.tile : null;
  const pending: PlacedUnit | null =
    drag !== null && dragTile !== null
      ? { type: drag.type, row: dragTile.row, col: dragTile.col, facing: drag.facing }
      : selectedType !== null && hovered !== null
        ? { type: selectedType, row: hovered.row, col: hovered.col, facing: selectedFacing }
        : null;

  const pendingLegal =
    pending !== null &&
    canPlace(
      activeTeam,
      pending.type,
      pending.row,
      pending.col,
      deployment.units,
      drag?.fromIndex ?? -1,
    );

  const preview = useMemo(() => {
    // While a unit is being moved, preview it from the NEW tile with its old
    // position excluded — otherwise it blocks its own line of sight.
    if (pending !== null && pendingLegal) {
      const lifted = drag?.fromIndex;
      const others =
        lifted == null ? deployment.units : deployment.units.filter((_, i) => i !== lifted);
      return arcPreview(activeTeam, others, pending);
    }
    if (selectedUnit !== null) return arcPreview(activeTeam, deployment.units, selectedUnit);
    return { covered: [], blocked: [], deadZone: [] };
  }, [activeTeam, deployment.units, selectedUnit, pending, pendingLegal, drag?.fromIndex]);

  const lifted = drag?.moved ? drag.fromIndex : null;

  const units: RenderUnit[] = toRenderUnits(deployment.units, activeTeam)
    // The unit being moved is lifted off its old tile, so the ghost reads as
    // "this is where it goes" rather than showing two of the same piece.
    .filter((u) => lifted === null || u.index !== lifted)
    .map((u) => ({ ...u, selected: u.index === selectedIndex }));

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

  if (pending !== null && pendingLegal) {
    units.push({
      key: "ghost",
      type: pending.type,
      team: activeTeam,
      row: pending.row,
      col: pending.col,
      facing: pending.facing,
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
        {/*
          Fills the dead space above the board on a phone, and closes a real gap
          while it is there: until this existed there was no way out of a match
          short of finishing it.
        */}
        <div className="board-topbar">
          <button type="button" className="ghost-btn" onClick={backHome}>
            <span aria-hidden="true">←</span> Menu
          </button>
          <span className="topbar-title">
            {mode === "hotseat"
              ? `${activeTeam === "A" ? "Blue" : "Orange"} deploys`
              : "Your deployment"}
          </span>
          <span className="topbar-actions">
            <button
              type="button"
              className="ghost-btn"
              onClick={clearAll}
              disabled={deployment.units.length <= 1}
            >
              <span aria-hidden="true">⟲</span> Reset
            </button>
            {/* Fullscreen lives in the bar rather than floating over the board,
                so the row above the battlefield holds every screen-level
                control instead of two competing for the same corner. */}
            <DisplayControls />
          </span>
        </div>
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
          hovered={dragTile ?? hovered}
          hoverLegal={pending === null ? true : pendingLegal}
          onTileEnter={(row, col) => setHovered({ row, col })}
          onTileLeave={() => setHovered(null)}
          onTilePointerDown={(row, col, event) => {
            // Dragging a piece already on the board repositions it.
            if (selectedType !== null) return;
            const index = unitIndexAt(deployment.units, row, col);
            const unit = index >= 0 ? deployment.units[index] : undefined;
            // The HQ is placed automatically and cannot be picked up.
            if (unit === undefined || unit.type === "hq") return;
            beginDrag(unit.type, unit.facing, index, event);
          }}
          onTileClick={(row, col) => {
            /*
              An occupied tile always INSPECTS what stands there; placement only
              ever targets empty ground.

              Previously a tap with a roster type still selected tried to place
              on top of the unit, failed silently because the tile was taken,
              and so never selected it — no arc preview, and nothing for the
              facing control to rotate. Since a type stays selected while you
              still have that unit left, this failed most of the time and
              worked right after you ran out of one: the "sometimes" behaviour.
            */
            const index = unitIndexAt(deployment.units, row, col);
            if (index >= 0) {
              // The HQ is automatic; there is nothing to adjust on it.
              if (deployment.units[index]?.type !== "hq") selectPlaced(index);
              return;
            }
            if (selectedType !== null) place(row, col);
          }}
          onUnitClick={(unit) => {
            if (unit.type === "hq") return;
            if (unit.team !== activeTeam) return;
            const index = unitIndexAt(deployment.units, unit.row, unit.col);
            if (index >= 0) selectPlaced(index);
          }}
        />
        <p className="hint board-note">
          {puzzle !== null
            ? "The enemy formation is fully visible. Work out the placement that beats it."
            : "Drag a unit onto the board to see its firing lane before you commit, and drag a placed one to move it. Both HQs are fixed and public; everything else stays hidden until the reveal."}
        </p>
      </div>

      <ArmyPanel
        team={activeTeam}
        kit={kit}
        readyLabel={mode === "hotseat" ? "Ready" : "Fight"}
        deployment={deployment}
        selectedType={selectedType}
        selectedUnit={selectedUnit}
        currentFacing={selectedUnit?.facing ?? selectedFacing}
        coverage={{
          covered: preview.covered.length,
          shadowed: preview.blocked.length,
          dead: preview.deadZone.length,
        }}
        onSelectType={selectType}
        onBeginDrag={beginDrag}
        onRotate={rotateSelected}
        onRemove={() => selectedIndex !== null && removeAt(selectedIndex)}
        onClear={clearAll}
        onAutoFill={autoFill}
        onReady={ready}
      />
    </div>
  );
}
