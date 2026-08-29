import type { Direction, Team, UnitTypeId } from "../game/types.ts";

/**
 * Shape coding, not colour coding.
 *
 * Every unit must be identifiable by glyph and silhouette alone, so colour is
 * never the only channel carrying meaning (§E.6). This also means the board
 * still reads correctly in greyscale.
 */
export const GLYPH: Record<UnitTypeId, string> = {
  soldier: "●",
  mg: "▲",
  tank: "■",
  mortar: "◆",
  sandbag: "▬",
  hq: "★",
};

const CHEVRON: Record<Direction, string> = {
  N: "▲",
  E: "▶",
  S: "▼",
  W: "◀",
};

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
    <div className={classes} onClick={onClick} role={onClick ? "button" : undefined}>
      {GLYPH[type]}
      {showFacing && !isStructure && <span className={`facing ${facing}`}>{CHEVRON[facing]}</span>}
      {hpFraction < 1 && !destroyed && (
        <span className="hpbar">
          <i className={barClass} style={{ width: `${Math.max(0, hpFraction) * 100}%` }} />
        </span>
      )}
    </div>
  );
}
