# Hidden Front — Game Design & Development Roadmap

> Working title: **Hidden Front**
> Genre: **Hidden-deployment tactical auto-battler**
> Setting: **World War I trench warfare, as a toy-soldier diorama**
> Platform: **Web first**
> Core inspiration: **Battleship-style hidden deployment + chess-like positioning + auto-battler combat**

---

## Contents

**Part I — Canonical Design** *(authoritative)*

- **§A** Identity and Fantasy — setting, tone, pitch, the emotional arc of a match
- **§B** The Resolved Rulebook — zones, LOS, facing, targeting, determinism, victory
- **§C** Unit Stats — final MVP table, damage multipliers, time-to-kill math
- **§D** The Core Design Risk — the static-battle problem and its mitigations
- **§E** Missing Systems — async play, puzzle mode, onboarding, ghost armies, a11y
- **§F** Scope Cut — what ships in the demo, what is cut
- **§G** Naming

**Part II — Tech Stack** *(authoritative)*

- **§H** MVP Demo — stack, determinism contract, art plan, repo layout
- **§I** Final Build — monorepo, Pixi, server, replays, AI, migration path

**Part III — Design Reference & Expansion Backlog**

- **§1–58** the original notes, annotated where Part I supersedes them

---

## How to read this document

| Part | Contents | Status |
| --- | --- | --- |
| **Part I — Canonical Design** | Identity, the resolved rulebook, final unit stats, the core design risk, demo scope | **Authoritative.** Build from this. |
| **Part II — Tech Stack** | MVP demo stack and final build stack | **Authoritative.** |
| **Part III — Design Reference & Expansion Backlog** | The original exploratory design notes, sections 1–58 | Reference and future ideas. Where it disagrees with Part I, **Part I wins.** |

Part I exists because the original notes explored options without closing them. Every open question below has been decided. Decisions can be revised — but they are decisions, not menus.

---

# PART I — CANONICAL DESIGN

---

# A. Identity and Fantasy

## A.1 The setting was already chosen by the mechanics

Units that never move. Sandbag walls. Machine guns that scythe down infantry formations. Mortars lobbing over cover. A strip of empty ground between two entrenched lines that the design already calls **no man's land**.

This is **World War I** — the war in which movement died and geometry took over. No other setting explains stationary units:

- WWII implies maneuver, blitzkrieg, armor breakthroughs.
- Near-future implies drones and mobility.
- Abstract/sci-fi throws away free intuition — every player on earth already knows what a sandbag, a trench line, and a mortar do. That is an entire tutorial you get for nothing.

## A.2 The tone problem, and the frame that solves it

Real WWI is grim, and a grim game about the Somme is not what this design wants to be.

**The frame: a toy-soldier diorama on a general's map table.**

You are not commanding humans. You are a general pushing wooden tokens across a paper map — or, equivalently, a kid arranging army men on the floor. This is also the *honest* frame, because it is literally what the player does: draw up a battle plan, then watch it play out.

Stylize hard:

```text
Units          painted-wood / tin-toy soldiers, chipped enamel
Battlefield    cork board, folded paper map, coffee-ring stains
Arc previews   grease-pencil marks, hand-drawn chalk lines
Reveal SFX     a referee's whistle
Report SFX     typewriter clatter
Camera         slight tilt-shift vignette — it reads as "small objects"
```

## A.3 The pitch

> **Battleship meets auto-chess in the trenches: secretly dig in your army, then watch two battle plans collide in thirty seconds.**

## A.4 Player fantasy

**The map-table general.** Your skill is foresight, not reflexes. You never fire a shot — you decide where every shot will come from.

## A.5 The emotional arc of one match

This is the spine of the whole design. Every feature should be checked against it.

| Beat | Feeling | Design obligation |
| --- | --- | --- |
| **1. Deploy** — *scheming* | Quiet, private confidence. *"They always push the left flank."* | Deployment must be fast, tactile, and fully previewable. |
| **2. Reveal** — *the gasp* | The highest emotional beat in the match. Both plans visible at once — you see which guesses were right **before a shot is fired**. | Hold this moment 1–2 seconds longer than feels necessary. |
| **3. Watch** — *the binoculars* | Helplessness with rooting interest. You lean in when a sandbag cracks in front of your mortar. | See §D — this beat is the design's biggest risk. |
| **4. Report** — *the debrief* | The loss autopsy that converts frustration into *"one more, I know what to change."* | Must teach. Must lead to a 2-click rematch with your formation preloaded. |

## A.6 Art direction a solo developer can actually execute

- Top-down 2D, **static sprites**. No character animation rigs.
- Recoil is a 2-frame translate. Tracers are lines. Explosions are expanding circles plus particles.
- **3 damage states per unit**, as sprite swaps — not animations.
- Team colors: **blue vs. orange**. Never red/green (see §E.6).
- Muted khaki board so both team colors pop.

**Total art budget for the demo: ~15 sprites and 6 sound effects.**

---

# B. The Resolved Rulebook

Everything in this section is a settled decision. It supersedes the exploratory notes in Part III.

## B.0 Global conventions

These three settle a dozen small ambiguities at once:

```text
DISTANCE   Chebyshev (chessboard) distance, everywhere, no exceptions.
           Used for range, mortar min/max, and splash radius.

TIME       All time is in ticks. 20 ticks per second.
           Every stat is stored as an integer tick count.

ROUNDING   Damage is computed in floats (base x type multiplier),
           rounded half-up to an integer, with a minimum of 1.
```

## B.1 Battlefield and deployment zones

```text
Grid: 12 columns x 9 rows

Rows  1-4    PLAYER B deployment zone      (48 tiles)
Row   5      NO MAN'S LAND                 (nothing may ever be placed here)
Rows  6-9    PLAYER A deployment zone      (48 tiles)
```

48 tiles per side for 22 occupied tiles of army — 46% density.

### Why the board shrank from 12x14

The original 6-deep zones with a 2-row gap left most of the board inert. Measured
enemy rows reachable, by the row you place a unit on:

| Your row | Soldier | MG | Tank | Mortar |
| --- | ---: | ---: | ---: | ---: |
| 9 (front) | 2 | 2 | 4 | 6 |
| 10 | 1 | 1 | 3 | 6 |
| 11 | **0** | **0** | 2 | 6 |
| 12 | **0** | **0** | 1 | 5 |
| 13 | **0** | **0** | **0** | 4 |
| 14 | **0** | **0** | **0** | 3 |

Soldiers and machine guns contributed **nothing** from row 11 back. Seven of the
nine combat units in a Classic army were competing for two rows, while four rows
held sandbags, an HQ and scenery. Deployment collapsed to "line the infantry up
on rows 9–10", which is not a decision.

The governing arithmetic is:

```text
useful infantry rows  =  weapon range - no man's land depth  =  4 - 2  =  2
```

Note what that does *not* contain: zone depth. Making the zone shallower removes
dead space but does not widen the infantry band — only changing range or the gap
does that. Hence **both** changes: zones 6 → 4, and no man's land 2 → 1.

Reachability on the 12x9 board:

| Your row | Reachable by |
| --- | --- |
| 6 (front) | soldier, MG, tank, mortar |
| 7 | soldier, MG, tank, mortar |
| 8 | soldier, MG, tank, mortar |
| 9 (back) | tank, mortar |

Infantry is now useful on 3 rows of 4. The rear row stays tank-and-artillery
territory, which preserves the intended layering — infantry hold the line, tanks
reach mid-field, artillery reaches deep — without wasting a third of the board.

**The measured effect on balance was large.** On the symmetric full-army fixture
the mortar's share of all damage fell from **56% to 33%**, with tanks at 29%,
MGs at 21% and soldiers at 17%. Open question #5 in the design review — the
mortar carrying turtle-breaker, splash-punisher and indirect-fire duty alone —
substantially resolved itself once infantry could reach the enemy at all.

## B.2 Occupancy and placement

```text
One unit per tile. Hard rule. No stacking, ever.
The HQ occupies 4 tiles (2x2) and must be fully inside your zone.
Placement is legal anywhere in your own 4 rows, including the front row.
The HQ is placed automatically and cannot be moved (see below).
Ready is irreversible.
```

### The HQ is placed automatically, and both are public

**Neither player positions their HQ.** Both stand on the rear rank of their own
zone, each in a column **drawn independently each match**, and both are visible
from the moment deployment begins.

```text
Player B HQ   rows 1-2, columns C..C+1   (displayed)
Player A HQ   rows 8-9, columns C..C+1
                        C drawn per match from the match seed
```

### The columns must NOT be mirrored

They were, at first, and it broke the game. Mirroring makes the lane you must
attack and the lane you must defend **the same lane**, so a single stack of
units does both jobs at once. Measured head to head at 150 matches per pairing,
a formation that simply piled everything into that column won **80%** overall
and beat an ordinary front line 97-3. Nothing countered it.

Drawing the columns separately forces the choice the game exists to pose — how
much do you commit forward, how much do you hold back — and dropped that same
formation to 56%.

Fairness does not require identical columns, only identical *problems*: each
player has one objective to crack and one to hold, drawn from the same
distribution. The distance between the two columns varies per match, and that
distance is itself the interesting variable.

The draw is seeded, so a match stays reproducible from one number — battlefield
and battle alike — and it is **held steady across a rematch**, which is the
entire point of edit-and-rerun (§D.2).

**Why the column and not the row.** Which lane you must force, and which lane
you must hold, is the decision that actually changes between matches. Varying
the depth would mostly change how long the battle takes. Fixing the rank also
leaves the rear rows clear of everything else, which is what lets a stored
formation adapt to the drawn position instead of breaking on it.

**Why.** Guessing *where* the HQ is was never the interesting hidden
information; guessing the enemy's **lanes and facings** is. Publishing both
objectives turns every match into a concrete problem — attack this point,
defend that one — which makes a sandbag wall a readable decision instead of a
hedge against an unknown, and gives the attacker something to actually plan
against. It also removes a swing that was never fun: one player hiding their HQ
well and the other not.

The hidden information that matters is untouched. Everything except the two HQs
stays secret until the reveal.

Consequences:

- The placeable army is **18 units**, not 19 (§C.2 minus the HQ).
- Clearing your formation leaves the HQ standing; it cannot be removed or built
  over.
- Puzzles may pre-place other pieces too, via a scenario's `fixed` list.

> **This is §41's prescribed answer to solved formations: map variety, not
> dice.** A single fixed anchor would give every match the same objective
> geometry and invite one memorised optimum. Drawing the column removes that
> without adding a grain of combat randomness — the simulation stays fully
> deterministic (§B.8.1).

**The AI opponent draws its own column too.** Single-player armies are generated
per match rather than stored, so they simply build around whatever position the
draw gives them. Puzzles keep the position their author designed them for.

### Why no placement rule is needed

When players *did* position their own HQ, the 12x14 board made this unsafe.
The back two rows were reachable **only**
by the enemy mortar — one weapon type out of four, one unit out of nineteen,
with 35 HP — so an HQ parked there was effectively invulnerable once that mortar
died. Worse, the tiebreak ladder checks HQ HP first (§B.3), so an untouched HQ
also won every stalemate automatically, even against a player with more army
left and more damage dealt. That required an explicit "the HQ may not sit on
your back row" rule.

The 12x9 board removes the need for it. With 4-deep zones and a 1-row gap, a
tank on the front rank covers the **entire** enemy zone, so every tile — and
therefore every legal HQ placement — is contestable by something other than
artillery. The artificial restriction was deleted.

> **Invariant, enforced by `reachability.test.ts`:** every row of a deployment
> zone must be reachable by tanks, not just by the mortar. That test fails if
> anyone deepens a zone, widens no man's land, or shortens a weapon range —
> any of which would silently reopen the sanctuary.

---

## B.3 Victory, stalemate, and draws

Evaluated every tick, in this priority order:

**1. Army destruction wins outright.**
The moment one side has zero combat-capable units and the other has at least one, the side with units **wins immediately** — regardless of HQ HP.

> *Why this rule matters:* it closes the "hide the HQ somewhere unreachable" hole. Since nothing moves, an unreachable HQ must not be able to force a draw.

**2. HQ destruction.** `HQ HP <= 0` → that player loses.

**3. Dead-air early end.** If **100 consecutive ticks (5 seconds)** pass with zero damage events, the battle ends immediately.

**4. Hard cap.** **1,200 ticks (60 seconds)**, unconditional.

Tiebreak when the battle ends without an HQ kill or army destruction:

```text
(a) Higher HQ HP remaining
(b) Higher summed tactical value of surviving units
(c) Draw — prompt rematch
```

If both HQs die on the same tick: **draw** in MVP. (Ranked mode later applies tiebreak (b).)

**Definition — "combat-capable": any unit with damage > 0.** Sandbags and the HQ are not combat-capable. A side reduced to sandbags and an HQ has **lost** by rule 1.

## B.4 Line of sight — what blocks

**Living units never block line of sight or bullets — friendly or enemy.**

Soldiers fire past their comrades. Tanks do not shield anything by standing in front of it.

**Only sandbags and HQs block LOS — and they block it for both teams.**

Walling yourself in means you cannot shoot out. That double edge is a genuine placement decision, and it makes the "blocked lane" story readable: the only things that block are big, obvious, static objects.

> This resolves Part III §9's open question ("optionally other large units"). The answer is **no**. Tanks do not block.

## B.5 Line of sight — the exact raycast rule

Cast the segment from attacker tile center to target tile center. The shot is **blocked** if and only if:

- the segment **strictly passes through the interior** of any intermediate tile containing an intact blocker, **or**
- the segment passes **exactly through a tile corner** and **both** diagonally-adjacent tiles at that corner contain blockers.

In short: **supercover raycast, with diagonals blocked only by double walls.**

```text
Shooting past a single sandbag corner    → ALLOWED
Shooting through a diagonal seam of two  → BLOCKED

    . S              S .
    S .   ← blocked  . S   ← blocked
    
    . S              
    . .   ← allowed  
```

This rule is permissive, standard, and — critically — **previewable**. The arc preview simply greys out shadowed tiles, which makes the rule self-teaching.

**Bullets stop at the first thing in the line.** A line-pattern unit's target is the nearest unit or blocker in its column. An enemy sandbag is a *valid* (if inefficient) target. A friendly sandbag just blocks you.

> Note: with 4 facings, Soldier and Tank lines are axis-aligned and this rule is trivial. It mainly governs the MG cone.

## B.6 Facing: locked, and there is only one cone

**A unit's search cone and fire cone are the same cone, and facing is locked at Ready.**

A unit only ever acquires targets inside its attack pattern's footprint. If nothing valid is inside it, the unit does nothing — **forever** — and the battle report says so:

```text
Your tank had no valid target for 8.4 seconds.
```

No mid-battle rotation. Ever.

> This is the game's identity. Your plan is your fate. A unit that swivels to help is a unit that forgives bad planning.

## B.7 Targeting and re-acquisition

**There are no held targets, so there is no re-acquisition problem.**

```text
On any tick where a unit's cooldown is ready:
    evaluate the priority function over ALL currently valid targets
    (in pattern, in range, LOS clear)
    fire THIS TICK at the winner.

Between shots, a unit holds nothing.
```

If a target dies mid-cooldown, nothing happens. The cooldown keeps counting. The next ready tick is a completely fresh evaluation.

**All direct fire is hitscan in the simulation.** Projectiles are pure animation — they never affect the outcome.

**The one exception — the mortar:** its shell has a **20-tick (1.0s) flight time** and is **tile-targeted, not unit-targeted**. It damages whatever is on the target tile at landing, even if the original occupants died in flight. Nothing moves, so it cannot miss — but a simultaneous kill can make a shell "overkill" a corpse's tile. That is fine; it reads as drama.

## B.8 The determinism contract

```text
Cooldowns are integers in ticks:
    Soldier  20 ticks (1.0s)
    MG       14 ticks (0.7s)
    Tank     56 ticks (2.8s)
    Mortar   80 ticks (4.0s)

Nothing ever fires between ticks.
```

**First shot fires at 50% of cooldown** (Soldier t=10, Tank t=28). This staggers the opening so the battle ramps up instead of opening with an alpha strike, and it desynchronizes identical units naturally.

**Two-phase tick resolution — no turn-order advantage:**

```text
Phase 1   Every ready unit selects its target and computes damage
          against the board state AS OF THE START OF THE TICK.
Phase 2   All damage applies simultaneously.
Phase 3   Deaths resolve.
```

**Two units that deal lethal damage to each other on the same tick both die.** Mutual kills are legal and correct.

**RNG consumption order:** units are iterated sorted by `(team, deploymentIndex)`. The seeded PRNG is used **only** for tie-breaks between equally-scored targets.

**Overkill:** excess damage is lost. No spillover.

### B.8.1 Override: damage variance is cut

Part III §2.4 proposes ±5% damage variance and a "10–15% randomness" target. **Cut it from the MVP entirely.**

The original notes want both *"10–15% randomness"* and *"the simulation should not feel random."* Those are in tension. Variance adds noise to the loss autopsy — *"did I lose to a plan, or to dice?"* — while doing nothing at all for the reveal, which is where the emotion actually lives.

```text
Randomness in MVP = tie-breaks only.
```

Re-introduce variance later **only** if solved formations actually emerge (the fear in Part III §41) — and even then, prefer map variety over dice.

## B.9 The mortar's "largest cluster" — the exact algorithm

Part III §8.4 says the mortar targets the "largest cluster" without defining it. Here is the implementable version:

```text
Candidates:  every tile T containing an enemy unit, where
             minRange <= chebyshev(mortar, T) <= maxRange

Score(T)  =  sum of tacticalValue(u) for every enemy unit u whose
             occupied tiles intersect the 3x3 block centered on T
             (a multi-tile HQ counts once per shell, at value 40)

Target    =  argmax Score(T)

Ties      →  closest T to the mortar
             still tied → seeded random pick

Re-evaluated from scratch on every shot.
```

**Tactical values** (also used by the `highestValue` priority):

| Unit | Value |
| --- | ---: |
| Sandbag | 1 |
| Soldier | 5 |
| Machine Gun | 12 |
| Mortar | 15 |
| Tank | 20 |
| **HQ** | **40** |

> **The HQ at value 40 is load-bearing.** It means a defended HQ *is* usually the largest cluster on the board — which makes the mortar the natural turtle-breaker without any special-case anti-turtle rule.

**Damage:** full to the center tile, **50% to the 8 surrounding tiles**.

**No friendly fire in MVP.** Mortars fire across the board; friendly-fire cases would be vanishingly rare and would add a hidden rule for no benefit.

**Cut:** Part III §8.5's *"explosion behind sandbag partially reduced."* Splash ignores cover in MVP. One fewer invisible rule.

## B.10 Armor: deleted

Part III contains **two** overlapping damage-mitigation systems — flat armor subtraction (§11) and type multipliers (§10).

**Use type multipliers only. Delete the flat armor stat.**

Two mitigation systems is one too many to explain, and `max(1, dmg - armor)` has a bad failure mode: it makes massed chip fire weirdly effective against tanks.

## B.11 HQ: 2×2

```text
Size:   2 x 2 (four tiles, one shared HP pool)
HP:     200
Attack: none
LOS:    blocks
```

**Why not 1×1:** a 1×1 HQ hides completely behind a single sandbag on the only axis that matters. That is degenerate — one 3-point piece fully shielding the win condition.

**Why 2×2 works:**

- Needs 2+ sandbags per exposed side — a real budget commitment.
- Is a fat target for mortar splash, which the anti-turtle system depends on.
- Reads instantly on the board as *"the important thing."*

A mortar shell overlapping two HQ tiles damages it **once**.

## B.12 What actually stops turtling

Four organic systems. **No artificial placement restrictions** — Part III §38 is right about that.

1. **Tanks one-shot sandbags.** 40 heavy × 1.5 vs. structure = 60 damage vs. 60 HP. A wall costs 3 points per tile and dies at one tile per 2.8 seconds per tank.

2. **Mortar max range raised 7 → 10.** At range 7, rows 1–2 were a *mathematically unreachable sanctuary* for the HQ. Nothing moves, so any unreachable tile is a broken tile.

   > **Design invariant to keep forever:** every tile in the enemy zone must be reachable by at least one weapon from at least one legal placement.

3. **Cluster scoring counts the HQ at 40** — the turtle's own defensive huddle is the mortar's favorite target.

4. **Stalemate economics.** The 60s cap resolves on HQ HP first, so a full turtle that deals no damage loses every tiebreak to a single point of chip damage. And losing all combat units while your bunker still stands is an **outright loss** by §B.3 rule 1.

## B.13 Smaller ambiguities, resolved

| Issue | Resolution |
| --- | --- |
| **MG "8 × burst"** was undefined | Each MG attack deals **8 damage to each of up to 3 distinct targets** in its cone, priority-ordered. *This* is what makes it a formation-punisher rather than a fast soldier. |
| **MG cone footprint** — the diagram in §8.2 is internally inconsistent | Facing N, at distance d ∈ 1..4, covers lateral offsets \|x\| ≤ ⌈d/2⌉ → widths **3, 3, 5, 5**. Sixteen tiles. **Publish it as a picture, not a formula.** |
| **"Infantry first" fallback** | No infantry in arc → nearest valid target of any kind. An MG plinking a sandbag for 2 damage is fine — non-idle beats idle. |
| **§16's range-preview diagram shows the tank at range 4**, but its stats say 6 | **Stats win.** Fix the diagram. |
| **§12's example timeline** has the MG firing at 0.3s then 0.8s on a 0.7s cooldown | Arithmetic error. Superseded by the tick contract in §B.8. |
| **Eight-direction facing** (§7) | **Four directions, permanently**, unless a proven need emerges. Diagonals double the preview and LOS surface for marginal depth. |

---

# C. Unit Stats — Final MVP Table

## C.1 Damage type multipliers

Classes: **Infantry** (Soldier, MG, Mortar — crewed weapons die like the people crewing them), **Armored** (Tank), **Structure** (Sandbag, HQ).

| Multiplier | vs Infantry | vs Armored | vs Structure |
| --- | ---: | ---: | ---: |
| **Bullet** | ×1.0 | ×0.25 | ×0.25 |
| **Heavy shell** | ×0.5 | ×1.0 | ×1.5 |
| **Explosive** | ×1.0 | ×0.5 | ×1.0 |

## C.2 The army

Per player: **5 Soldiers, 3 Machine Guns, 1 Tank, 1 Mortar, 8 Sandbags, 1 HQ.**

> **Revised from 2 tanks / 2 MGs after measurement.** The second tank was what
> made an HQ rush unbeatable. §C.4 costs the objective at *"9.8s solo, ~5.6s
> with both tanks"* — two tanks aligned on the enemy HQ column finish it before
> the rest of the board becomes relevant, and head to head **nothing countered
> that** (66-98% against every other shape). Cutting to one tank gives the
> defence time to answer: a dedicated lane guard now beats an HQ rush **90% to
> 2%**, turning a dominant strategy into one half of a counter pair.
>
> The freed slot went to a third machine gun — the only weapon whose cone covers
> neighbouring columns, so lanes support each other instead of each fighting
> alone.
>
> Measured effect (6,000 matches): top archetype **80% → 67%**, front line now
> competitive at 61%, matches inside the 15–30s band **13% → 36%**, mean 21.4s
> and median 20.6s both in band, timeouts 2.2% → 1.9%.
>
> **What this cost:** with one tank, your only breacher never fires in ~15% of
> matches (avg idle 13.6s), and §C.4's tank-versus-tank arithmetic no longer
> describes a real matchup. The machine gun is now the top damage dealer at
> 40.5%, replacing the mortar's old dominance.

| Unit | HP | Damage | Type | Range | Cooldown | Pattern & arc | Priority | Class | Cost | Value |
| --- | ---: | ---: | --- | --- | ---: | --- | --- | --- | ---: | ---: |
| **Soldier** | 30 | 10 | Bullet | 1–4 | 1.0s (20t) | Line, width 1 | Closest | Infantry | 5 | 5 |
| **Machine Gun** | 50 | 8 × up to 3 targets | Bullet | 1–4 | 0.7s (14t) | Cone, widths 3,3,5,5 | Infantry first → closest | Infantry | 12 | 12 |
| **Tank** | 120 | 40 | Heavy | 1–6 | 2.8s (56t) | Line, width 1 | Highest HP in arc | Armored | 20 | 20 |
| **Mortar** | 35 | 30 center / 15 splash | Explosive | 3–10, ignores LOS | 4.0s (80t) | Indirect, tile-targeted, 1.0s flight | Cluster score (§B.9) | Infantry | 15 | 15 |
| **Sandbag** | 60 | — | — | — | — | Blocks LOS | — | Structure | 3 | 1 |
| **HQ** | 200 | — | — | — | — | 2×2, blocks LOS | — | Structure | — | 40 |

## C.3 Changes from the original notes, and why

| Change | Reason |
| --- | --- |
| Soldier range **3 → 4** | Range 3 threatened too little of the enemy zone across the gap; too many soldiers never fired. |
| Mortar max range **7 → 10** | Kills the unreachable-back-row sanctuary (§B.12). |
| Sandbag cost **2 → 3** | Eight near-free blockers undervalued the wall. |
| Armor stat **deleted** | Replaced entirely by type multipliers (§B.10). |
| MG burst **defined** | 8 damage to each of 3 targets (§B.13). |
| Mortar splash **defined** | Full center, 50% to the 8 neighbors (§B.9). |

## C.4 Time-to-kill math

All figures assume the first shot fires at 50% of cooldown (§B.8).

| Matchup | Math | TTK |
| --- | --- | ---: |
| **Soldier vs Soldier** | 30 HP / 10 = 3 shots → 0.5 + 2×1.0 | **2.5s** |
| **MG vs 3-soldier squad** | 8 dmg to all three per volley, 4 volleys → 0.35 + 3×0.7 | **2.5s** |
| **Tank vs Sandbag** | 40 × 1.5 = 60 vs 60 HP | **1 shot** — first breach at 1.4s |
| **Tank vs Tank** | 40 × 1.0, 120 HP → 3 shots | **7.0s** |
| **Tank vs HQ** | 60/shot, 200 HP → 4 shots | **9.8s** solo, **~5.6s** with both tanks |
| **Soldier vs Tank** | 10 × 0.25 = 3/shot → 40 shots | **40s** — effectively impossible |
| **Mortar vs 3 clustered soldiers** | Shell 1 lands ~3.0s (kills center, halves neighbors), shell 2 at 7.0s | **~7s** |
| **Mortar vs HQ** | 30/shell → 7 shells | **~27s** solo |

**Three things this table is telling you:**

1. **Head-on soldier duels are mutual kills** (two-phase ticks). Position and pattern decide fights — never initiative.
2. **The MG kills three soldiers in the time a soldier kills one.** That is the formation-punisher role, exactly as Part III §26 intends.
3. **Soldiers and MGs cannot kill tanks** (3 and 2 damage per shot respectively). Tanks die to tanks, and are opened up by mortars. Correct — the mortar opens turtles, tanks execute them.

## C.5 Whole-battle sanity check

```text
Total HP per side = 1,205
    150  (5 soldiers)
    100  (2 MGs)
    240  (2 tanks)
     35  (mortar)
    480  (8 sandbags)
    200  (HQ)
```

Effective throughput lands around **100–160 HP/s** once lanes open, throttled early by LOS and idle arcs.

```text
 0 -  4s   infantry / MG skirmish
1.4 -  6s   first sandbag breaches
 6 - 18s   line collapse
18 - 28s   converged fire kills the HQ
```

That sits inside the 15–30s target, with the 60s cap as a backstop.

**Tuning levers, in order of preference:**

```text
If battles run LONG:    sandbag HP 60 → 45
                        tank cooldown 56 → 48 ticks
                        mortar cooldown 80 → 70 ticks

If battles run SHORT:   soldier HP 30 → 35 first
                        NEVER slow the tanks — the breach cadence is sacred
```

---

# D. The Core Design Risk

## D.1 The static-battle problem

> **Because nothing moves, nothing changes — and a battle where nothing changes is a foregone conclusion played at 1× speed.**

Be precise about why this is worse here than in other auto-battlers. In TFT or Mechabellum, **movement continuously creates new engagements** — the state evolves and the outcome genuinely swings mid-fight.

In Hidden Front, the **entire engagement graph is fixed at Ready**. The only state changes possible are:

```text
1. A unit died.
2. A blocker broke.
```

The nightmare version of this game: two lines plink at whatever happens to sit in their lanes, 30% of units never fire because nothing entered their cone, the winner is obvious by second 3, and the player watches 25 seconds of confirmation.

That is not a payoff for 90 seconds of planning. That is a loading screen with tracers.

And the asymmetry is brutal: **agency ends at Ready.** The watch phase must pay the player in *something*, and the only currencies available are suspense, spectacle, and information.

## D.2 Mitigation: build around cascades, and around iteration

**1. Sandbag breaches are the drama engine. Tune for them deliberately.**

The one mid-battle state change this game genuinely owns is *"a blocker breaks and a lane opens."* Dormant units suddenly activating is the closest thing to a plot twist the system can produce.

The §C numbers are chosen so that **every battle has 2–4 breach moments** — a tank one-shots a bag every 2.8s, and mortars crack clustered walls.

```text
NEW PRIMARY METRIC: lane-opening events per battle.
If a playtest battle has ZERO breaches, the tuning is wrong.
```

**2. Target under 15% idle units.**

Part III §52 already logs idle time. **Promote it to the primary health metric of the watch phase.** Every unit that never fires is planning effort with zero payoff.

Soldier range 4 (not 3), the MG's wide cone, and the "nearest valid target" fallback all exist to push this number down.

**3. Don't spoil, but do narrate.**

- A live **army-strength bar** — summed remaining tactical value per side. This is a *heuristic*, **not** the simulation's known outcome. It gives the watcher a scoreboard to feel swings against.
- A kill feed.
- Damage numbers.
- **Exactly one slow-motion moment per match:** the shot that kills an HQ. Nothing else.

> The simulation knows the winner at tick 0. **Never leak it.**

**4. The real payoff is the next deployment — so make iteration frictionless.**

This is the deepest fix. The watch phase is **reconnaissance for the rematch**.

```text
Rematch must be <= 2 clicks, same opponent, AND —
critically — your previous formation loads PRE-PLACED for editing.
```

Rebuilding 19 pieces from scratch kills the *"I know exactly what I'd change"* impulse that Part III §51 correctly identifies as the win condition.

> **Edit-and-rerun is the actual core loop.** The original notes never state this.

**5. The honest bet.**

60–120s of planning for ~25s of payoff is a fine ratio — it is Battleship's ratio, and puzzle games run far worse — but **only** if battles are legible stories and the rematch is instant.

If playtests show players tabbing out during combat: **do not add mid-battle abilities to "restore agency."** That breaks the identity. Instead, shorten combat toward 15s and make the report sharper.

> The plan-collision *is* the game. Protect it.

## D.3 Secondary risk

A solved dominant formation in fixed-army mode. Part III §41 already anticipates this.

The answer is **puzzle seeds and map variety later — not combat RNG.**

---

# E. Missing Systems

Systems the original notes do not mention at all, in priority order.

## E.1 Asynchronous multiplayer — the biggest structural miss

**This game does not need realtime anything.** Both players deploy independently, and the simulation is deterministic.

**Play-by-link:**

```text
Player A deploys
    ↓
Gets a URL encoding their deployment
(~19 tuples of type/position/facing — trivially URL-encodable)
    ↓
Sends it anywhere — chat, email, forum
    ↓
Player B opens it, deploys blind
    ↓
Battle resolves instantly for B, and via link/notification for A
```

No lobbies. No sockets. No presence. No reconnect logic.

> Part III's Phase 21 (realtime multiplayer) should be **replaced** by this for the first online release. Realtime rooms are a luxury for after the game has an audience.

## E.2 Puzzle mode / daily challenge — promote into the MVP

A fixed, **visible** enemy formation. You deploy a limited kit. Win the simulation.

This is simultaneously:

- **(a)** the tutorial engine
- **(b)** daily-retention content on a platform (web) with no install and no push notifications
- **(c)** a global leaderboard for free — everyone gets the same seed, rank by HQ HP remaining + time
- **(d)** matchmaking-free single-player content

Cost: the battle engine you already built, plus ~10 handcrafted formations.

## E.3 Onboarding

Nothing in the original notes teaches the game — which is a problem for a design with this much hidden rule surface.

**Three scripted puzzles as the tutorial:**

```text
1. Place one soldier to kill a target      → teaches facing and line
2. Rotate an MG to cover two lanes         → teaches cones and previews
3. Stop a visible mortar from killing       → teaches splash, spreading,
   your HQ                                     and sandbags
```

**Plus one systemic feature that replaces pages of tutorial:**

> **Tap any event in the report or replay to get its explanation.**
> *"Tank fired at Sandbag: highest-HP target in arc."*

The simulation is rule-based, so these explanations are **free**. This is the cheapest killer feature in the design, and it directly serves Part III §2.3 (combat must be readable).

## E.4 Bot armies seeded from real players

**Every deployment ever submitted is bot content.** "Ghost" opponents are just stored formations.

- Day-one web traffic gets instant opponents.
- Those opponents play like humans, because humans designed them.
- The "Hard AI" of Part III §53 becomes *"search the library of real human formations."*

```text
Store every deployment from the very first playtest onward.
```

## E.5 Replay sharing

A full replay is `(deploymentA, deploymentB, seed)` — **under 200 bytes.** That is a URL.

Every match result screen gets **"copy replay link."** This is the shareable artifact and the community seed: formation-of-the-week, "beat this defense" challenges. Nearly free given the deterministic engine.

## E.6 Accessibility

- **Blue vs. orange** team colors. Never red/green.
- **Shape and silhouette coding** so color is never the only channel.
- ≥44px effective tile targets on touch.
- Toggles for screen shake and reduced motion.
- Scalable battle-report text.

Cheap now. Expensive to retrofit.

## E.7 Audio — pull it forward

The original notes defer sound to Phase 23. But **sound is half the watch phase's juice** on this art budget.

Six SFX in the demo:

```text
rifle crack
MG burst
tank thump
mortar whistle + boom     ← the falling whistle IS suspense, in audio form
sandbag collapse
HQ destruction
```

## E.8 Monetization: explicitly none for the demo

Decide this now so nothing warps around it.

```text
Free web game.
If it works: cosmetics only — unit skins, board themes, victory stamps.
NEVER units. NEVER boosts.
```

Part III §24's instinct is right. This writes it down as policy.

---

# F. Scope Cut — What Actually Ships

Twenty-four phases is a plan for a studio. This is the solo-developer version.

## F.1 Cut or defer indefinitely

Do not design these. Do not build data models for them. Revisit only if the core proves fun **and** finds players.

| Cut | Was | Why |
| --- | --- | --- |
| Aircraft + Anti-Air | Phase 13, §27–28 | An entire off-board subsystem for one unit |
| Formation synergies | Phase 14, §29 | Hidden multipliers fight readability. The base game's overlapping-arcs geometry **is** the synergy system |
| Recon / Fog of war / Decoys | Phases 15–17, §30, §32, §33 | All three are "more hidden information" — deployment secrecy already provides that. Decoys are the first to revisit, much later |
| Commanders | Phase 18, §37 | Build identity before build variety |
| Terrain + Procedural maps | Phases 19–20, §35–36 | Solve balance on one board first |
| Ranked + Cosmetics | Phases 22, 24 | Needs a playerbase |
| Scout, Mines, Sniper, Bunker, Anti-Tank | Phase 12, §31, §34 | Add units only after the base six are proven |
| Eight-direction facing | §7 | Doubles preview/LOS surface for marginal depth |
| Damage variance | §2.4 | See §B.8.1 |
| Secondary objective modes | §20, §42 | Classic mode only |

## F.2 The demo — the smallest thing that answers "is deployment fun?"

**Board and army**
- 12×14 board, zones per §B.1
- Fixed identical armies per §C.2
- 4 facings

**Deployment**
- Place, rotate, remove
- **Arc preview with LOS shadowing** — non-negotiable; it is the entire readability thesis
- Ready

**Battle**
- Full engine per §B
- Reveal + countdown
- Minimal juice: tracers, health bars, damage states, explosions, the six sounds, one slow-mo on HQ kill

**After**
- Battle report: per-unit damage, idle time, one auto-generated "key moment" line
- **Rematch that reloads your previous formation for editing**
- "Watch again" (one button, given determinism)

**Opponents — three kinds**
- Pass-and-play hotseat
- 3 handcrafted bot formations (Easy/Medium from §53)
- **5 puzzle setups** (visible enemy, beat it)

## F.3 Explicitly NOT in the demo

```text
Online play of any kind — even async.
    (Hotseat + puzzles answer the core question first.)
Army budget / draft mode.
    (Phase 10 — the FIRST post-validation feature, not a demo feature.)
Replays-as-links.
Accounts, leaderboards.
Hard AI.
Everything in the cut list.
```

That is Part III Phases 0–8, compressed, plus puzzles, minus everything else.

## F.4 Order of work after the demo proves fun

```text
1. Async play-by-link
2. Daily puzzle + leaderboard
3. Draft mode (army budget)
4. Ghost-army matchmaking
```

In that order — because **each one multiplies the audience of the previous.**

---

# G. Naming

| Title | Rationale |
| --- | --- |
| **Hidden Front** *(current)* | Names the core mechanic (hidden) and the setting (front). Two common words in an uncommon pairing — strong searchability, no dominant incumbent in games. Pronounceable and spellable worldwide. |
| **Trench Gambit** | "Gambit" signals chess-brain strategy, "trench" signals the setting. Unique collocation that will own its search results. Reads well on a store page. |
| **Enfilade** | The actual military term for fire along the length of a line — i.e. this game's core geometry. One ownable word. Risk: most players can't spell or say it. |
| **Dug In** | Purest mechanical match (units never move), punchy — but a common English phrase (terrible SEO) and it collides with an infamous political surname. **Pass.** |
| **Firing Lines** | Literal and self-explaining. But generic enough that search results will be a soup of idioms and journalism. |
| **The Big Push** | Authentic WWI slang for a grand offensive, has the wry toy-soldier tone. Weak searchability, low genre signal. |
| **No Man's Land** | Maximally evocative and exactly on-theme. Also maximally taken (films, games, TV). **The cautionary example:** evocative-but-unownable is the trap. |

**Decision: keep "Hidden Front." Fallback: "Trench Gambit."**

Practical domain reality: `hiddenfront.com` may be parked or priced, but `hiddenfront.game`, `.gg`, or `playhiddenfront.com` are the realistic route regardless of which title wins. Modern web games live on `play<name>` and `.gg` domains — **don't let .com availability pick your name.**

Run a trademark / Steam / itch search before committing. If "Hidden Front" collides (there are WWII mod-adjacent uses of similar phrases), switch to Trench Gambit without ceremony.

---

# PART II — TECH STACK

---
# H. MVP Demo — Tech Stack

## H.1 What the demo has to prove

The demo exists to answer one question:

```text
Is deployment itself fun?
```

Everything in this stack is chosen to reach that answer fast and then get out of the way.
Constraints that follow from the goal:

- **No backend.** Local hotseat on one device. Zero servers, zero accounts, zero deploy pipeline beyond a static host.
- **No art pipeline.** Programmer art and free CC0 sprites. Do not commission or draw anything.
- **No renderer investment.** DOM elements are enough for a 12x14 board. Do not open PixiJS yet.
- **Engine written as if it will be reused**, because it will be. This is the one place to spend care.

Target: a playable hotseat build in **2-4 weeks of evenings**, hosted at a URL you can send to a friend.

---

## H.2 The stack

| Layer | Choice | Why this one |
| --- | --- | --- |
| Language | **TypeScript** (`strict: true`, `noUncheckedIndexedAccess: true`) | The engine is all data transforms. Types catch the entire class of "wrong field name in a unit config" bugs for free. |
| Build tool | **Vite** | Instant dev server, zero-config TS, one command to a static `dist/`. |
| UI framework | **React** | You need drag-and-drop, panels, tooltips and modals — a UI framework earns its keep here. |
| Rendering | **DOM + CSS Grid** | 168 tiles. The browser handles this without effort. Native click/drag/hover, and you can debug the board in DevTools. |
| Animation | **CSS transitions + Web Animations API** | Projectiles are a `translate` over 120ms. Explosions are a scale + fade. No library needed. |
| State (UI) | **Zustand** | Tiny, no boilerplate, and — critically — readable/writable from outside React, so the engine never has to know React exists. |
| Engine | **Plain TypeScript, zero dependencies** | Pure functions over plain objects. No classes with hidden state, no framework coupling. |
| RNG | **Hand-rolled `mulberry32`** (≈10 lines) | Seeded, deterministic, portable. `Math.random()` is **banned** in `src/game/` — enforce it with a lint rule. |
| Testing | **Vitest** | Same config as Vite. Needed for the determinism tests described below. |
| Lint / format | **Biome** | One binary replaces ESLint + Prettier. For a solo dev, that's one less config to maintain. |
| Package manager | **pnpm** | Fast, strict, and already the right shape for the monorepo the final build needs. |
| Persistence | **`localStorage`** | Saved formations, last match, settings. That is the whole persistence story for the demo. |
| Hosting | **Cloudflare Pages / Vercel / Netlify** — static | `git push` deploys. Free tier is more than sufficient. |

### Deliberately NOT in the MVP

| Rejected | Reason |
| --- | ---: |
| PixiJS / Canvas / WebGL | The rules are not stable yet. A canvas renderer makes every rule change more expensive to visualize. |
| Redux / MobX / XState | Zustand covers it. The complex state lives in the engine, not the UI. |
| A backend of any kind | Hotseat needs none. Adding one now buys nothing and costs weeks. |
| Tailwind / component library | ~15 screens' worth of CSS. Plain CSS Modules is less to learn and less to fight. |
| A physics engine | Grid game. Positions are integers. |
| An ECS library | 20 units per side. Arrays and `for` loops are faster to write and faster to run. |
| Sound design | One pass of free SFX at the end of the demo, or skip entirely. |

---

## H.3 Determinism is a hard requirement from day one

Replays, the AI opponent, server-authoritative multiplayer, and the balance test suite **all** depend on the same input producing the same battle, forever. Retrofitting determinism is painful; getting it right on day one is nearly free.

The engine contract is specified in Part I §B.8. Four implementation rules enforce it:

**1. Integers only inside the engine.**
Store HP and damage as whole numbers. Store time as **ticks**, not seconds. Where fractions are unavoidable (the damage-type multipliers in Part I §C.1), compute in floats and round half-up to an integer with a minimum of 1 — or use fixed-point — multiply by 1000, do integer math, divide at the end.

```ts
// cooldowns are authored in seconds, compiled to ticks at load
const TICKS_PER_SECOND = 20;
const toTicks = (seconds: number) => Math.round(seconds * TICKS_PER_SECOND);

toTicks(0.7);  // 14 ticks
toTicks(2.8);  // 56 ticks
toTicks(4.0);  // 80 ticks
```

Every cooldown in the config must land on a clean tick boundary. Author unit stats in multiples of 0.05s.

**2. Never call `Math.sin`, `Math.cos`, `Math.pow`, or `Math.sqrt` in the engine.**
IEEE-754 `+ - * /` are exactly specified and portable. The transcendental functions are **not** — they are allowed to differ between JS engines and CPU architectures. A battle simulated on the player's phone must match one simulated on your server, exactly. For distance checks, compare squared integer distances:

```ts
// never: Math.sqrt(dx*dx + dy*dy) <= range
const inRange = dx * dx + dy * dy <= range * range;
```

**3. Iteration order must be stable.**
Never iterate a `Set` or `Map` whose insertion order depends on player input, and never sort with a comparator that can return `0` for two different units. Every unit gets a stable integer `id` assigned at deployment-lock time, and every tie-break in targeting ends with `a.id - b.id`.

**4. One RNG stream, drawn in a fixed order.**
A single seeded generator, advanced only inside the simulation loop, in tick order. Never draw a random number from the renderer — visual jitter must use a separate, non-engine RNG.

### The test that protects all of this

```ts
// src/game/engine/__tests__/determinism.test.ts
it("produces an identical event log for identical input", () => {
  const a = simulateBattle({ playerA, playerB, seed: 12345, config: UNITS_V1 });
  const b = simulateBattle({ playerA, playerB, seed: 12345, config: UNITS_V1 });
  expect(hash(a.events)).toBe(hash(b.events));
});

it("matches the recorded golden log", () => {
  const result = simulateBattle(GOLDEN_FIXTURE);
  expect(hash(result.events)).toMatchSnapshot();
});
```

Keep a folder of ~20 golden fixtures — real formations from playtests. Any intentional balance change breaks them loudly and you re-bless the snapshots on purpose. Any *unintentional* change is caught the moment you make it.

---

## H.4 The one architectural rule

The engine must run a complete battle with no DOM, no React, and no browser:

```ts
const result = simulateBattle({
  playerA,       // Deployment
  playerB,       // Deployment
  seed: 12345,
  config: UNITS_V1,
});

// result: { winner, events: BattleEvent[], stats: MatchStats, endedAtTick }
```

If that call works in a bare Node process, then for free you get: the replay system, the headless AI that evaluates thousands of formations, server-authoritative multiplayer, the balance test suite, and a `pnpm balance:sweep` script that plays 10,000 matches overnight and prints unit win rates.

The UI never simulates. It **submits deployments and plays back an event log.** Two different consumers of the same log:

```text
                    ┌──────────────────┐
   Deployments ────▶│  simulateBattle  │────▶ BattleEvent[]
   + seed           └──────────────────┘         │
                                                 ├──▶ BattleRenderer  (animates it)
                                                 └──▶ BattleReport    (aggregates it)
```

Because the report reads the same log the renderer does, its numbers can never disagree with what the player just watched.

---

## H.5 Art and audio without an artist

- **Sprites:** [Kenney.nl](https://kenney.nl) asset packs — CC0, no attribution required, top-down military and tower-defense sets that fit this game exactly.
- **Fallback:** CSS shapes and Unicode/emoji tokens. A colored square with a direction chevron is a completely adequate soldier for a playtest.
- **UI icons:** Lucide (MIT).
- **Font:** one condensed sans for HUD, one monospace for stat readouts. Google Fonts.
- **SFX:** freesound.org (filter to CC0) or generate with jsfxr. One `<audio>` pool, no library.

Readability beats fidelity. Every unit must be identifiable at a glance by **shape and facing**, not by color alone — which also solves colorblind accessibility before it becomes a problem.

---

## H.6 Repository layout for the demo

```text
hidden-front/
├── src/
│   ├── game/                 ← zero React imports, zero DOM. Enforce with a lint rule.
│   │   ├── config/           ← units.ts, gameConfig.ts, CONFIG_VERSION
│   │   ├── engine/           ← BattleEngine, Targeting, Damage, LineOfSight, Victory
│   │   ├── models/           ← Unit, Grid, BattleState, Deployment
│   │   ├── rng/              ← mulberry32
│   │   └── __tests__/        ← determinism + golden fixtures
│   ├── components/           ← Grid, Unit, ArmyPanel, BattleHUD, Results
│   ├── screens/              ← Home, Deployment, Battle, Results
│   ├── store/                ← Zustand
│   └── styles/
├── biome.json
├── vite.config.ts
└── package.json
```

The `src/game/` boundary is the most valuable line in the project. Guard it:

```json
// biome.json — no framework imports inside the engine
"noRestrictedImports": {
  "paths": { "react": "The engine must not import React." }
}
```

---

# I. Final Build — Tech Stack

## I.1 What changes, and what deliberately does not

The engine written for the demo is the engine that ships. It does not get rewritten — it gets **published as a package and run in two places**. Everything below is added around it.

| Concern | MVP Demo | Final Build |
| --- | --- | --- |
| Battle rendering | DOM + CSS | **PixiJS v8** (WebGL/WebGPU) |
| Simulation location | Client only | **Client + server, same code, server is authoritative** |
| Opponent | Human on the same device | Online (async + realtime) and AI |
| Persistence | `localStorage` | **PostgreSQL** |
| Accounts | None | Guest-first, upgradeable |
| Repo shape | Single app | **pnpm workspace monorepo** |
| Telemetry | `console.log` | Analytics + balance pipeline |

---

## I.2 Monorepo — the shared engine is the whole architecture

```text
hidden-front/
├── packages/
│   ├── engine/         ← the demo's src/game/, published as @hf/engine. Zero deps.
│   ├── config/         ← unit stats + CONFIG_VERSION, imported by both sides
│   └── protocol/       ← shared request/response types + Zod schemas
├── apps/
│   ├── web/            ← React + Pixi client
│   ├── server/         ← Fastify + WebSocket
│   └── bots/           ← headless AI + overnight balance sweeps
└── turbo.json
```

**pnpm workspaces + Turborepo.** The client and server import the identical `@hf/engine` build. A match simulated on the server and replayed on the client produce byte-identical event logs — that is what makes cheating structurally impossible rather than merely difficult.

---

## I.3 Client

| Layer | Choice | Notes |
| --- | --- | --- |
| Shell / UI | **React + TypeScript** | Menus, army panel, battle report, lobby, profile. Unchanged from the demo. |
| Battle renderer | **PixiJS v8** | Batched sprites, particle effects, projectile trails, screen shake, hundreds of draw calls at 60fps. WebGPU with WebGL2 fallback. |
| Pixi ↔ React bridge | **Manual, via `useRef`** | Mount Pixi into a container ref and drive its own `requestAnimationFrame` loop. Do **not** put per-frame battle state in React state — React reconciliation has no business running at 60fps. React owns the chrome; Pixi owns the canvas. |
| Deployment screen | **Stays DOM** | Drag-and-drop, hover tooltips, and accessibility are all easier and better in the DOM. There is no reason to move it into the canvas. |
| Routing | **React Router** or TanStack Router | TanStack if you want typed routes. |
| Server state | **TanStack Query** | Match history, leaderboards, profiles. Caching and retries for free. |
| Realtime | **Native `WebSocket`** + a thin reconnect wrapper | The payloads are tiny and structured. Socket.IO's fallbacks are not worth its weight here. |
| Validation | **Zod**, shared via `@hf/protocol` | One schema validates on the client for UX and on the server for safety. |
| Audio | **Howler.js** | Sprite sheets for SFX, pooling, mobile unlock handling — all the tedious parts solved. |
| PWA | **Vite PWA plugin** | Installable, offline-capable single-player. Meaningful on mobile web. |
| i18n | **react-i18next** | Only when you actually go multi-language. |

---

## I.4 Server

**The key insight: this game barely needs realtime networking.**

Deployment is submitted **once**. The battle is a pure function of two deployments plus a seed. There is no per-frame state to synchronize, no input prediction, no rollback, no lag compensation — none of the hard parts of multiplayer games apply. The server receives two ~2KB payloads, runs the simulation, and returns an event log. That is the entire netcode.

```text
Client A ──POST deployment──▶┐
                             ├──▶ simulateBattle() ──▶ event log ──▶ both clients
Client B ──POST deployment──▶┘        (server-authoritative)
```

Bandwidth per match is measured in kilobytes. This scales absurdly cheaply and it means **async play is the default mode, not a compromise.**

| Layer | Choice | Notes |
| --- | --- | --- |
| Runtime | **Node.js LTS** | Boring and correct. Bun is faster but Node's operational maturity is worth more than the milliseconds here. |
| HTTP framework | **Fastify** | Fast, first-class TypeScript, schema-based validation that pairs with Zod. |
| Match rooms | **Cloudflare Durable Objects** *or* a Fly.io stateful process | A DO per match is an excellent fit: one object holds both players' ready state, lives near the players, costs almost nothing idle, and dies when the match ends. Fly.io is the simpler mental model if you'd rather run one boring Node process. |
| Database | **PostgreSQL** (Neon or Supabase) | Users, matches, deployments (`jsonb`), ratings, seasons, ladders. |
| ORM | **Drizzle** | TypeScript-native, generates real SQL, no runtime magic, trivial migrations. |
| Cache / queue | **Redis** (Upstash) | Matchmaking queue, presence, rate limits, leaderboard sorted sets. |
| Auth | **Guest-first**, then Clerk or Supabase Auth | Critical: let people play immediately with a generated handle and upgrade to a real account later. Forcing signup before the first match will cost you most of your funnel. |
| Client hosting | **Cloudflare Pages / Vercel** | Static, edge-cached. |
| Server hosting | **Fly.io** or **Railway** | Long-lived WebSocket connections need a persistent process. Serverless functions are the wrong shape for this. |
| CI | **GitHub Actions** | Typecheck, Biome, Vitest, and the determinism golden tests on every PR. |
| Errors | **Sentry** | With source maps. |
| Product analytics | **PostHog** | Funnels, retention, session replay of the *UI* (not the battle — you already have real replays). |

---

## I.5 Replays and the config-version trap

Store replays as inputs, never as video or frames:

```ts
interface Replay {
  id: string;
  deploymentA: Deployment;   // ~1-2 KB
  deploymentB: Deployment;
  seed: number;
  configVersion: string;     // ← the part that is easy to forget
  engineVersion: string;
  createdAt: string;
}
```

A full replay is **under 4KB**. A million replays fit in a few gigabytes.

**The trap:** the moment you ship a balance patch, every stored replay silently desyncs — it replays against the new numbers and produces a different battle than the one the player actually watched. So:

- Pin `configVersion` **and** `engineVersion` into every replay.
- Keep every historical config in `packages/config/versions/` forever. They are a few kilobytes each.
- The replay loader resolves the config by version, not by "latest".
- If an engine change is genuinely breaking, mark old replays as archived rather than replaying them wrong.

This also gives you the shareable artifact: a replay URL is `/r/<id>` and it is the single best organic growth mechanism this game has. Make it one click from the battle report.

---

## I.6 The AI opponent falls out of the architecture

Because the engine is headless and deterministic, the "Hard" AI in Part III §53 needs no machine learning and no special infrastructure:

```ts
// apps/bots — runs in a Worker on the client, or as a server job
const candidates = generateFormations(1000);
const scored = candidates.map(f => ({
  formation: f,
  score: averageResult(
    likelyEnemyFormations.map(e => simulateBattle({ playerA: f, playerB: e, seed }))
  ),
}));
const best = maxBy(scored, s => s.score);
```

A full battle simulates in low single-digit milliseconds. Thousands of evaluations fit comfortably inside a "thinking..." spinner — and inside a **Web Worker**, so the UI never janks.

Two things this unlocks that are worth more than the AI itself:

1. **Matchmaking with no playerbase.** Seed the bot pool with real formations harvested from actual players. A new player at 3am always gets an opponent, and that opponent plays like a human because a human designed it.
2. **Automated balance.** `pnpm balance:sweep` plays 10,000 matches overnight across the formation space and prints the Part III §52 metrics table. Unit win rates, pick rates, idle time, average match duration — measured, not guessed. This is the single highest-leverage tool you can build for this game.

---

## I.7 Native and store distribution — only if traction justifies it

Ship web first. It has no install friction, and a URL is shareable in a way an app store listing is not.

| Target | Path | Notes |
| --- | --- | ---: |
| Web / PWA | Vite PWA plugin | The default. Installable on mobile. |
| iOS / Android | **Capacitor** | Wraps the existing web build. Weeks, not months. |
| Steam / desktop | **Tauri v2** | ~10MB binary vs Electron's ~150MB, and it reuses the same web build. |

Do not build native clients until retention on web says people want them.

---

## I.8 Migration path — demo to final, without a rewrite

Each step is independently shippable, and none of them requires touching the engine:

```text
1. Extract src/game/ into packages/engine/         (mechanical; the lint boundary already made this safe)
2. Add apps/server — POST two deployments, return an event log
3. Async multiplayer: submit a deployment, get notified when the opponent submits
4. Realtime lobby + ready state over WebSocket
5. Accounts, match history, replay URLs
6. Swap the battle renderer DOM → Pixi   (the event log interface does not change)
7. Ranked, Elo, seasons
8. Balance sweep tooling + telemetry dashboards
```

Step 6 is the point of the whole architecture: **the renderer is replaceable because it only ever consumes `BattleEvent[]`.** Nothing else in the codebase notices the swap.

# PART III — DESIGN REFERENCE & EXPANSION BACKLOG

> These are the original exploratory design notes. They remain valuable as a
> catalogue of ideas, a phasing reference, and a record of the reasoning behind
> the decisions in Part I.
>
> **Where Part III disagrees with Part I, Part I is authoritative.**
>
> The known conflicts have been annotated inline with `> **SUPERSEDED —**` notes.
> Sections describing cut features (aircraft, fog of war, commanders, terrain,
> recon, decoys, formation synergies) are retained as a **future backlog**, not
> as a build plan. See Part I §F for what actually ships.

---
# 1. Game Vision

Hidden Front is a grid-based tactical strategy game where players secretly deploy a limited army on their half of a battlefield.

Units do **not move after deployment**.

Instead, every unit has:

- Health
- Damage
- Attack range
- Attack pattern
- Attack direction
- Attack speed / cooldown
- Target priority
- Armor or unit class
- Optional special ability

Once both players finish deployment, the battlefield is revealed and the battle resolves automatically.

The strategy comes from:

- predicting the opponent's placement
- choosing unit direction
- creating overlapping attack zones
- protecting important units
- countering likely enemy formations
- deciding where to place the HQ
- spreading units to avoid splash damage
- deciding how much to invest in offense vs defense

The player should feel:

> "I won because I predicted the opponent correctly."

or

> "I can clearly see what I should change in the next match."

The simulation should not feel random or unfair.

---

# 2. Core Design Principles

## 2.1 Deployment is the main gameplay

The most important phase is not combat.

It is:

**planning before combat starts.**

The player should spend most of their thinking on:

- positioning
- direction
- defensive lines
- lanes
- firing arcs
- protection
- baiting
- bluffing
- anticipating the opponent

---

## 2.2 Units remain stationary

For the initial game design, units do not move after deployment.

This gives the game its identity.

Instead of:

> "Where should I move this unit?"

the player asks:

> "Where will this unit have the highest impact if the enemy appears where I expect?"

Movement can be introduced much later as a separate game mode if desired.

---

## 2.3 Combat should be highly readable

The player must understand:

- who attacked
- what they targeted
- why they selected that target
- how much damage was dealt
- what blocked the attack
- why a unit died
- what formation mistake caused the loss

Avoid hidden combat rules.

---

## 2.4 Low randomness

> **SUPERSEDED — see Part I §B.8.1.** Damage variance is **cut entirely** from the MVP. Randomness = tie-breaks only. Variance adds noise to the loss autopsy (*"did I lose to a plan or to dice?"*) while doing nothing for the reveal.

The result should mostly come from strategy.

Recommended ratio:

- **85–90% positioning / army composition / targeting**
- **10–15% light randomness**

Possible randomness:

- damage ±5%
- occasional small critical hit
- random tie-breaking between equally valid targets

Avoid:

- large miss chances
- 50% accuracy systems
- extreme random critical hits
- random targeting without visible rules

---

# 3. Core Match Loop

```text
START MATCH
    ↓
PLAYER A DEPLOYMENT
    ↓
Hide Player A army
    ↓
PLAYER B DEPLOYMENT
    ↓
Both players READY
    ↓
BATTLEFIELD REVEAL
    ↓
Countdown
3
2
1
    ↓
SIMULTANEOUS AUTOMATIC COMBAT
    ↓
HQ destroyed / army defeated
    ↓
RESULT
    ↓
BATTLE REPORT
    ↓
REPLAY / REMATCH
```

Recommended match duration:

| Phase | Target Duration |
| --- | ---: |
| Deployment | 60–120 sec |
| Reveal / Countdown | 3–5 sec |
| Combat | 15–30 sec |
| Results | 5–15 sec |
| Full match | 2–4 min |

---

# 4. Battlefield

> **SUPERSEDED — see Part I §B.1.** Zones are now exact: **rows 1–6 Player B, rows 7–8 no man's land (2 rows, permanently empty), rows 9–14 Player A.** The 2-row gap is why Soldier range moved from 3 to 4.

## Recommended MVP Grid

Start with:

```text
12 columns × 14 rows
```

Alternative:

```text
12 × 16
```

The battlefield is divided horizontally.

Example:

```text
PLAYER B DEPLOYMENT AREA

┌────────────────────────────┐
│ . . . . . . . . . . . .  │
│ . . . . . . . . . . . .  │
│ . . . . . . . . . . . .  │
│ . . . . . . . . . . . .  │
│ . . . . . . . . . . . .  │
│ . . . . . . . . . . . .  │
├────────────────────────────┤
│         NO MAN'S LAND      │
├────────────────────────────┤
│ . . . . . . . . . . . .  │
│ . . . . . . . . . . . .  │
│ . . . . . . . . . . . .  │
│ . . . . . . . . . . . .  │
│ . . . . . . . . . . . .  │
│ . . . . . . . . . . . .  │
└────────────────────────────┘

PLAYER A DEPLOYMENT AREA
```

Players can only deploy inside their own zone.

---

# 5. Initial MVP Army

Recommended first playable army:

| Unit | Quantity |
| --- | ---: |
| Soldier | 5 |
| Tank | 2 |
| Machine Gun | 2 |
| Sandbag | 8 |
| Mortar | 1 |
| HQ | 1 |

Aircraft should be introduced later.

This is enough to test whether the fundamental gameplay works.

---

# 6. Core Unit Data Model

Example TypeScript model:

```ts
export type Team = "A" | "B";

export type Direction =
  | "N"
  | "NE"
  | "E"
  | "SE"
  | "S"
  | "SW"
  | "W"
  | "NW";

export type AttackPattern =
  | "line"
  | "cone"
  | "radius"
  | "indirect"
  | "none";

export type TargetPriority =
  | "closest"
  | "highestHp"
  | "lowestHp"
  | "highestValue"
  | "infantryFirst"
  | "structureFirst";

export interface Unit {
  id: string;

  type: string;
  team: Team;

  row: number;
  col: number;

  direction: Direction;

  hp: number;
  maxHp: number;

  damage: number;
  range: number;

  attackCooldown: number;
  lastAttackAt: number;

  attackPattern: AttackPattern;
  targetPriority: TargetPriority;

  // armor?: number;   // REMOVED — Part I §B.10 uses damage-type
                       // multipliers only. Do not implement flat armor.

  isDestroyed: boolean;

  cost?: number;

  tags?: string[];
}
```

---

# 7. Attack Direction

> **SUPERSEDED — see Part I §B.13.** **Four directions, permanently.** Do not upgrade to eight — diagonals double the preview and LOS surface for marginal depth. Facing is also **locked at Ready** (§B.6): search cone and fire cone are the same cone, and no unit ever rotates mid-battle.

Facing direction should be one of the most important mechanics in the game.

A placed unit must be rotatable.

Possible directions:

```text
      N
   NW   NE

W    UNIT    E

   SW   SE
      S
```

For MVP, four directions are simpler:

```text
N
E
S
W
```

Later upgrade to eight directions.

---

# 8. Attack Patterns

## 8.1 Soldier

Basic straight-line firing.

Example:

```text
X
X
X
S
```

Possible stats:

```text
HP: 30
Damage: 10
Range: 4                 <-- UPDATED (was 3). Part I §C.3
Cooldown: 1.0 sec
Priority: Closest target
```

---

## 8.2 Machine Gun

Shorter range but wider attack cone.

Example:

```text
X X X X X
  X X X
    MG
```

Possible stats:

```text
HP: 50
Damage: 8 per target, up to 3 targets   <-- DEFINED. Part I §B.13
Range: 4
Cooldown: 0.7 sec
Priority: Infantry
```

Purpose:

- punish infantry formations
- protect lanes
- create wide denial zones

---

## 8.3 Tank

Long range and high damage.

Example:

```text
    X
    X
    X
    X
    X
    X
   TANK
```

Possible stats:

```text
HP: 120
Damage: 40
Range: 6
Cooldown: 2.8 sec
Priority: Highest HP enemy
Armor: High
```

---

## 8.4 Mortar

Indirect ranged attack.

Mortar should not attack adjacent enemies.

Example:

```text
X X X
X X X
X X X

minimum-range gap

  M
```

Possible stats:

```text
HP: 35
Damage: 30
Splash Radius: 1
Min Range: 3
Max Range: 10             <-- UPDATED (was 7). Part I §C.3
Cooldown: 4 sec
Priority: Largest cluster
```

Purpose:

- punish clustering
- punish sandbag formations
- attack protected units indirectly

---

## 8.5 Sandbag

Sandbags do not attack.

Possible stats:

```text
HP: 60                   <-- FIXED. Part I §C.2
Damage: 0
```

Functions:

- blocks bullets
- provides directional protection
- reduces explosive damage partially
- occupies one tile

Recommended rules:

```text
Bullet damage:
blocked completely until sandbag breaks.

Tank shell:
high damage to sandbag.

Mortar:
moderate-high damage.

Explosion behind sandbag:
partially reduced.
```

---

## 8.6 HQ

Each player gets one HQ.

The HQ can be placed inside their deployment zone.

Possible stats:

```text
HP: 200
Attack: none
Size: 2×2                <-- DECIDED. Part I §B.11
```

Primary victory condition:

> Destroy enemy HQ.

Secondary victory condition:

> Destroy all enemy combat-capable units.

The HQ creates meaningful offense-vs-defense decisions.

---

# 9. Line of Sight

Line of sight should matter.

A unit should not shoot through:

- intact sandbags
- bunkers
- some structures
- ~~optionally other large units~~ — **NO.** Only sandbags and the HQ
  block line of sight, and they block it for both teams. Part I §B.4.

Possible MVP rule:

```text
Ray cast from attacker cell toward target cell.

If a blocking object exists between attacker and target:
attack cannot hit the target.
```

Mortars ignore line of sight.

---

# 10. Damage Types

Eventually divide damage into:

```text
Bullet
Heavy
Explosive
Anti-Air
```

Example effectiveness:

| Attack | Infantry | Tank | Sandbag |
| --- | ---: | ---: | ---: |
| Bullet | High | Low | Low |
| Heavy shell | Medium | High | High |
| Explosive | High | Medium | High |

This avoids a single universal "best unit".

---

# 11. Armor

> **SUPERSEDED — see Part I §B.10.** **The flat armor stat is deleted.** Mitigation is handled entirely by the damage-type multiplier table in §C.1. Two overlapping mitigation systems is one too many to explain, and `max(1, dmg - armor)` makes massed chip fire weirdly good against tanks.

Armor can reduce incoming damage.

Simple MVP formula:

```ts
finalDamage = Math.max(1, baseDamage - armor);
```

Later:

```ts
finalDamage =
  baseDamage *
  damageTypeMultiplier *
  armorMultiplier *
  randomVariance;
```

Keep formulas easy to understand.

---

# 12. Simultaneous Combat

> **SUPERSEDED — see Part I §B.8.** The example timeline below contains an arithmetic error (the MG fires at 0.3s then 0.8s on a 0.7s cooldown). The real contract is: integer tick cooldowns, **first shot at 50% of cooldown**, and **two-phase tick resolution** so simultaneous lethal hits kill both units.

Combat should be simultaneous rather than turn-based.

Each unit independently attacks according to its cooldown.

Example timeline:

```text
0.0s Soldier fires
0.3s MG fires
0.8s MG fires
1.0s Soldier fires
1.5s Tank fires
2.0s Soldier fires
2.8s Tank reload finishes
```

The engine should use a deterministic simulation tick.

Recommended:

```text
20 simulation ticks / second
```

or:

```text
fixed timestep = 50ms
```

Visual rendering can still run at 60 FPS.

---

# 13. Predictable Target Selection

> **See also Part I §B.7 and §B.9.** Targeting is re-evaluated from scratch on every ready tick — units never hold a target, so there is no re-acquisition problem. The mortar's "largest cluster" rule is specified as a concrete scoring algorithm in §B.9.

Units require visible target priority rules.

Examples:

## Soldier

```text
Nearest target inside firing arc
```

## Tank

```text
Highest HP target inside firing arc
```

## Machine Gun

```text
Nearest infantry target
```

Fallback:

```text
Nearest valid target
```

## Mortar

```text
Enemy location containing highest total nearby unit value
```

## Sniper — future

```text
Lowest HP / highest-value specialist
```

## Plane — future

```text
Highest-value exposed target
```

These priorities should be visible in the unit tooltip.

---

# 14. Unit Value

Each unit can have an internal tactical value.

Example:

```text
Soldier: 5
Machine Gun: 12
Mortar: 15
Tank: 20
Plane: 25
```

Target priority can use this value.

---

# 15. Deployment UX

The deployment interface should provide:

- drag unit from inventory
- place unit on grid
- click unit to select
- rotate selected unit
- remove unit
- move unit before Ready
- preview firing arc
- preview blocked firing path
- show remaining army pieces
- Ready button
- reset formation button

Example:

```text
┌────────────────────────────────────────┐
│              ENEMY AREA                │
│                                        │
│               HIDDEN                   │
│                                        │
├────────────────────────────────────────┤
│              FRONT LINE                │
├────────────────────────────────────────┤
│                                        │
│              YOUR AREA                 │
│                                        │
└────────────────────────────────────────┘

ARMY
------------------------------------------
Soldier       ● ● ● ● ●
Tank          ● ●
Machine Gun   ● ●
Mortar        ●
Sandbag       ● ● ● ● ● ● ● ●
HQ            ●

[ RESET ]                [ READY ]
```

---

# 16. Attack Range Preview

> **SUPERSEDED — see Part I §C.2.** The tank diagram below shows range **4**; the tank's actual range is **6**. Stats win — fix the diagram.

Selecting a unit should highlight exactly where it can attack.

Example tank:

```text
░ ░ ░ █ ░ ░
░ ░ ░ █ ░ ░
░ ░ ░ █ ░ ░
░ ░ ░ █ ░ ░
░ ░ ░ T ░ ░
```

Attack previews are mandatory for making the game intuitive.

---

# 17. Reveal Phase

After both players click Ready:

1. Lock both deployments.
2. Hide interaction controls.
3. Reveal both armies.
4. Camera can slightly zoom out.
5. Pause for 1–2 seconds.
6. Show countdown.

```text
3
2
1
BATTLE
```

The reveal should be one of the emotional high points of the match.

---

# 18. Battle Visualization

Combat feedback should feel satisfying even with simple graphics.

Recommended visual effects:

## Soldier

- muzzle flash
- tracer
- small impact
- recoil

## Machine Gun

- rapid burst
- multiple tracers
- repeated hit flashes

## Tank

- large recoil
- visible projectile
- stronger impact
- slight screen shake

## Mortar

- shell arc
- delayed landing
- explosion
- splash hit markers

## Sandbags

- cracks / damage state
- pieces breaking
- final collapse

## Damaged units

Show progressive health states:

```text
100% -> normal
<60% -> damaged
<30% -> smoke / critical
0% -> destroyed
```

---

# 19. Slow Motion Moments

Use slow motion sparingly.

Examples:

- final projectile heading toward HQ
- last surviving tank
- simultaneous final shots
- HQ destruction

Suggested:

```text
Normal: 1.0×
Slow motion: 0.35×
Duration: 0.5–1.5 seconds
```

Do not use slow motion for every destruction.

---

# 20. Victory Conditions

> **SUPERSEDED — see Part I §B.3.** Full rules now include **army destruction as an outright win** (closes the unreachable-HQ hole), a 5-second dead-air early end, a hard 60-second cap, and an explicit tiebreak ladder.

Primary:

```text
Enemy HQ HP <= 0
```

Secondary:

```text
No enemy combat-capable units remain
```

Possible future objective modes:

- hold center sector
- destroy radar station
- protect convoy
- eliminate commander
- survive fixed duration

---

# 21. Battle Report

After the match, show:

```text
BATTLE REPORT
```

Suggested stats:

| Statistic | Example |
| --- | ---: |
| Damage dealt | 548 |
| Damage received | 622 |
| Damage blocked | 243 |
| Units destroyed | 7 |
| Units survived | 4 |
| HQ remaining HP | 32 |

Per-unit stats:

```text
Tank #1          182 damage
Mortar           141 damage
MG #1             86 damage
Soldier #3        54 damage
```

Also show useful insights.

Example:

```text
KEY MOMENT

Enemy mortar destroyed 3 clustered soldiers.
```

or:

```text
Your tank had no valid target for 8.4 seconds
because its firing lane was blocked.
```

The battle report should teach the player how to improve.

---

# 22. Replay System

> **See also Part II §I.5.** The input-not-video approach below is correct. The missing piece: every replay must pin a **`configVersion` and `engineVersion`**, or the first balance patch silently desyncs every stored replay.

Eventually support:

```text
WATCH REPLAY
```

Controls:

```text
Pause
Play
0.5×
1×
2×
Restart
```

Important implementation idea:

Do not store video.

Store:

- initial deployment
- random seed
- simulation events

Then replay the same deterministic match.

---

# 23. Initial Fixed-Army Mode

The first version should give both players identical armies.

Reason:

- easier to balance
- isolates positioning skill
- easier to test
- less UI
- fewer variables

Recommended:

```text
5 Soldiers
2 Tanks
2 Machine Guns
1 Mortar
8 Sandbags
1 HQ
```

---

# 24. Army Budget System

Once the core is proven, replace fixed armies with army-building.

Example:

```text
Army Budget: 100
```

Possible costs:

| Unit | Cost |
| --- | ---: |
| Soldier | 5 |
| Scout | 6 |
| Machine Gun | 12 |
| Anti-Air | 12 |
| Mortar | 15 |
| Tank | 20 |
| Plane | 25 |
| Sandbag | 3 |
| Mine | 4 |
| Decoy | 3 |

This creates major replayability.

One player may build:

```text
2 Tanks
4 Soldiers
1 MG
8 Sandbags
```

Another:

```text
1 Tank
2 Mortars
6 Soldiers
5 Sandbags
```

---

# 25. Unit Classes

Future unit categories:

## Infantry

- Soldier
- Scout
- Sniper
- Anti-Tank Infantry

## Heavy

- Tank
- Heavy Tank

## Support

- Machine Gun
- Mortar
- Anti-Air

## Defense

- Sandbag
- Bunker
- Barbed Wire
- Decoy

## Air

- Fighter
- Bomber

Avoid introducing too many units too quickly.

---

# 26. Rock-Paper-Scissors Balance

Example relationship:

```text
Tank
 ↓ strong against
Machine Gun

Machine Gun
 ↓ strong against
Infantry

Infantry / Anti-Tank
 ↓ strong against
Tank
```

Additional counters:

```text
Mortar > clustered defenses
AA > aircraft
Aircraft > artillery
Sniper > specialists
Tank > structures
```

Prefer **soft counters**.

Example:

AA should be excellent against planes.

But a plane should not be completely invincible if no AA exists.

---

# 27. Aircraft

> **CUT from the roadmap — see Part I §F.1.** An entire off-board subsystem for one unit. Retained here as future backlog only.

Aircraft should not remain stationary on the battlefield.

Instead, deploy something like:

```text
Airfield
Radio Beacon
Air Support Marker
```

Then the plane performs timed runs.

Example:

```text
Every 6 seconds:
Plane enters battlefield
↓
Selects target
↓
Performs attack
↓
Leaves battlefield
```

Possible target priority:

```text
Tank
>
Mortar
>
Machine Gun
>
Soldier
```

---

# 28. Anti-Air

Possible future unit:

```text
ANTI-AIR GUN
HP: 70
Range: 5
Cooldown: 1.5 sec
Targets: Air
```

Anti-air should be a strong but not mandatory counter.

---

# 29. Formation Synergies

> **CUT from the roadmap — see Part I §F.1.** Hidden multipliers fight readability. The base game's overlapping-arcs geometry **is** the synergy system. Retained here as future backlog only.

Add later only after the basic game is stable.

Examples:

## Infantry Squad

```text
S S S
```

Three adjacent soldiers:

```text
+15% fire rate
```

## Tank Support

```text
S T
```

Adjacent soldier:

```text
+20% effective protection
```

## Entrenched Machine Gun

```text
B B B
B M B
```

Possible bonus:

```text
+20% defense
+1 range
```

## Artillery Spotter

If Scout can detect a target:

```text
Mortar targeting accuracy improves.
```

All formation bonuses must be clearly shown in the UI.

---

# 30. Fog of War

> **CUT from the roadmap — see Part I §F.1.** Deployment secrecy already provides the hidden information. Retained here as future backlog only.

Advanced mode.

Instead of revealing everything when battle starts:

Units remain hidden until:

- they fire
- they receive damage
- a scout detects them
- radar reveals them

This introduces stronger hidden-information gameplay.

Do not use this in the first MVP.

---

# 31. Scout Unit

Possible stats:

```text
HP: 20
Damage: 5
Range: 2
Vision: 5
Cooldown: 1 sec
```

Primary role:

```text
Detect hidden enemies.
```

The scout should be strategically useful despite weak damage.

---

# 32. Reconnaissance

> **CUT from the roadmap — see Part I §F.1.** Same reason as fog of war. Retained here as future backlog only.

Before battle, players may eventually gain limited information.

Example:

```text
Enemy Army Estimate:

Tanks: 1–3
Infantry: 4–7
Artillery: 0–2
Aircraft: YES
```

Alternative:

Choose one:

```text
SCAN LEFT
SCAN CENTER
SCAN RIGHT
```

The scanned area reveals limited enemy information.

---

# 33. Bluffing and Decoys

> **CUT from the roadmap — see Part I §F.1.** The first of the hidden-information features worth revisiting, but much later. Retained here as future backlog only.

Hidden information creates opportunities for bluffing.

Example:

## Tank Decoy

Costs much less than a tank.

During initial reveal it may look like a tank.

After:

- being hit
- a short time
- scout detection

it becomes visible as a decoy.

Possible use:

> Enemy aircraft wastes its attack on the decoy.

Other possibilities:

- fake artillery
- fake HQ
- empty bunker
- dummy defensive line

---

# 34. Mines

Traditional mines require movement, so they are not ideal for the stationary MVP.

Possible alternatives:

## Proximity Trap

Automatically triggers when an enemy attacks a nearby target.

## Remote Mine

Triggers if a valid enemy exists inside a defined sector.

## Delayed Explosive

Detonates at a specific combat time.

Traditional mines should be saved for a future movement-based mode.

---

# 35. Terrain

> **CUT from the roadmap — see Part I §F.1.** Solve balance on one board first. Retained here as future backlog only.

Introduce after combat and balancing are stable.

Possible terrain:

```text
Forest
Hill
River
Building
Mud
Rock
```

Examples:

## Forest

```text
Infantry receives camouflage.
```

## Hill

```text
+1 attack range.
```

## Building

```text
Infantry receives damage reduction.
```

## Mud

Possible future effect:

```text
Reduced heavy-unit attack speed.
```

## Rock

```text
Blocks line of sight.
```

Terrain forces players to adapt instead of memorizing one ideal formation.

---

# 36. Procedural Maps

> **CUT from the roadmap — see Part I §F.1.** Needs a stable balanced base map first. Retained here as future backlog only.

Later, generate different symmetrical or semi-symmetrical battlefields.

Ranked mode should prefer balanced map layouts.

Casual mode can allow more unusual terrain.

---

# 37. Commanders

> **CUT from the roadmap — see Part I §F.1.** Build identity before build variety. Retained here as future backlog only.

Players can eventually select one commander.

Examples:

## Engineer Commander

```text
Defensive structures gain +25% HP.
```

## Tank Commander

```text
Tank reload speed +15%.
```

## Air Commander

```text
Aircraft performs one extra run.
```

## Infantry Commander

```text
Soldiers gain +10 HP.
```

Commanders create build identity without requiring a huge number of unit types.

---

# 38. Preventing Deathball Strategies

Problem:

Players may stack every powerful unit together.

Best counter:

```text
Splash damage.
```

Mortars, bombs, or artillery should heavily punish clustering.

Avoid artificial restrictions like:

```text
Maximum 4 units per area
```

unless absolutely necessary.

Organic counters feel better.

---

# 39. Preventing Sandbag Spam

Potential problem:

A wall of defensive units could stall the match.

Solutions:

- tank shells destroy sandbags efficiently
- mortar splash damages defenses
- sandbags have limited HP
- sandbags cost army points
- attackers can fire over some destroyed gaps
- defensive pieces cannot completely surround everything

---

# 40. Avoiding Hard Counters

Bad example:

```text
Player buys plane.
Enemy has no AA.
Enemy automatically loses.
```

Better:

```text
AA = excellent against aircraft
MG = weak against aircraft
Soldiers = very weak but still capable of damage
```

Players should almost always have some possible response.

---

# 41. Preventing Solved Formations

If the exact same deployment always produces the exact same outcome, players may eventually optimize the game completely.

Possible solutions:

- multiple maps
- small damage variance
- different armies
- terrain
- commanders
- recon uncertainty
- fog of war
- random but balanced map elements

Do not compensate with excessive combat RNG.

---

# 42. Game Modes

> **SUPERSEDED — see Part I §F.2.** The demo ships **Classic only**, plus puzzle mode. Every other mode listed here is deferred.

## Classic

```text
Fixed army
Full reveal
Destroy HQ
```

## Draft Battle

```text
100-point army budget
```

## Blitz

```text
30-second deployment timer
```

## Fog of War

```text
Hidden enemies until detected
```

## Commander

```text
Commander bonuses enabled
```

## Terrain Battle

```text
Procedural battlefield
```

## Ranked

```text
Competitive symmetrical maps
```

---

# 43. Recommended Tech Stack

> **MOVED — see Part II.** This section has been replaced by two fuller ones:
> **§H (MVP Demo Tech Stack)** and **§I (Final Build Tech Stack)**.

---

# 44. Game Architecture

> **See also Part II §H.4 and §H.6.** The separation described here is correct and is the most important decision in the project. Part II adds the enforcement mechanism (a lint rule banning React imports inside `src/game/`) and the migration path to a shared `packages/engine`.

Recommended separation:

```text
UI
│
├── Deployment System
│
├── Battle Renderer
│
└── Results UI

GAME ENGINE
│
├── Grid
├── Units
├── Targeting
├── LOS
├── Damage
├── Simulation
└── Victory Detection
```

The battle engine should not depend on React.

Example:

```text
React UI
    ↓ commands
Game Engine
    ↓ state/events
Renderer
```

This makes testing much easier.

---

# 45. Recommended Folder Structure

> **See Part II §H.6** for the updated layout, which adds `rng/` and `__tests__/` and marks the `src/game/` boundary as lint-enforced.

```text
src/
│
├── game/
│   ├── config/
│   │   ├── units.ts
│   │   └── gameConfig.ts
│   │
│   ├── engine/
│   │   ├── BattleEngine.ts
│   │   ├── TargetingSystem.ts
│   │   ├── DamageSystem.ts
│   │   ├── LineOfSight.ts
│   │   ├── AttackPatterns.ts
│   │   └── VictorySystem.ts
│   │
│   ├── models/
│   │   ├── Unit.ts
│   │   ├── Grid.ts
│   │   └── BattleState.ts
│   │
│   ├── simulation/
│   │   ├── SimulationLoop.ts
│   │   └── BattleEvents.ts
│   │
│   └── utils/
│
├── components/
│   ├── Grid/
│   ├── Unit/
│   ├── ArmyPanel/
│   ├── BattleHUD/
│   └── Results/
│
├── screens/
│   ├── Home.tsx
│   ├── Deployment.tsx
│   ├── Battle.tsx
│   └── Results.tsx
│
└── store/
```

---

# 46. Battle Events

The simulation should generate events instead of directly animating.

Example:

```ts
export type BattleEvent =
  | {
      type: "ATTACK";
      time: number;
      attackerId: string;
      targetId: string;
    }
  | {
      type: "DAMAGE";
      time: number;
      sourceId: string;
      targetId: string;
      amount: number;
    }
  | {
      type: "UNIT_DESTROYED";
      time: number;
      unitId: string;
    }
  | {
      type: "HQ_DESTROYED";
      time: number;
      team: "A" | "B";
    };
```

Renderer listens for events and plays animations.

This is important for:

- replay
- debugging
- multiplayer
- deterministic simulation
- battle reports

---

# 47. Deterministic Simulation

> **See Part I §B.8 and Part II §H.3** for the full determinism contract — integer ticks, the ban on `Math.sqrt`/`sin`/`cos` inside the engine (they are not portable across JS engines), stable iteration order, and the golden-log test suite.

Eventually use a seeded random number generator.

Input:

```text
Player A deployment
Player B deployment
Game configuration
Random seed
```

Output:

```text
Exact same battle every time.
```

This helps with:

- replay
- multiplayer synchronization
- debugging
- cheat prevention

---

# 48. Multiplayer Direction

> **SUPERSEDED — see Part I §E.1.** **Async play-by-link comes first, not realtime.** Deployment is submitted once and the sim is deterministic, so the first online release needs no sockets, lobbies, presence, or reconnect logic — just a URL encoding a deployment. Realtime rooms are a luxury for after the game has an audience.

Do not build multiplayer first.

First build:

```text
Local Hotseat
```

Flow:

```text
Player A deploys
↓
Hide screen
↓
Pass device
↓
Player B deploys
↓
Battle
```

Once gameplay works:

```text
Online Multiplayer
```

Possible later stack:

```text
Node.js
WebSocket / Socket.IO
Redis optional
PostgreSQL / MongoDB
```

The server should validate deployment and ideally execute authoritative battles.

---

# 49. Development Phases

The following phases are intentionally ordered so the game becomes playable as early as possible.

---

# PHASE 0 — Project Foundation

## Goal

Create a clean base that supports future expansion.

## Implement

- React
- TypeScript
- Vite
- routing
- state management
- basic CSS/theme
- grid model
- unit model
- game config

## Deliverable

Application loads with an empty battlefield.

No combat yet.

---

# PHASE 1 — Grid + Unit Placement

## Goal

Make deployment satisfying.

## Implement

- 12×14 grid
- player zones
- unit inventory
- drag-and-drop placement
- click-to-place alternative
- remove unit
- move unit
- rotate unit
- placement validation
- deployment reset

Units:

- Soldier
- Tank
- Machine Gun
- Mortar
- Sandbag
- HQ

## Deliverable

One player can build a complete valid formation.

---

# PHASE 2 — Attack Range Visualization

## Goal

Make unit strategy understandable.

## Implement

- line attack
- cone attack
- indirect attack
- range highlighting
- direction highlighting
- hover tooltip
- selected unit stats

## Deliverable

The player can immediately understand every unit's attack coverage.

---

# PHASE 3 — Local Two-Player Hidden Deployment

## Goal

Create the hidden-information setup.

## Implement

Player A:

```text
Deploy
↓
Ready
↓
Board hidden
```

Then:

```text
Pass device screen
```

Player B:

```text
Deploy
↓
Ready
```

Then lock both armies.

## Deliverable

Two people can secretly prepare armies on one computer.

---

# PHASE 4 — Basic Battle Engine

## Goal

Create the first complete game loop.

## Implement

- fixed timestep
- cooldowns
- range detection
- firing arc detection
- targeting
- damage
- HP
- unit destruction
- victory detection
- simultaneous attacks

Ignore advanced LOS initially if needed.

## Deliverable

Player A and Player B armies can automatically fight until a winner exists.

---

# PHASE 5 — Reveal + Battle Presentation

## Goal

Make the battle emotionally satisfying.

## Implement

- army reveal
- 3-2-1 countdown
- transition into battle
- health bars
- projectile animation
- muzzle flash
- tank recoil
- MG bursts
- mortar shell
- explosion
- destruction animations

## Deliverable

The simulation starts feeling like a game instead of a debug tool.

---

# PHASE 6 — HQ + Defense Mechanics

## Goal

Create stronger strategic objectives.

## Implement

- HQ placement
- HQ victory condition
- sandbag HP
- shot blocking
- directional protection
- line-of-sight system
- cover visualization

## Deliverable

Players must choose between protecting the HQ and controlling attack lanes.

---

# PHASE 7 — Combat Balance

## Goal

Make the fixed-army mode genuinely fun.

## Implement

Tune:

- HP
- damage
- cooldowns
- ranges
- firing arcs
- armor
- mortar splash
- defensive durability

Create internal debug controls to change values rapidly.

## Deliverable

Multiple viable formations exist.

No obvious dominant strategy.

---

# PHASE 8 — Battle Report

## Goal

Make every loss teach the player something.

## Implement

Track:

- damage per unit
- damage received
- kills
- blocked damage
- survival time
- time without target
- HQ damage

Display:

- winner
- unit performance
- tactical observations
- rematch button

## Deliverable

Players understand why the battle was won or lost.

---

# PHASE 9 — Replay

## Goal

Let players study battles.

## Implement

- event log
- deterministic seed
- replay controls
- pause
- 0.5×
- 1×
- 2×
- restart

## Deliverable

Every completed match can be replayed.

---

# PHASE 10 — Army Budget / Draft Mode

## Goal

Add army composition strategy.

## Implement

```text
100 point budget
```

Add unit costs.

Players choose their army before deployment.

UI:

```text
Budget Remaining: 37
```

## Deliverable

Players can create different army builds.

This should significantly improve replayability.

---

# PHASE 11 — Damage Types + Soft Counters

## Goal

Create deeper balancing.

## Implement

Damage types:

- bullet
- heavy
- explosive

Unit armor categories.

Example counters:

```text
MG > infantry
Tank > MG / structures
Anti-tank infantry > tanks
Mortar > clustered defenses
```

## Deliverable

Army composition becomes strategically important.

---

# PHASE 12 — Additional Units

Add one at a time.

Recommended order:

1. Anti-Tank Infantry
2. Scout
3. Sniper
4. Anti-Air
5. Bunker

Do not add all simultaneously.

Balance every new unit before adding the next.

---

# PHASE 13 — Aircraft

## Goal

Introduce off-board combat.

## Implement

- air support unit
- timed plane runs
- target selection
- flyover animation
- plane HP
- Anti-Air targeting

## Deliverable

Air strategy becomes available without putting a stationary airplane on the grid.

---

# PHASE 14 — Formation Bonuses

## Goal

Reward deliberate unit combinations.

Implement examples:

- Infantry Squad
- Entrenched MG
- Tank Support
- Scout Spotter

UI must clearly communicate activated bonuses.

## Deliverable

Players begin creating recognizable tactical formations.

---

# PHASE 15 — Reconnaissance

## Goal

Add more information-based strategy.

Implement:

```text
Scan Left
Scan Center
Scan Right
```

or partial army intelligence.

## Deliverable

Players make decisions using incomplete but useful enemy information.

---

# PHASE 16 — Fog of War

## Goal

Deepen suspense during battle.

Implement visibility states:

```text
Hidden
Detected
Visible
Last Known
```

Reveal when:

- firing
- damaged
- scouted

## Deliverable

Hidden-information gameplay continues after the battle begins.

---

# PHASE 17 — Decoys + Bluffing

## Goal

Introduce deception.

Add:

- fake tank
- dummy artillery
- fake defensive position

Decoys should cost army budget points.

## Deliverable

Players can manipulate enemy targeting and predictions.

---

# PHASE 18 — Commanders

## Goal

Create player build identity.

Start with four:

```text
Engineer
Tank Commander
Infantry Commander
Air Commander
```

Each should have one simple passive bonus.

Avoid active abilities initially.

---

# PHASE 19 — Terrain

## Goal

Prevent repetitive optimal formations.

Add:

- forest
- hill
- rock
- building

Each terrain feature should have one clear rule.

## Deliverable

Players adapt formations to battlefield layout.

---

# PHASE 20 — Procedural Maps

## Goal

Increase replayability.

Generate balanced battlefield layouts.

Need:

- symmetry validation
- deployment viability
- firing lane validation

Ranked maps should remain carefully controlled.

---

# PHASE 21 — Online Multiplayer

> **SUPERSEDED — see Part I §E.1.** Replaced by **async play-by-link** as the first online release.

## Goal

Play against remote opponents.

Implement:

- room creation
- matchmaking
- Ready state
- deployment submission
- server-side validation
- battle synchronization
- reconnect logic
- surrender

Important:

Do not send Player A deployment to Player B before both are locked.

---

# PHASE 22 — Ranked Mode

Implement:

- Elo / MMR
- ranked matchmaking
- seasonal ladder
- placement matches
- match history

Only introduce ranked once balance is reasonably stable.

---

# PHASE 23 — Game Polish

Implement:

- sound effects
- music
- screen shake
- particles
- hover feedback
- tooltips
- cinematic reveal
- slow-motion final hits
- visual health damage
- improved animations

---

# PHASE 24 — Progression / Cosmetics

Only after gameplay is strong.

Possible:

- skins
- battlefield themes
- projectile cosmetics
- commander portraits
- banners
- profile badges

Avoid pay-to-win bonuses.

---

# 50. Recommended MVP Definition

> **SUPERSEDED — see Part I §F.2.** The demo definition has changed: puzzle mode and a **rematch that reloads your formation pre-placed for editing** are now in scope (edit-and-rerun is the actual core loop), while 8-direction facing, damage variance, and flat armor are out.

The first proper release should contain only:

```text
12×14 Battlefield

Units:
5 Soldiers
2 Tanks
2 Machine Guns
1 Mortar
8 Sandbags
1 HQ

Features:
Secret deployment
Rotation
Attack preview
Ready state
Full reveal
Simultaneous battle
Line-of-sight
Sandbag blocking
HP
Damage
Target priorities
HQ victory
Battle result
Rematch
```

This is enough to answer the most important question:

> Is deployment itself fun?

Do not build advanced systems until the answer is YES.

---

# 51. First Playtest Questions

After every playtest ask:

1. Was deployment interesting?
2. Did you understand the firing arcs?
3. Did you correctly predict what units would attack?
4. Did any combat result feel unfair?
5. Did you understand why you lost?
6. Did you immediately want a rematch?
7. Was one unit obviously too powerful?
8. Was one formation obviously dominant?
9. Were defenses useful but counterable?
10. Was the battle short enough?
11. Did the reveal create excitement?
12. Did any unit spend too much time doing nothing?

If players say:

> "I want another match because I know what I'd change."

the core loop is working.

---

# 52. Balance Metrics to Track

During development log:

```text
Unit pick rate
Unit win rate
Average damage
Average survival time
Average kills
Average idle time
HQ damage
Formation clustering
Match duration
```

Useful warning signs:

```text
Tank used in 95% of winning armies
→ probably too strong.

Mortar gets almost no kills
→ targeting/range may be bad.

Games regularly exceed 60 seconds
→ defenses or HP probably too high.
```

---

# 53. AI Opponent

> **See also Part I §E.4 and Part II §I.6.** The strongest version of this is not a smarter search — it is **ghost armies**: every deployment a real player submits becomes bot content. Store them from the very first playtest onward.

After local multiplayer is working, create a simple AI.

Do not start with machine learning.

AI levels:

## Easy

Random valid formation.

## Medium

Basic rules:

- HQ at rear
- sandbags near HQ
- MG controls center
- tanks separated
- mortar protected

## Hard

Generate many formations and run fast simulations against estimated enemy formations.

Choose the best-performing formation.

This becomes possible because the battle engine is deterministic and headless.

---

# 54. Important Engineering Rule

Keep these separate:

```text
GAME RULES
```

and

```text
ANIMATION
```

The battle engine should be able to simulate a full match without rendering anything.

Example:

```ts
const result = simulateBattle({
  playerA,
  playerB,
  seed: 12345,
});
```

Then the UI visualizes the event log.

This architecture will save a lot of time later.

---

# 55. Suggested Immediate Build Order

For the first coding session:

```text
1. Create project
2. Define grid
3. Define unit configs
4. Render battlefield
5. Implement deployment zones
6. Place units
7. Rotate units
8. Preview range
```

Next:

```text
9. Add second player deployment
10. Add Ready state
11. Reveal armies
12. Build simulation loop
13. Find valid targets
14. Apply damage
15. Destroy units
16. Determine winner
```

Then:

```text
17. Add projectiles
18. Add health bars
19. Add sandbags
20. Add LOS
21. Add mortar splash
22. Add HQ
23. Add results
24. Add rematch
```

At that point:

**STOP ADDING FEATURES AND PLAYTEST.**

---

# 56. Definition of a Successful Core Game

The prototype is successful if:

- deployment creates meaningful choices
- both players can predict possible outcomes
- formation matters more than luck
- different strategies can win
- battle resolves quickly
- players understand losses
- players want immediate rematches

If those conditions are not met, do not solve the problem by adding more content.

Fix the core:

```text
placement
range
targeting
balance
information
battle speed
```

---

# 57. Final Product Direction

The final game can eventually combine:

```text
Hidden Deployment
+
Directional Combat
+
Army Drafting
+
Fog of War
+
Reconnaissance
+
Terrain
+
Commanders
+
Decoys
+
Aircraft
+
Formation Synergies
+
Ranked Multiplayer
```

But every advanced mechanic should strengthen the original idea:

> Plan the battle before it begins.

The game should remain understandable, tactical, replayable, and satisfying even if the visual style stays relatively simple.

---

# 58. Core Design Summary

The strongest identity for the game is:

> A short tactical warfare game where players secretly construct a stationary battle formation, predict the enemy's strategy, and then watch both plans collide in an automatic real-time simulation.

The reveal creates suspense.

Directional firing creates strategy.

Predictable targeting creates fairness.

Battle reports create learning.

Short matches create rematches.

Army building and hidden information create long-term replayability.

That should remain the foundation of every future feature.
