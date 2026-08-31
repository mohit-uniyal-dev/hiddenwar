# Hidden Front — Follow-up Consult Brief

> Self-contained. Read only this file; the codebase is not needed and the
> earlier brief is summarised where it matters.
>
> **Your previous recommendations were implemented and measured. One worked
> exactly as predicted. One rested on a premise the board cannot satisfy. And
> the headline problem changed shape rather than going away.**
>
> The question is in §5.

---

## 1. The game, briefly

Grid tactical auto-battler. Two players secretly place a fixed army on their
half of an **8 wide × 9 tall** board. **Units never move.** Both commit, the
board is revealed, and the battle resolves deterministically in ~30 seconds with
no further input. Phone-first, portrait.

Board: rows 1–4 Orange, row 5 no man's land, rows 6–9 Blue. Zones are four rows
deep, which is load-bearing — `useful infantry rows = weapon range − gap depth`,
so a shallower zone is what lets infantry reach the enemy objective at all.

Hard commitments, unchanged: units never move; a player must be able to
reconstruct why they lost; full determinism with no combat RNG; all decisions
made before Ready; portrait phone; edit-and-rerun is the core loop.

## 2. What was implemented from your last consult

All four of these shipped and are measured below.

| Your rank | Change | Status |
| --- | --- | --- |
| 1 | **AT Gun** — pierce lane weapon, hits every unit in its lane | Built. Damage raised 12 → 22 (see §3.1) |
| 3 | **Twin HQ nodes** — two 1×2 nodes, 100 HP each, AND win condition, 45s cap, node-damage tiebreak, columns ≥3 apart | Built exactly as specified |
| 4 | **Seeded mirrored craters** — 2–3 per side, 180° rotation, block LoS both ways, excluded from rear ranks and node columns | Built |
| 6 | **Sandbags 8 × 60 HP → 6 × 90 HP** | Built |

Not built, as you advised: power-ups, point-buy, roster growth past six types,
synergy auras. Progressive reveal and the debrief layer are not built yet.

Current army (18 placeable pieces + 2 auto-placed nodes): Soldier ×5, MG ×2,
AT Gun ×1, Tank ×1, Mortar ×1, Sandbag ×6.

## 3. Measured results

Balance harness: 5,000 generated matches per figure, plus a round-robin
archetype matrix at 120–150 matches per pairing.

### 3.1 The AT Gun rested on a premise the board cannot satisfy

You specified 12 damage to every unit in the lane, reasoning that "against an
8-deep stack it deals 96 per shot."

**A 4-deep zone caps a column at four units, and real formations do not get
close to the cap.** Measured deepest-column occupancy:

| Archetype | Deepest column holds |
| --- | ---: |
| Stack the enemy objective's column | **2.74** combat units |
| Front line | 2.15 |
| Spread | 2.15 |
| Own-objective lane guard | 2.03 |

The "column stack" strategy is **not depth-stacking — it is lateral clustering
across adjacent columns.** Its deepest column is barely above the dispersed
shapes. A width-1 pierce weapon is therefore aimed at a shape the board never
produces.

At 12 damage the AT Gun dealt 4.0% of all damage and 0.36 kills per match — less
DPS than a soldier against a single target, which is by design, but it almost
never caught the multi-unit lane that justified it. Damage was raised to 22
(still below the 24 that would make it a strictly better soldier, preserving the
density trade-off). That moved it to **6.7% of damage, 1.57 kills/match**, and
moved the dominant archetype by about one point. It is not the lever.

### 3.2 Twin nodes worked exactly as you predicted

The stranding argument held completely.

| | Before | After twin nodes | After nodes + craters |
| --- | ---: | ---: | ---: |
| "Stack the objective's column" win rate | **70.7%** | 62.8% | **51.8%** |
| That shape vs. Front line, head to head | **74%** | 28% | 16% |
| Draws | 6.9% | 1.0% | 0.6% |
| Army-destruction finishes | 3.5% | 12.7% | 12.7% |

Concentration is dead as a dominant strategy. Killing one node strands the force
that did it, exactly as argued.

### 3.3 But the dominant moved rather than dissolved

| Archetype | Win rate now |
| --- | ---: |
| **Front line** (units spread across the full width of the front rank) | **71.0%** |
| Spread | 58.1% |
| Own-objective lane guard | 54.8% |
| Stack the enemy objective's column | 51.8% |
| Artillery-heavy | 47.8% |
| Random (control) | 36.4% |
| Turtle | 27.6% |

Your target was **top archetype ≤55%**. The top is 71%, 13 points clear of
second.

Head-to-head, Front line beats every other shape: 73% vs. the stack, 73% vs.
artillery, 70% vs. lane guard, 60% vs. spread, 93% vs. turtle.

**Your predicted wheel did not form.** You expected Stack ▸ beats Broad Front,
AT Gun ▸ beats Stack, Dispersion+screens ▸ beats AT Gun. The first edge is now
reversed: with twin objectives, a local breakthrough kills one node and then has
nowhere to go, so massing force cannot beat a formation that simply covers
everything. **Twin nodes punish concentration; nothing punishes dispersion.**

### 3.4 Other health metrics

| Metric | Target | Now | Note |
| --- | --- | ---: | --- |
| Matches in 15–30s | — | 27.8% | was 40.1% before craters |
| Timeout finishes | <30% | 18.7% | fine |
| Lane openings per battle | 2–5 | 6.6 | improved from 10.4 by the sandbag rework |
| **Idle units** | <12% | **22.8%** | tripled after craters |
| Objective damage: Mortar | <35% | **63.9%** | rose when nodes halved to 100 HP |
| Objective damage: Tank | — | 15.3% | tank idle time rose 12.2s → 21.4s |
| Objective damage: MG / Soldier / AT Gun | ≥5% each | 13.4% / 4.2% / 3.2% | all now non-zero, which they were not before |

Two caveats on the idle figure, stated so it is not over-read: the generator
places units **without checking line of sight**, so it will park pieces behind
craters in a way a human reading the arc-preview overlay would not. And the
45-second cap means a unit whose lane opens late has less time to fire.

## 4. What is already ruled out, with measurements

Do not re-propose these without addressing the measurement.

| Tried | Result |
| --- | --- |
| Raise objective HP (200 → 400, single HQ era) | Made the then-dominant rush **stronger**, 73.6% → 79.2% |
| Buff mortar splash to 100% and damage +50% | Dominant moved 73.6% → 70.4% only |
| Recompose the army (fewer/more MGs, 2 tanks, 2 mortars) | Dominant stayed 70–78% in every variant |
| Mirror the two sides' objective columns | Created an 80% unbeatable shape; columns are drawn independently now |
| Shorten mortar range 10 → 6 | Only shuffles objective damage between mortar and tank |
| AT Gun damage 12 → 22 | Dominant moved ~1 point |
| Craters (your rank 4) | Helped the *old* dominant (62.8% → 51.8%), did not touch the new one, and tripled idle units |

## 5. THE QUESTION

**Nothing in the current ruleset punishes dispersion, so "spread units evenly
across the front rank" is now the answer to every board.**

The deeper pattern across two rounds of fixes: each change removed the reigning
dominant and installed the next one. Concentration was dominant; twin objectives
killed it; now dispersion is dominant. That looks less like a balance problem
than a structural one — the game may lack any mechanism whose value is
*non-monotonic* in how spread out you are.

Please address:

### 5.1 Diagnosis

Why does dispersion win, mechanically? Is the missing piece a weapon, a rule, an
objective structure, or something about how value is computed at all? Be
specific about what "punishes dispersion" would even mean in a game where
nothing moves and every unit fires independently.

Consider seriously whether **twin nodes over-corrected** and whether the fix is
to tune them (node separation is currently forced to ≥3 columns of 8; it could
go to 2, or be drawn variably) rather than to add anything.

### 5.2 Was the wheel wrong, or is it just incomplete?

You predicted a rock-paper-scissors cycle. Measured, there is a weak 3-cycle
below the top shape but Front line beats all of it. Was the AT Gun the wrong
counter given §3.1, and if so what is the right one? If the roster genuinely
needs a different sixth unit, say so and specify it — but note that a unit whose
value is linear in lane occupancy was already tried and the board caps lane
occupancy at four.

### 5.3 The rank ordering, revised

Given the measurements, re-rank what remains: progressive reveal, the debrief
layer, the reserve wave, node-separation tuning, and anything new. What is now
first? Has anything you previously recommended become a bad idea, or anything
you previously cut become necessary?

### 5.4 Idle units

22.8% of combat units never fire. How much of that is a real design problem
versus an artefact of a generator that ignores line of sight, and what would you
change about craters — density, placement rules, or nothing?

### 5.5 The honest question

Two rounds of structural fixes have each produced a new dominant at ~70%. Is
this game's decision space simply too small to support a flat metagame — 18
pieces, six unit types, 32 tiles a side, one shot at placement — and if so, what
is the smallest change that makes it big enough? Alternatively: is a 70%
top-archetype win rate actually acceptable for a game whose real loop is
edit-and-rerun against a specific opponent rather than ladder play against a
population?

Be decisive and specific. Numbers where numbers are needed. No code.
