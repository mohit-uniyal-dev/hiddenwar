import { UNIT_SPRITES, type UnitVisualState } from "../assets/units/unitSprites.ts";
import type { UnitTypeId } from "../game/types.ts";

export type { UnitVisualState } from "../assets/units/unitSprites.ts";

interface Props {
  type: UnitTypeId;
  state?: UnitVisualState;
  className?: string;
}

/** Unit artwork shared by the board, roster and reports. */
export function UnitIcon({ type, state = "intact", className = "" }: Props) {
  const classes = `unit-icon unit-icon-${type} ${className}`.trim();

  return <img className={classes} src={UNIT_SPRITES[type][state]} alt="" draggable={false} />;
}
