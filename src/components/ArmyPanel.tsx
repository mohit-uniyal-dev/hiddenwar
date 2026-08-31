import { useEffect, useRef, useState } from "react";
import { MVP_ARMY, type Roster, UNITS } from "../game/config/units.ts";
import type { Deployment, Direction, PlacedUnit, Team, UnitTypeId } from "../game/types.ts";
import { isComplete, remainingFor } from "../store/gameStore.ts";
import { UnitIcon } from "./UnitIcon.tsx";

const ORDER: UnitTypeId[] = ["soldier", "mg", "atgun", "tank", "mortar", "sandbag", "hq"];

const PRIORITY_LABEL: Record<string, string> = {
  closest: "Nearest target",
  highestHp: "Highest HP in arc",
  infantryFirst: "Infantry first",
  cluster: "Largest cluster",
};

const FACING_ARROW: Record<Direction, string> = { N: "▲", E: "▶", S: "▼", W: "◀" };

const UNIT_ROLE: Record<UnitTypeId, string> = {
  soldier: "Reliable rifle squad",
  mg: "Wide cone · anti-infantry",
  atgun: "Pierces every unit in its lane",
  tank: "Heavy armor · line breaker",
  mortar: "Indirect fire · splash",
  sandbag: "Cover · blocks sight",
  hq: "Protect at all costs",
};

interface Props {
  team: Team;
  /** The roster being placed: the Classic army, or a puzzle's smaller kit. */
  kit?: Roster;
  /** Puzzle mode has no "Ready" ceremony — the label reads differently. */
  readyLabel?: string;
  deployment: Deployment;
  selectedType: UnitTypeId | null;
  selectedUnit: PlacedUnit | null;
  /** Facing that will be used for the next placement, or of the selected unit. */
  currentFacing: Direction;
  /** Live counts from the arc preview, so coverage is never left to inference. */
  coverage?: { covered: number; shadowed: number; dead: number };
  onSelectType: (type: UnitTypeId | null) => void;
  /** Start dragging a fresh unit out of the roster onto the board. */
  onBeginDrag?: (
    type: UnitTypeId,
    facing: Direction,
    fromIndex: number | null,
    event: React.PointerEvent,
  ) => void;
  onRotate: () => void;
  onRemove: () => void;
  onClear: () => void;
  onAutoFill: () => void;
  onReady: () => void;
}

export function ArmyPanel({
  team,
  kit = MVP_ARMY,
  readyLabel = "Ready",
  deployment,
  selectedType,
  selectedUnit,
  currentFacing,
  coverage,
  onSelectType,
  onBeginDrag,
  onRotate,
  onRemove,
  onClear,
  onAutoFill,
  onReady,
}: Props) {
  // On a phone this panel is a bottom sheet: the roster and the primary action
  // stay visible, everything else lives behind the toggle.
  const [open, setOpen] = useState(false);

  // Selecting a piece on the board opens the sheet, because rotate and remove
  // live inside it. This has to nudge the same state the toggle owns — deriving
  // `open` from the selection instead would leave the collapse button inert
  // while anything was selected.
  useEffect(() => {
    if (selectedUnit !== null) setOpen(true);
  }, [selectedUnit]);

  /**
   * Publish the sheet's COLLAPSED height so the board can centre in exactly the
   * space above it.
   *
   * A hardcoded reservation was over-estimating and leaving a visible gap under
   * the board. Measuring only while collapsed is deliberate: expanding must not
   * move the battlefield.
   */
  const panelRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = panelRef.current;
    if (el === null || open) return;
    const publish = () =>
      document.documentElement.style.setProperty("--sheet-collapsed", `${el.offsetHeight}px`);
    publish();
    const observer = new ResizeObserver(publish);
    observer.observe(el);
    return () => observer.disconnect();
  }, [open]);

  const left = remainingFor(deployment, kit);
  const ready = isComplete(deployment, kit);
  // A puzzle kit lists only the pieces it hands you.
  const order = ORDER.filter((type) => kit.some((entry) => entry.type === type));
  const inspect = selectedUnit !== null ? UNITS[selectedUnit.type] : null;
  const remaining = countLeft(left);
  const rosterSize = kit.reduce((total, entry) => total + entry.count, 0);
  const placed = rosterSize - remaining;
  const forceName = team === "A" ? "Blue Force" : "Orange Force";

  return (
    <div ref={panelRef} className={`panel army team-${team} ${open ? "expanded" : ""}`}>
      <button
        type="button"
        className="sheet-grip"
        aria-expanded={open}
        aria-label={open ? "Collapse panel" : "Expand panel"}
        onClick={() => setOpen((v) => !v)}
      />
      <div className="army-heading">
        <span className="army-insignia">
          <UnitIcon type="hq" />
        </span>
        <span className="army-heading-copy">
          <small>Deployment command</small>
          <h2>{forceName}</h2>
        </span>
        <span className={`roster-status ${ready ? "ready" : ""}`}>
          {ready ? "Ready" : `${placed}/${rosterSize}`}
        </span>
        <button
          type="button"
          className="sheet-toggle"
          aria-expanded={open}
          onClick={() => setOpen((v) => !v)}
        >
          {open ? "Hide" : "Details"}
          <span aria-hidden="true">{open ? "▾" : "▴"}</span>
        </button>
      </div>

      <p className="panel-lead">Choose a unit, then place it in your territory.</p>

      <div className="roster">
        {order.map((type) => {
          const spec = UNITS[type];
          const count = left.get(type) ?? 0;
          const done = count === 0;
          return (
            <button
              type="button"
              key={type}
              className={`army-row ${selectedType === type ? "active" : ""} ${done ? "done" : ""}`}
              disabled={done}
              onClick={() => onSelectType(selectedType === type ? null : type)}
              onPointerDown={(event) => {
                if (done) return;
                // Selecting on press keeps a plain tap arming tap-to-place,
                // while a drag from the same press previews the arc on the way.
                onSelectType(type);
                onBeginDrag?.(type, currentFacing, null, event);
              }}
            >
              <span className={`chip unit-chip team-${team}`}>
                <UnitIcon type={type} />
              </span>
              <span className="name">
                {spec.name}
                <em>{UNIT_ROLE[type]}</em>
              </span>
              <span className="count">{count > 0 ? count : "✓"}</span>
            </button>
          );
        })}
      </div>

      {inspect !== null && selectedUnit !== null && (
        <div className="stat-block">
          <p className="stat-compact">
            <b>{inspect.name}</b>
            {inspect.damage !== undefined
              ? ` · range ${inspect.minRange}–${inspect.maxRange} · ${
                  PRIORITY_LABEL[inspect.priority ?? ""] ?? ""
                }`
              : " · blocks line of sight"}
          </p>
          <dl>
            <dt>Unit</dt>
            <dd>{inspect.name}</dd>
            <dt>HP</dt>
            <dd>{inspect.hp}</dd>
            {inspect.damage !== undefined && (
              <>
                <dt>Damage</dt>
                <dd>
                  {inspect.damage}
                  {inspect.maxTargets !== undefined ? ` x${inspect.maxTargets} targets` : ""}{" "}
                  {inspect.damageType}
                </dd>
                <dt>Range</dt>
                <dd>
                  {inspect.minRange}–{inspect.maxRange}
                </dd>
                <dt>Cooldown</dt>
                <dd>{((inspect.cooldownTicks ?? 0) / 20).toFixed(1)}s</dd>
                <dt>Targets</dt>
                <dd>{PRIORITY_LABEL[inspect.priority ?? ""] ?? "—"}</dd>
                <dt>Facing</dt>
                <dd>{selectedUnit.facing}</dd>
              </>
            )}
            {inspect.blocksLineOfSight === true && (
              <>
                <dt>Blocks</dt>
                <dd>line of sight (both sides)</dd>
              </>
            )}
          </dl>
          {coverage !== undefined && inspect.pattern !== undefined && (
            <div className="legend">
              <div className="row">
                <span className="sw covered" />
                <span>
                  can hit <b>{coverage.covered}</b> tiles
                </span>
              </div>
              {coverage.shadowed > 0 && (
                <div className="row">
                  <span className="sw shadowed" />
                  <span>
                    <b>{coverage.shadowed}</b> shadowed by your own cover
                  </span>
                </div>
              )}
              {coverage.dead > 0 && (
                <div className="row">
                  <span className="sw dead" />
                  <span>
                    <b>{coverage.dead}</b> too close — min range {inspect.minRange}
                  </span>
                </div>
              )}
            </div>
          )}

          <div className="row-actions">
            <button type="button" onClick={onRotate}>
              Rotate (R)
            </button>
            {selectedUnit.type !== "hq" && (
              <button type="button" className="danger" onClick={onRemove}>
                Remove
              </button>
            )}
          </div>
        </div>
      )}

      {selectedUnit === null && selectedType !== null && (
        <p className="hint">
          Click a tile in your zone to place. Press <b>R</b> to set facing before you place.
        </p>
      )}

      {selectedUnit === null && selectedType === null && (
        <p className="hint">
          Pick a unit to place, or click one already on the board to rotate or remove it.
        </p>
      )}

      <div className="row-actions tools">
        {/*
          Touch has no `R` key and no hover, so facing needs a visible control.
          It shares the tool row rather than taking a full-width bar of its own.
        */}
        {/*
          Says what it acts on. Unlabelled, it read as broken when nothing was
          selected: it was setting the facing for the NEXT placement, which is
          invisible until you place something.
        */}
        <button
          type="button"
          className="facing-control"
          onClick={onRotate}
          title={
            selectedUnit === null
              ? "Facing for the next unit you place (R)"
              : `Rotate this ${UNITS[selectedUnit.type].name} (R)`
          }
        >
          <span className={`facing-arrow ${currentFacing}`}>{FACING_ARROW[currentFacing]}</span>
          <span className="facing-label">{selectedUnit === null ? "Next" : "Rotate"}</span>
        </button>
        <button type="button" onClick={onAutoFill}>
          Auto-fill
        </button>
        <button type="button" onClick={onClear}>
          Clear
        </button>
      </div>
      <div className="row-actions">
        <button type="button" className="primary" disabled={!ready} onClick={onReady}>
          {ready ? readyLabel : `Deploy ${remaining} more`}
        </button>
      </div>
      {ready && readyLabel === "Ready" && (
        <p className="hint">Ready is irreversible — your facing choices lock in.</p>
      )}
    </div>
  );
}

function countLeft(left: Map<UnitTypeId, number>): number {
  let total = 0;
  for (const n of left.values()) total += n;
  return total;
}
