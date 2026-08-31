# Hidden Front — Design Consult Brief

> **Purpose:** a self-contained context file for a design consult. It describes
> the game as it exists today, what has been *measured* about it, and what has
> already been tried and rejected. Read only this — the codebase is not needed.
>
> **The question is at the end (§7). Everything before it is context.**

---

## 1. The game in one paragraph

Two players secretly place a fixed army on their half of a grid. **Units never
move.** Each has a facing, an attack pattern, a range, a cooldown and a target
priority. Both players commit, the board is revealed, and the battle resolves
automatically in 15–30 seconds with no further input. You win by destroying the
enemy HQ, or by wiping out their combat units. A match is 60–120 seconds of
planning followed by a ~25-second battle you watch.

Web game, portrait, one-handed on a phone. Playable now: hotseat and vs. AI.

## 2. Current rules (settled, and mostly not up for revision)

**Board.** 8 columns × 11 rows. Rows 1–5 Orange, row 6 no man's land, rows 7–11
Blue. Portrait.

**The objective.** Each side has one 2×2 HQ, 200 HP, on the rear rank of its own
zone. It is **placed automatically and is visible to both players** — its column
is drawn fresh each match, independently for each side. It cannot be moved.
Everything else about a formation stays secret until the reveal.

**The army** (identical for both players, 18 placeable pieces):

| Unit | HP | Damage | Type | Range | Cooldown | Pattern | Targets |
| --- | ---: | --- | --- | --- | ---: | --- | --- |
| Soldier ×5 | 30 | 10 | bullet | 1–4 | 1.0s | line, width 1 | closest |
| Machine Gun ×3 | 50 | 8 to each of 3 | bullet | 1–4 | 0.7s | cone, widths 3/3/5/5 | infantry first |
| Tank ×1 | 120 | 40 | heavy | 1–6 | 2.8s | line, width 1 | highest HP in arc |
| Mortar ×1 | 35 | 30 + 50% splash | explosive | 3–10, ignores cover | 4.0s | indirect, omnidirectional | largest cluster |
| Sandbag ×8 | 60 | — | — | — | — | blocks line of sight, both sides | — |

Damage multipliers: bullet ×1.0 infantry / ×0.25 armour / ×0.25 structure;
heavy ×0.5 / ×1.0 / ×1.5; explosive ×1.0 / ×0.5 / ×1.0.

**Key rules.** Facing locks at Ready and never changes. Living units never block
line of sight; only sandbags and HQs do, and they block for *both* sides. There
is no damage variance — the simulation is fully deterministic, and randomness is
used only to break ties.

## 3. Design commitments that constrain any answer

These are load-bearing. An answer that violates one needs to say so and argue it.

1. **Units never move.** This is the game's identity. Movement is a different
   game.
2. **Readability.** A player must be able to reconstruct *why* they lost from
   what they watched. An earlier consult explicitly recommended cutting
   formation-synergy bonuses on these grounds: hidden multipliers you cannot see
   fight this directly.
3. **Determinism.** No combat RNG. Replays, the AI and an automated balance
   sweep all depend on identical inputs producing identical battles.
4. **The watch phase is the weak point.** Agency ends at Ready. Nothing changes
   during the battle except "a unit died" and "a blocker broke", so battles risk
   being a foregone conclusion played at 1× speed.
5. **Phone-first, portrait, one-handed.** 8 columns is the practical width.
6. **The core loop is edit-and-rerun.** A rematch reloads your formation
   pre-placed for editing. "I know exactly what I'd change" is the retention
   mechanism.

## 4. What is measured, not guessed

There is a headless balance harness that plays thousands of matches between
generated formation archetypes and reports statistics. All figures below come
from 4,000–6,000 match runs.

### 4.1 The problem the player reports

> "The mortar is the only thing that can reach the HQ, so I always place it in
> the last row away from every attack range. It feels like the only deciding
> factor. There seems to be no variation or creative thinking a player can use."

The data agrees, and is starker:

**Share of all damage dealt to HQs, by unit type:**

| Unit | Share |
| --- | ---: |
| Mortar | **65.6%** |
| Tank | 34.4% |
| Machine Gun | **0%** |
| Soldier | **0%** |

Five soldiers and three machine guns — **eight of the eleven combat units** —
cannot contribute to the win condition at all. They can only kill each other.

The mortar is also nearly untouchable: it is omnidirectional, ignores cover, and
outranges everything, so it can sit on the back rank where only the enemy mortar
(and a tank that happens to line up in its exact column) can reach it.

### 4.2 Formation archetype win rates

Seven generated shapes, played round-robin:

| Shape | Win rate |
| --- | ---: |
| Everything stacked in the enemy HQ's column | **70%** |
| Front line across the width | 58% |
| Everything stacked on your own HQ's column | 51% |
| Turtle (hang back) | 44% |
| Spread (disperse against splash) | 43% |
| Random (control) | 33% |
| Artillery-heavy | 27% |

### 4.3 Other health metrics

- Only **14–31%** of matches finish inside the 15–30s target; the spread is very
  wide (p10 ≈ 10s, p90 ≈ 39s).
- 82–89% of matches end by HQ destruction. Army destruction is 3–5%.
- Idle units (a combat unit that never fires a shot): 8%.
- "Lane openings" — a sandbag breaking and opening a firing lane, intended as
  the main mid-battle drama — run at ~8 per battle against a design target of
  2–4, so they are frequent enough to be unremarkable.

## 5. Fixes already tried and REJECTED, with measurements

Do not re-propose these without addressing why the measurement was wrong.

| Tried | Result |
| --- | --- |
| **Raise HQ HP** 200 → 400 | Made the dominant rush *stronger* (73.6% → 79.2%). Longer battles just let a formation already winning its lane keep winning. |
| **Buff splash** to 100% and mortar damage +50% | Barely moved the dominant shape (73.6% → 70.4%). One mortar cannot impose a cost on a ten-unit stack, so the roadmap's stated "punish clustering with splash" does not work at this army size. |
| **Change composition** (fewer MGs, more MGs, second tank, second mortar) | Three variants tested; the dominant shape stayed at 70–78% in all of them. The problem is geometric, not a unit-count problem. |
| **Mirror the two HQ columns** | Created an unbeatable formation at 80% with no counter, because the lane you attack and the lane you defend became the same lane. Columns are now drawn independently. |
| **Shorten mortar range** 10 → 6 | Only shuffles HQ damage between mortar and tank. Infantry still contributes 0%. Treats the symptom. |
| **Two tanks instead of one** | Two tanks aligned on the objective's column end the match before the rest of the board matters; nothing countered it. Cut to one tank. |

## 6. One structural fix already identified

Shallower zones let infantry reach the enemy HQ from the front rank, because
`useful infantry rows = weapon range − no man's land depth`. Measured on a
4-deep zone (an 8×9 board):

| | 5-deep (now) | 4-deep |
| --- | ---: | ---: |
| Mortar's share of HQ damage | 65.6% | 45.5% |
| Machine Gun | 0% | 11.8% |
| Soldier | 0% | 3.5% |
| Top archetype | 70% | 62% |

This is a real improvement and will probably be applied. **It is not the answer
to this consult** — it makes every unit *able* to contribute, but it does not by
itself make deployment a rich creative space. Assume it is done.

## 7. THE QUESTION

The player's verdict is: **"it's fun, but it lacks creativity."** Deployment
currently has roughly three decisions — which lane to contest, how far forward
to commit, and where to spend eight sandbags — and one of them (put the mortar
somewhere safe) dominates.

**How do we make deployment a space where a player's creativity actually pays
off, without breaking §3?**

Please cover:

### 7.1 Diagnosis first

What *specifically* is missing? Name the mechanism, not the symptom. Consider:
is the problem too few meaningful choices, choices with one right answer,
choices whose consequences the player cannot predict, or a lack of *interaction*
between pieces? Distinguish "more options" from "more expression" — a bigger
unit roster is not automatically more creative.

### 7.2 The player's three proposals — evaluate each honestly

1. **Power-ups during the battle phase**, to make watching more engaging.
   Note that this cuts against the design's identity (agency ends at Ready) and
   against determinism. Is there a version that works? Is the underlying need —
   a more engaging watch phase — better met another way?
2. **New units that enable more plays.** Which specific units, and *why those*?
   What decision does each one add that does not exist today? What does the
   roster look like when you are done, and how do you avoid the readability cost
   of a large roster?
3. **Splitting the HQ into two objectives that must both be defended.** Evaluate
   seriously — it doubles the defensive problem and may force real force
   division. What are the failure modes?

### 7.3 Your own proposals

Go beyond the three above. Rank everything by **impact per unit of complexity**,
and be explicit about what you would build first and what you would not build at
all.

### 7.4 Precedent

What do comparable games do, and what specifically transfers here? Consider
Into the Breach, Mechabellum, TFT/auto-battlers, Battleship, Frozen Synapse,
Gunpoint/Duskers-style plan-then-execute games, and tower defence. Be concrete
about the mechanism being borrowed, not just the name.

### 7.5 Psychology

Why does a deployment feel expressive rather than solved? What makes a player
believe *their* formation is theirs? Consider the difference between optimising
and expressing, the role of legible failure, identifiable playstyles, and why
some constraint systems (chess openings, deckbuilding) feel infinitely creative
while others collapse to one answer.

### 7.6 The loop

Sketch the match loop and the session loop you would aim for. Where does the
satisfaction actually land, and what carries a player from one match into the
next?

Be decisive and specific. Give numbers where numbers are needed. Length is fine;
depth is the point. Do not write code.
