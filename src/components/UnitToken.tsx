import type { Direction, Team, UnitTypeId } from "../game/types.ts";
import { UnitIcon } from "./UnitIcon.tsx";

interface Props {
  type: UnitTypeId;
  team: Team;
  facing: Direction;
  /** Structures have no meaningful facing, so no chevron is drawn. */
  showFacing?: boolean;
  hpFraction?: number;
  destroyed?: boolean;
  selected?: boolean;
  justHit?: boolean;
  onClick?: (event: React.MouseEvent) => void;
}

export function UnitToken({
  type,
  team,
  facing,
  showFacing = true,
  hpFraction = 1,
  destroyed = false,
  selected = false,
  justHit = false,
  onClick,
}: Props) {
  const isStructure = type === "sandbag" || type === "hq";
  const classes = [
    "unit",
    `team-${team}`,
    `type-${type}`,
    type === "hq" ? "hq" : "",
    type === "sandbag" ? "structure" : "",
    destroyed ? "destroyed" : "",
    !destroyed && hpFraction < 0.3 ? "critical" : !destroyed && hpFraction < 0.6 ? "damaged" : "",
    selected ? "selected" : "",
    justHit ? "hit" : "",
  ]
    .filter(Boolean)
    .join(" ");

  const barClass = hpFraction < 0.3 ? "critical" : hpFraction < 0.6 ? "low" : "";

  return (
    <div
      className={classes}
      onClick={onClick}
      role={onClick ? "button" : undefined}
      aria-label={onClick ? type : undefined}
    >
      <span className="unit-art">
        <UnitIcon type={type} />
      </span>
      {showFacing && !isStructure && (
        <span className={`facing ${facing}`} aria-hidden="true">
          <svg viewBox="0 0 16 12">
            <title>Facing direction</title>
            <path d="M2 10 8 3l6 7" />
          </svg>
        </span>
      )}
      {hpFraction < 1 && !destroyed && (
        <span className="hpbar">
          <i className={barClass} style={{ width: `${Math.max(0, hpFraction) * 100}%` }} />
        </span>
      )}
    </div>
  );
}
