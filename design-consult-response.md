# Hidden Front — Design Consult: Response

> Answer to [design-consult-brief.md](design-consult-brief.md) §7.
> Assumes the §6 fix (4-deep zones, 8×9 board) is applied. Every number is a
> starting point for the balance harness, with pass/fail targets stated so the
> sweep can verify rather than argue.

---

## 7.1 Diagnosis

**The symptom is "one right answer." The mechanism is that deployment is a single-variable optimisation problem against a public constant, with no counter-structure that makes the optimum punishable.**

Four missing mechanisms, in order of importance:

### 1. The game has a pure-strategy equilibrium, and creative games must not

The archetype table is not a balance problem, it is a game-theory diagnosis: "stack the enemy HQ column" beats *every* other archetype. When one strategy is best regardless of what the opponent does, the opponent's hidden formation is strategically irrelevant — and a game about hidden formations has made its own hidden information worthless.

Creativity requires that the best formation **depend on a read of the opponent** — a mixed-strategy equilibrium, where masters can legitimately disagree about the best plan on the same seed. Today two masters would build the identical board. That is the definition of solved.

Three reinforcing causes:

- **The most valuable information in the game is public.** The enemy HQ column is visible before placement. The "hidden" front hides only the things that don't decide games. The attacker knows exactly where to go; the defender does not know where the attack comes from — except they do, because it's their own HQ column.
- **Nothing in the ruleset scales against density.** Every weapon does fixed damage per shot regardless of how many enemies stand in the lane. A 10-unit column presents the same target profile as a 2-unit column to everything except mortar splash — and one mortar's throughput cannot tax a ten-unit stack no matter how the splash is buffed. Stacking has no cost. The fundamental dial in any deployment game is *concentration vs. dispersion*, and it is only a dial if both ends are punishable.
- **There is one objective reachable through one geometric channel.** All value flows to a single 2×2 target, so the strategy space projects down to a one-dimensional lane-allocation question with a known answer.

### 2. Piece placements are independent, not interdependent

The value of placing unit B almost never changes the value of already-placed unit A. The only interactions are sandbag LoS, mortar cluster-targeting, and MG priority — all weak.

Expression lives where a small alphabet composes into many sentences. When placements *combine* (crossfire arcs, screened lanes, bait), the number of meaningfully distinct formations explodes combinatorially. This is the opposite of "more options": adding units to a non-interacting system adds options **linearly**; adding one interaction rule **multiplies** the space. A bigger roster is the most expensive and least effective way to buy expression.

### 3. The reveal resolves all tension instantly

Determinism plus full information at reveal means the outcome is fixed — and *visibly* fixed — at second zero of the watch phase. Drama is the gap between what the viewer knows and what happens; that gap closes at reveal, and the remaining 25 seconds are epilogue.

This is an **information pacing** problem, not an agency problem. That distinction is decisive for evaluating the power-up proposal.

### 4. Drama is devalued by frequency

Lane openings run at ~8 per battle against a target of 2–4. A mid-battle event that happens eight times is texture, not a beat. Scarcity is a design resource.

### "More options" vs. "more expression", stated precisely

Expression =

- **(a)** multiple viable strategies whose ranking depends on the opponent's hidden choice (non-transitivity),
- **(b)** visible authorship — your board *looks* different from other players' boards, and you can watch your specific idea work or fail,
- **(c)** legible failure — a loss reads as "my idea was countered", which invites a next idea.

The current game fails (a) outright, fails (b) because all optimal boards converge on the same column, and half-delivers (c): determinism and replays are there, but losing to the same stack every time teaches "there is one answer", which kills the loop.

---

## 7.2 The player's three proposals

### Power-ups during the battle — **reject the literal proposal**

As stated this is the worst of the three ideas:

- It violates two commitments at once (agency ends at Ready; determinism, if drops or timing are random).
- It punishes the exact skill the game is about. If I can fix my plan mid-battle, planning matters less. **The player is asking to weaken deployment in a consult about making deployment richer.**
- On a phone, one-handed, during a 25-second battle, reactive input is a stress mechanic, not a drama mechanic.

The only versions that work are ones where all decisions are still made before Ready — pre-committed contingencies, scheduled events. But even those answer the wrong question, because the watch phase is flat for an information reason, not an agency reason: the viewer knows everything at 0:00.

**The correct fix is to make information, not decisions, unfold during the battle:**

- **Progressive reveal** (vs. AI and async PvP; impossible and unnecessary in hotseat): enemy pieces render as unidentified silhouettes until they first fire or take damage. Full formation is disclosed on the end screen and in replays, so reconstruction — the thing readability actually protects — is fully preserved. The battle becomes intelligence-gathering for the rerun, feeding edit-and-rerun directly. **Nothing in the simulation changes; it is a renderer feature.**
- **Structural beats** — the reserve wave and the two-front objective give the battle a shape: opening exchange, mid-battle landing, one front breaking. Drama by architecture, not by input.

Verdict: **do not build power-ups in any form**, including the deterministic pre-scripted form. Build progressive reveal.

### New units — **half right: the roster is missing exactly one unit *class***

The composition experiments look like they refute this ("three variants tested; dominant shape stayed at 70–78%"), but that measurement condemns *recombining existing* units — all of which lack the one property whose absence makes stacking dominant: **damage that scales with density**.

The splash buff failed for the same reason: splash scales with adjacency inside a small radius, capped by one mortar's 4-second cooldown. Buffing its magnitude cannot make its throughput proportional to a ten-unit sin. The measurement was correct; the conclusion "anti-density is impossible" would be wrong. What is needed is a weapon whose **per-shot output is linear in stack size**.

#### The one unit to add — the AT Gun (pierce lane weapon)

| Stat | Value |
| --- | --- |
| Count | 1 (swap: Machine Gun ×3 → ×2, keeping 18 total pieces) |
| HP | 40 |
| Damage | 12 to **every** enemy unit in its lane, per shot (×1.0 infantry / ×1.0 armour / ×0.75 structure) |
| Range | 1–8, line, width 1, fires only along its facing |
| Cooldown | 2.4s |
| Targeting | none needed — it hits everything in the lane; holds fire if the lane is empty |
| LoS | the line stops at the first sandbag/HQ/crater, damaging it |

Why exactly this design:

- **It makes concentration cost something, linearly.** Against an 8-deep stack in its lane it deals 96 per shot (~40 collective DPS); against a dispersed line it deals 12. That is the density dial the game is missing, and no tuning of existing units produces it — the problem is geometric, so the counter must be geometric.
- **Placing it is a read.** It fires only where it points, so its position and facing are a prediction of where the enemy committed. Call the lane right and it wins the game; call wrong and it idles. This is the first placement whose value depends primarily on the opponent's hidden choice — the seed of a mixed equilibrium. Idle-unit rate will rise above 8%; accept up to ~12% and have the debrief frame an idle AT gun as a **miscalled bet**, which is legible failure, not waste.
- **It is maximally readable.** One visible line; everything on it takes a hit. Sideways facings give enfilade fire across a broad front — a rich positional idea from one rule, and on-theme for a game called Hidden Front.
- **It closes a rock-paper-scissors wheel using pieces that already exist:**
  - Column Stack beats Broad Front (local superiority in one lane)
  - AT Gun beats Column Stack (pierce scales with depth)
  - Dispersion + sandbag screens beat the AT Gun (one hit per shot; the line stops at the first bag, and at 9 damage per shot it takes ~17s to chew through a 60 HP sandbag)
  - Mortar taxes screens and clusters (ignores cover, targets clusters)
  - Dispersion beats the mortar; the Stack beats dispersion. **The wheel closes.**

**Harness validation target:** at least one 3-cycle among generated archetypes where each pairwise edge is ≥55%, and the top archetype overall ≤55%.

**The finished roster:** Soldier ×5, MG ×2, AT Gun ×1, Tank ×1, Mortar ×1, Sandbag ×8 — 18 pieces, six combat types, ten combat units. **That is the cap.** Readability cost grows with the *square* of the type count, since every pair is a matchup the player must model. Discipline: every weapon is one geometric rule drawable as a board overlay, and no seventh type until the wheel is stable and players have exhausted it.

Explicitly **not** to add: an aura/spotter unit (the formation-synergy class already correctly cut — visible or not, multipliers on other units' stats fight readability), a second mortar-class unit, or any unit whose rule cannot be drawn as a shape on the grid.

### Splitting the HQ — **the best of the three; adopt it**

This deserves to be taken more seriously than the player probably realises, because of a property unique to this game: **"units never move" makes dual objectives a *hard* force-division requirement.**

In any movement game you kill objective A and walk to objective B, so split objectives only slow you down. Here, a stack that kills node A is then **permanently stranded** — its units physically cannot contribute to node B, ever. The no-movement identity, currently the source of the solvedness, becomes the enforcement mechanism for force division. This is the rare mechanic that is *stronger* in this game than in the games it comes from.

Formally, two objectives turn deployment into a **Colonel Blotto game** — allocation of hidden force across multiple fronts — and Blotto games famously have **no pure-strategy equilibrium**. 70/30 beats 50/50 on one front and loses the war to 40/60; every split is a bet about the opponent's split. That is precisely the missing mechanism. This is the structural half of the fix, as the AT Gun is the tactical half.

#### Concrete rules

- Replace the 2×2, 200 HP HQ with **two 1×2 (one column wide, two rows deep) HQ nodes, 100 HP each**, on the rear two rows. Columns drawn independently per side with a **minimum separation of 3 columns**. Both visible, auto-placed, blocking LoS — as today. Total footprint 4 tiles (unchanged), total HP 200 (unchanged). Front face on the second-to-last row, preserving the infantry-reachability arithmetic.
- **Win: destroy both enemy nodes**, or wipe all enemy combat units. The OR version ("destroy either") **must not ship** — it is strictly worse than today, since attack simply concentrates on whichever node is less defensible.
- **Hard cap at 45s.** At timeout: more total node damage dealt wins; tie → more surviving army HP; tie → the match seed decides. Fully deterministic.

#### Why this is not the rejected "raise HQ HP"

Total structure HP stays at 200. More importantly, that measurement showed longer battles let "a formation already winning its lane keep winning" — true *when there is one lane and winning it wins the game*. Under AND, winning your lane earns exactly one node and a pile of stranded units; the clock then works **against** the concentrator, because the opponent's untouched second front keeps producing damage toward the tiebreak. The mechanism is inverted, not ignored.

#### Failure modes, honestly

1. **Stalemates and timeout finishes rise.** A tiebreak verdict is less satisfying than an explosion. Mitigation: keep the tiebreak simple, visible during the battle (running damage bars per side), and deterministic. If the harness shows >30% of matches timing out, node HP comes down to 80.
2. **Tank alignment two-shots a node.** 40 × 1.5 = 60 heavy: an open lane kills a 100 HP node in two shots (~5.6s). Partially self-limiting — facing locks, so one tank threatens exactly one node, never both — and screened by sandbags/craters. Fallback levers: node HP 120, or heavy-vs-structure ×1.25.
3. **Board space and readability on portrait.** Two fronts must read at a glance. 1×2 vertical nodes cost no extra width, and two fronts *help* narrative readability. The minimum-separation rule is essential; nodes one column apart collapse back into a single front.
4. **Degenerate race meta** (both sides ignore defence and race single nodes). Under AND + damage tiebreak, the racer who also chipped the second node wins the timeout, so pure racing is dominated. Verify: "everything on one enemy node" should land ≤50%.

This does not repeat the rejected mirrored-columns change — all four node columns are drawn independently, so attack lanes and defence lanes never merge.

---

## 7.3 Ranked proposals

| Rank | Proposal | Impact | Complexity | Ratio |
| --- | --- | --- | --- | --- |
| 1 | **AT Gun** (pierce lane weapon) | High — breaks the measured dominant, installs the counter wheel, adds the first read-based placement | Low-med | **Best** |
| 2 | **Debrief layer**: per-unit damage-share bars, tap-a-corpse killer trace, "what changed vs. your last run", named/saved formations with records | Med-high — converts existing telemetry into the fuel of edit-and-rerun and legible failure | Low | **Best** |
| 3 | **Twin HQ nodes**, AND win, timeout tiebreak | Very high — removes the pure equilibrium structurally; creates fronts, narrative, and the Blotto layer | Medium | High |
| 4 | **Seeded mirrored terrain**: 2–4 indestructible craters per side, 180°-rotationally mirrored, drawn per match, excluded from node columns and rear ranks; block LoS both ways; mortar unaffected | High — every match a fresh puzzle, so one-right-answer can never be cached; boards become visually distinct | Low | High |
| 5 | **Progressive reveal** (async/AI only) | Med-high — fixes the foregone-conclusion watch phase; makes the rematch a mind-game | Low (renderer only) | High |
| 6 | **Sandbag rework**: 8 × 60 HP → **6 × 90 HP**, placeable in no man's land | Medium — pushes lane openings toward the 2–4 target by making each wall bigger and rarer; forward bags reshape lane geometry | Very low | High |
| 7 | **Reserve wave**: up to 3 non-sandbag units held at planning with chosen landing tiles; deploy at a fixed t=10s | Medium — a guaranteed mid-battle beat; anti-alpha-strike insurance; landing value depends on predicting the battle state | Medium | Medium |
| 8 | **Doctrine badges** (per-unit target-priority override) | Low-med — risks per-unit one-right-answers | Low-med | **Cut** |
| 9 | **HQ node self-defence** (10 dmg, range 2, 1.5s) | Low — anti-rush garnish | Very low | Contingency only |

**Build order:** ranks 1–2 together first — the AT Gun because it attacks the measured dominant directly and the harness can verify the wheel within a day, and the debrief because it is nearly free and every later feature pays into it. Then 3 (twin nodes) as its own iteration with a full sweep. Then 4 and 5. Then 6. Reserve wave only if watch-phase engagement still lags — and note honestly that it bends the *spirit* of "the board is fixed at Ready" even though it breaks no stated commitment: units still never move, all decisions precede Ready, the sim stays deterministic; a unit *appearing* is a deployment event, not movement. Defensible, but it should have to earn its way in.

### Would not build at all

- **Mid-battle power-ups or any reactive input.** Violates identity and determinism; weakens the planning skill.
- **Point-buy / draftable armies.** Tempting for expression, but no composition of the current units fixes dominance, so choice over composition today is choice among broken options — and point-buy multiplies the balance surface by orders of magnitude before the counter wheel exists. Revisit only after ranks 1–4 ship, if ever.
- **Roster expansion beyond the AT Gun.** Six combat types is the readability ceiling.
- **Formation-synergy auras of any kind**, visible or not. Re-litigating this would trade the game's best property — reconstructable losses — for depth players cannot see.
- **An open sandbag-placement phase before secret unit placement.** Genuine bluffing potential, but it adds a phase to a 60–120s loop and is awkward for async simultaneous play. A prototype curiosity, not a roadmap item.

### Harness success targets after ranks 1–4

State them now so the sweep is a test, not a vibe:

- top archetype **≤55%**
- every combat unit **≥5%** and no unit **>35%** of objective damage share (the mortar comes down by dilution, not nerfs)
- at least one pairwise **3-cycle at ≥55% per edge**
- p10–p90 duration inside **12–40s**
- timeout finishes **<30%**
- idle units **<12%**
- lane openings **2–5** per battle

---

## 7.4 Precedent — the mechanism, not the name

- **Mechabellum — the reactive counter-purchase.** Its creativity comes from seeing round N's fight and buying the counter for round N+1. Hidden Front already owns this loop — edit-and-rerun *is* that round structure stretched across matches — but it only works if counters exist to buy into (the wheel) and if the opponent's formation persists across the chain. That argues for a **ghost ladder**: your formation defends asynchronously against real players' attacks, and you get a replay of every breach. Creativity becomes "build a line that beats a population", and expression gets a scoreboard. Needs no movement — only deterministic replayable battles.
- **Into the Breach — a small fixed toolkit against a procedurally fresh, fully readable board.** ITB proves you don't need a big roster or hidden combat to feel endlessly creative; you need the board to change and the consequences to be legible. That is the seeded-terrain proposal, plus ITB's telegraphing translated to planning-time overlays: shade the bands a mortar could reach, show your own LoS lanes live as you place.
- **Battleship — placement as strategy under sequential probing.** Battleship's hidden placement is only interesting because information leaks shot by shot. A single simultaneous reveal wastes hidden information the same way revealing the whole Battleship board at once would. Transfer: progressive reveal plus the rematch chain — across a series, your opponent's evolving picture of your habits *is* the probed board.
- **Frozen Synapse — simultaneous committed plans with in-client hypothesis testing.** FS lets you simulate your plan against a *sketched* enemy plan before committing; that single feature is why its planning feels authorial. Reuse the deterministic sim for a planning-phase **wargame button**: sketch a guessed enemy layout and watch your formation fight it before committing. You can never sim the real hidden enemy — only your hypothesis — so nothing is solved, but the player is explicitly authoring and testing theories.
- **TFT / auto-battlers — mostly a negative precedent.** Their trait-synergy engine is exactly the hidden-multiplier class this game rightly rejected. What transfers: *positioning as the last mile of counterplay*, and the *post-combat damage recap chart* — TFT proved players read those bars and change their next round because of them.
- **Tower defence — player-shaped geometry constraining a flow.** Nothing moves here except projectiles and sightlines, so the "maze" is LoS: sandbags and craters are walls, firing lanes are paths. Transfer: elevate cover into the primary expressive medium — fewer, tougher, forward-placeable sandbags, and overlays that render your crossfire architecture.
- **Gunpoint / Duskers — contingency scripting.** The cleanest deterministic form of "agency during execution". Cut: in a 25-second battle, per-unit conditionals cost more comprehension than they return.
- **Colonel Blotto / poker — hidden allocation across multiple fronts has no pure-strategy solution.** The theoretical spine of the twin-node proposal, and the reason to trust it beyond intuition.

---

## 7.5 Psychology

**Optimising vs. expressing.** A deployment feels expressive when its value depends on a belief about the opponent, because then the formation is a *statement* — "I think you'll stack left, so I've called it" — and statements have authors. When value is computable against a public constant, the formation is homework, and everyone hands in the same homework.

The litmus test: **can two strong players disagree about the best formation on the same seed?** Today, no. After the AT Gun (a wager), twin nodes (a Blotto bet), and terrain (a fresh argument every match), yes — and sustained disagreement between competent players is the operational definition of an expressive system.

**Why chess openings and deckbuilding don't collapse, and archetype tables do.** Three properties, each mappable to a feature:

1. **Style-level non-transitivity.** Sharp lines beat passive play, solid structures blunt sharp lines, flexible systems outmaneuver solid structures. No style dominates, so choosing one is self-description, not error. → the counter wheel and the Blotto layer.
2. **Combinatorial interaction density.** A small alphabet whose elements modify each other yields a sentence space too large to exhaust. → LoS screening, enfilade facings, reserve timing: interactions, not roster size.
3. **Authorship artifacts.** Openings have names; decks get named by their builders; identity attaches to a repeatable, recognisable choice. → named saved formations with persistent records, and terrain-varied boards that make two players' solutions *look* different. A screenshot of your formation should be identifiably yours. Today every optimised board is the same column; **visual convergence is identity death.**

**Legible failure is the retention mechanism wearing a different hat.** A loss sustains creativity only if it parses as "my idea met a counter" — which names a next idea — rather than "the system has one answer" — which names quitting. Determinism and replays are a rare structural advantage here; the debrief layer converts that advantage into felt experience. Losing your stack to an AT gun teaches the wheel in one viewing. Losing to the same stack forever teaches learned helplessness.

This is where twin fronts quietly do their best work: they give every battle a **narrative skeleton** — "the left held, the right folded" — and narratable losses are the ones players re-run. The game is called Hidden Front; give it fronts.

**The watch phase is the payoff channel, not the game.** Its job is to deliver two moments: *"I called it"* (your AT gun's lane fills with the enemy stack) and *"I know exactly what I'd change"* (the debrief). Both are planning-phase satisfactions collected during the watch phase. That is why power-ups are the wrong instrument — they relocate satisfaction away from the plan — and information pacing is the right one.

---

## 7.6 The loop

### Match loop (~2.5–3 minutes)

1. **The draw (3s).** Seed revealed: terrain craters, your two node columns, the enemy's two node columns. A one-glance statement of *this match's* puzzle.
2. **The plan (60–90s).** Place 18 pieces; optionally hold up to 3 in reserve. Live overlays: your LoS lanes, range shadows, mortar-reach bands. Decisions on the table: the Blotto split across two fronts, how far forward, the AT gun's lane call, the cover architecture with 6 heavy sandbags, what to hold for t=10. Optionally, one wargame preview against a sketched enemy.
3. **The battle (20–35s, hard cap 45s).** Act 1 (0–10s): opening exchange, silhouettes identifying themselves as they fire; running node-damage bars. Beat at t=10: reserves land. Act 2: one front breaks — a wall falls, a node dies, its killers stand stranded. Act 3: the second front decides it, or the bars decide it at the cap.
4. **The debrief (10s, skippable).** Outcome by front; damage-share bars; tap any corpse for its killer and lane; delta vs. your previous run.
5. **One-tap rerun** with your formation pre-loaded. Target: **under 30 seconds** from "I know what I'd change" to watching the change fight.

Satisfaction lands in exactly three places: the mid-battle *called it* moment, the debrief *diagnosis* moment, and the rerun *vindication* moment. Steps 4→5 are the engine; everything ships in service of shortening that hinge.

### Session loop (15–30 minutes)

A best-of-N series against one opponent or ghost — a **campaign of adjustments**, Mechabellum's round loop at match scale. Across the series, progressive reveal makes your previous formation the thing being metagamed, so varying your line is real strategy rather than variety for its own sake.

Between sessions: named formations with persistent records, the ghost ladder ("your line was breached while you were away — watch the replay"), and a weekly shared seed so the community argues about one board.

The carry from match to match is a sentence the player can say out loud — *"next time the AT gun goes on column 5"* — and the carry from session to session is a formation with a name, a record, and a reputation. **That is what "theirs" means.**

---

## Summary of decisions

- **Diagnosis:** a pure-strategy equilibrium caused by a single public objective, no density-scaling counter, and near-zero piece interdependence; plus a watch phase whose tension resolves at reveal. Expression requires opponent-dependent value, not more content.
- **Player's proposals:** power-ups — reject outright, meet the need with information pacing. New units — add exactly one (AT Gun), cap the roster at six combat types. Split HQ — adopt as twin 1×2 nodes, 100 HP each, AND win condition, 45s cap with damage tiebreak; it is the best of the three because "units never move" turns dual objectives into compulsory force division.
- **Build first:** AT Gun + debrief layer; then twin nodes; then seeded mirrored terrain; then progressive reveal; sandbag rework alongside; reserve wave only if the watch phase still lags.
- **Never build:** reactive battle input, point-buy armies (for now), roster growth past six types, synergy auras.
- **Constraint flags:** progressive reveal withholds in-battle information but preserves reconstruction via full end-of-battle disclosure and replays; the reserve wave bends the spirit (not the letter) of "everything is fixed at Ready" and must earn its slot; everything else sits fully inside the stated commitments.
