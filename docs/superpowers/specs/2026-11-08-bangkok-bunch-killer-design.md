# Bunch Killer (Bangkok): area-match coverage — design

Date: 2026-11-08. Status: agreed in chat, waiting for the user's review of this document.
Decision log entry to add on build: D-40 (area match), D-41 (touchdown result), D-42 (seed v2).

## 1. Intent

The user plays NFL FLAG 5v5 and calls two red-zone defenses against bunch, trips or any tight
formation. Source: two coaching diagrams, "Zone: Bunch Killer (Bangkok) Rush" and "Zone: Bunch Killer
(Bangkok) No Rush Spy". They want Flagbook's engine to run these defenses faithfully. They also want both
plays ready-made in Install, so they can watch them against bunch and trips without drawing anything.

What makes the coverage special: no defender has a fixed receiver. Defenders split the field into four
lanes and claim receivers by the **order** receivers enter those lanes. The engine today only knows
man coverage by receiver number (strong #1, #2…), plain zones and match rules keyed on fixed numbers. None
of those can express "first one into my lane".

## 2. The coverage as the user described it

Four coverage defenders, left to right: **left CB | LB | S | right CB**. Each owns a vertical lane of the
field.

- **CB (corner):** plays man on the **first** receiver who enters his lane after the snap.
  - If nobody comes by the squeeze time, he **squeezes in** and takes the receiver running vertical in
    the next lane inside. User's example: Z slants inside and Y runs a seam, so the right CB takes Y.
  - Red zone, the ball comes out fast, so the squeeze time is short: 0.5 s *(my call; editable)*.
- **LB / S (inside):** read the flow.
  - Ignore the **first** receiver who breaks to the outside lane (the CB's lane): that is the CB's man.
  - Play man on the **second** one, following him into the CB's lane. User's example: Z corner then Y
    flat, so the CB takes Z and S takes Y.
  - If nobody breaks outside, pick **whoever is left**. User's example: Z slants and the CB squeezed
    onto Y, so S drops and plays zone where Z goes, not man.
- **R, Rush version:** lines up outside the box at the rush line and rushes on the snap. The variant "R
  inside the box, waits for the middle to clear" is just a rush delay. The engine already supports it,
  so it is not a separate play *(my call)*.
- **R, Spy version:** covers the middle: a zone over a box from just past the LOS to the back of the end
  zone. He sits there, reads the QB's eyes and jumps whoever comes in.

Context: the ball is usually ≤ 5 yd from the goal line, inside the no-run zone, against bunch or trips.

## 3. Goals, non-goals, anti-goals

**Goals**

1. The engine runs the area-match coverage on any defender the user marks, in any play, not only the
   two seeded ones.
2. The two scenarios the user described play out as described (§6, T-AM-01, T-AM-02).
3. Both defense plays, a tight Bunch offense and an Install with four matchups exist in every user's
   database, existing databases included.
4. A catch in the end zone reads as a touchdown.

**Non-goals**

- No "defender communication" model. Each defender infers teammates' claims from what it sees (§5.3).
- No new UI for drawing lanes. Lanes come from defender alignment.
- The existing `spy` action (spy the QB) stays unimplemented in the engine. The Spy play uses a zone.
- No change to the QB read model, suggestions or scoring.

**Anti-goals** (it would be a failure even if it runs)

- Defenders that know the offense's play or routes (breaks NFR-ARC-06).
- Seed code that overwrites or duplicates a user's own edits to the seeded plays.
- A coverage that only works for the exact seeded alignment. Move a defender and the lanes must follow.

## 4. Constraints

- NFR-ARC rules 1–6 (CLAUDE.md). Engine pure and deterministic. The new logic lives in `src/engine/`
  and reads only `Perception` plus static pre-snap data: the defense's own alignment, field and ball spot.
- `src/domain/types.ts` is a lead-owned contract file, so every change there gets a DECISIONS entry.
- The Zod import/export schema must accept the new fields; old files must still import.
- UI text in Vietnamese via `src/i18n/vi`; football terms stay English.
- Default rules NFL FLAG 5v5. Rushers at y ≥ 7 (rush line), no rush delay under `rusherGoesOnSnap`.

## 5. The engine change (how it works)

### 5.1 Data model (D-40)

A new optional field on a defensive `PlayerSlot`, next to `matchRules`:

```ts
interface AreaMatch {
  role: 'corner' | 'inside';
  /** Corner only: seconds after the snap before squeezing in when nobody entered the lane. Default 0.5. */
  squeezeAfter?: number;
}
// PlayerSlot.areaMatch?: AreaMatch
```

The slot keeps its normal coverage action as the **base**: a `zone` action, preset or polygon. This is
what the defender plays while he has no man. For LB/S it is the triangle from the diagram. For a CB it is
his lane, or any zone the user picks. A slot with `areaMatch` but no zone action gets a rectangle over
its own lane as the base.

The binding is computed only when the slot has a `zone` action or no coverage action. `areaMatch` on a
rusher or a pure man defender is ignored, with a warning.

### 5.2 Lanes (static, at prepare time)

In `prepare.ts`, after flips, take every defense slot with `areaMatch`. Sort them by `start.x`. The
lane boundary between two neighbours is the midpoint of their `start.x`. The outermost lanes run to the
sidelines.

Each inside defender's **outside** is the direction of its nearest corner neighbour, the lane adjacent
to it on the corner side. With the standard four, the LB's outside is the left CB's lane and the S's
outside is the right CB's lane. Lanes are full depth: y from the LOS to the back of the end zone.

This uses only the defense's own alignment, which every defender knows pre-snap. It is not opponent
data.

The new binding:

```ts
| { kind: 'areaMatch'; role: 'corner' | 'inside'; index: number; lanes: number[] /* boundaries */;
    outsideIndex: number | null; squeezeAfter: number; base: ZoneBinding }
```

### 5.3 The claim tracker (pure, `src/engine/areaMatch.ts`)

A small state machine that every area defender runs **on its own perception**. Because all defenders
apply the same rules to what they each see, a defender can work out what its teammates have claimed
without talking to them. Different reaction times can make two defenders disagree for a moment, which is
realistic (a busted coverage), and deterministic.

Per tick, for each perceived offensive non-QB player:

- **Released** once y > 0.5 (same threshold as match rules) or t > 0.
- **Lane** = the lane containing its x.
- **Entry log:** a receiver logs "entered lane L at t" the first time it is released and inside L. A
  receiver aligned inside a corner's lane at the snap logs at release. In trips the wide receiver is
  therefore the corner's man.
- **Ties** (two receivers enter the same lane on the same tick, e.g. Z and Y both aligned in the CB's
  lane in trips): the one closer to the sideline counts as first *(my call: the outside receiver is the
  corner's, the standard bunch/trips rule)*.

Claims are recomputed from the log each tick, in this order, and are **sticky**: once claimed, a man
stays claimed until the ball is thrown.

1. **Corner, first in:** the corner of lane L claims the first receiver that entered L.
2. **Inside, second out:** the inside defender whose outside lane is L claims the second receiver that
   entered L. That receiver must not have been claimed in step 1. A receiver who starts in the inside
   lane and is the second to cross into L also counts.
3. **Corner squeeze:** a corner with no claim at t ≥ `squeezeAfter`:
   - Claims the deepest unclaimed receiver in the adjacent inside lane whose velocity is vertical
     (|vy|/|v| ≥ 0.7, as the match-rule `vertical` event).
   - If none, his base zone shifts inward so its centre sits on the boundary with the inside lane, and
     he keeps checking steps 1 and 3 *(my call)*.
4. **Inside, whoever is left:** an inside defender with no claim plays its base zone. Receivers claimed
   by others (steps 1–3, as this defender infers them) are passed to the zone agent's `ignore` set, so
   the zone defender plays the receivers that are left.

Output per defender per tick: `{ manTarget: ID | null; ignore: Set<ID>; squeezed: boolean }` plus an
event the first time a claim is made: `areaClaim { receiverId, reason: 'first' | 'second' | 'squeeze' }`.

### 5.4 The agent (`src/engine/agents/areaMatchDefender.ts`)

It wraps the existing man and zone agents, as `ruleDefender.ts` does today:

- Starts as a zone agent on its base zone, with `ignore = () => tracker.ignore`.
- On a claim, it switches to a man agent on the claimed receiver: trail technique, the slot's leverage,
  the shared anticipation model.
- On a squeeze with no claim, it rebuilds the zone agent with the shifted polygon.
- The ball reaction (`ballResponse`) is unchanged, since the wrapped agents already handle it.

In `simulate.ts`, `areaMatch` bindings build this agent. Match rules on the same slot are ignored, with
a warning: one smart coverage per defender. Frames get the state `'man'` or `'zone'` as today, so the
existing overlays and debug views keep working.

### 5.5 Touchdown (D-41)

`Outcome` `complete` gains `touchdown?: true` when the catch point is at or beyond the goal line:
`landing.y ≥ field.length − ballSpot.yardLine`. The result panel and the outcome summary show
"Touchdown" for it. Aggregates count it as complete, so nothing else changes.

## 6. Scenarios that define "correct"

Defense in the diagram's alignment. Offense = the seeded "Bunch Tight" (§7), ball on the 5.

| ID | Offense does | Expected |
| --- | --- | --- |
| T-AM-01 | Z corner, Y flat (both out to the right) | right CB man on Z; S man on Y, following him into the CB's lane |
| T-AM-02 | Z slant inside, Y seam, nobody into the right CB's lane | right CB squeezes at ~0.5 s and takes Y; S stays in zone and plays Z; S never goes man on Y |
| T-AM-03 | Mirror of T-AM-01 to the left (flipped matchup) | left CB and LB mirror the right side |
| T-AM-04 | Trips Flood (Z wide right, aligned in the right CB's lane) | right CB takes Z at release; next receiver out right goes to S |
| T-AM-05 | Same input + seed twice | identical frames |
| T-AM-06 | Move S 3 yd right in the editor | lane boundaries move; claims follow the new lanes |

## 7. Ready-made content (D-42)

Fixed ids, so they can be checked and never duplicated.

**Offense "Bunch Tight"** (formation `Bunch`, strength right), from the diagrams:
- QB at (0, −5), shotgun drop.
- X at (−3, −1), C at (0, −0.5), Y at (3, −1), Z at (6, −1).
- Routes *(my call, chosen so the seeded matchup shows the "first out / second out" read)*: Z corner,
  Y flat, X slant, C seam. Read order Y, Z, X, C.

**Defense "Zone: Bunch Killer (Bangkok) Rush"** (formation `Bunch Killer`, alignTo ball, strength right).
Positions are measured from the diagram (QB depth 5 yd ≈ diagram scale), y ≥ 0:

| Slot | Role | Start | areaMatch | Base zone |
| --- | --- | --- | --- | --- |
| CB2 | CB | (−8, 3.5) | corner | own lane |
| LB | LB | (−1.5, 3.5) | inside | triangle (−4.8, 0), (1.4, 0), (−1.3, 6.5) |
| S | S | (4, 3.5) | inside | triangle (−0.6, 0), (4.8, 0), (4.8, 6) |
| CB1 | CB | (9, 3.5) | corner | own lane |
| R | R | (−7, 7) | — | rush on the snap, path to the QB |

R sits at the rush line, which is legal under NFL FLAG, so the play has no warnings.

**Defense "Zone: Bunch Killer (Bangkok) No Rush Spy":** the same four coverage defenders. R starts at
(0.5, 7) and plays a zone polygon "MID": x −6..7, y 1.5..15 (the end line with the ball on the 5; was 1.5..10, D-44), clamped to the field. No rusher.

**Install "Red Zone – Bunch Killer (Bangkok)"** with four matchups, ball on the 5
(`yardLine = field.length − 5`), defenseFlip auto:
1. Bunch Killer Rush vs Bunch Tight
2. Bunch Killer No Rush Spy vs Bunch Tight
3. Bunch Killer Rush vs Trips Flood
4. Bunch Killer No Rush Spy vs Trips Flood

**Seeding existing databases.** `Settings` gains `seedVersion?: number` (missing = 1):
- Fresh database: write everything and set `seedVersion = 2`.
- Database at version 1: in one transaction, add each v2 record whose fixed id is missing, then set
  version 2. Records are never overwritten, and something the user deleted is not re-added after that.
- `seedVersion` goes through export/import like the rest of Settings. A file exported before this change
  has no `seedVersion`, so after a "replace all" import the v2 content is added once *(my call:
  acceptable, and the user can delete it)*.

## 8. Editor

- Defender panel: a select **"Area match (Bangkok)"** with none / corner / inside. For a corner, a
  number input "Squeeze sau (s)" defaults to 0.5. Strings in `src/i18n/vi`.
- When any defender in the play has `areaMatch`, the field shows the lane boundaries as faint dashed
  vertical lines. This is a drawing only; the lane math lives in `domain/` so the editor and the engine
  share it.
- Play checker: a new warning `area-match-incomplete` when an inside defender has no corner neighbour on
  either side, or the play has fewer than 2 area defenders.
- Flip: `areaMatch` has no coordinates, so nothing to mirror. Lanes follow the flipped starts.
- Zod schema: `areaMatch` optional; `Outcome.touchdown` optional; `Settings.seedVersion` optional.

## 9. Left to the builder

- Exact tick bookkeeping in the tracker, e.g. whether to use the receiver's lane at the delayed
  perception time or with lookahead. It must match T-AM-01..06.
- Shape of the lane overlay (colour, label).
- Whether the area-claim event shows on the playback timeline markers. Recommended: yes, as "claim",
  if it fits in the existing marker set without new UI.
- Test file names and helper structure.
