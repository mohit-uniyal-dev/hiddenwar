import craterArt from "../assets/terrain/crater.webp";
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
  arc?: readonly Coord[];
  /** Tiles inside the footprint that cover shadows out. */
  arcBlocked?: readonly Coord[];
  /** Tiles too close to hit — inside minimum range. */
  arcDead?: readonly Coord[];
  /** Indestructible terrain. Blocks sight, cannot be built on or shot away. */
  craters?: readonly Coord[];
  /** Deployment zone that accepts clicks, or null in battle. */
  interactiveZone?: Team | null;
  hovered?: Coord | null;
  hoverLegal?: boolean;
  onTileEnter?: (row: number, col: number) => void;
  onTileLeave?: () => void;
  onTileClick?: (row: number, col: number) => void;
  onTilePointerDown?: (row: number, col: number, event: React.PointerEvent) => void;
  onUnitClick?: (unit: RenderUnit, event: React.MouseEvent) => void;
  /** Deployment drags read the tile under the finger off this element's rect. */
  ref?: React.Ref<HTMLDivElement>;
  children?: React.ReactNode;
}

const key = (c: Coord) => `${c.row}:${c.col}`;

export function Board({
  units,
  arc = [],
  arcBlocked = [],
  arcDead = [],
  craters = [],
  interactiveZone = null,
  hovered = null,
  hoverLegal = true,
  onTileEnter,
  onTileLeave,
  onTileClick,
  onTilePointerDown,
  onUnitClick,
  ref,
  children,
}: Props) {
  const arcSet = new Set(arc.map(key));
  const blockedSet = new Set(arcBlocked.map(key));
  const deadSet = new Set(arcDead.map(key));
  const craterSet = new Set(craters.map(key));
  const byTile = new Map<string, RenderUnit>();
  for (const u of units) byTile.set(key(u), u);

  const tiles = [];
  for (let row = 0; row < BOARD.rows; row++) {
    for (let col = 0; col < BOARD.cols; col++) {
      const owner = zoneOwner(row);
      const k = `${row}:${col}`;
      const unit = byTile.get(k);
      const isHovered = hovered?.row === row && hovered?.col === col;
      const isCrater = craterSet.has(k);
      const canInteract = interactiveZone !== null && owner === interactiveZone && !isCrater;

      const classes = [
        "tile",
        owner === "A" ? "zone-a" : owner === "B" ? "zone-b" : "nml",
        arcSet.has(k) ? "arc" : "",
        blockedSet.has(k) ? "arc-blocked" : "",
        !arcSet.has(k) && deadSet.has(k) ? "arc-dead" : "",
        isCrater ? "crater" : "",
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
          // Read back by document.elementFromPoint during a drag: pointer
          // events stay with the element the gesture started on, so the tile
          // under the finger has to be found by hit-testing.
          data-row={row}
          data-col={col}
          disabled={!canInteract}
          aria-label={
            isCrater
              ? `Blocked crater, row ${row + 1}, column ${col + 1}`
              : unit === undefined
                ? `Row ${row + 1}, column ${col + 1}`
                : `${UNITS[unit.type].name}, row ${row + 1}, column ${col + 1}`
          }
          onMouseEnter={() => onTileEnter?.(row, col)}
          onFocus={() => onTileEnter?.(row, col)}
          onMouseLeave={() => onTileLeave?.()}
          onClick={() => onTileClick?.(row, col)}
          onPointerDown={(e) => onTilePointerDown?.(row, col, e)}
        >
          {isCrater && <img className="crater-art" src={craterArt} alt="" draggable={false} />}
          {unit && (
            <UnitToken
              type={unit.type}
              team={unit.team}
              width={UNITS[unit.type].width}
              height={UNITS[unit.type].height}
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
    <div
      className="board"
      ref={ref}
      style={{
        // Driven from BOARD so the grid can never drift out of sync with the
        // rules the way a hardcoded `repeat(12, ...)` in CSS would.
        gridTemplateColumns: `repeat(${BOARD.cols}, var(--tile))`,
        gridTemplateRows: `repeat(${BOARD.rows}, var(--tile))`,
      }}
      onMouseLeave={() => onTileLeave?.()}
    >
      {tiles}
      <span className="zone-stamp zone-stamp-b">Orange territory</span>
      <span className="zone-stamp zone-stamp-nml">No man's land</span>
      <span className="zone-stamp zone-stamp-a">Blue territory</span>
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
