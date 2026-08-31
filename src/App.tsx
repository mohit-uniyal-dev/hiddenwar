import { useState } from "react";
import { DisplayControls } from "./components/DisplayControls.tsx";
import { BOARD } from "./game/config/gameConfig.ts";
import { DIFFICULTIES, type Difficulty } from "./game/content/formations.ts";
import { PUZZLES } from "./game/content/puzzles.ts";
import { BattleScreen } from "./screens/Battle.tsx";
import { DeploymentScreen } from "./screens/Deployment.tsx";
import { ResultsScreen } from "./screens/Results.tsx";
import { useGame } from "./store/gameStore.ts";

/**
 * Puzzle mode is built, tested and working — just not surfaced yet. Flip to
 * true to bring it back; nothing else needs to change.
 */
const SHOW_PUZZLES = false;

export function App() {
  const phase = useGame((s) => s.phase);

  // Short screens read better centred; the play screens must stay top-aligned
  // on a phone or the board is pushed off the bottom.
  const centred = phase === "home" || phase === "handoff";
  // Deployment uses a bottom-sheet layout on phones: the board centres in the
  // space above a fixed sheet, and expanding the sheet overlays it rather than
  // shifting it.
  const sheet = phase === "deploy";

  return (
    <div
      className={`app app-${phase}${centred ? " app-centred" : ""}${sheet ? " app-sheet" : ""}`}
      // Board dimensions reach the stylesheet from the rules, so the mobile
      // tile size can never drift out of sync with the actual grid.
      style={{ "--board-cols": BOARD.cols, "--board-rows": BOARD.rows } as React.CSSProperties}
    >
      {/* Deployment renders its own inside the board top bar. */}
      {phase !== "deploy" && <DisplayControls />}
      {phase === "home" && <HomeScreen />}
      {phase === "deploy" && <DeploymentScreen />}
      {phase === "handoff" && <HandoffScreen />}
      {phase === "battle" && <BattleScreen />}
      {phase === "results" && <ResultsScreen />}
    </div>
  );
}

function HomeScreen() {
  const [difficulty, setDifficulty] = useState<Difficulty>("medium");
  const selected = DIFFICULTIES.find((d) => d.id === difficulty);
  const startHotseat = useGame((s) => s.startHotseat);
  const startAi = useGame((s) => s.startAi);
  const startPuzzle = useGame((s) => s.startPuzzle);

  return (
    <>
      <div className="title">
        <h1>Hidden Front</h1>
        <p>Secretly dig in your army — then watch two plans collide</p>
      </div>

      <div className={`menu ${SHOW_PUZZLES ? "" : "menu-single"}`}>
        {SHOW_PUZZLES && (
          <div className="panel">
            <h2>Puzzles</h2>
            <p className="menu-note">
              A visible enemy formation and a small kit. Work out the placement that beats it.
            </p>
            {PUZZLES.map((p, i) => (
              <button
                type="button"
                key={p.id}
                className="army-row"
                onClick={() => startPuzzle(p.id)}
              >
                <span className="chip puzzle-chip">{i + 1}</span>
                <span className="name">{p.name}</span>
                <span className="count">{p.teaches}</span>
              </button>
            ))}
          </div>
        )}

        <div className="panel">
          <h2>New match</h2>
          <p className="menu-note">
            Units never move once placed — position, facing and firing lanes decide everything. Both
            HQs are fixed and public, and each side's column is drawn fresh every match.
          </p>

          <div className="row-actions">
            <button type="button" className="primary" onClick={startHotseat}>
              Start match
            </button>
          </div>
          <p className="hint">
            Hotseat: Blue deploys, hands over the device, Orange deploys. Neither side sees the
            other until both are locked.
          </p>

          <div className="or-rule">
            <span>or</span>
          </div>

          <div className="controls segmented">
            {DIFFICULTIES.map((d) => (
              <button
                type="button"
                key={d.id}
                className={difficulty === d.id ? "on" : ""}
                onClick={() => setDifficulty(d.id)}
              >
                {d.label}
              </button>
            ))}
          </div>
          <div className="row-actions">
            <button type="button" onClick={() => startAi(difficulty)}>
              vs. AI
            </button>
          </div>
          <p className="hint keep-on-mobile">{selected?.blurb}</p>
        </div>
      </div>
    </>
  );
}

function HandoffScreen() {
  const proceed = useGame((s) => s.proceedToDeploy);
  return (
    <div className="handoff">
      <h2>Pass the device</h2>
      <p>
        Blue Force has committed. Their formation is hidden.
        <br />
        Hand the device to <b>Orange Force</b>.
      </p>
      <div style={{ marginTop: "1.5rem" }}>
        <button type="button" className="primary" onClick={proceed}>
          I am Orange — deploy
        </button>
      </div>
    </div>
  );
}
