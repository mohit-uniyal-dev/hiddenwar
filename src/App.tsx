import { BattleScreen } from "./screens/Battle.tsx";
import { DeploymentScreen } from "./screens/Deployment.tsx";
import { ResultsScreen } from "./screens/Results.tsx";
import { useGame } from "./store/gameStore.ts";

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
  const startMatch = useGame((s) => s.startMatch);
  return (
    <>
      <div className="title">
        <h1>Hidden Front</h1>
        <p>Secretly dig in your army — then watch two plans collide</p>
      </div>
      <div className="panel" style={{ maxWidth: "34rem" }}>
        <h2>Hotseat</h2>
        <p style={{ lineHeight: 1.6, fontSize: "0.92rem", margin: "0 0 1rem" }}>
          Blue deploys first, then hands the device to Orange. Neither side sees the other's
          formation until both are locked. Units never move once placed — everything is decided by
          position, facing and firing lanes.
        </p>
        <div className="row-actions">
          <button type="button" className="primary" onClick={startMatch}>
            Start match
          </button>
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
