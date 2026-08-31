import { useMemo, useState } from "react";
import { type SuggestedEdit, bestSingleEdit, buildDebrief } from "../game/engine/debrief.ts";
import type { BattleResult } from "../game/engine/simulate.ts";
import type { Coord, Deployment, Team } from "../game/types.ts";
import { UnitIcon } from "./UnitIcon.tsx";

interface Props {
  readonly result: BattleResult;
  readonly deployments: Record<Team, Deployment>;
  readonly seed: number;
  readonly craters: readonly Coord[];
  /** Hot seat debriefs either side; against the AI only Blue is the player. */
  readonly allowSideSwitch: boolean;
}

const NAME: Record<Team, string> = { A: "Blue", B: "Orange" };

/**
 * The debrief, which is where a loss becomes the next attempt.
 *
 * The report above this says what happened. This says what to change, and the
 * design constraint is that everything shown must be a fact about THIS battle —
 * a lane that produced nothing, a node that fell, a move that provably wins.
 * Generic advice would be worse than silence, because it would be spending the
 * player's next run on a guess.
 */
export function DebriefPanel({ result, deployments, seed, craters, allowSideSwitch }: Props) {
  // Default to whoever lost: they are the one with a question to answer.
  const [team, setTeam] = useState<Team>(result.winner === "A" ? "B" : "A");
  const [edit, setEdit] = useState<SuggestedEdit | null | "none">(null);
  const [searching, setSearching] = useState(false);

  const debrief = useMemo(() => buildDebrief(result.events, result.stats, team), [result, team]);

  const maxLane = Math.max(1, ...debrief.lanes.map((l) => Math.max(l.dealt, l.taken)));

  const findBestMove = (): void => {
    setSearching(true);
    // Yield a frame first: the search replays a few hundred whole battles, and
    // the button should visibly change before the main thread is taken.
    setTimeout(() => {
      const mine = deployments[team];
      const theirs = deployments[team === "A" ? "B" : "A"];
      const found = bestSingleEdit(mine, theirs, seed, craters, result);
      setEdit(found ?? "none");
      setSearching(false);
    }, 16);
  };

  const switchTo = (next: Team): void => {
    setTeam(next);
    setEdit(null);
  };

  return (
    <div className="debrief">
      <div className="debrief-head">
        <h2>Debrief</h2>
        {allowSideSwitch && (
          <div className="debrief-tabs">
            {(["A", "B"] as const).map((t) => (
              <button
                key={t}
                type="button"
                className={`debrief-tab team-${t} ${t === team ? "on" : ""}`}
                onClick={() => switchTo(t)}
              >
                {NAME[t]}
              </button>
            ))}
          </div>
        )}
      </div>

      {debrief.findings.map((finding) => (
        <div className="keymoment" key={finding}>
          {finding}
        </div>
      ))}

      <h3 className="debrief-sub">Column by column</h3>
      <p className="hint">
        Damage {NAME[team]} dealt from each column, and took in it. Nothing moves, so a column you
        left empty was conceded before the first shot.
      </p>
      <div className="lanes">
        {debrief.lanes.map((lane) => (
          <div className={`lane ${lane.units === 0 ? "empty" : ""}`} key={lane.col}>
            <div className="lane-bars">
              <span
                className="lane-dealt"
                style={{ height: `${(lane.dealt / maxLane) * 100}%` }}
                title={`${lane.dealt} dealt`}
              />
              <span
                className="lane-taken"
                style={{ height: `${(lane.taken / maxLane) * 100}%` }}
                title={`${lane.taken} taken`}
              />
            </div>
            <div className="lane-col">{lane.col + 1}</div>
            <div className="lane-units">
              {lane.units === 0 ? "—" : lane.dead ? "idle" : lane.units}
            </div>
          </div>
        ))}
      </div>

      <h3 className="debrief-sub">One move</h3>
      {edit === null ? (
        <>
          <p className="hint">
            Every legal single-piece change, replayed against the exact army they committed. This is
            a real search, not a hint.
          </p>
          <button type="button" onClick={findBestMove} disabled={searching}>
            {searching ? "Replaying…" : `Find ${NAME[team]}'s best single move`}
          </button>
        </>
      ) : edit === "none" ? (
        <div className="keymoment">
          No single move improves this result. The answer to that board needs more than one piece
          changed — or there wasn't one.
        </div>
      ) : (
        <div className={`keymoment one-move ${edit.wins ? "winning" : ""}`}>
          <strong>{edit.wins ? "This would have won it" : "Closest single move"}</strong>
          <span className={`report-unit-icon team-${team}`}>
            <UnitIcon type={edit.type as "soldier"} />
          </span>{" "}
          Move it from row {edit.from.row + 1}, column {edit.from.col + 1} to row {edit.to.row + 1},
          column {edit.to.col + 1}.
        </div>
      )}
    </div>
  );
}
