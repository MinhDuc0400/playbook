# Bunch Killer as Custom Rules Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Custom pattern-match rules gain "Bất kỳ / Người thứ N", "vào khu vực của", and "Man người đó".
Bunch Killer becomes a rule template, and the separate area-match mode is removed, with no change in how the
Bangkok plays behave.

**Architecture:**
- The lane logic of D-40 (alignment lanes, entry log, inferred teammate claims) moves from the role-based
  `areaMatch` tracker into a rule-based "area coordinator". The coordinator evaluates every lane member's
  `entersArea` rules.
- A lane member runs a new `laneDefender` agent. It combines the coordinator, the member's other rules
  (through `evaluateRules`) and the D-40/D-47 base behaviour: hold depth, zone or stand.
- Old `areaMatch` data is converted by one pure function, used by the Dexie upgrade, the JSON import and the
  Freestyle draft loader.
- The old path is deleted last. Until then both paths live side by side, so every task ends green.

**Tech Stack:** TypeScript strict, React 18, Zustand, Dexie, Zod, Vitest, Playwright, pnpm.

**Spec:** `docs/superpowers/specs/2026-11-09-area-rules-design.md` (read it first; it is the authority).

## Global Constraints

- NFR-ARC:
  - `domain/`, `engine/` and `suggest/` never import React, Dexie or the DOM.
  - The engine is pure and deterministic.
  - Agents see their own team's play and their own delayed perception, never the opponent's play.
- UI text in Vietnamese from `src/i18n/vi`. Code, comments and commits in English. Football terms stay
  English.
- Commits: `feat(<area>): ... [D-48]` / `test(...)` / `chore(...)`. Each ends with
  `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`. Commit on master and never push.
- Log the decision as D-48 in `docs/plan/DECISIONS.md`.
- Engine bench (`pnpm bench`) must not regress by more than 10% against the baseline (~4.7 ms mean,
  Trips Flood vs Cover 3).
- Area rules (`event: 'entersArea'`) fire with **no** iq delay. Direction rules keep the delay.
- Bunch Killer behaviour must match today's: the assertions of T-AM-01..07, the no-press test and the
  rusher-ignored tests hold with rule-based fixtures.

## Review Focus

1. **A teammate named by an area rule is deleted, or becomes a rusher:** the rule is ignored with a warning,
   with no crash in the sim or the editor. Tests in Task 2 (engine) and Task 4 (validate).
2. **Ctrl+D duplicates a defender with "khu vực của tôi":** the copy becomes a lane member, the lanes
   recompute, and the sim runs. Test in Task 2.
3. **Lật (flip) a Bunch Killer defense:** the same pairs come out (as T-AM-03b). Test in Task 2.
4. **A Freestyle draft saved before this change**, with `areaMatch` in localStorage: it loads converted,
   not dropped. Test in Task 3.
5. **Importing a schemaVersion 1 export that has `areaMatch`:** it converts. A version 2 export round-trips.
   Test in Task 3.

---

### Task 1: Domain types, lanes and Bunch Killer templates

**Files:**
- Modify: `src/domain/types.ts` (rule types; keep `areaMatch` for now)
- Modify: `src/domain/areaLanes.ts` (generalise lanes)
- Create: `src/domain/areaRules.ts` (lane members, templates, inside teammate, lane rectangle)
- Modify: `src/lib/io/schemas.ts` (rule schema)
- Test: `src/domain/__tests__/areaRules.test.ts`, `src/lib/io/__tests__/areaRulesSchema.test.ts`

**Interfaces:**
- Produces (types.ts):
  ```ts
  export type AreaRef = { kind: 'self' } | { kind: 'teammate'; slotId: ID };
  export type RuleReceiver = ReceiverRef | { kind: 'any' } | { kind: 'nth'; n: 1 | 2 };
  export type MatchEvent = 'vertical' | 'out' | 'in' | 'under' | 'release' | 'stop' | 'entersArea';
  // MatchRule.when.receiver: RuleReceiver; MatchRule.when.area?: AreaRef;
  // MatchRule.then adds { type: 'manTrigger' }
  ```
- Produces (areaLanes.ts):
  - `export interface Lanes { order: ID[]; boundaries: number[] }`.
  - `AreaLanes extends Lanes`.
  - `laneOf(lanes: Lanes, x)` and `laneSpan(lanes: Lanes, i, minX, maxX)` accept `Lanes`.
  - `computeLanes(slots: readonly PlayerSlot[], isMember: (s: PlayerSlot) => boolean): Lanes | null`.
    `computeAreaLanes` keeps its result and is built on it.
- Produces (areaRules.ts):
  - `isAreaRule(r: MatchRule): boolean`: event is `entersArea`.
  - `canCover(slot: PlayerSlot): boolean`: no rush, man or spy action.
  - `laneMemberIds(slots: readonly PlayerSlot[]): ID[]`: slots that `canCover` and either have an area
    rule, or are named as `area.teammate` by another slot's area rule.
  - `computeRuleLanes(slots): Lanes | null`, which is `computeLanes` over the lane members.
  - `cornerRules(idGen: () => ID): MatchRule[]` returns
    `[{id, priority: 0, when: {receiver: {kind:'nth', n:1}, event:'entersArea', area:{kind:'self'}}, then:{type:'manTrigger'}}]`.
  - `insideRules(idGen, teammateId: ID | null): MatchRule[]` is the same shape with n: 2 and
    `area: {kind:'teammate', slotId}`. With a null teammate, it returns the rule with `slotId: ''`.
  - `matchTemplate(rules: readonly MatchRule[] | undefined): 'corner' | 'inside' | null`. It compares
    structure only (one rule; receiver, event, area kind and reaction), never ids or the teammate.
  - `insideTeammate(slots: readonly PlayerSlot[], slotId: ID): ID | null`. Algorithm
    (spec "Editor → Inside"):
    1. Lane order = lane members plus `slotId`, sorted by start x.
    2. Take the left neighbour if `matchTemplate(neighbour.matchRules) === 'corner'`, else the right one if
       so.
    3. Else take the neighbour on the side of the nearer sideline (`slot.start.x < 0` → left).
    4. Else null.
  - `laneRectangle(slots, slotId, field): Point[]` is the lane of `slotId` (members plus `slotId`), as a
    rectangle with y 0..10. Outer lanes run to the sidelines with the ball centred
    (`sidelineBounds(field, {x: 0, yardLine: 25})`).

- [ ] **Step 1: Write the failing tests** in `src/domain/__tests__/areaRules.test.ts`. Use a 4-defender
  helper: CB2 x −8, LB −1.5, S 4, CB1 9, all at y 3.5.
  - `laneMemberIds`:
    - Corners with `cornerRules` plus S with `insideRules('CB1')` gives `['CB2','CB1','S']` (in slot order).
    - LB with no rules but named by an area rule is a member.
    - A rusher with an area rule is not a member.
  - `computeRuleLanes`: with all four members, `boundaries` equals `[-4.75, 1.25, 6.5]` (the D-40 values).
  - `matchTemplate`:
    - `cornerRules(...)` gives `'corner'` and `insideRules(..., 'X')` gives `'inside'`.
    - Two rules, or a different reaction, give `null`.
  - `insideTeammate`:
    - S beside CB1 (both corners templated): S gives `'CB1'` and LB gives `'CB2'`.
    - With no templated corners, S (x 4) gives `'CB1'` (toward the nearer sideline) and LB (x −1.5) gives
      `'CB2'`.
    - The reviewer's case: CB2 −8, S 2, CB1 9, no LB, corners templated. The answer is `'CB2'`, matching
      today's `lanes.outside` (left first).
  - `laneRectangle` for S with all four members: x from 1.25 to 6.5, y 0 to 10.

- [ ] **Step 2: Run** `pnpm vitest run src/domain/__tests__/areaRules.test.ts`. Expected: FAIL (module
  missing).

- [ ] **Step 3: Implement** the types, `computeLanes` and `areaRules.ts` as in Interfaces. In `schemas.ts`:
  - `when.receiver` becomes a union of `ReceiverRefSchema`, `{kind:'any'}` and
    `{kind:'nth', n: 1|2}`.
  - `event` gains `'entersArea'`.
  - `area` is an optional union of `{kind:'self'}` and `{kind:'teammate', slotId: id}`.
  - `then` gains `{type:'manTrigger'}`.

- [ ] **Step 4: Schema test** in `src/lib/io/__tests__/areaRulesSchema.test.ts`. A play whose CB1 has
  `cornerRules` and whose S has `insideRules('CB1')` parses unchanged (`toEqual`). An `nth` with n: 3 is
  rejected.

- [ ] **Step 5: Run** `pnpm vitest run src/domain src/lib/io && pnpm typecheck`. Expected: PASS, no type
  errors. `ReceiverRef` consumers of `when.receiver` (engine `resolveRef`, `MatchRulesForm`) may need a
  narrowing guard (`'kind' in r && (r.kind === 'number' || r.kind === 'role')`). Add
  `isReceiverRef(r: RuleReceiver): r is ReceiverRef` to `areaRules.ts` and use it; no behaviour change.

- [ ] **Step 6: Commit** `feat(domain): area rule types, lanes and Bunch Killer templates [D-48]`.

---

### Task 2: Engine — area coordinator and lane defender

**Files:**
- Create: `src/engine/areaCoordinator.ts`
- Create: `src/engine/agents/laneDefender.ts`
- Modify: `src/engine/matchRules.ts` (`any` receiver, `manTrigger`)
- Modify: `src/engine/agents/ruleDefender.ts` (`manTrigger` outcome)
- Modify: `src/engine/types.ts` (binding), `src/engine/prepare.ts`, `src/engine/simulate.ts`
- Modify: `src/domain/types.ts` (`SimEvent` `ruleFired` may carry `targetId`; it already has an optional
  `targetId` field, so reuse it)
- Test: `src/engine/__tests__/areaCoordinator.test.ts`, `src/engine/__tests__/areaRulesSim.test.ts`,
  `src/engine/__tests__/matchRules.test.ts` (extend)
- Modify: `src/engine/__tests__/fixtures.ts` (add `bangkokRulesPlay(variant)`: the same slots as
  `bangkokPlay`, with `cornerRules` / `insideRules` instead of `areaMatch`)

**Interfaces:**
- Consumes: Task 1 (`Lanes`, `laneOf`, `laneSpan`, `computeRuleLanes`, `laneMemberIds`, `isAreaRule`,
  `isReceiverRef`).
- Produces:
  ```ts
  // engine/areaCoordinator.ts
  export interface LaneMember { id: ID; rules: readonly MatchRule[] } // area rules only
  export interface AreaView {
    fired: { ruleId: ID; receiverId: ID } | null; // self's area rule that fires THIS tick (once)
    ignore: ReadonlySet<ID>;                      // receivers taken by other members
  }
  export function createAreaCoordinator(opts: {
    lanes: Lanes; members: readonly LaneMember[]; selfId: ID; minX: number; maxX: number;
  }): { update(t: number, seen: readonly PerceivedPlayer[]): AreaView };

  // engine/types.ts
  export interface LaneBinding {
    kind: 'lane';
    lanes: Lanes;
    members: LaneMember[];
    base: { polygon: Point[]; dropPoint: Point; deep: boolean } | null; // null = stand on its spot
    hold: Point;
  }

  // engine/matchRules.ts
  // RuleOutcome adds { type: 'manTrigger'; targetId: ID }
  // evaluateRules skips entersArea rules
  // receiver 'any' = first seen satisfying the event (nearer sideline, then id)
  // 'nth' with a non-area event never holds
  ```
- Coordinator algorithm (spec "Semantics"):
  - **Entry log:** as `areaMatch.ts` today.
  - **Each tick:**
    - Evaluate every member's area rules that have not fired yet, in the fixed order: `nth` n=1 rules,
      then n=2, then `any`. Within a group, members go by lane index, left to right.
    - Area A = own lane (`self`) or the teammate's lane. A teammate that is not a lane member makes the
      rule inert.
    - **nth:** the N-th receiver in A's entry list, after removing receivers taken by members other than
      A's owner. He must not be taken himself.
    - **any:** the first untaken receiver in A's entry list.
    - `minDepth` and `beforeTime` apply to the trigger.
    - A firing `manTrigger` marks the receiver taken by that member, sticky. A member is taken off once it
      has a man; its later area rules don't fire.
    - `carry` and `passOff` from area rules fire for self only and take no one.
  - **No iq delay.**
- `laneDefender`:
  - **Base:** a zone defender with `holdDepth: hold.y`, starting at `hold`, with `ignore` = the
    coordinator's `ignore`. When `base` is null, `ignore` = every seen receiver and the polygon is the
    lane rectangle, so it stands on `hold` and reacts only to the ball (D-47).
  - **Area rules:** when the coordinator returns `fired` for self:
    - `manTrigger` switches to a man defender (trail, cushion 0).
    - It emits `ruleFired` with `targetId` and `data: {ruleId, outcome, receiverId}`.
  - **Other rules:** non-area rules run through `evaluateRules` exactly as `ruleDefender` does (reuse its
    outcome handling; extract a shared helper if needed).
- **`prepare`:** used when no slot has `areaMatch`; the old path stays when one does.
  - Lane members (`laneMemberIds`) get a `LaneBinding`.
  - `base` = the zone binding when the slot has a zone action, else null.
  - Area rules on non-members (rush, man, spy) or naming a missing or non-member teammate are dropped,
    with the warning `"<label>: area rule ignored"`.
- **`simulate`:** builds `laneDefender` for `kind: 'lane'`. `anticipation.readingEnabled` includes
  `'lane'`.

- [ ] **Step 1: Write failing coordinator tests** (`areaCoordinator.test.ts`). Port each case of
  `src/engine/__tests__/areaMatch.test.ts` to members built with `cornerRules` / `insideRules`, keeping
  every expectation:
  - T-AM-01, T-AM-02 (no claims, ignore excludes Y), T-AM-07.
  - "Waits, then takes a late receiver".
  - Ties nearer the sideline, sticky claims, nothing before the snap, the left side mirrors.
  - Add: an `any` area rule on CB1 fires on the first receiver into CB1's lane.
  - Add: an inside rule naming a teammate who is not a member never fires.

- [ ] **Step 2: Write failing sim tests** (`areaRulesSim.test.ts`). Copy every test in
  `areaMatchSim.test.ts` and swap `bangkokPlay` for `bangkokRulesPlay`. Swap the user-board defense
  `area(..., 'corner'|'inside')` for the matching rules, using
  `insideRules(idGen, insideTeammate(...))`. Keep every assertion, reading claims from `ruleFired` events
  (`playerId`, `targetId`, `t`) in place of `areaClaim`.

  Add the Review Focus tests:
  - **Missing teammate:** a defense where S's inside rule names a teammate id that is not in the play.
    The sim runs, S makes no man claim, and `prepare` warnings include `"S: area rule ignored"`.
  - **Teammate is a rusher:** CB1 is turned into a rusher. S's rule is ignored with the same warning, and
    the other claims are unchanged.
  - **Duplicate:** add a copy of CB1 (new id, x 11, `cornerRules`). The sim runs, lanes have 5 members,
    and claims are deterministic.
  - **Flip:** `flipPlay` on both sides keeps CB1 on Z and S on Y (as T-AM-03b).

- [ ] **Step 3: Write a failing `matchRules.test.ts` case.** `any` + `out` fires on the first receiver
  running out, nearer the sideline first. `manTrigger` returns `{type:'manTrigger', targetId}`.

- [ ] **Step 4: Run** `pnpm vitest run src/engine`. Expected: the new tests FAIL; the old tests pass.

- [ ] **Step 5: Implement** the coordinator, `laneDefender`, the `matchRules` changes, the `ruleDefender`
  `manTrigger` handling (it switches to man on the trigger), and the prepare/simulate wiring.

- [ ] **Step 6: Run** `pnpm vitest run src/engine && pnpm typecheck && pnpm bench`. Expected: all tests
  PASS (old area-match tests included), and the bench mean is within 10% of the baseline.

- [ ] **Step 7: Commit** `feat(engine): area rules — lane coordinator and lane defender [D-48]`.

---

### Task 3: Convert old `areaMatch` data; seed with rules

**Files:**
- Create: `src/domain/areaMatchToRules.ts`
- Modify: `src/domain/types.ts` (`SCHEMA_VERSION = 2`)
- Modify: `src/db/migrations.ts` (`upgradeToV3`, `migrateRecord` from 1)
- Modify: `src/db/schema.ts` (`this.version(3).stores(STORES_V2).upgrade(upgradeToV3)`)
- Modify: `src/features/freestyle/draft.ts` (`loadDraft` converts before `PlaySchema`)
- Modify: `src/db/seed/bangkok.ts` (rules, not `areaMatch`)
- Test: `src/domain/__tests__/areaMatchToRules.test.ts`, `src/db/__tests__/migrations.test.ts` (extend),
  `src/features/freestyle/__tests__/draft.test.ts` (extend or create), `src/db/__tests__/seed.test.ts`,
  `src/lib/io/__tests__/import*.test.ts` (extend whichever covers `parseImport`)

**Interfaces:**
- Consumes: Task 1 (`cornerRules`, `insideRules`, `insideTeammate`, `laneRectangle`), and today's
  `computeAreaLanes` and `isAreaMatchActive`.
- Produces: `areaMatchToRules(play: Play, field: FieldConfig, idGen: () => ID): Play`.
  - Pure.
  - Returns the same object when no slot has `areaMatch`.
  - Rule ids are deterministic: `${slot.id}-bk` (so `idGen` is only a fallback).
  - The algorithm follows the spec's "Migration" section:
    - **Corner:** gets `cornerRules`, and its zone action is removed.
    - **Inside:** gets `insideRules` with the teammate from today's `lanes.outside` (the same as
      `insideTeammate` when there is a corner neighbour). With no zone action, it gets
      `{type:'zone', zone:{polygon: laneRectangle(...)}, dropPoint: lane centre at y 5}`.
    - Old `matchRules` on an area-match slot are dropped.
    - The note line (Vietnamese, appended to `play.notes`): `'Đã chuyển Bunch Killer sang luật pattern match (D-48).'`
    - `areaMatch` is removed from every slot. `areaMatch` on a rush/man/spy slot is simply removed.
- Field for conversion: the Dexie upgrade and the import use `createDefaultFields()['5v5']`; `loadDraft`
  uses the same.

- [ ] **Step 1: Failing tests** in `areaMatchToRules.test.ts`:
  - **Bangkok (old shape):** CB1/CB2 get `matchTemplate === 'corner'`. S gets `'inside'` with
    `slotId === CB1`, and LB gets `'inside'` with `slotId === CB2`.
  - `areaMatch` is gone from every slot, and the notes end with the note line.
  - **Behaviour parity:** for the bunch matchups in `areaMatchSim.test.ts` T-AM-01, 02 and 04, simulating
    the old play and its conversion gives the same frames (`toEqual`). If an old/new difference in event
    names breaks `toEqual` on frames only through events, compare frames, not events.
  - An inside slot with no zone gets a polygon zone covering its lane.
  - A corner with a zone loses it.
  - A play with no `areaMatch` comes back as the same object (`toBe`).

- [ ] **Step 2: Review Focus 4 and 5 tests:**
  - **Draft:** `loadDraft()` with a stored v1 draft whose defense has `areaMatch` returns a draft with the
    rules (not null).
  - **Import:** `parseImport` on a `schemaVersion: 1` file with an `areaMatch` play gives rules. A
    `schemaVersion: 2` export → import → export round-trips equal.
  - **Dexie:** a v2 database with an `areaMatch` play opens at v3 converted, and `schemaVersion` on every
    record is 2. Follow the existing upgrade test's pattern in `src/db/__tests__/`.

- [ ] **Step 3: Run** these tests. Expected: FAIL.

- [ ] **Step 4: Implement:**
  - `areaMatchToRules`.
  - `upgradeToV3`: convert plays, set `schemaVersion = 2` on all tables.
  - `migrateRecord`: version 1 → 2 converts plays and sets `schemaVersion: 2`; version 0 runs v1 then v2.
  - The `loadDraft` call.
  - The seed: CB1/CB2 with `cornerRules` (ids `${slot.id}-bk`), S with `insideRules` → CB1 and LB with
    `insideRules` → CB2 (ids `${slot.id}-bk`), and no `areaMatch`.

- [ ] **Step 5: Run** `pnpm vitest run src/domain src/db src/lib/io src/features/freestyle && pnpm typecheck`.
  Expected: PASS. Update `seed.test.ts` assertions that read `areaMatch?.role` to read
  `matchTemplate(slot.matchRules)` (same expected values, 'corner'/'inside'/null).

- [ ] **Step 6: Commit** `feat(db): convert area-match plays to rules; schema v2 [D-48]`.

---

### Task 4: Editor — new rule options and the template select

**Files:**
- Modify: `src/features/editor/defense/MatchRulesForm.tsx`
- Modify: `src/features/editor/defense/ruleOps.ts` (add `setRules(slotId, rules)`), `ops.ts` (`setZone` reused
  for the Inside lane zone)
- Modify: `src/features/editor/defense/AssignmentLayer.tsx` (lanes from `computeRuleLanes` when no
  `areaMatch`)
- Modify: `src/domain/validate.ts` (new warnings), `src/i18n/vi/rules.ts`, `src/i18n/vi/editor.ts`
- Modify: `src/components/field/markers.ts` (`ruleFired` with `targetId` → "CB1 → Z")
- Test: `src/features/editor/defense/__tests__/MatchRulesForm.test.tsx`, `src/domain/__tests__/validate*.test.ts`,
  `src/components/field/__tests__/markers.test.ts`

**Interfaces:**
- Consumes: Task 1 (`cornerRules`, `insideRules`, `insideTeammate`, `matchTemplate`, `laneRectangle`,
  `computeRuleLanes`, `laneMemberIds`).
- Produces:
  - `setRules(slotId: ID, rules: MatchRule[]): Recipe`.
  - Validation codes `'area-rule-ignored'` (slotId) and `'area-rule-bad-target'` (slotId).
- UI (testids):
  - **Template select:** `rule-template`, with values `rules` | `corner` | `inside` and label `t.rules.template`
    ('Mẫu'). Its value is `matchTemplate(slot.matchRules) ?? 'rules'`. Picking `corner`/`inside` calls
    `apply('rule template', ...)` once, replacing this slot's rules; for `inside` with no coverage action it
    also adds the lane zone. Picking `rules` changes nothing.
  - **Hint:** `rule-area-hint`, shown under the select for corner/inside, with today's
    `cornerHint`/`insideHint`.
  - **Rule list:** always visible.
  - **Receiver select:** adds options `any` ('Bất kỳ'), and `nth-1` / `nth-2` ('Người thứ 1/2'), the
    latter only when the event is `entersArea`.
  - **Event select:** adds `entersArea` ('vào khu vực của').
  - **Area select:** `rule-area-<ruleId>`, shown when the event is `entersArea`. Options: `self` ('tôi')
    plus the other non-rusher defenders by label. Picking the event defaults `area` to `self`.
  - **Phản ứng:** adds `manTrigger` ('Man người đó').
  - **Switching:** moving the event away from `entersArea` while the receiver is `nth` resets the receiver
    to `any` and removes `area`.
- Validation:
  - `'area-rule-ignored'`: an area rule on a rush/man/spy slot.
  - `'area-rule-bad-target'`: the teammate is missing, a rusher, or the slot itself; or `nth` is used with
    a non-area event.
  - Vietnamese texts: 'Luật khu vực bị bỏ qua (defender này rush/man/spy)' and
    'Luật khu vực trỏ tới đồng đội không hợp lệ'.

- [ ] **Step 1: Failing form tests:**
  - **Template corner:** the rules become one rule matching `cornerRules`, the select shows `corner`, the
    hint shows, and it is one undo step.
  - **Template inside:** on S beside CB1 (templated corner), the rule's area is `CB1`. S without a zone
    gets a polygon zone.
  - **Event entersArea:** shows the area select defaulting to `self`. The receiver offers `nth-1`/`nth-2`.
    Switching the event back to `out` resets the receiver to `any` and drops `area`.
  - **Phản ứng `manTrigger`:** stored as `{type:'manTrigger'}`.
  - **Rusher:** no `rule-template` select.

- [ ] **Step 2: Failing validate tests (Review Focus 1):**
  - An area rule naming a deleted teammate gives `area-rule-bad-target`.
  - An area rule on a rusher gives `area-rule-ignored`.
  - The Bangkok rules play gives no warnings.

- [ ] **Step 3: Failing markers test:** a `ruleFired` event with `playerId` CB1 and `targetId` Z gives
  label `'CB1 → Z'`.

- [ ] **Step 4: Run** `pnpm vitest run src/features/editor src/domain src/components`. Expected: FAIL.

- [ ] **Step 5: Implement.** Keep the old `rule-mode` select only for slots that still carry `areaMatch`
  (removed in Task 5).

- [ ] **Step 6: Run** the same tests, plus `pnpm typecheck && pnpm lint`. Expected: PASS.

- [ ] **Step 7: Commit** `feat(editor): area rule options and Bunch Killer template [D-48]`.

---

### Task 5: Remove the old area-match path; docs; E2E

**Files:**
- Delete:
  - `src/engine/areaMatch.ts` and `src/engine/agents/areaMatchDefender.ts`.
  - Their tests: `areaMatch.test.ts` and `areaMatchSim.test.ts`, which are superseded by Task 2's ports.
- Modify:
  - `src/domain/types.ts`: remove `areaMatch`, `AreaMatch` and the `'areaClaim'` SimEventType.
  - `src/domain/areaLanes.ts`: remove `isAreaMatchActive` and `computeAreaLanes`, unless the Task 3
    converter still needs them. If it does, move the old-shape logic into `areaMatchToRules.ts` as private
    helpers reading the raw `areaMatch` key.
  - `src/engine/prepare.ts`, `src/engine/simulate.ts`, `src/engine/types.ts`.
  - `src/features/editor/defense/MatchRulesForm.tsx` (drop `rule-mode`) and `ops.ts` (drop `setAreaMatch`).
  - `src/domain/validate.ts` (drop the `area-match-*` codes).
  - `src/lib/io/schemas.ts`: drop `areaMatch`. Old keys are stripped; conversion already ran before the
    schema.
  - `src/components/field/markers.ts`, `Timeline.tsx`, `src/i18n/vi/playback.ts`,
    `MatchupPage.tsx` / `TrialView.tsx` `MARKER_TYPES`: drop `areaClaim`; `ruleFired` markers keep the teal
    colour when they have a `targetId`.
  - `e2e/19-bangkok.spec.ts`: `rule-mode` → `rule-template`, value `corner`; the lane boundaries stay
    at 3.
- Docs:
  - `docs/plan/DECISIONS.md`: add D-48.
  - `docs/SRS.md`: §5.2 type, §5.4 rule fields, and §8.6 "Area match" rewritten as rules.
  - `docs/plan/STATUS.md`: add a line.

**Interfaces:**
- Consumes: everything above. The converter must still read old data through the raw key
  (`(slot as {areaMatch?: unknown}).areaMatch`).

- [ ] **Step 1:** Delete and remove as listed. Run `pnpm typecheck` and fix every reference.
  Expected: no type errors.
- [ ] **Step 2:** Run `pnpm lint && pnpm test`. Expected: all pass. The test count drops only by the deleted
  area-match files.
- [ ] **Step 3:** Run `pnpm exec playwright test --project=chromium`. Expected: all pass (39 passed,
  2 skipped today).
- [ ] **Step 4:** Run `pnpm bench`. Expected: within 10% of the baseline.
- [ ] **Step 5:** Write D-48. It covers:
  - the new options;
  - one system with templates;
  - no iq delay on area rules;
  - the conversion, including the corner zone dropped, the inside lane zone and old rules dropped;
  - the teammate helper;
  - the removal of `areaMatch` / `areaClaim`.

  Update the SRS and STATUS.
- [ ] **Step 6: Commit** `refactor(engine): Bunch Killer runs on rules; remove area-match mode [D-48]`.
