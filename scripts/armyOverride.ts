/**
 * Experiment support: override army composition from the command line.
 *
 *   --army soldier:3,mg:4
 *
 * MVP_ARMY and PLACEABLE_ARMY hold the SAME entry objects (the latter is a
 * filter of the former), so mutating a count here is seen by both. Counts only
 * — adding or removing a unit type would need a real config change.
 */

import { MVP_ARMY } from "../src/game/config/units.ts";

export function applyArmyOverride(args: string[]): string {
  const i = args.indexOf("--army");
  if (i === -1) return "default";
  const spec = args[i + 1];
  if (spec === undefined) return "default";

  for (const part of spec.split(",")) {
    const [type, raw] = part.split(":");
    const count = Number(raw);
    if (type === undefined || !Number.isFinite(count)) continue;
    const entry = MVP_ARMY.find((e) => e.type === type);
    if (entry !== undefined) (entry as { count: number }).count = count;
  }
  return MVP_ARMY.map((e) => `${e.type}:${e.count}`).join(" ");
}
