# Bunch Killer as custom pattern-match rules ("one system")

Date: 2026-11-09. Status: design for review. Builds on D-40 (area match), D-46, D-47.

## Intent

Today "Bunch Killer (Bangkok)" is a separate mode in the "Kiểu" select (Corner / Inside). It runs its own
engine path (`areaMatch` on the slot, `areaMatchDefender`, `areaMatch.ts` claim tracker). Custom rules
("Luật tự đặt") cannot express it, because a rule:

- names one receiver by number (Strong #1, Weak #2, RB…), while Bunch Killer means "whoever comes";
- only knows direction events (vertical, out, in, under, release, stop), not "enters my area";
- can only man a fixed receiver, not "the one who triggered the rule";
- does not know what teammates took ("the second one, after my corner took the first");
- has no "stay on my spot" fallback.

The user wants **one system**: custom rules gain the options needed to build Bunch Killer, and choosing
"Bunch Killer" just fills in those rules, which the user can then see and tweak. The separate area-match
mode goes away.

Success: the Bangkok plays behave exactly as now (all T-AM tests still pass, rewritten to use rules), and a
user can read and edit Bunch Killer as two plain rules.

## The rules Bunch Killer becomes

- **Corner (CB1 / CB2):** Khi [Người thứ 1] [vào khu vực của] [tôi] thì [Man người đó].
- **Inside (S / LB):** Khi [Người thứ 2] [vào khu vực của] [CB1] thì [Man người đó]. No rule fired → plays
  his zone.

## Goals

1. New rule options:
   - **Receiver:** "Bất kỳ" (any receiver), "Người thứ 1", "Người thứ 2" (the Nth receiver to enter the
     rule's area).
   - **Event:** "vào khu vực của" + a target: "tôi" (my own area) or a teammate (by label).
   - **Reaction:** "Man người đó" (man, trail, on the receiver that made the rule fire).
2. Areas are the existing D-40 lanes: vertical lanes from the alignment of the "lane members", boundaries at
   the midpoint of neighbouring members' start x, outer lanes to the sideline.
3. Teammate awareness without communication (as D-40): every lane member evaluates the area rules of all
   lane members on its own delayed perception. It infers who took whom, skips receivers a teammate took, and
   ignores them in its zone.
4. Base behaviour of a lane member before any of its rules fires (unchanged from D-40/D-47):
   - Never presses: holds its alignment depth.
   - With a zone action: plays that zone, ignoring receivers teammates took.
   - With no coverage action: stands on its alignment spot and reacts to nobody, only to a ball in the air
     (today's corner behaviour).
5. The "Kiểu" select becomes a **template** picker: "Luật tự đặt" (no template), "Bunch Killer: Corner",
   "Bunch Killer: Inside". Picking a template replaces this defender's rules with the template's rules,
   in one undo step. The rule list stays visible and editable.
6. Existing data with `areaMatch` is converted to rules everywhere it can come from: the database, JSON
   import and the Freestyle draft in localStorage. The seeded Bangkok plays are written with rules.

## Non-goals

- Drawn or free-form areas (polygons) as "khu vực". Lanes only.
- "Người thứ 3" or higher.
- Changes to the QB, offense, scoring or suggestions.
- A squeeze. D-47 removed it and it stays removed.

## Anti-goals (a failure even if it runs)

- Bunch Killer behaves differently from today on the same board. The T-AM tests (01–07, the no-press test,
  rusher-ignored, and the user's board in T-AM-07) must pass unchanged in what they assert.
- A user's existing Bangkok setup (seeded, saved or in the Freestyle draft) is lost or silently becomes
  plain zone.
- Custom rules that do not use the new options behave differently.

## Data model

```ts
// domain/types.ts
export type AreaRef = { kind: 'self' } | { kind: 'teammate'; slotId: ID };
export type RuleReceiver = ReceiverRef | { kind: 'any' } | { kind: 'nth'; n: 1 | 2 };
export type MatchEvent = 'vertical' | 'out' | 'in' | 'under' | 'release' | 'stop' | 'entersArea';

export interface MatchRule {
  id: ID;
  priority: number;
  when: {
    receiver: RuleReceiver;
    event: MatchEvent;
    area?: AreaRef;      // required when event = 'entersArea', ignored otherwise
    minDepth?: number;
    beforeTime?: number;
  };
  then:
    | { type: 'man'; target: ReceiverRef }
    | { type: 'manTrigger' }  // "Man người đó"
    | { type: 'zone'; zone: ZonePresetId }
    | { type: 'carry' }
    | { type: 'passOff' };
}
```

- `PlayerSlot.areaMatch` and `AreaMatch` are removed.
- `{ kind: 'nth' }` is only valid with `event: 'entersArea'`. With any other event, the editor does not offer
  it and validation warns.
- `{ kind: 'any' }` works with every event: the rule fires on the first receiver that satisfies the event
  (ties: nearer the sideline, then id).

## Semantics

**Lane members:** the slots of the defense that have at least one rule with `event: 'entersArea'`, or that
some rule names as `area.teammate`. Slots whose coverage is rush, man or spy are excluded, with a warning
(as D-40 "area match ignored"). Lanes are computed from the members' start x, as `computeAreaLanes` does
today.

**Entry log:** as today. After the snap, a receiver seen in a lane where he has not been logged is appended
to that lane's entry list; same tick, nearer the sideline first.

**"Người thứ N vào khu vực của A":**
- Look at A's entry list, leaving out receivers taken by a lane member other than A.
- The N-th receiver in what's left is the trigger, if he exists and is not taken.
- For the corner (A = self, N = 1) this is today's "first unclaimed receiver into my lane". For the inside
  defender (A = CB1, N = 2) it is today's "first receiver into CB1's lane other than CB1's man".

**"Bất kỳ vào khu vực của A":** the first receiver in A's entry list who is not taken by a lane member.

**Taken:** a receiver is taken once a lane member's `manTrigger` area rule has fired on him. Every lane member
computes this for all lane members, in a fixed order each tick: rules with `nth` n = 1 first, then n = 2,
then `any`. Within each group, lanes go left to right. Claims are sticky. Direction-event rules and fixed
`man` rules are not inferred for teammates. Only a member's own rules fire for it, as today.

**Rule firing:**
- Unchanged: priority order, each rule fires once, `beforeTime`, `minDepth` (for `entersArea`, minDepth
  applies to the trigger's depth).
- The iq recognition delay applies to direction-event rules as today, but **not** to `entersArea` rules.
  Those fire on the tick the trigger is found, exactly like today's claim tracker. The teammate inference uses
  the same no-delay rule, so it matches what teammates really do, and no agent needs a teammate's stats.
  *(My call: it keeps Bunch Killer timing identical to today.)*
- `manTrigger` switches to a man defender (trail, cushion 0) on the trigger.
- `carry` and `passOff` with `any` / `nth` use the trigger as the receiver.

**Events and timeline:** `ruleFired` gains `targetId` (the trigger) for `manTrigger`. The timeline label for a
`ruleFired` with a target is "CB1 → Z", like today's `areaClaim`. The `areaClaim` event type is retired.

## Editor

- **Template select** (label "Mẫu", replacing "Kiểu"): "Luật tự đặt", "Bunch Killer: Corner",
  "Bunch Killer: Inside". The select shows which template the current rules match exactly, else
  "Luật tự đặt".
  - **Corner:** rules := [Người thứ 1 · vào khu vực của · tôi → Man người đó].
  - **Inside:** rules := [Người thứ 2 · vào khu vực của · <teammate> → Man người đó]. The teammate comes from
    one shared helper, `insideTeammate(play, slotId)`, used by both the editor and the migration:
    1. Lane order is by start x, with this defender counted as a lane member.
    2. Pick the left neighbour if it holds the Corner rule, else the right neighbour if it does. This is
       today's `lanes.outside` with "corner" read as "holds the Corner rule".
    3. If neither neighbour holds it, pick the neighbour on the side of the nearer sideline.
    4. If there is no neighbour at all, leave the teammate empty; validation warns.
  - If the defender has no coverage action, picking Inside also gives it a zone polygon equal to its current
    lane rectangle, the same as the migration does. Otherwise it would stand still instead of zoning its lane.
  - "Matches a template" compares the rules' structure only (receiver, event, area kind, reaction). The
    teammate's identity is not compared, so a migrated S shows "Bunch Killer: Inside".
  - Picking "Luật tự đặt" from a template keeps the rules as they are (they become ordinary custom rules).
  - Not offered for rushers, as today.
- **Rule row:**
  - Receiver select adds "Bất kỳ", plus "Người thứ 1" and "Người thứ 2" when the event is "vào khu vực của".
  - Event select adds "vào khu vực của". When it is picked, a second select appears with "tôi" plus the other
    defenders' labels (rushers excluded).
  - Phản ứng adds "Man người đó".
- The hint text under the template select explains the template in one line (today's corner and inside
  hints).
- Lane boundaries keep showing on the field when there are lane members (dashed lines, as today).
- All new strings go in `src/i18n/vi`.

## Migration

One pure function, `areaMatchToRules(play: Play): Play`, in `src/domain`:
- Computes the lanes from the slots that have `areaMatch` (and no rush / man / spy).
- **Corner:** rules := the Corner template. A zone action on an area-match corner is removed, because
  today's corner ignores every receiver whatever its zone (D-47), so it had no effect. Removing it keeps the
  "stands on its spot" behaviour under the new rule "zone action → plays the zone". The play's notes say so
  in one line.
- **Inside:** rules := the Inside template, with the teammate from `insideTeammate` (it gives the same answer
  as today's `lanes.outside` whenever today's lanes had a corner neighbour). An inside slot with no zone
  action also gets a zone polygon equal to its current lane rectangle (y 0..10), so it keeps zoning its lane
  instead of standing still. When that lane is outermost, its sideline edge uses the field bounds with the
  ball centred (x = 0); a Play stores no ball spot. *(My call; it only differs on a hash.)*
- Old custom rules on an area-match slot were ignored by the engine (D-40). They are dropped, and the
  conversion says so in the play's notes in one line *(my call)*.
- Removes `areaMatch` and any `squeezeAfter`.

It runs in three places:
1. A Dexie version 3 upgrade over `plays`.
2. JSON import: `SCHEMA_VERSION` 1 → 2, with `migrateRecord` converting plays from version 1.
3. `loadDraft` (Freestyle), before `PlaySchema` validation. Without it, the draft would lose the coverage.

The Bangkok seed (`createBangkokContent`) writes rules directly. No seed-version bump is needed, because
the Dexie upgrade converts the seeded plays already in the database.

## Validation warnings (replacing `area-match-ignored` / `area-match-incomplete`)

- An area rule on a rush / man / spy defender: "luật khu vực bị bỏ qua".
- `entersArea` naming a teammate that is missing, a rusher, or the defender itself: the rule is ignored, with
  a warning.
- `nth` with a non-area event: the rule is ignored, with a warning.

## Constraints

- NFR-ARC: domain, engine and suggest stay pure; the engine stays deterministic. Agents see only their own
  team's play, never the opponent's.
- The engine perf bench must not regress by more than 10%.
- UI text in Vietnamese from `src/i18n/vi`. Code, comments and commits in English. Log as D-48 in
  `docs/plan/DECISIONS.md`, and update SRS §5.2/§5.4/§8.6.

## Left to the builder

- Whether the inference lives in a generalised `areaMatch.ts` tracker or a new module, and how the area
  agent and the rule defender are merged (one agent, or the rule defender delegating to an area
  coordinator).
- Exact test layout, provided the T-AM tests keep their assertions.
- Layout details of the new selects in the rule row.

## My calls (for the user to check)

- Area rules fire with no iq delay (as today's Bunch Killer); direction rules keep the delay.
- During conversion, a Bunch Killer corner's zone action is removed (it had no effect), so he still stands
  on his spot.
- The Inside teammate is the neighbour holding the Corner rule (left first), else the neighbour toward the
  nearer sideline.
- Picking the Inside template on a defender with no zone also gives it its lane as a zone.

- Areas are alignment lanes, not drawn zones.
- "Người thứ N" is only offered with "vào khu vực của".
- Old custom rules on an area-match slot are dropped during conversion (the engine already ignored them),
  with a note in the play.
- An inside defender without a zone gets its lane rectangle as an explicit zone during conversion.
- The template select shows a template's name only while the rules match it exactly.
