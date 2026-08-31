import type { UnitTypeId } from "../../game/types.ts";
import atgunDamaged from "./atgun/atgun-damaged.png";
import atgunDestroyed from "./atgun/atgun-destroyed.png";
import atgunIntact from "./atgun/atgun-intact.png";
import hqDamaged from "./hq/hq-damaged.png";
import hqDestroyed from "./hq/hq-destroyed.png";
import hqIntact from "./hq/hq-intact.png";
import mgDamaged from "./mg/mg-damaged.png";
import mgDestroyed from "./mg/mg-destroyed.png";
import mgIntact from "./mg/mg-intact.png";
import mortarDamaged from "./mortar/mortar-damaged.png";
import mortarDestroyed from "./mortar/mortar-destroyed.png";
import mortarIntact from "./mortar/mortar-intact.png";
import sandbagDamaged from "./sandbag/sandbag-damaged.png";
import sandbagDestroyed from "./sandbag/sandbag-destroyed.png";
import sandbagIntact from "./sandbag/sandbag-intact.png";
import soldierDamaged from "./soldier/soldier-damaged.png";
import soldierDestroyed from "./soldier/soldier-destroyed.png";
import soldierIntact from "./soldier/soldier-intact.png";
import tankDamaged from "./tank/tank-damaged.png";
import tankDestroyed from "./tank/tank-destroyed.png";
import tankIntact from "./tank/tank-intact.png";

export type UnitVisualState = "intact" | "damaged" | "destroyed";

type StateSprites = Record<UnitVisualState, string>;

/** The complete artwork atlas used everywhere a unit is rendered. */
export const UNIT_SPRITES: Record<UnitTypeId, StateSprites> = {
  soldier: {
    intact: soldierIntact,
    damaged: soldierDamaged,
    destroyed: soldierDestroyed,
  },
  mg: { intact: mgIntact, damaged: mgDamaged, destroyed: mgDestroyed },
  atgun: {
    intact: atgunIntact,
    damaged: atgunDamaged,
    destroyed: atgunDestroyed,
  },
  tank: { intact: tankIntact, damaged: tankDamaged, destroyed: tankDestroyed },
  mortar: {
    intact: mortarIntact,
    damaged: mortarDamaged,
    destroyed: mortarDestroyed,
  },
  sandbag: {
    intact: sandbagIntact,
    damaged: sandbagDamaged,
    destroyed: sandbagDestroyed,
  },
  hq: { intact: hqIntact, damaged: hqDamaged, destroyed: hqDestroyed },
};
