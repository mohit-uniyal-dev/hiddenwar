import { UNITS } from "../game/config/units.ts";
import type { Deployment, PlacedUnit, Team, UnitTypeId } from "../game/types.ts";
import { isComplete, remainingFor } from "../store/gameStore.ts";
import { GLYPH } from "./UnitToken.tsx";

const ORDER: UnitTypeId[] = ["soldier", "mg", "tank", "mortar", "sandbag", "hq"];

const PRIORITY_LABEL: Record<string, string> = {
  closest: "Nearest target",
  highestHp: "Highest HP in arc",
  infantryFirst: "Infantry first",
  cluster: "Largest cluster",
};

interface Props {
  team: Team;
  deployment: Deployment;
  selectedType: UnitTypeId | null;
  selectedUnit: PlacedUnit | null;
  onSelectType: (type: UnitTypeId | null) => void;
  onRotate: () => void;
  onRemove: () => void;
  onClear: () => void;
  onAutoFill: () => void;
  onReady: () => void;
}

export function ArmyPanel({
  team,
  deployment,
  selectedType,
  selectedUnit,
  onSelectType,
  onRotate,
  onRemove,
  onClear,
  onAutoFill,
  onReady,
}: Props) {
  const left = remainingFor(deployment);
  const ready = isComplete(deployment);
  const inspect = selectedUnit !== null ? UNITS[selectedUnit.type] : null;

  return (
    <div className="panel army">
      <h2>{team === "A" ? "Blue Force" : "Orange Force"} — Army</h2>

      {ORDER.map((type) => {
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
          >
            <span className={`chip team-${team}`} style={chipStyle(team)}>
              {GLYPH[type]}
            </span>
            <span className="name">{spec.name}</span>
            <span className="count">{count > 0 ? `x${count}` : "—"}</span>
          </button>
        );
      })}

      {inspect !== null && selectedUnit !== null && (
        <div className="stat-block">
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
          <div className="row-actions">
            <button type="button" onClick={onRotate}>
              Rotate (R)
            </button>
            <button type="button" className="danger" onClick={onRemove}>
              Remove
            </button>
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

      <div className="row-actions">
        <button type="button" onClick={onAutoFill}>
          Auto-fill
        </button>
        <button type="button" onClick={onClear}>
          Clear
        </button>
      </div>
      <div className="row-actions">
        <button type="button" className="primary" disabled={!ready} onClick={onReady}>
          {ready ? "Ready" : `${countLeft(left)} left`}
        </button>
      </div>
      {ready && <p className="hint">Ready is irreversible — your facing choices lock in.</p>}
    </div>
  );
}

function countLeft(left: Map<UnitTypeId, number>): number {
  let total = 0;
  for (const n of left.values()) total += n;
  return total;
}

function chipStyle(team: Team): React.CSSProperties {
  return {
    background: team === "A" ? "var(--team-a)" : "var(--team-b)",
    color: team === "A" ? "#eaf2fb" : "#fdf1e4",
  };
}
