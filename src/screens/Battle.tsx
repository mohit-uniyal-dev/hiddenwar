import { useEffect, useMemo, useRef, useState } from "react";
import { Board, type RenderUnit } from "../components/Board.tsx";
import { BOARD, TICKS_PER_SECOND } from "../game/config/gameConfig.ts";
import { type Frame, frameAt, hqKillTick } from "../game/engine/playback.ts";
import { useGame } from "../store/gameStore.ts";

/** Held after the last event so the final state is legible before the report. */
const HOLD_TICKS = 30;

const REASON_TEXT: Record<string, string> = {
  hqDestroyed: "HQ destroyed",
  armyDestroyed: "Army wiped out",
  deadAir: "No damage for 5s — decided on tiebreak",
  timeCap: "60s time cap — decided on tiebreak",
  mutualHqDestruction: "Both HQs fell on the same tick",
};
const COUNTDOWN_MS = 2600;

export function BattleScreen() {
  const result = useGame((s) => s.result);
  const finish = useGame((s) => s.finish);

  const [tick, setTick] = useState(0);
  const [speed, setSpeed] = useState(1);
  const [paused, setPaused] = useState(false);
  const [countdown, setCountdown] = useState(3);
  const raf = useRef<number>(0);
  const last = useRef<number>(0);
  const accumulated = useRef<number>(0);

  const source = useMemo(
    () =>
      result === null
        ? null
        : { events: result.events, units: result.stats.units, endedAtTick: result.endedAtTick },
    [result],
  );

  const hqKill = useMemo(() => (source === null ? null : hqKillTick(source)), [source]);

  // Reveal, then 3-2-1. The reveal is the highest emotional beat in the match,
  // so it is deliberately held longer than feels necessary (§A.5).
  useEffect(() => {
    const timers = [
      setTimeout(() => setCountdown(2), COUNTDOWN_MS * 0.34),
      setTimeout(() => setCountdown(1), COUNTDOWN_MS * 0.56),
      setTimeout(() => setCountdown(0), COUNTDOWN_MS * 0.78),
      setTimeout(() => setCountdown(-1), COUNTDOWN_MS),
    ];
    return () => timers.forEach(clearTimeout);
  }, []);

  const endTick = (source?.endedAtTick ?? 0) + HOLD_TICKS;
  const finished = tick >= endTick;

  useEffect(() => {
    if (source === null || countdown >= 0 || paused || finished) return;

    const loop = (now: number) => {
      if (last.current === 0) last.current = now;
      const deltaMs = Math.min(now - last.current, 100);
      last.current = now;

      // The one slow-motion moment in the match: the shot that kills an HQ.
      // Exactly one, never more (§D.2).
      const nearHqKill = hqKill !== null && tick >= hqKill - 16 && tick <= hqKill + 12 ? 0.35 : 1;

      accumulated.current += (deltaMs / 1000) * TICKS_PER_SECOND * speed * nearHqKill;
      if (accumulated.current >= 1) {
        const advance = Math.floor(accumulated.current);
        accumulated.current -= advance;
        setTick((t) => Math.min(t + advance, endTick));
      }
      raf.current = requestAnimationFrame(loop);
    };

    raf.current = requestAnimationFrame(loop);
    return () => {
      cancelAnimationFrame(raf.current);
      last.current = 0;
    };
  }, [source, countdown, paused, finished, speed, hqKill, tick, endTick]);

  if (source === null || result === null) return null;

  const frame = frameAt(source, tick);
  const units: RenderUnit[] = frame.units.map((u) => ({
    key: String(u.report.id),
    type: u.report.type,
    team: u.report.team,
    row: u.report.row,
    col: u.report.col,
    facing: u.report.facing,
    hpFraction: u.hpFraction,
    destroyed: u.destroyed,
    justHit: u.ticksSinceHit !== null && u.ticksSinceHit <= 2,
  }));

  const totalStrength = frame.strength.A + frame.strength.B || 1;

  // Playback runs on past the last event so the final board is legible, but the
  // CLOCK must not — otherwise the battle screen reports a longer battle than
  // the report does.
  const shownTick = Math.min(tick, result.endedAtTick);
  const seconds = (shownTick / TICKS_PER_SECOND).toFixed(1);

  const winnerClass = result.winner === "A" ? "a" : result.winner === "B" ? "b" : "";
  const winnerText =
    result.winner === "draw" ? "Draw" : `${result.winner === "A" ? "Blue" : "Orange"} wins`;
  const reasonText = REASON_TEXT[result.reason] ?? result.reason;

  const status = finished
    ? { label: "BATTLE OVER", tone: "over" }
    : paused && countdown < 0
      ? { label: "PAUSED", tone: "paused" }
      : { label: `${seconds}s`, tone: "" };

  return (
    <div className="screen" style={{ flexDirection: "column", alignItems: "center" }}>
      <div className="hud">
        <div className="strength">
          <i className="a" style={{ width: `${(frame.strength.A / totalStrength) * 100}%` }} />
          <i className="b" style={{ width: `${(frame.strength.B / totalStrength) * 100}%` }} />
        </div>
        <div className="hud-meta">
          <span>BLUE {frame.strength.A}</span>
          <span className={status.tone}>{status.label}</span>
          <span>{frame.strength.B} ORANGE</span>
        </div>
      </div>

      <div className="board-wrap">
        <Board units={units}>
          <FxLayer frame={frame} />
          {countdown >= 0 && (
            <div className="countdown">{countdown === 0 ? "BATTLE" : countdown}</div>
          )}
          {/* The battle ending must be unmistakable. Before this existed the
              only signal was a button label quietly changing. */}
          {finished && (
            <div className="overlay end">
              {/* Text sits on its own panel rather than straight on the board,
                  so it never has to compete with the pieces underneath. */}
              <div className="card">
                <div className={`who ${winnerClass}`}>{winnerText}</div>
                <div className="why">{reasonText}</div>
                <div className="why">battle lasted {result.durationSeconds.toFixed(1)}s</div>
              </div>
            </div>
          )}
          {!finished && paused && countdown < 0 && (
            <div className="overlay">
              <div className="card">Paused</div>
            </div>
          )}
        </Board>
      </div>

      <div className="controls">
        <button type="button" onClick={() => setPaused((p) => !p)} disabled={finished}>
          {paused ? "Play" : "Pause"}
        </button>
        {[0.5, 1, 2].map((s) => (
          <button
            type="button"
            key={s}
            className={speed === s ? "on" : ""}
            onClick={() => setSpeed(s)}
            disabled={finished}
          >
            {s}×
          </button>
        ))}
        <button
          type="button"
          onClick={() => {
            setTick(0);
            accumulated.current = 0;
            setPaused(false);
          }}
        >
          {finished ? "Watch again" : "Restart"}
        </button>
        <button type="button" className="primary" onClick={finish}>
          {finished ? "Battle report →" : "Skip"}
        </button>
      </div>
    </div>
  );
}

/**
 * Tracers, shell arcs and explosions, drawn in board-space so the SVG scales
 * with the CSS tile size without any pixel measurement.
 */
function FxLayer({ frame }: { frame: Frame }) {
  const pos = new Map<number, { x: number; y: number }>();
  for (const u of frame.units) {
    const half = u.report.type === "hq" ? 1 : 0.5;
    pos.set(u.report.id, { x: u.report.col + half, y: u.report.row + half });
  }

  return (
    <svg
      className="fx-layer"
      viewBox={`0 0 ${BOARD.cols} ${BOARD.rows}`}
      preserveAspectRatio="none"
      aria-hidden="true"
    >
      <title>Battle effects</title>
      {frame.tracers.map((t) => {
        const from = pos.get(t.fromId);
        const to = pos.get(t.toId);
        if (from === undefined || to === undefined) return null;
        return (
          <line
            key={`t-${t.fromId}-${t.toId}-${t.age}`}
            className="tracer"
            x1={from.x}
            y1={from.y}
            x2={to.x}
            y2={to.y}
            opacity={1 - t.age / 5}
            vectorEffect="non-scaling-stroke"
          />
        );
      })}

      {frame.shells.map((s) => {
        const from = pos.get(s.sourceId);
        if (from === undefined) return null;
        const x = from.x + (s.col + 0.5 - from.x) * s.progress;
        const y = from.y + (s.row + 0.5 - from.y) * s.progress;
        // A shallow parabola so the shell visibly arcs over cover.
        const lift = Math.sin(s.progress * Math.PI) * 1.2;
        return (
          <g key={`s-${s.sourceId}-${s.row}-${s.col}`}>
            <line
              className="shell-arc"
              x1={from.x}
              y1={from.y}
              x2={s.col + 0.5}
              y2={s.row + 0.5}
              vectorEffect="non-scaling-stroke"
            />
            <circle className="shell" cx={x} cy={y - lift} r={0.16} />
          </g>
        );
      })}

      {frame.explosions.map((e) => (
        <circle
          key={`e-${e.row}-${e.col}-${e.age}`}
          className="boom"
          cx={e.col + 0.5}
          cy={e.row + 0.5}
          r={0.4 + e.age * 0.14}
          opacity={1 - e.age / 9}
          vectorEffect="non-scaling-stroke"
        />
      ))}
    </svg>
  );
}
