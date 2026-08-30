import { BOTS } from "./game/content/bots.ts";
import { PUZZLES } from "./game/content/puzzles.ts";
import { BattleScreen } from "./screens/Battle.tsx";
import { DeploymentScreen } from "./screens/Deployment.tsx";
import { ResultsScreen } from "./screens/Results.tsx";
import { useGame } from "./store/gameStore.ts";

/**
 * Puzzle and single-player modes are built, tested and working — they are just
 * not surfaced while hotseat is the focus of playtesting. Flip these to true to
 * bring them back; nothing else needs to change.
 */
const SHOW_PUZZLES = false;
const SHOW_BOTS = false;

export function App() {
  const phase = useGame((s) => s.phase);

  return (
    <div className="app">
      {phase === "home" && <HomeScreen />}
      {phase === "deploy" && <DeploymentScreen />}
      {phase === "handoff" && <HandoffScreen />}
      {phase === "battle" && <BattleScreen />}
      {phase === "results" && <ResultsScreen />}
    </div>
  );
}

function HomeScreen() {
  const startHotseat = useGame((s) => s.startHotseat);
  const startBot = useGame((s) => s.startBot);
  const startPuzzle = useGame((s) => s.startPuzzle);

  return (
    <>
      <div className="title">
        <h1>Hidden Front</h1>
        <p>Secretly dig in your army — then watch two plans collide</p>
      </div>

      <div className="menu menu-single">
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

        {SHOW_BOTS && (
          <div className="panel">
            <h2>Single player</h2>
            <p className="menu-note">
              Deploy against a stored formation. It cannot see yours either.
            </p>
            {BOTS.map((b) => (
              <button type="button" key={b.id} className="army-row" onClick={() => startBot(b.id)}>
                <span className={`chip diff-${b.difficulty.toLowerCase()}`}>{b.difficulty[0]}</span>
                <span className="name">
                  {b.name}
                  <em>{b.blurb}</em>
                </span>
              </button>
            ))}
          </div>
        )}

        <div className="panel">
          <h2>Hotseat</h2>
          <p className="menu-note">
            Blue deploys, hands over the device, Orange deploys. Neither side sees the other until
            both are locked. Units never move once placed — position, facing and firing lanes decide
            everything. Both HQs are fixed and public, and their column is drawn fresh each match.
          </p>
          <div className="row-actions">
            <button type="button" className="primary" onClick={startHotseat}>
              Start match
            </button>
          </div>
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
