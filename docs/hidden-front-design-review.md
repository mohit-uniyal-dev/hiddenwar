# Hidden Front — Design Review

> **Subject:** [hidden-front-game-design-roadmap.md](hidden-front-game-design-roadmap.md)
> **Reviewed:** original 37KB / 2,740-line draft, 58 sections + 24 phases
> **Date:** 2026-08-29
> **Outcome:** roadmap restructured into three parts; ~25 conflict points annotated inline

---

## Contents

- [Verdict](#verdict)
- [Findings by severity](#findings-by-severity)
  - [S1 — Would break the game](#s1--would-break-the-game)
  - [S2 — Errors in the document](#s2--errors-in-the-document)
  - [S3 — Unresolved rules](#s3--unresolved-rules)
  - [S4 — Scope](#s4--scope)
  - [S5 — Missing systems](#s5--missing-systems)
- [Changelog](#changelog--what-changed-in-the-roadmap)
- [Still open](#still-open--decisions-not-yet-made)
- [What to measure in playtest 1](#what-to-measure-in-playtest-1)
- [Next actions](#next-actions)

---

## Verdict

**The core idea is sound and the document was strong on breadth.** Three things in the original draft were already right and should not be touched:

1. **The engine/animation separation** (§44, §54). This is the single most valuable decision in the project. Everything downstream — replays, the AI, server-authoritative multiplayer, automated balance testing — falls out of it for free.
2. **The phasing discipline.** *"Do not build advanced systems until the answer is YES"* (§50) and *"STOP ADDING FEATURES AND PLAYTEST"* (§55) are the correct instincts.
3. **The readability thesis** (§2.3). A game where the player cannot reconstruct why they lost has no rematch loop.

**What it lacked was three things:** a settled identity, about twenty rules that were stated as options rather than decisions, and a scope roughly 3× larger than a solo developer can carry.

The revision does not add design. It **closes** design.

> The honest summary: sections A–G of the revised roadmap are what §50 and §55 look like when they are actually obeyed.

---

## Findings by severity

### S1 — Would break the game

#### 1.1 The unreachable-HQ hole

**Severity: critical. Present in the original rules as written.**

The original victory conditions (§20) were:

```text
Primary:   Enemy HQ HP <= 0
Secondary: No enemy combat-capable units remain
```

Combined with a mortar max range of 7 on a 14-row board, **rows 1–2 of each deployment zone were mathematically unreachable by any weapon from any legal placement.**

A player could therefore place the HQ in the back corner, wall it, and no opponent could ever satisfy the primary condition. Because nothing moves, there is no way to close distance — this is not a hard fight, it is an *impossible* one.

**Resolution — two changes, both needed:**

- Mortar max range **7 → 10**, restoring full-board reachability.
- **Army destruction now wins outright**, regardless of HQ HP. If one side has zero combat-capable units and the other has at least one, the side with units wins immediately.

**Design invariant added to the doc, to be kept permanently:**

> Every tile in the enemy zone must be reachable by at least one weapon from at least one legal placement.

This invariant must be re-checked every time a range, a grid dimension, or a zone boundary changes.

---

#### 1.2 The static-battle problem

**Severity: critical. This is the most likely reason the game fails to be fun.**

The framing that makes this concrete: in TFT or Mechabellum, **movement continuously creates new engagements.** The state evolves; outcomes genuinely swing mid-fight.

In Hidden Front, the **entire engagement graph is fixed at Ready.** Only two kinds of state change are possible:

```text
1. A unit died.
2. A blocker broke.
```

The failure mode is specific and easy to hit: two lines plink at whatever happens to sit in their lanes, ~30% of units never fire because nothing entered their cone, the winner is obvious by second 3, and the player watches 25 seconds of confirmation.

That is not a payoff for 90 seconds of planning. **That is a loading screen with tracers.**

And the asymmetry is unforgiving: agency ends at Ready, so the watch phase can only pay the player in suspense, spectacle, or information.

**Resolution — four mitigations, in order of importance:**

| # | Mitigation | Mechanism |
| --- | --- | --- |
| 1 | **Breaches are the drama engine** | Stats tuned so a tank one-shots a sandbag (60 dmg vs 60 HP) every 2.8s → 2–4 lane-opening moments per battle. A dormant unit suddenly activating is the only plot twist this system can produce. |
| 2 | **Idle-unit budget under 15%** | Soldier range 4 (not 3), the MG's wide cone, and the "nearest valid target" fallback all exist to push this down. |
| 3 | **Narrate without spoiling** | Live army-strength bar (a *heuristic*, never the sim's known result), kill feed, damage numbers, exactly one slow-mo per match. |
| 4 | **Frictionless iteration** | See 1.3 below. |

**Two new primary metrics** were added to the balance list, ranking above the original §52 stats:

```text
lane-opening events per battle   (target: 2-4; zero means the tuning is wrong)
idle unit percentage             (target: under 15%)
```

**Guidance if playtests fail here:** do **not** add mid-battle abilities to "restore agency." That destroys the identity. Shorten combat toward 15s and sharpen the report instead. The plan-collision *is* the game.

---

#### 1.3 The actual core loop was never stated

**Severity: high.**

The original document describes deploy → battle → report → rematch. But it never identifies what the loop actually is.

> **The watch phase is reconnaissance for the rematch. Edit-and-rerun is the core loop.**

This has a direct, concrete UI consequence the original draft missed:

```text
Rematch must be <= 2 clicks, same opponent, AND —
critically — your previous formation loads PRE-PLACED for editing.
```

Rebuilding 19 pieces from scratch kills the *"I know exactly what I'd change"* impulse — which §51 correctly identifies as the win condition for the entire prototype. Forcing a blank board between attempts converts the game's best feeling into a chore.

**This is a cheap fix that protects the most expensive thing in the design.**

---

### S2 — Errors in the document

Four concrete defects found in the original text. These are not disagreements; they are mistakes.

| # | Location | Defect | Fix |
| --- | --- | --- | --- |
| 2.1 | §12 | Example timeline has the MG firing at **0.3s then 0.8s** — a 0.5s gap on a stated 0.7s cooldown | Superseded by the tick contract (§B.8) |
| 2.2 | §16 | Tank range-preview diagram shows **range 4**; the tank's stats (§8.3) say **range 6** | Stats win. Diagram must be redrawn |
| 2.3 | §10 + §11 | **Two overlapping damage-mitigation systems** — flat armor subtraction *and* type multipliers | Flat armor **deleted**. Multipliers only |
| 2.4 | §8.2 | MG cone diagram is internally inconsistent with the stated range of 4 | Footprint defined exactly: widths **3, 3, 5, 5** at d=1..4 |

**On 2.3 specifically** — this is worth more than a line in a table. Two mitigation systems is one too many to explain to a player, and the flat-subtraction formula has a bad failure mode:

```ts
finalDamage = Math.max(1, baseDamage - armor);
```

The `max(1, …)` floor means massed weak fire is *disproportionately* effective against heavy armor — twenty soldiers each doing a guaranteed 1 damage beats the armor system entirely. Type multipliers have no such floor: a soldier does `10 × 0.25 = 3` to a tank, scaling correctly.

---

### S3 — Unresolved rules

The largest category. The original document repeatedly presented options without choosing — *"2×2 or 1×1"*, *"optionally other large units"*, *"largest cluster"*. Each of these would have stalled implementation for roughly a day.

**All are now decided.** Full detail lives in §B of the roadmap; this is the index:

| Rule | Original state | Decision |
| --- | --- | --- |
| Stalemate / draw | Not addressed at all | 5s dead-air end, 60s hard cap, explicit tiebreak ladder |
| Friendly units blocking LOS | *"optionally other large units"* | **No.** Only sandbags and HQs block — for **both** teams |
| Search cone vs. fire cone | Never distinguished | Same cone. Facing **locked at Ready**, no rotation ever |
| Target re-acquisition | Not addressed | No held targets. Fresh evaluation every ready tick |
| Tick / cooldown alignment | 20 ticks/s stated, but 0.7s and 2.8s cooldowns given | Integer ticks. First shot at 50% cooldown. Two-phase resolution |
| Mortar "largest cluster" | Prose only | Concrete scoring algorithm (§B.9) |
| LOS raycast | *"ray cast from attacker cell"* | Supercover, with diagonals blocked only by double walls |
| HQ size | *"2×2 or 1×1"* | **2×2** |
| Deployment zone rows | Not specified | Rows 1–6 / 7–8 NML / 9–14 |
| Tile occupancy | Not specified | One unit per tile, hard rule |
| Turtling | §38 worried; no mechanism | Four organic counters (§B.12) |
| MG "8 × burst" | Undefined | 8 damage to **each of up to 3** targets |
| 8-direction facing | *"later upgrade"* | **Four, permanently** |
| Damage variance | *"10–15% randomness"* | **Cut.** Tie-breaks only |

#### Three of these deserve explanation

**Facing locks at Ready.** A unit that swivels to help is a unit that forgives bad planning. Locking it is what makes the game's promise — *your plan is your fate* — literally true. A unit with nothing in its arc does nothing for the entire battle, and the report says so by name.

**Only sandbags and HQs block LOS — for both teams.** This is the load-bearing readability decision. It means the only things that block are large, obvious, static objects, so "why didn't my tank fire?" always has a visible answer. The both-teams part is what makes it a real decision: walling yourself in means you cannot shoot out.

**The HQ counts as tactical value 40 in mortar cluster scoring.** This one line does the entire anti-turtle job with no special-case rule. A defended HQ *is* usually the largest cluster on the board, so the turtle's own defensive huddle becomes the mortar's favorite target. Organic counters beat artificial restrictions like *"maximum 4 units per area"* — §38 was right about that, it just lacked a mechanism.

#### On cutting damage variance

The original document asks for two incompatible things:

> §2.4: *"10–15% light randomness"*
> §2.3 / §2.1: *"The simulation should not feel random or unfair."*

Variance adds noise to the loss autopsy — *"did I lose to a plan, or to dice?"* — while contributing nothing to the reveal, which is where the emotion actually lives. For a game whose entire retention mechanism is *"I know what I'd change,"* deterministic outcomes are a feature, not a limitation.

Re-introduce variance later **only** if solved formations genuinely emerge (the fear in §41) — and even then, prefer map variety over dice.

---

### S4 — Scope

**Finding: 24 phases is a studio plan, not a solo-developer plan.**

Roughly 60% of the roadmap was cut or deferred indefinitely. The cuts are not arbitrary — most fall into two groups:

**Group 1 — redundant with what already exists.** Fog of war, reconnaissance, and decoys are all *"more hidden information."* But deployment secrecy **already provides** the hidden information; the reveal is already the emotional peak. These add cost and rules surface for a feeling the game delivers on day one.

**Group 2 — fights the readability thesis.** Formation synergies (§29) are hidden multipliers in a game whose central promise is that you can see why everything happened. And the base game's overlapping firing arcs already *are* a synergy system — a visible, previewable one.

| Cut | Reason |
| --- | --- |
| Aircraft + Anti-Air | An entire off-board subsystem for one unit |
| Formation synergies | Hidden multipliers fight readability |
| Fog of war / Recon / Decoys | Deployment secrecy already provides this |
| Commanders | Build identity before build variety |
| Terrain / Procedural maps | Solve balance on one board first |
| Ranked / Cosmetics | Needs a playerbase |
| Scout, Mines, Sniper, Bunker, Anti-Tank | Prove the base six first |
| 8-direction facing | Doubles preview/LOS surface for marginal depth |

**Also cut from the demo, and this one may be counterintuitive: online play of any kind.** Hotseat plus puzzle mode answers *"is deployment fun?"* completely. Shipping any networking before that question is answered is spending weeks to learn nothing.

**Draft mode (army budget) is also out of the demo** — but it is explicitly the **first** post-validation feature, not a cut.

**Post-demo ordering** (each multiplies the audience of the previous):

```text
1. Async play-by-link
2. Daily puzzle + leaderboard
3. Draft mode
4. Ghost-army matchmaking
```

---

### S5 — Missing systems

Eight systems the original document does not mention at all. Two are structural.

#### 5.1 Async multiplayer — the biggest structural miss

**This game does not need realtime anything.**

Both players deploy independently. The simulation is deterministic. There is no per-frame state to synchronize — which means **none of the hard parts of multiplayer games apply here**: no input prediction, no rollback, no lag compensation, no reconnect logic, no presence, no lobbies.

A deployment is ~19 tuples of `(type, position, facing)`. That fits in a URL.

```text
Player A deploys → gets a link → sends it anywhere → B opens it,
deploys blind → battle resolves instantly for B, via link for A
```

**Phase 21 (realtime multiplayer) should be replaced by this** for the first online release. Realtime rooms are a luxury for after the game has an audience.

#### 5.2 Puzzle mode — promote into the MVP

A fixed, **visible** enemy formation; you deploy a limited kit; win the sim.

This one feature is simultaneously:

- the **tutorial engine**
- **daily retention** on a platform (web) with no install and no push notifications
- a **free global leaderboard** — same seed for everyone, rank by HQ HP remaining
- **single-player content**, removing the cold-start matchmaking problem

Cost: the engine you already built, plus ~10 handcrafted formations. This is the highest ratio of value to effort anywhere in the roadmap.

#### 5.3 The rest

| System | Note |
| --- | --- |
| **Onboarding** | Three scripted puzzles teach facing, cones, and splash. Plus: **tap any event in the report to get its explanation** — the sim is rule-based, so explanations are free. Cheapest killer feature in the design |
| **Ghost armies** | Every deployment a real player submits is bot content. Solves cold-start matchmaking. Store them from playtest 1 |
| **Replay sharing** | `(deploymentA, deploymentB, seed)` is under 200 bytes — a URL. The natural growth mechanism |
| **Accessibility** | Blue/orange (never red/green), shape coding so color is never the only channel, ≥44px touch targets, reduced-motion toggle. Cheap now, expensive to retrofit |
| **Audio** | Deferred to Phase 23 in the original, but sound is *half* the watch phase's juice on this art budget. The mortar's falling whistle **is** the suspense mechanic |
| **Monetization** | Explicitly none. Write it down now so nothing warps around it |

---

## Changelog — what changed in the roadmap

### Structure

The document is now three parts. Part I and Part II are authoritative; Part III is the original notes, retained as backlog and annotated at every conflict point with `> **SUPERSEDED —**` blocks so nothing contradicts silently.

### Balance changes

| Stat | Was | Now | Reason |
| --- | ---: | ---: | --- |
| Soldier range | 3 | **4** | At range 3 with a 2-row NML, a soldier threatens only one enemy row → too many never fired |
| Mortar max range | 7 | **10** | Closes the unreachable-back-row sanctuary (S1.1) |
| Sandbag cost | 2 | **3** | Eight near-free blockers undervalued the wall |
| Sandbag HP | 50–60 | **60** | Exactly one tank shot (60 dmg). The breach cadence depends on this |
| HQ size | 2×2 *or* 1×1 | **2×2** | 1×1 hides fully behind one sandbag — degenerate |
| Armor stat | present | **deleted** | See S2.3 |
| Damage variance | ±5% | **none** | See S3 |
| Facing options | 4, later 8 | **4, permanently** | Doubles preview/LOS surface for marginal depth |

### Additions

New material: identity and setting (§A), the full rulebook (§B), the final stats table with time-to-kill math (§C), the design-risk analysis (§D), missing systems (§E), the scope cut (§F), naming (§G), and both tech stacks (§H, §I).

---

## Still open — decisions not yet made

Honest list. These were **not** resolved, and most should not be resolved before playtesting.

| # | Open question | When to decide |
| --- | --- | --- |
| 1 | **All balance numbers are unplaytested estimates.** The TTK math is internally coherent, but coherent is not the same as fun | After playtest 1. Tuning levers and their preferred order are in §C.5 |
| 2 | **Does the 60s hard cap ever actually fire?** If matches routinely hit it, sandbag HP or tank cooldown is wrong | Playtest 1 — log it |
| 3 | **Is 12×14 the right board?** Never validated. Fewer rows means faster, more lethal battles | Playtest 1–2. Cheap to change now, expensive later |
| 4 | **Fixed army vs. draft as the long-term default mode** | After draft mode exists |
| 5 | **Does the mortar carry too much load?** It is currently the sole turtle-breaker, splash-punisher, *and* indirect-fire unit. Three jobs on a 1-per-army unit is fragile | Playtest 2. If it is always mandatory, split the roles |
| 6 | **Title.** "Hidden Front" is the pick; needs a trademark / Steam / itch check | Before any public build |
| 7 | **Does the toy-diorama frame survive contact with an actual art pass?** | First art spike |

> **On #5 specifically:** watch for the signature failure — if the mortar appears in 100% of winning formations, the anti-turtle systems are leaning on one unit and need distributing.

---

## What to measure in playtest 1

The original §52 metrics list is good. These two are **new and rank above it**, because they measure the S1.2 risk directly:

```text
lane-opening events per battle    target 2-4    zero = tuning is wrong
idle unit percentage              target < 15%
```

Then, in priority order:

```text
match duration distribution       target 15-30s, cap never reached
HQ-kill vs army-destruction ratio both should occur; neither dominant
per-unit damage + kill share      no unit at zero, no unit dominant
formation clustering              is the mortar actually punishing it?
rematch rate                      THE retention signal
```

**Behavioral observations — watch, don't ask:**

- Do players **tab out** during combat? → the watch phase is failing (S1.2)
- Do players **rebuild from scratch** or **edit** after a loss? → tests the S1.3 fix
- Do players correctly predict what a unit will shoot **before** the reveal? → tests readability
- Can they state **why** they lost, unprompted? → the §51 win condition

The single question that matters, from §51:

> *"I want another match because I know what I'd change."*

---

## Next actions

1. **Build §F.2 and nothing else.** Hotseat, fixed armies, arc preview with LOS shadowing, battle, report, rematch-with-preloaded-formation.
2. **Write the determinism test on day one** (§H.3). Retrofitting determinism is painful; getting it right at the start is nearly free.
3. **Enforce the `src/game/` boundary with a lint rule** before the first component exists. It is the line the whole architecture rests on, and it is much easier to keep than to restore.
4. **Store every deployment from the first playtest** — that is ghost-army content and balance data, and it costs nothing to start now.
5. **Playtest against the §51 questionnaire before adding anything.**

---

## One caution on this review

The revision **closed** a large number of open questions, which is what was asked for and what the project needed. But closed is not the same as correct.

The rules in §B are internally consistent and should be implemented as written. The **numbers** in §C are estimates that have never met a player. Expect the first playtest to move several of them — and treat that as the process working, not as the design failing.

The parts most likely to survive contact with players are the structural decisions: locked facing, only-blockers-block-LOS, army-destruction-wins, and edit-and-rerun. The parts most likely to move are every HP and cooldown value in the table.
