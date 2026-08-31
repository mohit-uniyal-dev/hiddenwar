import { useEffect, useState } from "react";
import { DisplayControls } from "./components/DisplayControls.tsx";
import { SharePanel } from "./components/SharePanel.tsx";
import { BOARD } from "./game/config/gameConfig.ts";
import { DIFFICULTIES, type Difficulty } from "./game/content/formations.ts";
import { PUZZLES } from "./game/content/puzzles.ts";
import { BattleScreen } from "./screens/Battle.tsx";
import { DeploymentScreen } from "./screens/Deployment.tsx";
import { ResultsScreen } from "./screens/Results.tsx";
import { shareCode, useGame } from "./store/gameStore.ts";

/**
 * Board dimensions reach the stylesheet from the rules, so the tile size can
 * never drift out of sync with the actual grid.
 *
 * They go on the DOCUMENT element, not on `.app`, and that distinction is the
 * whole point. `--tile` is declared on `:root`, and a custom property resolves
 * its `var()` references against the element it is declared on — so with the
 * dimensions living on `.app`, `--tile` fell back to `var(--board-rows, 11)`
 * and sized every tile for eleven rows on a board that has nine. Tiles were
 * about 18% smaller than the viewport allowed, on a layout whose whole reason
 * for being 8 columns wide is hitting a 44px touch target.
 *
 * Set at module scope so it lands before first paint rather than after it.
 */
document.documentElement.style.setProperty("--board-cols", String(BOARD.cols));
document.documentElement.style.setProperty("--board-rows", String(BOARD.rows));

/**
 * Puzzle mode is built, tested and working — just not surfaced yet. Flip to
 * true to bring it back; nothing else needs to change.
 */
const SHOW_PUZZLES = false;

/**
 * Pull a match out of the address bar, once, on load.
 *
 * The code rides in the fragment, so it never reaches a server and the whole
 * exchange works on static hosting. The fragment is cleared as soon as it is
 * read: leaving it in place means a reload silently restarts the match and
 * throws away whatever the player had deployed since.
 */
function useIncomingCode(): string | null {
  const openCode = useGame((s) => s.openCode);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const match = /[#?]c=([A-Za-z0-9_-]+)/.exec(window.location.hash + window.location.search);
    const code = match?.[1];
    if (code === undefined) return;
    window.history.replaceState(null, "", window.location.pathname);
    const result = openCode(code);
    if (!result.ok) setError(result.reason);
  }, [openCode]);

  return error;
}

export function App() {
  const phase = useGame((s) => s.phase);
  const incomingError = useIncomingCode();

  // Short screens read better centred; the play screens must stay top-aligned
  // on a phone or the board is pushed off the bottom.
  const centred = phase === "home" || phase === "handoff";
  // Deployment uses a bottom-sheet layout on phones: the board centres in the
  // space above a fixed sheet, and expanding the sheet overlays it rather than
  // shifting it.
  const sheet = phase === "deploy";

  return (
    <div className={`app app-${phase}${centred ? " app-centred" : ""}${sheet ? " app-sheet" : ""}`}>
      {/* Deployment renders its own inside the board top bar. */}
      {phase !== "deploy" && <DisplayControls />}
      {phase === "home" && <HomeScreen incomingError={incomingError} />}
      {phase === "share" && <ShareScreen />}
      {phase === "deploy" && <DeploymentScreen />}
      {phase === "handoff" && <HandoffScreen />}
      {phase === "battle" && <BattleScreen />}
      {phase === "results" && <ResultsScreen />}
    </div>
  );
}

function HomeScreen({ incomingError }: { incomingError: string | null }) {
  const [difficulty, setDifficulty] = useState<Difficulty>("medium");
  const [pasted, setPasted] = useState("");
  const [openError, setOpenError] = useState<string | null>(null);
  const startChallenge = useGame((s) => s.startChallenge);
  const openCode = useGame((s) => s.openCode);
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

        <div className="panel">
          <h2>Play someone else</h2>
          <p className="menu-note">
            No account and no server — the whole match travels in a link. Deploy, send it, and they
            play you back whenever they get to it.
          </p>

          <div className="row-actions">
            <button type="button" className="primary" onClick={startChallenge}>
              Challenge a friend
            </button>
          </div>

          <div className="or-rule">
            <span>or</span>
          </div>

          <form
            className="code-entry"
            onSubmit={(event) => {
              event.preventDefault();
              const result = openCode(pasted);
              setOpenError(result.ok ? null : result.reason);
              if (result.ok) setPasted("");
            }}
          >
            <label htmlFor="open-code-field">Got a code or link?</label>
            <input
              id="open-code-field"
              value={pasted}
              spellCheck={false}
              autoComplete="off"
              placeholder="Paste it here"
              onChange={(event) => {
                setPasted(event.target.value);
                setOpenError(null);
              }}
            />
            <button type="submit" disabled={pasted.trim().length === 0}>
              Open
            </button>
          </form>
          {(openError ?? incomingError) !== null && (
            <p className="hint error-note">{openError ?? incomingError}</p>
          )}
        </div>
      </div>
    </>
  );
}

/**
 * Shown to a challenger once they commit: there is no opponent to fight yet,
 * so the army becomes something to send.
 */
function ShareScreen() {
  const code = useGame(shareCode);
  const backHome = useGame((s) => s.backHome);
  if (code === null) return null;

  return (
    <>
      <div className="title">
        <h1>Challenge sent</h1>
        <p>Your formation is locked and hidden inside the link</p>
      </div>
      <div className="menu menu-single">
        <SharePanel
          code={code}
          title="Send this to your opponent"
          blurb="They deploy against your formation without seeing it, and the battle resolves on their screen."
          footnote="They can send the finished match back so you can watch it too."
        />
        <div className="row-actions">
          <button type="button" onClick={backHome}>
            Menu
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
