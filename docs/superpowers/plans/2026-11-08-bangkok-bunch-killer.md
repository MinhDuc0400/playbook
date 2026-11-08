# Bunch Killer (Bangkok) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** The engine can run an "area match" coverage (CB takes the first receiver into his lane; LB/S
skip the first receiver out and take the second, else play zone on whoever is left). Two Bangkok defense
plays, a Bunch Tight offense and a red-zone Install ship ready-made in every database.

**Architecture:**
- Lanes are computed once before the snap from the defense's own alignment (`domain/areaLanes.ts`).
- Each area defender runs a pure claim tracker (`engine/areaMatch.ts`) on its own delayed perception.
  The tracker infers what teammates have claimed by applying the same rules to the same picture, so
  defenders never talk to each other and never see the offense's play (NFR-ARC-06).
- A wrapper agent (`engine/agents/areaMatchDefender.ts`) switches between the existing zone and man
  agents, the same way `ruleDefender.ts` does.

**Tech Stack:** TypeScript strict, Vitest, fake-indexeddb, Dexie, React + Testing Library, Playwright,
pnpm.

**Spec:** `docs/superpowers/specs/2026-11-08-bangkok-bunch-killer-design.md`

## Global Constraints

- NFR-ARC 1–6 (CLAUDE.md): `domain/` and `engine/` never import React, Dexie or the DOM. The engine is
  pure: same input + seed gives the same frames. Agents get only their own state, assignment, stats and
  a delayed `Perception`.
- Coordinates in yards, ball-relative: x right, y downfield.
- `src/domain/types.ts` is lead-owned. Every change there gets a DECISIONS entry: D-40 area match, D-41
  touchdown, D-42 seed v2.
- UI strings in Vietnamese in `src/i18n/vi/*.ts`. Football terms stay English.
- Commits: `feat(<area>): <title> [<FR ids>]`, ending with
  `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`. Never push.
- Default squeeze time 0.5 s. Release threshold y > 0.5. Vertical = vy > 0 and vy/|v| ≥ 0.7. The same
  numbers as `matchRules.ts`; import its constants, don't copy them.
- Seed ids are fixed (§Task 6). A seeded record is never overwritten.

## Review Focus

1. **Two receivers enter a lane on the same tick** (trips: Z and Y both aligned in the CB's lane). The
   receiver closer to the sideline is first. Test in Task 2: `ties go to the receiver nearer the
   sideline`.
2. **An area defender is a rusher or plays man.** `areaMatch` is ignored, with a warning, and the sim
   doesn't crash. Test in Task 3: `areaMatch on a rusher is ignored with a warning`.
3. **Only one area defender, or an inside defender with no corner beside it.** The sim still runs: the
   lone defender plays its base zone, and the editor shows `area-match-incomplete`. Tests in Task 3
   (`single area defender plays its base zone`) and Task 5 (validate).
4. **The defense is flipped** (bunch to the left, `defenseFlip: 'auto'`). Lanes are computed after the
   flip, so the left CB and LB mirror. Test in Task 3: T-AM-03.
5. **A user who already edited or deleted a seeded play gets the v2 seed.** Only missing v2 ids are
   added, and nothing comes back after `seedVersion = 2`. Test in Task 6:
   `does not overwrite or re-add after v2`.

---

## How the engine part works (read this before Tasks 1–3)

**Before the snap (`prepareSim`).** Take every defense slot with `areaMatch` and sort by `start.x`
(flips are already applied). Lane `i` belongs to defender `i`. Boundary `i` is the midpoint between
defender `i` and `i + 1`. The first and last lanes run to the sidelines.

An inside defender's **outside lane** is the neighbouring corner lane:
- If the left neighbour is a corner, that lane.
- Else if the right neighbour is a corner, that lane.
- Else none.

With CB | LB | S | CB, the LB's outside lane is lane 0 and the S's is lane 3.

**Every tick, per area defender (`ClaimTracker.update`).** Using only the defender's own `Perception`:

1. **Log entries.** For each seen offensive non-QB player that is released (y > 0.5 or t > 0) and not
   yet logged in its current lane, append `{ id, lane, t }` to the entry log. Within one tick, sort new
   entries by distance to the nearest sideline (closer first).
2. **Corner first-in.** Each corner lane's first logged receiver is that corner's man.
3. **Inside second-out.** For each inside defender with an outside lane L, the second distinct receiver
   logged in L (excluding the corner's) is that inside defender's man.
4. **Corner squeeze.** A corner with no man at t ≥ `squeezeAfter`:
   - Takes the deepest unclaimed receiver that is currently in the adjacent inside lane and moving
     vertical.
   - If none, it is marked `squeezed`: its base zone moves so its centre sits on the inner lane
     boundary. It keeps re-checking steps 2 and 4 on later ticks.
5. **Claims are sticky.** Once a defender has a man, it keeps him.
6. **Whoever is left.** The result for "me" is my man (or null) and the set of receivers claimed by
   anyone else. The zone agent gets that set as `ignore`.

The tracker computes claims for **all** area defenders from my perception and returns only mine. That is
how S knows the CB took Z without being told. Different reaction times can make two defenders disagree
for a few ticks, which is a realistic bust and still deterministic.

**The agent (`createAreaMatchDefender`).**
- Starts as `createZoneDefender` on the base zone, with `ignore: () => tracker.ignore`.
- When the tracker reports a man, it switches to `createManDefender` (technique trail, cushion 0, the
  slot's leverage, the shared anticipation model) and emits an `areaClaim` event once.
- When the tracker reports `squeezed` with no man, it rebuilds the zone agent on the shifted polygon.

---

### Task 1: Area-match data model and lane math (D-40)

**Files:**
- Modify: `src/domain/types.ts`: add `AreaMatch`, add `PlayerSlot.areaMatch?: AreaMatch`.
- Create: `src/domain/areaLanes.ts`
- Modify: `src/lib/io/schemas.ts`: `PlayerSlotSchema` gets
  `areaMatch: z.object({ role: z.enum(['corner','inside']), squeezeAfter: num.optional() }).optional()`.
- Modify: `docs/plan/DECISIONS.md`: append D-40 (area match: lanes from alignment, the claim order,
  inference without communication).
- Test: `src/domain/__tests__/areaLanes.test.ts`, `src/lib/io/__tests__/schemas.test.ts` (add one case).

**Interfaces:**
- Produces:
  ```ts
  export interface AreaMatch { role: 'corner' | 'inside'; squeezeAfter?: number }
  export const DEFAULT_SQUEEZE_AFTER = 0.5;
  export interface AreaLanes {
    /** Slot ids left → right. */ order: ID[];
    /** order.length − 1 x boundaries, ascending. */ boundaries: number[];
    roles: ('corner' | 'inside')[];
    /** Per lane index: outside lane index for inside defenders, null for corners / none. */
    outside: (number | null)[];
  }
  export function computeAreaLanes(slots: readonly PlayerSlot[]): AreaLanes | null; // null when < 1 area slot
  export function laneOf(lanes: AreaLanes, x: number): number;
  /** [left, right] x of lane i; outer lanes use the given sideline bounds. */
  export function laneSpan(lanes: AreaLanes, i: number, minX: number, maxX: number): [number, number];
  ```

- [ ] **Step 1: Write failing tests** in `areaLanes.test.ts`:
  - `T-AM lanes: boundaries are neighbour midpoints`. Slots CB(−8), LB(−1.5), S(4), CB(9) →
    `boundaries` `[-4.75, 1.25, 6.5]`, `outside` `[null, 0, 3, null]`.
  - `laneOf` → −10 → 0, 0 → 1, 5 → 2, 7 → 3.
  - `slots without areaMatch are skipped; zero area slots → null`.
  - `inside with no corner neighbour has outside null` (roles inside, inside).
  - Schema: a play with `areaMatch: { role: 'corner' }` round-trips through `PlaySchema.parse`; a play
    without it still parses.
- [ ] **Step 2:** `pnpm vitest run src/domain/__tests__/areaLanes.test.ts`. Expected: FAIL, module not
  found.
- [ ] **Step 3:** Add the types, `areaLanes.ts` and the schema field. Write D-40.
- [ ] **Step 4:** Run the tests and `pnpm typecheck`. Expected: PASS, no type errors.
- [ ] **Step 5: Commit** `feat(domain): area-match lanes from defender alignment [D-40]`.

### Task 2: Claim tracker (pure engine logic)

**Files:**
- Create: `src/engine/areaMatch.ts`
- Modify: `src/engine/matchRules.ts`: export `RELEASE_Y`, `VERTICAL_RATIO` (currently module-private).
- Test: `src/engine/__tests__/areaMatch.test.ts`

**Interfaces:**
- Consumes: `AreaLanes`, `laneOf` (Task 1); `PerceivedPlayer` from `engine/types.ts`.
- Produces:
  ```ts
  export type ClaimReason = 'first' | 'second' | 'squeeze';
  export interface ClaimView { manId: ID | null; reason: ClaimReason | null; ignore: ReadonlySet<ID>; squeezed: boolean }
  export interface ClaimTracker {
    /** Feed one perception; returns this defender's view. */
    update(t: number, seen: readonly PerceivedPlayer[]): ClaimView;
  }
  export function createClaimTracker(opts: {
    lanes: AreaLanes; selfIndex: number; squeezeAfter: number[]; // per lane index
    minX: number; maxX: number;
  }): ClaimTracker;
  ```
  `seen` is already filtered to offense non-QB by the caller.

- [ ] **Step 1: Write failing tests.** Use synthetic perceptions: a helper builds `PerceivedPlayer`
  with pos/vel per tick. Lanes are those of Task 1: CB(−8), LB(−1.5), S(4), CB(9).
  - `T-AM-01 tracker: Z out first, Y out second`. Z from (6, 0.6) moving +x into lane 3 at t = 0.3;
    Y from (3, 0.6) reaching lane 3 at t = 0.6. Right CB view: man Z, reason 'first'. S view: man Y,
    reason 'second'; ignore has Z.
  - `T-AM-02 tracker: no one out, CB squeezes onto the seam`. Z moving −x (slant) and Y vertical
    (vel (0, 6)) in lane 2. At t = 0.4 the right CB has no man. At t = 0.5 the right CB has man Y,
    reason 'squeeze'. S has man null, and its ignore contains Y and not Z.
  - `squeeze with no vertical receiver marks squeezed`. Lane 2 empty at t = 0.5 → right CB
    `squeezed: true`, man null. A receiver entering lane 3 at t = 0.8 → man, reason 'first'.
  - `ties go to the receiver nearer the sideline`. Z (x 12) and Y (x 8) both in lane 3 at release on
    the same tick → right CB man Z, S man Y.
  - `claims are sticky`. After Z is claimed, Z moving back into lane 2 doesn't change the right CB's
    man.
  - `unreleased receivers are not logged`. y ≤ 0.5 at t ≤ 0 → no entries.
- [ ] **Step 2:** `pnpm vitest run src/engine/__tests__/areaMatch.test.ts`. Expected: FAIL.
- [ ] **Step 3:** Implement `createClaimTracker` following "How the engine part works" steps 1–6.
  State: the entry log, a per-lane claim map (lane index → receiver id), and a squeezed flag per corner
  lane. Recompute claims every tick from the log, with sticky claims kept in the map.
- [ ] **Step 4:** Run the tests. Expected: PASS.
- [ ] **Step 5: Commit** `feat(engine): area-match claim tracker [D-40]`.

### Task 3: Area-match agent, binding and sim wiring

**Files:**
- Create: `src/engine/agents/areaMatchDefender.ts`
- Modify: `src/engine/types.ts`. Add a `DefenderBinding` variant:
  ```ts
  | { kind: 'areaMatch'; index: number; lanes: AreaLanes; squeezeAfter: number[];
      base: { polygon: Point[]; dropPoint: Point; deep: boolean } }
  ```
  Also add `'areaClaim'` to the `SimEvent` type union (wherever `'ruleFired'` is listed).
- Modify: `src/engine/prepare.ts`:
  - Compute `computeAreaLanes(defense.players)` once.
  - In `bindDefender`, a slot with `areaMatch` whose first coverage action is `zone` or absent becomes
    `areaMatch`:
    - `base` comes from the zone action, as today's zone binding.
    - With no zone action, `base` is the rectangle `laneSpan × [0, 10]` with dropPoint (lane centre, 5)
      *(spec §5.1)*.
  - A slot with `areaMatch` whose first coverage action is `rush`, `man` or `spy` keeps today's binding
    and pushes the warning `"<label>: area match ignored (<kind>)"`.
- Modify: `src/engine/simulate.ts`: in the defender loop, the `areaMatch` binding builds
  `createAreaMatchDefender`, before the match-rules branch. It sets `coverage`, and tells/anticipation
  get the same treatment as man/zone. A slot with both `areaMatch` and `matchRules` uses area match, and
  `prepare.ts` pushes `"<label>: match rules ignored (area match)"` (spec §5.4). Add a test case for it.
- Modify: `src/engine/agents/zoneDefender.ts`: no change expected (`ignore` already exists). Confirm
  only.
- Test: `src/engine/__tests__/areaMatchSim.test.ts`

**Interfaces:**
- Consumes: Task 1 (`AreaLanes`, `laneSpan`), Task 2 (`createClaimTracker`), `createManDefender`,
  `createZoneDefender`, `DefenderAgent`.
- Produces:
  ```ts
  export function createAreaMatchDefender(opts: {
    id: ID; binding: Extract<DefenderBinding, { kind: 'areaMatch' }>; leverage: Leverage | undefined;
    info: FieldInfo; anticipation?: AnticipationModel;
  }): DefenderAgent;
  ```
  It emits `{ type: 'areaClaim', data: { receiverId, reason } }` once per claim.

- [ ] **Step 1: Write failing sim tests** in `areaMatchSim.test.ts`:
  - Build the Bangkok Rush defense from Task 6's helper if it exists. Otherwise inline the same slots
    from spec §7 and move them into Task 6's helper then.
  - Use offense plays built with `buildRoute` from the route tree, and ball spot `{ x: 0, yardLine: 45 }`.
  - Read assignments from frames: the defender's `state` and the `areaClaim` events in `result.events`.
  - `T-AM-01 sim`: Bunch Tight with Z corner, Y flat. Expect an `areaClaim` for CB1 with receiver Z,
    reason first, and for S with receiver Y, reason second.
  - `T-AM-02 sim`: Z slant, Y seam (go), X and C hitch. CB1's claim is Y with reason squeeze, at
    t ∈ [0.5, 1.0] (reaction delay included). S has no `areaClaim` event before the throw.
  - `T-AM-03 sim`: the T-AM-01 offense flipped (`flipPlay`). CB2 claims Z (first) and LB claims Y
    (second).
  - `T-AM-04 sim`: Trips Flood (`floodPlay()` fixture). CB1 claims Z (first) and S claims the next
    receiver out.
  - `T-AM-05`: the same input twice gives deep-equal `frames`.
  - `T-AM-06`: S moved to x 7. `prepareSim(...).bindings[S].lanes.boundaries` changes, and T-AM-01
    still holds.
  - `areaMatch on a rusher is ignored with a warning`: the binding kind is `rush`, and
    `warnings` contains `area match ignored`.
  - `single area defender plays its base zone`: one slot with areaMatch inside. The sim runs, the frames
    are non-empty and the defender's state is 'zone'.
- [ ] **Step 2:** `pnpm vitest run src/engine/__tests__/areaMatchSim.test.ts`. Expected: FAIL.
- [ ] **Step 3:** Implement the binding, the agent and the wiring.
  - Follow `ruleDefender.ts`: a `current: DefenderAgent` that is swapped out, with `lastAim` and
    `targetId` getters that delegate to it.
  - The perception filter for the tracker: `p.others.filter(o => o.side === 'offense' && o.role !== 'QB')`.
  - Squeeze polygon: translate `base.polygon` and `base.dropPoint` by
    `dx = boundaryInside − centroid(base.polygon).x`.
- [ ] **Step 4:** Run the new tests, `pnpm vitest run src/engine`, and `pnpm bench` once to check the
  perf budget still holds. Expected: all PASS. Existing engine tests are unchanged.
- [ ] **Step 5: Commit** `feat(engine): area-match defender (Bunch Killer coverage) [D-40, FR-ENG-09]`.

### Task 4: Touchdown result (D-41)

**Files:**
- Modify: `src/domain/types.ts`: the `complete` outcome becomes
  `{ kind: 'complete'; targetId: ID; yards: number; t: number; touchdown?: true }`.
- Modify: `src/engine/simulate.ts:597`: set `touchdown: true` when
  `landing.y >= goalLineY(info.field, info.ballSpot)`.
- Modify: `src/features/matchup/ResultPanel.tsx` and `src/i18n/vi/result.ts`: add
  `touchdown: 'Touchdown'`. When `outcome.touchdown`, the outcome label and summary read
  "Touchdown" (plus yards in the summary).
- Modify: `docs/plan/DECISIONS.md`: D-41.
- Test: `src/engine/__tests__/outcome.test.ts` (or `simulate.test.ts`), and
  `src/features/matchup/__tests__/ResultPanel.test.tsx`.

- [ ] **Step 1: Failing tests:**
  - `T-TD-01`: ball spot yardLine 45, a completed catch with landing.y ≥ 5 → `touchdown: true`; at
    yardLine 25 with the same play → no touchdown.
  - ResultPanel with `{ kind: 'complete', touchdown: true, yards: 7, ... }` shows the text
    `t.result.touchdown`.
- [ ] **Step 2:** Run them. Expected: FAIL.
- [ ] **Step 3:** Implement.
- [ ] **Step 4:** Run the tests plus `pnpm vitest run src/features/matchup`. Expected: PASS.
- [ ] **Step 5: Commit** `feat(matchup): a catch in the end zone is a touchdown [D-41]`.

### Task 5: Editor support

**Files:**
- Modify: `src/features/editor/defense/DefensePanel.tsx`: in `SelectedDefender`, add a `Select`
  (`data-testid="def-area-match"`) with options none / corner / inside. For a corner, add a `TextInput`
  (`data-testid="def-squeeze-after"`, min 0, max 3, step 0.1).
- Modify: `src/features/editor/defense/ops.ts`:
  `setAreaMatch(slotId: ID, am: AreaMatch | undefined): (p: Play) => Play`.
- Modify: `src/domain/validate.ts`: warning code `'area-match-incomplete'` when the play has exactly one
  area slot, or an inside slot whose `outside` is null.
- Modify: `src/features/editor/...` warning text map (wherever `man-target-missing` is mapped) and
  `src/i18n/vi/defense.ts`:
  - `areaMatch: { label: 'Area match (Bangkok)', none: 'Không', corner: 'Corner (nhận người đầu tiên vào làn)', inside: 'Inside (nhận người thứ hai ra ngoài)', squeezeAfter: 'Squeeze sau (s)' }`
  - The warning text: `'Area match thiếu: cần ít nhất 2 defender và mỗi inside cạnh một corner'`.
- Modify: `src/features/editor/defense/AssignmentLayer.tsx`:
  - When `computeAreaLanes(play.players)` is non-null, draw each boundary as a dashed vertical
    `<line data-testid="area-lane-boundary">` from y 0 to the field top.
  - Use `toScreen()` only; no new conversion code.
- Test: `src/features/editor/defense/__tests__/DefensePanel.test.tsx`,
  `src/domain/__tests__/validate.test.ts`, `src/features/editor/__tests__/ops.test.ts` (whichever
  holds defense ops).

- [ ] **Step 1: Failing tests:**
  - Selecting "corner" in `def-area-match` stores `areaMatch: { role: 'corner' }`. Setting
    `def-squeeze-after` to 0.8 stores `squeezeAfter: 0.8`. Choosing none removes the field. Undo
    restores it.
  - `validate`: one area slot → `area-match-incomplete`; the standard four → no such warning.
  - AssignmentLayer with the four area slots renders 3 `area-lane-boundary` lines.
- [ ] **Step 2:** Run them. Expected: FAIL.
- [ ] **Step 3:** Implement.
- [ ] **Step 4:** Run `pnpm vitest run src/features/editor src/domain` and `pnpm lint`. Expected: PASS.
- [ ] **Step 5: Commit** `feat(editor): set area-match role per defender, show lanes [D-40, FR-DEF]`.

### Task 6: Ready-made plays, Install and seed v2 (D-42)

**Files:**
- Modify: `src/domain/types.ts`: `Settings.seedVersion?: number`. Modify `src/lib/io/schemas.ts`:
  `seedVersion: num.optional()`.
- Create: `src/db/seed/bangkok.ts`.
- Modify: `src/db/seed/samplePlays.ts`: export the `slot`/`wr`/`center` helpers if `bangkok.ts` needs
  them, or move them to `src/db/seed/helpers.ts`.
- Modify: `src/db/seed/seed.ts`:
  - A fresh database writes v1 + v2 content and `seedVersion: 2`.
  - An existing database with `seedVersion` missing or < 2 adds the missing v2 records in one
    `rw` transaction over plays, matchups, installs and settings, then sets `seedVersion: 2`.
- Modify: `docs/plan/DECISIONS.md`: D-42.
- Test: `src/db/seed/__tests__/seed.test.ts` (existing or new), with fake-indexeddb.

**Interfaces:**
- Produces:
  ```ts
  export const BANGKOK_IDS = {
    bunchTight: 'seed-off-bunch-tight',
    rush: 'seed-def-bangkok-rush',
    spy: 'seed-def-bangkok-spy',
    install: 'seed-install-bangkok',
    matchups: ['seed-mu-bangkok-rush-bunch', 'seed-mu-bangkok-spy-bunch',
               'seed-mu-bangkok-rush-flood', 'seed-mu-bangkok-spy-flood'],
  } as const;
  export function createBangkokContent(now: number, field: FieldConfig):
    { plays: Play[]; matchups: Matchup[]; install: Install };
  ```
- Exact content (spec §7):
  - **Bunch Tight** (formation 'Bunch', strength right):
    - QB (0, −5), shotgun drop 2.
    - X (−3, −1) slant, C (0, −0.5) seam, Y (3, −1) flat, Z (6, −1) corner.
    - Routes from `buildRoute`, depths: slant 3, seam 10, flat 1, corner 5.
    - Progression Y, Z, X, C.
  - **Rush** "Zone: Bunch Killer (Bangkok) Rush":
    - CB2 (−8, 3.5) corner, base lane rectangle.
    - LB (−1.5, 3.5) inside, base polygon `[(-4.8,0),(1.4,0),(-1.3,6.5)]`, drop (−1.3, 3).
    - S (4, 3.5) inside, base polygon `[(-0.6,0),(4.8,0),(4.8,6)]`, drop (3.5, 3).
    - CB1 (9, 3.5) corner.
    - R (−7, 7) rush, path `[(0, −5)]`, delay 0.
    - alignTo ball, strength right, tags `['cov:zone','cov:match','red-zone','vs:bunch','vs:trips']`.
  - **Spy** "Zone: Bunch Killer (Bangkok) No Rush Spy": the same four. R (0.5, 7) with zone polygon
    `[(-6,1.5),(7,1.5),(7,10),(-6,10)]`, drop (0.5, 5). No rush.
  - **Matchups:** `createMatchup` with fixed ids and `ballSpot: { x: 0, yardLine: field.length − 5 }`,
    named "<defense> vs <offense>".
  - **Install:** "Red Zone – Bunch Killer (Bangkok)", the 4 matchups in the order of spec §7.

- [ ] **Step 1: Failing tests:**
  - `fresh seed writes Bangkok content`: after `ensureSeeded`, all `BANGKOK_IDS` exist, the install
    has 4 items in order, the defense names match exactly, and `seedVersion === 2`.
  - `v1 database gets v2 once`. Write v1 settings (no `seedVersion`) and the v1 plays, then call
    `ensureSeeded`. The Bangkok content is added.
  - `does not overwrite or re-add after v2`. Rename the seeded Rush play and delete the Spy play,
    then call `ensureSeeded` again. The name is kept and Spy is still gone.
  - `seeded defense plays have no validate warnings` (`validatePlay` with the 5v5 field).
  - Export → import round-trip keeps `seedVersion`.
- [ ] **Step 2:** `pnpm vitest run src/db`. Expected: FAIL.
- [ ] **Step 3:** Implement. Write D-42.
- [ ] **Step 4:** Run `pnpm vitest run src/db src/lib` and `pnpm typecheck`. Expected: PASS.
- [ ] **Step 5: Commit** `feat(install): Bunch Killer (Bangkok) plays and red-zone install [D-42, FR-DAT-05]`.

### Task 7: End-to-end check, SRS and status

**Files:**
- Create: `e2e/19-bangkok.spec.ts`
- Modify: `docs/SRS.md`:
  - §5.2 `PlayerSlot.areaMatch`.
  - §8.6: a short "Area match" subsection that copies the claim order from this plan.
  - The outcome types: touchdown.
- Modify: `docs/plan/STATUS.md`.

- [ ] **Step 1: Write the E2E test:**
  - From a fresh app, open Install. The "Red Zone – Bunch Killer (Bangkok)" install exists with 4
    items.
  - Open item 1 and wait for `open-windows`. No error banner, and the playback runs to the end.
  - Open the Rush defense in the editor: 3 `area-lane-boundary` lines, and `def-area-match` for CB1
    reads corner.
- [ ] **Step 2:** Run `pnpm test:e2e e2e/19-bangkok.spec.ts`. Expected: PASS on chromium (webkit,
  mobile and tablet in the full run).
- [ ] **Step 3:** Update the SRS and STATUS.
- [ ] **Step 4: Full check:** `pnpm typecheck && pnpm lint && pnpm test && pnpm test:e2e`. Expected:
  all green, except tests already known flaky under load, which must pass when rerun alone.
- [ ] **Step 5: Commit** `test(e2e): Bunch Killer install opens and runs; docs [D-40..D-42]`.
