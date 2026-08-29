import { BOARD, zoneOwner } from "../game/config/gameConfig.ts";
import { UNITS } from "../game/config/units.ts";
import type { Coord, Direction, PlacedUnit, Team, UnitTypeId } from "../game/types.ts";
import { UnitToken } from "./UnitToken.tsx";

export interface RenderUnit {
  key: string;
  type: UnitTypeId;
  team: Team;
  row: number;
  col: number;
  facing: Direction;
  hpFraction?: number;
  destroyed?: boolean;
  selected?: boolean;
  justHit?: boolean;
  index?: number;
}

interface Props {
  units: RenderUnit[];
  /** Tiles the selected weapon covers — drawn as grease-pencil marks. */
  arc?: Coord[];
  /** Tiles inside the footprint that cover shadows out. */
  arcBlocked?: Coord[];
  /** Deployment zone that accepts clicks, or null in battle. */
  interactiveZone?: Team | null;
  hovered?: Coord | null;
  hoverLegal?: boolean;
  onTileEnter?: (row: number, col: number) => void;
  onTileLeave?: () => void;
  onTileClick?: (row: number, col: number) => void;
  onUnitClick?: (unit: RenderUnit, event: React.MouseEvent) => void;
  children?: React.ReactNode;
}

const key = (c: Coord) => `${c.row}:${c.col}`;

export function Board({
  units,
  arc = [],
  arcBlocked = [],
  interactiveZone = null,
  hovered = null,
  hoverLegal = true,
  onTileEnter,
  onTileLeave,
  onTileClick,
  onUnitClick,
  children,
}: Props) {
  const arcSet = new Set(arc.map(key));
  const blockedSet = new Set(arcBlocked.map(key));
  const byTile = new Map<string, RenderUnit>();
  for (const u of units) byTile.set(key(u), u);

  const tiles = [];
  for (let row = 0; row < BOARD.rows; row++) {
    for (let col = 0; col < BOARD.cols; col++) {
      const owner = zoneOwner(row);
      const k = `${row}:${col}`;
      const unit = byTile.get(k);
      const isHovered = hovered?.row === row && hovered?.col === col;
      const canInteract = interactiveZone !== null && owner === interactiveZone;

      const classes = [
        "tile",
        owner === "A" ? "zone-a" : owner === "B" ? "zone-b" : "nml",
        arcSet.has(k) ? "arc" : "",
        blockedSet.has(k) ? "arc-blocked" : "",
        canInteract ? (hoverLegal ? "placeable" : "illegal") : "",
        isHovered ? "hovered" : "",
      ]
        .filter(Boolean)
        .join(" ");

      tiles.push(
        <button
          type="button"
          key={k}
          className={classes}
          disabled={!canInteract}
          onMouseEnter={() => onTileEnter?.(row, col)}
          onFocus={() => onTileEnter?.(row, col)}
          onMouseLeave={() => onTileLeave?.()}
          onClick={() => onTileClick?.(row, col)}
        >
          {unit && (
            <UnitToken
              type={unit.type}
              team={unit.team}
              facing={unit.facing}
              showFacing={UNITS[unit.type].pattern !== undefined}
              hpFraction={unit.hpFraction ?? 1}
              destroyed={unit.destroyed ?? false}
              selected={unit.selected ?? false}
              justHit={unit.justHit ?? false}
              onClick={(e) => {
                if (onUnitClick) {
                  e.stopPropagation();
                  onUnitClick(unit, e);
                }
              }}
            />
          )}
        </button>,
      );
    }
  }

  return (
    <div className="board" onMouseLeave={() => onTileLeave?.()}>
      {tiles}
      <div
        className="front-line"
        style={{ top: `calc(var(--tile) * ${BOARD.noMansLandRows[0]})` }}
      />
      <div
        className="front-line"
        style={{ top: `calc(var(--tile) * ${BOARD.noMansLandRows[1] + 1})` }}
      />
      {children}
    </div>
  );
}

export function toRenderUnits(units: readonly PlacedUnit[], team: Team): RenderUnit[] {
  return units.map((u, index) => ({
    key: `${team}-${index}`,
    type: u.type,
    team,
    row: u.row,
    col: u.col,
    facing: u.facing,
    index,
  }));
}
