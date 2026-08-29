/**
 * Auto-generated tactical observations for the battle report.
 *
 * "The battle report should teach the player how to improve" (§21). Because the
 * simulation is rule-based, these explanations are free — we already know
 * exactly why every unit did what it did, so we can say so in words.
 *
 * Ordered by how much the player learns, not by how dramatic it sounds.
 */

import { TICKS_PER_SECOND } from "../config/gameConfig.ts";
import type { BattleEvent } from "./events.ts";
import type { MatchStats, UnitReport } from "./stats.ts";

export interface Insight {
  readonly label: string;
  readonly text: string;
}

const teamName = (team: string) => (team === "A" ? "Blue" : "Orange");
const secs = (ticks: number) => (ticks / TICKS_PER_SECOND).toFixed(1);

export function buildInsights(events: readonly BattleEvent[], stats: MatchStats): Insight[] {
  const insights: Insight[] = [];
  const byId = new Map<number, UnitReport>();
  for (const u of stats.units) byId.set(u.id, u);

  // --- 1. A shell that caught a cluster --------------------------------------
  // The most teachable moment in the game: spreading out is a real decision.
  const killsByTick = new Map<number, number[]>();
  for (const e of events) {
    if (e.type !== "UNIT_DESTROYED") continue;
    const list = killsByTick.get(e.tick) ?? [];
    list.push(e.unitId);
    killsByTick.set(e.tick, list);
  }
  const landings = events.filter((e) => e.type === "SHELL_LANDED");
  let bestShell: { tick: number; count: number; team: string } | null = null;
  for (const landing of landings) {
    if (landing.type !== "SHELL_LANDED") continue;
    const killed = (killsByTick.get(landing.tick) ?? []).filter((id) => {
      const u = byId.get(id);
      return u !== undefined && u.type !== "sandbag";
    });
    if (killed.length >= 2) {
      const source = byId.get(landing.sourceId);
      if (bestShell === null || killed.length > bestShell.count) {
        bestShell = {
          tick: landing.tick,
          count: killed.length,
          team: source?.team ?? "A",
        };
      }
    }
  }
  if (bestShell !== null) {
    insights.push({
      label: "Key moment",
      text: `${teamName(bestShell.team)}'s mortar destroyed ${bestShell.count} clustered units with one shell at ${secs(bestShell.tick)}s. Spread those units out.`,
    });
  }

  // --- 2. A unit that never fired --------------------------------------------
  // Planning effort with zero payoff — the single most useful thing to tell a
  // player who just lost (§D.2).
  const silent = stats.units
    .filter((u) => u.shotsFired === 0 && u.idleTicks > 0)
    .sort((a, b) => b.idleTicks - a.idleTicks);
  const worst = silent[0];
  if (worst !== undefined) {
    insights.push({
      label: "Wasted unit",
      text: `${teamName(worst.team)}'s ${worst.name} at row ${worst.row + 1}, col ${worst.col + 1} never fired a shot — nothing entered its arc for ${secs(worst.idleTicks)}s. Check its facing, or whether your own cover shadowed its lane.`,
    });
  } else {
    const idlest = [...stats.units]
      .filter((u) => u.shotsFired > 0 && u.idleTicks > TICKS_PER_SECOND * 3)
      .sort((a, b) => b.idleTicks - a.idleTicks)[0];
    if (idlest !== undefined) {
      insights.push({
        label: "Idle time",
        text: `${teamName(idlest.team)}'s ${idlest.name} spent ${secs(idlest.idleTicks)}s with a loaded weapon and no target in its arc.`,
      });
    }
  }

  // --- 3. What the wall actually bought --------------------------------------
  const blocked = { A: stats.teams.A.damageBlocked, B: stats.teams.B.damageBlocked };
  const heavier = blocked.A >= blocked.B ? "A" : "B";
  const amount = Math.max(blocked.A, blocked.B);
  if (amount > 0) {
    insights.push({
      label: "Cover",
      text: `${teamName(heavier)}'s structures absorbed ${amount} damage across ${stats.laneOpenings} breach${stats.laneOpenings === 1 ? "" : "es"}.`,
    });
  }

  // --- 4. Who actually won it -------------------------------------------------
  const top = [...stats.units].sort((a, b) => b.damageDealt - a.damageDealt)[0];
  if (top !== undefined && top.damageDealt > 0) {
    const totalDamage = stats.teams.A.damageDealt + stats.teams.B.damageDealt;
    const share = totalDamage === 0 ? 0 : Math.round((top.damageDealt / totalDamage) * 100);
    insights.push({
      label: "Top performer",
      text: `${teamName(top.team)}'s ${top.name} dealt ${top.damageDealt} damage — ${share}% of all damage in the battle — and killed ${top.kills}.`,
    });
  }

  return insights;
}
