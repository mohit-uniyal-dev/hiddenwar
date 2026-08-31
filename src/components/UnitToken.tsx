import type { Team, UnitTypeId } from "../game/types.ts";
import { UnitIcon } from "./UnitIcon.tsx";

interface Props {
  type: UnitTypeId;
  team: Team;
  /** Footprint in tiles, so a multi-tile piece is drawn the size it occupies. */
  width?: number;
  height?: number;
  hpFraction?: number;
  destroyed?: boolean;
  selected?: boolean;
  justHit?: boolean;
  onClick?: (event: React.MouseEvent) => void;
}

/**
 * No facing chevron is drawn, because there is no facing to choose: every
 * weapon points at the enemy. An arrow that is identical on every friendly
 * piece is decoration that reads as information.
 */
export function UnitToken({
  type,
  team,
  width = 1,
  height = 1,
  hpFraction = 1,
  destroyed = false,
  selected = false,
  justHit = false,
  onClick,
}: Props) {
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
      // Sized from the unit's own footprint rather than a hardcoded rule. The
      // HQ was 2x2 when it became 1x2, so its token covered a column it did not
      // occupy — it hung off the board edge, it looked like units were placed
      // inside it, and it swallowed drag hit-tests aimed at the next column.
      style={
        width === 1 && height === 1
          ? undefined
          : ({ "--unit-w": width, "--unit-h": height } as React.CSSProperties)
      }
      onClick={onClick}
      role={onClick ? "button" : undefined}
      aria-label={onClick ? type : undefined}
    >
      <span className="unit-art">
        <UnitIcon type={type} />
      </span>
      {hpFraction < 1 && !destroyed && (
        <span className="hpbar">
          <i className={barClass} style={{ width: `${Math.max(0, hpFraction) * 100}%` }} />
        </span>
      )}
    </div>
  );
}
