# Hidden Front

> Battleship meets auto-chess in the trenches: secretly dig in your army, then watch two battle plans collide in thirty seconds.

A hidden-deployment tactical auto-battler. Two players secretly place a fixed army on their half of a 12×14 board. **Units never move.** Both sides commit, the board is revealed, and the battle resolves automatically from position, facing and firing lanes alone.

- **Design:** [hidden-front-game-design-roadmap.md](hidden-front-game-design-roadmap.md) — Part I is the canonical rulebook, Part II the tech stack, Part III the backlog.
- **Review:** [hidden-front-design-review.md](hidden-front-design-review.md) — findings, open questions, playtest plan.

---

## Running it

```bash
pnpm install
pnpm dev          # http://localhost:5173
```

| Script | Does |
| --- | --- |
| `pnpm dev` | Vite dev server |
| `pnpm build` | Typecheck + production bundle into `dist/` |
| `pnpm test` | Vitest, 109 tests |
| `pnpm test:watch` | Vitest in watch mode |
| `pnpm typecheck` | `tsc --noEmit` |
| `pnpm lint` | Biome |
| `pnpm format` | Biome, writing fixes |

---

## What works today

Three modes, all playable:

| Mode | What it is |
| --- | --- |
| **Puzzles** | 5 setups with a *visible* enemy and a small kit. A deliberate curriculum: facing → cones → cover → artillery → reach. Doubles as the tutorial. |
| **Single player** | 3 handcrafted bot formations (Easy/Medium). Their formation stays hidden until the reveal, same as a human's. |
| **Hotseat** | Two players, one device, secret deployment both ways. |

The full loop from §F.2 of the roadmap:

```
Home  →  Blue deploys  →  hand off  →  Orange deploys  →  reveal + 3-2-1
      →  battle plays back  →  battle report  →  rematch (formations preloaded)
```

- **Deployment** — click to place, `R` to rotate, `Esc` to deselect, click a placed unit to rotate or remove it. Auto-fill and clear for fast iteration.
- **Arc preview with LOS shadowing** — solid marks are tiles the unit can hit; faded marks are shadowed by *your own* cover. Shown as a ghost under the cursor before you commit.
- **Battle playback** — tracers, shell arcs, explosions, health bars, damage states, a live army-strength bar, pause / 0.5× / 1× / 2× / restart, and exactly one slow-motion moment (the shot that kills an HQ).
- **Battle report** — per-unit damage, kills and idle time, auto-generated tactical observations, and the two health metrics from §D.2.
- **Rematch** reloads both formations pre-placed for editing. This is the core loop, not a convenience.

Every bot formation is validated as a legal Classic army, and **every puzzle is proven solvable by running its reference solution through the real engine** — an unsolvable tutorial is worse than no tutorial.

Not built yet: online play of any kind, draft mode, searching AI, replay links, sound.

---

## Architecture

The one rule that matters:

```
src/game/   →  headless. No React, no DOM, no browser.
src/        →  everything else may import it, never the reverse.
```

`simulateBattle()` runs a complete match in a bare Node process and returns an event log. The renderer and the battle report are two independent consumers of that one log — which is why the report's numbers can never disagree with what the player just watched.

```
Deployments ──▶ simulateBattle() ──▶ BattleEvent[] ──┬──▶ BattleRenderer
+ seed                                               └──▶ BattleReport
```

That boundary is what makes replays, headless AI, server-authoritative multiplayer and automated balance sweeps possible later **without a rewrite**. It is enforced by [architecture.test.ts](src/game/__tests__/architecture.test.ts), not by a lint rule — a lint rule can be switched off in a config file without anyone noticing.

```
src/
├── game/                    ← the engine (headless)
│   ├── config/              gameConfig.ts, units.ts, CONFIG_VERSION
│   ├── engine/              simulate, targeting, lineOfSight, damage,
│   │                        victory, geometry, state, stats, playback,
│   │                        preview, insights, events
│   ├── models/              deployment validation (runs client + server)
│   ├── rng/                 mulberry32
│   └── __tests__/           determinism, LOS, combat, architecture
├── components/              Board, UnitToken, ArmyPanel
├── screens/                 Deployment, Battle, Results
├── store/                   zustand + flow tests
└── styles/
```

---

## Determinism

The same inputs must produce the same battle forever, or replays, the AI, server-authoritative play and the balance suite all break. Four rules, all test-enforced:

1. **Integer ticks.** 20/sec. Cooldowns are integers; nothing fires between ticks.
2. **No `Math.sqrt` / `sin` / `cos` / `pow` in the engine.** IEEE-754 `+ - * /` are exactly specified and portable; the transcendental functions are *not* — they may differ between JS engines. Range checks compare squared integer distances.
3. **Stable iteration order.** Units carry integer ids assigned at deployment-lock; every targeting tie-break ends with `a.id - b.id`.
4. **One seeded RNG stream**, used *only* for tie-breaks. There is no damage variance. `Math.random` is banned in `src/game/`.

Protected by a golden-log snapshot: any unintentional change to battle resolution fails the moment it is made. Deliberate balance changes re-bless the snapshot on purpose.

---

## Notes for the next session

**The balance signal so far.** On the symmetric full-army test fixture, the mortar deals **56% of all damage** and takes 7 of 16 kills — it is the last combatant standing on both sides. The front lines annihilate each other in the first ~2.5 seconds and the mortars then duel for another 36. That is one arbitrary formation rather than a playtest, but it is exactly the failure mode flagged as open question #5 in the review: the mortar carries three jobs (turtle-breaker, splash-punisher, indirect fire) on a one-per-army unit. Worth watching before touching any other number.

The same fixture runs **39s** against a 15–30s target and produces **14 lane openings** against a target of 2–4. Both are visible on the battle report as red metrics.

**Tuning levers, in preferred order** (§C.5): sandbag HP 60→45, tank cooldown 56→48 ticks, mortar cooldown 80→70. If battles end *too* fast, raise soldier HP 30→35 first — never slow the tanks, the breach cadence is the drama engine.

**One doc correction found by the tests.** §C.4 says a soldier "cannot realistically kill a tank" at ~40s. Precisely: it kills it at tick 790 (39.5s), which is *inside* the 60s cap. The claim is "too slow to matter", not "impossible".

**The HQ back-row exploit, found in playtest and now closed.** Measured reachability of Blue's zone from any legal Orange placement: rows 9–10 are open to all four weapons, rows 11–12 to tanks and the mortar, and rows **13–14 to the mortar alone**. An HQ parked there was touchable by exactly one unit out of nineteen — and because the tiebreak ladder checks HQ HP first, an untouched HQ also won every stalemate automatically. The HQ may no longer sit on your back row; [reachability.test.ts](src/game/__tests__/reachability.test.ts) asserts every legal anchor stays inside tank range, so the sanctuary cannot silently reopen if a zone, gap, or range is ever changed.

**Ranges deliberately left alone.** No man's land costs every weapon two rows of reach, which looks like a bug and is not: infantry fight at the line, tanks reach mid-field, artillery reaches deep, and each unit gets a distinct spatial role. Making distance ignore the gap would also drop the mortar's minimum range below 3 against the enemy front rank, inverting its role. If playtests ever show idle units above 15%, the lever is narrowing no man's land to one row — not a global range buff.
