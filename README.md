# Hidden Front

> Battleship meets auto-chess in the trenches: secretly dig in your army, then watch two battle plans collide in thirty seconds.

A hidden-deployment tactical auto-battler. Two players secretly place a fixed army on their half of a 12×9 board. **Units never move.** Both sides commit, the board is revealed, and the battle resolves automatically from position, facing and firing lanes alone.

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
| `pnpm test` | Vitest, 110 tests |
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
- **Both HQs are automatic and public.** Neither player positions their own; both stand at a published centre-rear anchor and are visible from the start. You place 18 units, not 19. Guessing the HQ's location was never the interesting hidden information — guessing lanes and facings is.
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

**The board was reshaped from 12×14 to 12×9** after playtest feedback that everything had to go in the front two rows. It was worse than it felt: soldiers and MGs could reach *zero* enemy tiles from row 11 back, so seven of nine combat units competed for two rows while four rows held scenery. Zones went 6 → 4 deep and no man's land 2 → 1, because `useful infantry rows = weapon range − gap depth` and that formula does not contain zone depth — shrinking the zone alone removes dead space without widening the band.

**Balance improved sharply as a side effect.** On the symmetric fixture the mortar's share of all damage fell from **56% to 33%** (tank 29%, MG 21%, soldier 17%), and lane openings from 14 to 2. Open question #5 in the review — the mortar carrying turtle-breaker, splash-punisher and indirect-fire duty alone — largely resolved itself once infantry could reach the enemy at all.

**The open metric is duration.** Matches now run **31–47s** against a 15–30s target. Nothing has been tuned for it yet, deliberately: the levers below are guesses until someone plays a few dozen games.

**Tuning levers, in preferred order** (§C.5): sandbag HP 60→45, tank cooldown 56→48 ticks, mortar cooldown 80→70. If battles end *too* fast, raise soldier HP 30→35 first — never slow the tanks, the breach cadence is the drama engine.

**One doc correction found by the tests.** §C.4 says a soldier "cannot realistically kill a tank" at ~40s. Precisely: it kills it at tick 790 (39.5s), which is *inside* the 60s cap. The claim is "too slow to matter", not "impossible".

**The HQ back-row exploit, found in playtest and now closed by geometry.** On the old board an HQ on the back row was reachable only by the enemy mortar, and since the tiebreak ladder checks HQ HP first, an untouched HQ won every stalemate automatically. It was patched with a placement rule, then the rule was **deleted** when the board shrank: with 4-deep zones and a 1-row gap a tank on the front rank covers the whole enemy zone, so every tile is contestable. Organic beats artificial. [reachability.test.ts](src/game/__tests__/reachability.test.ts) asserts every row stays inside tank range, so the sanctuary cannot silently reopen if a zone, gap, or range is ever changed.

**Weapon ranges deliberately left alone.** The layering is intentional — infantry hold the line, tanks reach mid-field, artillery reaches deep. Making distance ignore no man's land would also drop the mortar's minimum range below 3 against the enemy front rank, inverting its role.
