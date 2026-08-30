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
| `pnpm test` | Vitest, 129 tests |
| `pnpm test:watch` | Vitest in watch mode |
| `pnpm typecheck` | `tsc --noEmit` |
| `pnpm lint` | Biome |
| `pnpm format` | Biome, writing fixes |
| `pnpm balance:sweep` | Play thousands of matches headlessly and print the §52 metrics. `--matches N`, `--seed N` |
| `node scripts/matrix.ts` | Archetype head-to-head matrix — answers "does anything beat this shape?" |

### Playing on a phone

The board and the unit picker are deliberately kept on screen **together** — a
layout where you pick a unit, scroll up to the board, then scroll back down is
responsive but not playable.

- **Portrait:** board on top, roster as one swipeable row of large tap targets
  beneath it. Tile size is derived from viewport width, capped so the board
  never overruns the screen.
- **Landscape:** the panel moves *beside* the board instead of stacking.
  Counter-intuitive but measured: stacking in landscape leaves so little height
  that tiles shrink to ~17px, whereas side by side gives ~36px — bigger than
  portrait manages.
- Touch has no `R` key and no hover, so **facing has its own always-visible
  control** rather than living inside the selected-unit panel, and the tall stat
  list collapses to a single line.

Honest limitation: 12 columns on a 360px-wide phone works out to ~28px tiles in
portrait, under the 44px touch guidance in §E.6. Landscape is the better way to
play on a small screen.

---

## Deploying

Pushing to `main` builds and publishes to GitHub Pages via
[.github/workflows/deploy.yml](.github/workflows/deploy.yml). Typecheck, lint and
the full test suite run *before* the build, so a broken commit fails the deploy
rather than shipping something your teammates then playtest.

**One-time setup:** in the repo, *Settings → Pages → Build and deployment →
Source* must be set to **GitHub Actions** (not "Deploy from a branch").

The site lands at `https://<user>.github.io/hiddenwar/`. Vite is configured with
`base: "./"`, so the same build also works at a domain root or opened straight
from the filesystem — nothing depends on the repo name.

---

## What works today

Three modes, all playable:

| Mode | What it is |
| --- | --- |
| **vs. AI** | Single player. The opposing army is **generated fresh each match** — a different legal formation every time. Three tiers (Recruit / Regular / Veteran) drawn from archetype pools ordered by *measured* head-to-head win rate, not by feel. |
| **Hotseat** | Two players, one device, secret deployment both ways. |
| *Puzzles* | 5 setups with a *visible* enemy and a small kit — a curriculum from facing through cones, cover and artillery. Built and tested; hidden behind `SHOW_PUZZLES` in [App.tsx](src/App.tsx). |

The AI reuses the same generator the balance sweep runs on, so every opponent it
produces is validated by the same rules a human deployment is. After the battle
the report names the shape it played and where that shape is weak.

The full loop from §F.2 of the roadmap:

```
Home  →  Blue deploys  →  hand off  →  Orange deploys  →  reveal + 3-2-1
      →  battle plays back  →  battle report  →  rematch (formations preloaded)
```

- **Deployment** — click to place, `R` to rotate, `Esc` to deselect, click a placed unit to rotate or remove it. Auto-fill and clear for fast iteration.
- **Both HQs are automatic, public, and drawn fresh each match** — each on its own rear rank, in **independently drawn columns**, visible from the start. You place 18 units, not 19. Guessing the HQ's location was never the interesting hidden information; guessing lanes and facings is. The draw is seeded and held steady across a rematch, so each match poses a different problem while edit-and-rerun still works.
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

**Two measured design fixes landed after the sweep found a solved formation.**

The sweep's head-to-head matrix showed the game had collapsed to a single lane: a formation that piled everything into the HQ column won **80%** overall and beat a front line 97-3, with no counter. Two causes, both now fixed:

1. **The HQ columns were mirrored**, so the lane you attack and the lane you defend were the same lane — one stack did both jobs. They are now drawn independently. (Measured alone: 80% → 56%.)
2. **The army had two tanks.** §C.4 costs the objective at "9.8s solo, ~5.6s with both tanks" — two tanks aligned on the HQ column end it before anything else matters. The army is now **5 soldiers / 3 MG / 1 tank / 1 mortar / 8 sandbags**.

Current state over 6,000 matches: top archetype **67%** (was 80%), front line competitive at 61%, and a real counter pair — lane guard beats HQ rush **90% to 2%**. Matches inside the 15–30s band went **13% → 36%**, with mean 21.4s and median 20.6s both in band. 89% end by HQ destruction; idle units 10.7%.

**Two things I tested and rejected**, recorded so nobody re-tries them: raising HQ HP made the rush *stronger* (73.6% at 200 HP → 79.2% at 400), and buffing splash barely touched it (73.6% → 70.4% at double strength) — §38's "punish clustering with splash" does not work at one mortar per army.

**Still open.** Lane openings run 6.78 against a 2–4 target. The machine gun is now the top damage dealer at 40.5%, having replaced the mortar's old dominance — worth watching that it does not become the new one. With a single tank, your only breacher never fires in ~15% of matches.

**Tuning levers, in preferred order** (§C.5): sandbag HP 60→45, tank cooldown 56→48 ticks, mortar cooldown 80→70. If battles end *too* fast, raise soldier HP 30→35 first — never slow the tanks, the breach cadence is the drama engine.

**One doc correction found by the tests.** §C.4 says a soldier "cannot realistically kill a tank" at ~40s. Precisely: it kills it at tick 790 (39.5s), which is *inside* the 60s cap. The claim is "too slow to matter", not "impossible".

**The HQ back-row exploit, found in playtest and now closed by geometry.** On the old board an HQ on the back row was reachable only by the enemy mortar, and since the tiebreak ladder checks HQ HP first, an untouched HQ won every stalemate automatically. It was patched with a placement rule, then the rule was **deleted** when the board shrank: with 4-deep zones and a 1-row gap a tank on the front rank covers the whole enemy zone, so every tile is contestable. Organic beats artificial. [reachability.test.ts](src/game/__tests__/reachability.test.ts) asserts every row stays inside tank range, so the sanctuary cannot silently reopen if a zone, gap, or range is ever changed.

**Weapon ranges deliberately left alone.** The layering is intentional — infantry hold the line, tanks reach mid-field, artillery reaches deep. Making distance ignore no man's land would also drop the mortar's minimum range below 3 against the enemy front rank, inverting its role.
