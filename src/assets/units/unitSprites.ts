import type { UnitTypeId } from "../../game/types.ts";
import atgunDamaged from "./atgun/atgun-damaged.webp";
import atgunDestroyed from "./atgun/atgun-destroyed.webp";
import atgunIntact from "./atgun/atgun-intact.webp";
import hqDamaged from "./hq/hq-damaged.webp";
import hqDestroyed from "./hq/hq-destroyed.webp";
import hqIntact from "./hq/hq-intact.webp";
import mgDamaged from "./mg/mg-damaged.webp";
import mgDestroyed from "./mg/mg-destroyed.webp";
import mgIntact from "./mg/mg-intact.webp";
import mortarDamaged from "./mortar/mortar-damaged.webp";
import mortarDestroyed from "./mortar/mortar-destroyed.webp";
import mortarIntact from "./mortar/mortar-intact.webp";
import sandbagDamaged from "./sandbag/sandbag-damaged.webp";
import sandbagDestroyed from "./sandbag/sandbag-destroyed.webp";
import sandbagIntact from "./sandbag/sandbag-intact.webp";
import soldierDamaged from "./soldier/soldier-damaged.webp";
import soldierDestroyed from "./soldier/soldier-destroyed.webp";
import soldierIntact from "./soldier/soldier-intact.webp";
import tankDamaged from "./tank/tank-damaged.webp";
import tankDestroyed from "./tank/tank-destroyed.webp";
import tankIntact from "./tank/tank-intact.webp";

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
