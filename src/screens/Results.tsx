import { useMemo } from "react";
import { Board, type RenderUnit } from "../components/Board.tsx";
import { DebriefPanel } from "../components/DebriefPanel.tsx";
import { UnitIcon } from "../components/UnitIcon.tsx";
import { archetypeById } from "../game/content/formations.ts";
import { PUZZLES, evaluatePuzzle } from "../game/content/puzzles.ts";
import { buildInsights } from "../game/engine/insights.ts";
import { activePuzzle, useGame } from "../store/gameStore.ts";

const REASON_TEXT: Record<string, string> = {
  hqDestroyed: "HQ destroyed",
  armyDestroyed: "Army wiped out",
  deadAir: "No damage for 5s — decided on tiebreak",
  timeCap: "45s time cap — decided on node damage",
  mutualHqDestruction: "Both HQs fell on the same tick",
};

export function ResultsScreen() {
  const result = useGame((s) => s.result);
  const rematch = useGame((s) => s.rematch);
  const backHome = useGame((s) => s.backHome);
  const mode = useGame((s) => s.mode);
  const puzzleId = useGame((s) => s.puzzleId);
  const aiArchetype = useGame((s) => s.aiArchetype);
  const startPuzzle = useGame((s) => s.startPuzzle);
  const deployments = useGame((s) => s.deployments);
  const matchSeed = useGame((s) => s.matchSeed);
  const craters = useGame((s) => s.craters);

  const puzzle = useMemo(() => activePuzzle({ mode, puzzleId }), [mode, puzzleId]);
  const outcome = useMemo(
    () => (puzzle === null || result === null ? null : evaluatePuzzle(puzzle, result)),
    [puzzle, result],
  );
  const aiShape = aiArchetype === null ? undefined : archetypeById(aiArchetype);

  const insights = useMemo(
    () => (result === null ? [] : buildInsights(result.events, result.stats)),
    [result],
  );

  if (result === null) return null;
  const { stats } = result;

  const puzzleIndex = puzzle === null ? -1 : PUZZLES.findIndex((p) => p.id === puzzle.id);
  const nextPuzzleId =
    puzzleIndex >= 0 && puzzleIndex < PUZZLES.length - 1
      ? (PUZZLES[puzzleIndex + 1]?.id ?? null)
      : null;

  const units: RenderUnit[] = stats.units.map((u) => ({
    key: String(u.id),
    type: u.type,
    team: u.team,
    row: u.row,
    col: u.col,
    facing: u.facing,
    hpFraction: u.maxHp === 0 ? 1 : u.hpRemaining / u.maxHp,
    destroyed: !u.survived,
  }));

  const winnerClass = result.winner === "A" ? "a" : result.winner === "B" ? "b" : "";
  const winnerText =
    result.winner === "draw" ? "Draw" : `${result.winner === "A" ? "Blue" : "Orange"} wins`;

  const laneClass = stats.laneOpenings >= 2 && stats.laneOpenings <= 6 ? "good" : "bad";
  const idleClass = stats.idleUnitPercent < 15 ? "good" : "bad";
  const durationOk = result.durationSeconds >= 15 && result.durationSeconds <= 30;

  return (
    <div className="screen">
      <div className="board-wrap">
        <Board units={units} />
        <p className="hint" style={{ color: "#cfc4ab", textAlign: "center" }}>
          Final positions. Faded units were destroyed.
        </p>
      </div>

      <div className="panel report">
        <div className="verdict">
          <div className={`who ${winnerClass}`}>{winnerText}</div>
          <div className="why">
            {REASON_TEXT[result.reason] ?? result.reason} · {result.durationSeconds.toFixed(1)}s
          </div>
        </div>

        {outcome !== null && puzzle !== null && (
          <div className={`puzzle-verdict ${outcome.solved ? "solved" : "failed"}`}>
            <div className="stamp">{outcome.solved ? "Solved" : "Not solved"}</div>
            <ul className="objectives">
              {outcome.checks.map((c) => (
                <li key={c.objective.label} className={c.passed ? "pass" : "fail"}>
                  {c.passed ? "✓" : "✗"} {c.objective.label}
                </li>
              ))}
            </ul>
            {!outcome.solved && <p className="brief-text">{puzzle.hint}</p>}
          </div>
        )}

        {aiShape !== undefined && (
          <div className="keymoment">
            <strong>They played: {aiShape.label}</strong>
            {aiShape.tell}
          </div>
        )}

        {insights.slice(0, 2).map((insight) => (
          <div className="keymoment" key={insight.label}>
            <strong>{insight.label}</strong>
            {insight.text}
          </div>
        ))}

        <div className="metrics">
          <div className={`metric ${durationOk ? "good" : "bad"}`}>
            <div className="v">{result.durationSeconds.toFixed(1)}s</div>
            <div className="k">Duration · target 15–30s</div>
          </div>
          <div className={`metric ${laneClass}`}>
            <div className="v">{stats.laneOpenings}</div>
            <div className="k">Lane openings · target 2–4</div>
          </div>
          <div className={`metric ${idleClass}`}>
            <div className="v">{stats.idleUnitPercent}%</div>
            <div className="k">Units that never fired · under 15%</div>
          </div>
          <div className="metric">
            <div className="v">
              {stats.teams.A.hqHpRemaining}/{stats.teams.B.hqHpRemaining}
            </div>
            <div className="k">HQ HP · blue / orange</div>
          </div>
        </div>

        {puzzle === null && (
          <DebriefPanel
            result={result}
            deployments={deployments}
            seed={matchSeed}
            craters={craters}
            allowSideSwitch={mode === "hotseat"}
          />
        )}

        <h2>Unit performance</h2>
        <table className="report-table">
          <thead>
            <tr>
              <th>Unit</th>
              <th>Dmg</th>
              <th>Kills</th>
              <th>Idle</th>
              <th>Fate</th>
            </tr>
          </thead>
          <tbody>
            {[...stats.units]
              .filter((u) => u.type !== "sandbag")
              .sort((a, b) => b.damageDealt - a.damageDealt || a.team.localeCompare(b.team))
              .map((u) => (
                <tr key={u.id} className={u.survived ? "" : "dead"}>
                  <td>
                    <span className={`report-unit-icon team-${u.team}`}>
                      <UnitIcon
                        type={u.type}
                        state={
                          !u.survived
                            ? "destroyed"
                            : u.hpRemaining / u.maxHp < 0.6
                              ? "damaged"
                              : "intact"
                        }
                      />
                    </span>{" "}
                    {u.name}
                  </td>
                  <td>{u.damageDealt}</td>
                  <td>{u.kills}</td>
                  <td>{u.idleSeconds.toFixed(1)}s</td>
                  <td>{u.survived ? `${u.hpRemaining} hp` : "lost"}</td>
                </tr>
              ))}
          </tbody>
        </table>

        <div className="row-actions">
          <button type="button" className="primary" onClick={rematch}>
            {puzzle === null ? "Rematch" : "Try again"}
          </button>
          {puzzle !== null && outcome?.solved === true && nextPuzzleId !== null && (
            <button type="button" onClick={() => startPuzzle(nextPuzzleId)}>
              Next puzzle
            </button>
          )}
          <button type="button" onClick={backHome}>
            Menu
          </button>
        </div>
        <p className="hint">
          {puzzle === null
            ? "Rematch reloads both formations exactly as they were, ready to edit. Change one thing and run it again."
            : "Your placement is reloaded exactly as it was. Move one piece and run it again."}
        </p>
      </div>
    </div>
  );
}
