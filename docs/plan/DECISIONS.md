# Decisions

One entry per decision: context → decision → reason. IDs are stable; later entries may supersede earlier
ones (marked "supersedes D-xx").

## D-01 SRS §16 open questions use orchestrator defaults
- Context: §16 has 5 open items.
- Decision: 5v5 NFL FLAG is the main format (sample plays are 5v5); one player may motion before the snap;
  sample plays are generic (Cover 1, Cover 2, Cover 3; Trips Flood, Mesh, Smash); pass plays only (no run
  play); tablet is view-only (Matchup + Present usable by touch, Editor needs ≥ 1024 px).
- Reason: orchestrator brief.

## D-02 Repo layout
- Context: the kit was delivered in `flagbook-kit/` inside an empty git repo.
- Decision: kit files (`CLAUDE.md`, `docs/`, `.claude/`) copied to repo root; the app lives at the repo
  root. `flagbook-kit/` and `flagbook-kit.zip` are left untouched and git-ignored.
- Reason: kit README says "copy the whole kit into an empty folder"; nothing is deleted.

## D-03 Tooling versions
- Decision: pnpm 9 (corepack), Vite 5, React 18, TS 5.6 strict, React Router 6, Zustand 5 + immer 10 +
  zundo 2, Dexie 4, Zod 3, Vitest 2, Tailwind 3, ESLint 9 flat config, Playwright (chromium + webkit as the
  Safari stand-in).
- Reason: SRS §3.1 stack; majors pinned to well-known stable lines.

## D-04 Implementer / verifier agents
- Context: the session started before `.claude/agents/` existed at the repo root, so the custom agent types
  may not be registered.
- Decision: dispatch with `subagent_type: "implementer"` / `"verifier"` when available; otherwise use the
  general-purpose agent on model `sonnet` with the full text of `.claude/agents/implementer.md` (or
  `verifier.md`) prepended to the brief.
- Reason: same behaviour, same model, same report format.

## D-05 File ownership is per phase
- Context: plan rule "two tasks never own the same file", but later phases must extend earlier files
  (e.g. phase 5 adds anticipation to the man/zone agents).
- Decision: within a phase no two tasks own the same file. A later-phase task may take over a file owned in
  an earlier phase; the plan lists it explicitly under "Owned files (takes over)". Shared wiring files
  (`package.json`, configs, `src/app/router.tsx`, `src/db/schema.ts`, `src/i18n/vi.ts`,
  `src/features/editor/tools/index.ts`, `src/domain/types.ts`, `src/engine/types.ts`) are lead-owned.
- Reason: keeps parallel work conflict-free without forcing everything into phase-1 mega-files.

## D-06 i18n split into namespaces
- Context: NFR-UX-04 wants all strings in one file; parallel UI tasks would collide on it.
- Decision: `src/i18n/vi.ts` is the single entry point (`import { t } from '@/i18n/vi'`) and re-exports one
  namespace object per feature from `src/i18n/vi/<feature>.ts`. Each UI task owns its namespace file.
  Components never contain literal Vietnamese text.
- Reason: one place to add English later (swap the entry point), no merge conflicts.

## D-07 `schemaVersion`, timestamps on every record
- Context: FR-DAT-01 requires `schemaVersion` on every record; §5 shows it only on `Play`. Import merge
  (FR-IO-03) keeps the newer `updatedAt`, but `Athlete`/`Lineup` have no timestamps.
- Decision: add `schemaVersion: number` to `Athlete`, `Lineup`, `Matchup`, `Install`, `Settings`; add
  `createdAt`/`updatedAt` to `Athlete` and `Lineup`. Add `Settings.lastExportAt?: number` (FR-IO-05).
  Record schema version constant `SCHEMA_VERSION = 1`. Dexie DB version 2 = SRS v1 stores + `updatedAt`
  index on athletes/lineups; its upgrade fills missing `schemaVersion`/timestamps (gives FR-DAT-01 a real
  migration to test).
- Reason: SRS text wins over the incomplete type block; additive, no data-model conflict.

## D-08 Coordinates of route paths
- Decision: `RouteAction.path`, `MotionAction.path`, `RushAction.path`, option `stem/vsMan/vsZone` hold
  absolute field points (yards, ball-relative) and do NOT repeat the start point. Option branches start at
  the end of `stem`.
- Reason: SRS "điểm bẻ, bắt đầu từ vị trí hiện tại"; absolute points make `flipPlay` a plain x → −x.

## D-09 Strength, strong side and numbering tie-breaks
- Context: FR-OFF-05 says equal counts ⇒ `balanced`, but `ReceiverRef` needs a strong side, and T-DOM-02
  requires man assignments to survive an offense flip.
- Decision:
  - `computeStrength(players)` counts eligible receivers per side, excluding QB, players with |x| < 0.25
    (on the ball) and backfield RBs (|x| < 3 and y < −2). Equal ⇒ `balanced`.
  - `strongSide(players, strength)`: `left`/`right` when strength says so; for `balanced`, tie-break by
    larger Σ|x| of the side's receivers, then side of a backfield RB, then `right`.
  - Numbering per side sorts eligible receivers by |x| descending → #1, #2, #3 (max 3). A receiver on the
    ball (the C, |x| < 0.25) is numbered as the innermost receiver of the strong side. Backfield RB is never
    numbered (ref by role).
  - The engine computes strong side from visible alignment at the snap; the editor uses `Play.strength`
    (which may be a user override).
- Reason: deterministic, flips correctly for every non-mirror formation; an exact mirror formation is
  visually indistinguishable so `right` is the only honest default.

## D-10 Engine purity and anti-lookahead mechanics
- Decision:
  - Agents are created per player at sim start from their OWN slot + bound assignment (closures). `step()`
    gets only `AgentState`, `Perception`, `dt`, own forked `Rng`. No `world`, no opponent `Play`.
  - Per-agent RNG streams: `forkRng(seed, key)` so one agent's draws never shift another's (keeps
    T-ENG-02 exact).
  - Push-apart (§8.4) applies only between teammates. Cross-side overlap is allowed (contest at the
    catch point). Cross-side push would leak true positions with zero delay.
  - The oracle (a > 0.5) is built in `anticipation.ts` from an offense-only kinematic run of the offense
    play; it is the only code that reads the opponent's `Play`.
  - T-ENG-02 is measured as: find the first tick `tDiff` where any offensive player differs between the
    two runs; every defender must be identical for all t < tDiff + minEffectiveDelay, where
    minEffectiveDelay = min(reaction) × leverageReactionFactor × 0.5.
- Reason: NFR-ARC-02, §8.3; makes the anti-lookahead property testable and exact.

## D-11 Outcome logic shipped with phase 3
- Decision: `resolveContest` and the full §8.8 table (hands, ballSkills, accuracy error, armRange, INT /
  deflect) are implemented in phase 3, not phase 5. FR-ENG-10 is therefore delivered in phase 3.
  Receiver-only arrival = `resolveContest(hands, 0, …)`; defender-only = `resolveContest(0, ballSkills, …)`.
- Reason: the table is one function; staging it adds rework, and the §8.8 100k-sample test is a phase-3
  engine gate.

## D-12 Field defaults
- Decision: 5v5 = SRS table (30 × 50 + 2 × 10 end zones, lineToGain [25], noRunZones
  [{20,25},{45,50}] in yards from own goal line, rushLine 7, maxRushers 2, passClock 7). 7v7 = copy of 5v5
  with 7 players and width 40. custom = copy of 5v5. `ballSpot` default `{ x: 0, yardLine: 15 }`. Sidelines
  relative to the ball: x ∈ [−W/2 − ballSpot.x, W/2 − ballSpot.x].
- Reason: SRS says "copy from 5v5"; 40 yd width is the common 7v7 field.

## D-13 Offense-only preview is engine code
- Context: FR-OFF-06 ("Chạy thử", phase 1) needs animation, but NFR-ARC-03 forbids UI-side positions.
- Decision: phase 1 builds `engine/movement.ts` (§8.4 model) and `engine/routeFollower.ts`, and
  `engine/preview.ts` `previewOffense()` returns `Frame[]`. Phase 3 agents reuse them.
- Reason: one movement model; de-risks phase 3.

## D-14 Editor store is generic
- Decision: `editorStore` holds `play`, selection, tool and UI state; play edits go through
  `apply(label, recipe)` where recipes are pure functions from `features/editor/ops.ts` (and
  `features/editor/defense/ops.ts`). zundo tracks `play` only, limit 200.
- Reason: defense/advanced phases add ops without touching the store; ops are unit-testable.

## D-15 QB rules detail
- Decision: drop target y = start.y − depth (shotgun and under). Reads start when the drop ends. Under
  pressure or when t ≥ passClock − release: throw to the valid receiver with the largest predicted
  separation if it is ≥ throwOpenThreshold, else throwaway. Valid = predicted catch point y > 0 and
  distance ≤ armRange. QB predicts receiver position from its own team's route plan (offense knowledge
  is legal).
- Reason: fills gaps in §8.5 without changing the model.

## D-16 Seed / benchmark pairings
- Decision: "good concept vs matching coverage" (FR-TUN-03, §14.5) = Trips Flood vs Cover 3, Smash vs
  Cover 2, Mesh vs Cover 1. Benchmark: all players TB, noise on, 50 seeds per pairing.
- Reason: textbook pairings; matches the play tags (`beats:cover-3`, …).

## D-17 Strength override flag
- Context: FR-OFF-05 "Strength tự tính … cho phép ghi đè" needs to know whether the stored strength is an
  override, or every player move would overwrite it.
- Decision: optional `Play.strengthOverridden?: boolean` (offense). Editor ops recompute strength after
  alignment changes unless it is true; "auto" clears it. Engine ignores it (uses visible alignment, D-09).
- Reason: additive optional field; no data-model conflict.

## D-18 Editor default labels, formations, rendering
- Default labels per role: QB Q; C C; WR X, Z, Y, H, F, W; RB B, R; TE T, U; CB CB1..CB4; S FS, SS, S3;
  LB LB, LB2, LB3; R R1, R2. Exhausted → `${role}${n}`.
- Formation presets: 5v5 offense 2x1, Trips, Bunch, Stack, Spread RB; 5v5 defense Cover 1/2/3 shells;
  7v7 offense 3x2, Trips 7v7; 7v7 defense Cover 2/3 7v7. Default ghost = 2x1 (5v5/custom), 3x2 (7v7).
- movePlayer translates the player's own offense paths (route/option/motion); defense actions stay
  (zones are field-relative).
- Playback picks the last engine frame ≤ t (`engine/frames.ts frameAt`); no UI interpolation (NFR-ARC-03).
- Receiver tell: within `cutLoss × tellWindow` s of a sharp break (turn ≥ 30°, not smooth) desired speed
  drops to 0.5 × max; deceleration limit = 2 × acceleration limit.

## D-19 Engine contract details (phase 3)
- Agents return `AgentIntent` (extends the SRS `Intent`): optional state label, eyeTarget, throw, throwaway,
  focus (man target for the leverage factor), events. The world, not the agent, stamps events, releases
  the ball after `release` s, and decides sack/timeout.
- Perception: other players at `t − effectiveDelay`, ball/QB flags at `t − reaction` taken from the earlier
  snapshot (discrete state never leaks early). Leverage factor applies only to the man target while it
  moves laterally ≥ 1 yd/s toward the defender's leverage side.
- QB predicts its own receivers with the offense-only kinematic run (`previewOffense`) and defenders by
  linear extrapolation of their perceived velocity.
- Ball arrival uses the nearest receiver within catchRadius and nearest defender within contestRadius;
  `resolveArrival` wraps `resolveContest` (D-11), no RNG draw when nobody arrives.
- Noise: each stat × U[0.9, 1.1) from `forkRng(seed, 'noise:' + id)`; 0..1 stats clamped.
- Simulation continues 0.5 s after the outcome so the animation shows the ball arrive.
- Zone defenders apply QB-eye drift in phase 3; phase 5 gates it on anticipation > 0.

## D-20 Tuning after phase 3 (FR-TUN-03 benchmark)
- Context: with SRS defaults, Mesh vs Cover 1 completed 75–76 % (catches uncontested, capped by hands);
  `throwOpenThreshold` and `contestRadius` had no effect.
- Decision: `inaccuracyK` 0.05 → 0.34 (all other TuningParams at SRS values). Benchmark, all TB, noise
  on, 200 seeds: Trips Flood vs Cover 3 67 %, Mesh vs Cover 1 69 %, Smash vs Cover 2 61 %.
- Reason: the only lever that produces misses/contests on short throws without collapsing deep throws;
  0.40 drops Smash/C2 below 60 %. Re-check after phase 5 anticipation lands.
- Known limitation: Mesh scores ~69 % against every coverage (crossers beat trail man and zones alike).

## D-21 Phase 5 ordering
- Context: anticipation, option/motion and match rules all need `simulate.ts` and the defender agents.
- Decision: T5.1 (anticipation, owns simulate + man/zone agents) and T5.2 (pure `matchRules.ts`) run in
  parallel with editor/UI tasks; T5.3 (option/motion/delay) takes over simulate after T5.1; T5.4 then wires
  match rules into the agents and adds `simulateMany` + the Worker.
- Reason: keeps "one owner per file per moment" while still parallelising UI work.

## D-22 QB read model (post phase 6, user request 2026-10-26)
- Context: in all 9 seed matchups the QB threw to progression #1 (Y) at 1.27 s in 100 % of runs. Its
  openness check extrapolated defender velocity linearly and ignored defenders breaking on the ball, so
  every early read looked open (5–9 yd).
- Decision:
  - Openness = closing-speed separation: a defender reacts after `assumedDefenderReaction` and closes at
    `assumedDefenderSpeed` during the flight (`readModel.predictedSeparation`).
  - Each read has a window: auto = opens `readWindowLead` before the receiver's planned first break,
    lasts max(`readWindowMin`, readTime(iq)), sequential; manual windows per receiver override.
  - Read score 0..100 from openness, catch depth and INT lane risk; throw on the current read when
    sep ≥ `throwOpenThreshold` and score ≥ min score (per receiver, default `scoreThrow`).
  - After the last window: check-down scan (any receiver, best score ≥ scoreThrow − 15); pressure / clock:
    forced best valid read, else throwaway (as before).
  - Play-level optional `readPlan` { mode, windows?, minScore? }; modes progression (default, user choice),
    left→right, right→left, strong→weak, weak→strong, best.
  - Results expose `Frame.qb` (current read + scores), `SimMetrics.reads` (windows + decision) and
    `AggregateResult.readDistribution`.
- Reason: realistic timing and target variety; coaches can teach read timing (open window vs read window).
- Re-tune after D-22 (supersedes D-20 value): `inaccuracyK` 0.34 → 0.2 (closing-speed openness already
  produces tight windows). 200 seeds, TB, noise on: Flood/C3 61 %, Mesh/C1 71 %, Smash/C2 65 %.
  Mesh/C1 stays ≈ 71 % under every knob tried (inaccuracyK, catch/contest radius, thresholds): its drags
  are uncontested and capped by hands 0.75. Accepted as 1 pp over the 60–70 % band.
- Pressure anticipation: the QB treats a rusher as pressure when its time-to-QB (perceived distance /
  assumedDefenderSpeed, minus the QB's perception lag) ≤ release + 0.25 s; check-down earlier when it is
  < release + 0.5 s. Auto windows follow the drop rhythm (see readModel.buildWindows JSDoc).

## D-23 "QB tự ném" mode (user request 2026-10-26)
- Context: the user wants to play QB in the Matchup screen: press a key to throw to a receiver at that
  moment and see whether it was open.
- Decision:
  - Engine: optional `SimInput.qbControl: 'manual'` + `manualThrow { targetId, t }`. In manual mode the QB
    drops, reads (eyes, look-offs) and keeps computing read scores, but never decides on its own; sack and
    the 7 s timeout still apply. At the first tick with t ≥ manualThrow.t it throws to the target with the
    normal lead/error/release model (decision kind 'manual'). An invalid target (catch y ≤ 0 or beyond
    armRange) becomes a throwaway at that moment. Determinism: the run with a manual throw at t is
    identical to the run without one for every frame before t.
  - UI (UI-only state, nothing persisted): toggle "QB tự ném" on the Matchup page; keys Q W E R T = read
    order #1..#5 (badge on each receiver token), click a receiver token too; the sim re-runs with the
    throw at the current playhead and playback continues. Feedback: target, time, read score and
    predicted separation at the press, best alternative at that moment, outcome; "Thử lại" resets; a
    session tally (attempts, completions, % of throws to the best-scoring receiver).
- Reason: deterministic replay makes the press-time result exact and comparable with the auto QB.

## D-24 Catchable aim + eye line + re-tune (user report 2026-10-26)
- Context: a ball path went off the field while the QB's eye line pointed at the receiver: the QB led a
  receiver pinned on the sideline (aim on x = −15) and throw error pushed it out.
- Decision: the QB's aim is clamped `AIM_MARGIN` = 1 yd inside the sidelines and the end line (scoring
  and throws). The QB-eye overlay points at the ball's landing spot while the ball is in the air.
  `inaccuracyK` 0.2 → 0.3 (fewer automatic out-of-bounds misses raised completion). 200 seeds, TB,
  noise on: Flood/C3 69 %, Mesh/C1 67 %, Smash/C2 66 % — all three inside 60–70 %.

## D-25 Responsive layout down to phones (user request 2026-10-26; supersedes D-01 "tablet view-only" and the
Editor ≥ 1024 px limit of NFR-UX-01)
- Breakpoints (Tailwind): < 640 phone, 640–1023 tablet, ≥ 1024 desktop (current layouts unchanged).
- Rules for < 1024 px:
  - No horizontal page scroll at 360, 390, 430, 768 px (`documentElement.scrollWidth ≤ innerWidth`);
    wide content (tables, timelines) scrolls inside its own container.
  - The field comes first and gets ≥ 50 % of the viewport height; side panels move below it into a tab
    strip (one panel visible at a time). Bottom panels (warnings, timeline) collapse to a summary line.
  - Touch targets ≥ 40 px; toolbars become horizontal scrollable strips; top bars wrap into one row of
    primary actions + an overflow "⋯" menu.
  - App nav becomes a compact bar with a menu button; dialogs are full-screen sheets on phones.
  - Editing on phones is supported (pointer events already work with touch); keyboard-only shortcuts get
    on-screen buttons where they are the only way (e.g. finish route = "Xong").
- Verification: Playwright project `mobile` (iPhone 14 Pro Max, WebKit) and `tablet` (iPad Mini,
  WebKit) run `e2e/16-responsive.spec.ts` (no overflow on every screen + core flows by touch).

## D-26 Simple mode (user request 2026-10-27; plan in `docs/plan/SIMPLIFY.md`)
- Context: the app's purpose is drawing offense/defense plays, making a matchup, and seeing the open
  windows when installing. Stats editing and "run N times for %" are hidden for now.
- Decision: `Settings.ui.advanced` (optional boolean, default false) is the only switch; `useFeatures()`
  in `src/config/features.ts` derives the flags. Hidden features are not mounted; routes /roster and
  /suggest redirect to `/` in Simple mode. In Simple mode the sim input is forced: avg stats for everyone,
  noise off, seed 1, anticipation 0.5, QB auto, no lineups/overrides. Nothing is deleted; the data model is
  unchanged; existing unit tests render with advanced ON.
- Amendment (T12.1): "QB tự ném" (Q W E R T) and "Ném lúc open nhất" (`bestThrowTime`, picks the throw time
  with max separation at arrival) stay available in Simple mode; the manual override applies in both modes.

## D-27 Freestyle mode (user request 2026-10-31; design in `docs/superpowers/specs/2026-10-31-freestyle-mode-design.md`)
- Context: quick brainstorm / huddle mode. One screen, blank whiteboard, drag players in, draw offense routes and
  defense zones, run a trial. Planned by a product-owner and a business-analyst sub agent.
- Decision: route `/freestyle` (nav "Freestyle", both modes). `editorStore.play` stays the *active* side and a new
  `companion: Play | null` holds the passive side; history slice is `{play, companion}`; switching side is not
  recorded. Trial = transient `createMatchup({seed:1})` + `buildSimInput(..., simple=true)` + `useMatchupSim`
  (same result as a Simple-mode Matchup). Draft autosaved in `localStorage` key `flagbook.freestyle.v1`
  (validated with `PlaySchema`); no Dexie table, no schema bump. "Lưu thành play" writes 2 Plays + 1 Matchup
  (tag `freestyle`) through the repositories. Starts blank; a player tray places players; no time targets.
- Tasks: T13.1 store, T13.2 passive layer + Man on live offense, T13.2b tray, T13.3 page shell, T13.4 trial view,
  T13.5 persistence/save, T13.6 E2E.

## D-28 No completed/incomplete verdict in Simple mode (user request 2026-11-01)
- Context: Simple mode forces seed 1 and avg hands (0.6), so the catch roll made the verdict meaningless
  ("Không hoàn thành" on nearly every play).
- Decision: Simple Matchup and Freestyle no longer show `ResultSummary`; they show the open windows only. Advanced
  keeps `ResultPanel`. The engine is unchanged.

## D-29 Zones follow the defender (user request 2026-11-01)
- Context: presets had fixed field positions, so a free safety placed at y = 8 still covered y = 10..30.
- Decision: optional `ZoneAction.offset` shifts a preset and keeps its id, so its kind, colour and engine behaviour
  stay. Choosing a preset puts its drop point on the defender; dragging the defender moves the zone and drop point
  by the same delta (Editor and Freestyle). The drawn polygon is cut at the sidelines and LOS. Custom polygons
  translate directly. Dragging the drop point alone still moves only the drop point. No offset gives the old result,
  so saved plays and their simulations are unchanged until edited; no schema bump. Match-rule `zone` switches still
  use the standard preset spot.

## D-30 Field labels and ball marker (user request 2026-11-08)
- Context: the blank Freestyle field had no text, so the LOS, first-down line and rush line were unlabelled.
- Decision: `FieldSvg` gets an opt-in `labels` prop (on in `FieldStage` only; the mini-map and thumbnails stay
  clean). It draws pills on the left sideline (LOS, 1st down, Rush), yard numbers on the right sideline at each
  10 yd line (counted from the nearest goal line), and a football on the LOS under the tokens. Strings in
  `i18n/vi/field.ts`. Data and engine unchanged.

## D-31 Shallow half zones (user request 2026-11-08)
- Decision: new presets `shallow-half-L` / `shallow-half-R`: half the field wide (x −15..0 / 0..15), y 3..10, drop
  point (∓7.5, 7). Kind `hook` (shallow, not deep), mirrored by flip, accepted by the import schema. Existing
  plays are unchanged.

## D-32 Open windows stop at the throw (user request 2026-11-08)
- Decision: the "Khoảng open" panel clips each window at the `throw` event and totals, best window and summary use
  the clipped data. No throw (no event) keeps everything. Display only; `metrics.openWindows`, the engine and
  Suggest scoring are unchanged.

## D-33 Playback bar aligned with the open windows, speed in a menu (user request 2026-11-08)
- Context: the scrubber and the "Khoảng open" tracks had different widths, so the same time sat at different x.
- Decision: `Timeline` takes `gutter` (`normal` | `large`) and uses the same label/total column widths
  (`TRACK_GUTTER`, shared with `OpenWindows`), so one time = one x in both. The scrubber is drawn by us (track,
  progress, playhead with a handle); the native range input stays on top, transparent with a zero-width thumb, so
  clicks and keys map exactly to what is drawn. Speed buttons became a gear menu (`btn-speed-menu`, items
  `btn-speed-<s>`, role `menuitemradio`; closes on pick, Escape, outside click). Present now starts at the
  pre-snap time like Matchup so both share the same scale. Engine and data unchanged.

## D-34 Bigger playhead, marker tooltips (user request 2026-11-08)
- Decision: the playhead knob is 24 px (grows on hover/press) and the scrubber area is 40 px tall, so it is easy to
  grab. Event markers are 16 px wide hit targets, focusable, with an instant tooltip: event name, the player's label
  (the target for throw/catch) and the time. Touch: tap shows it. Texts in `i18n/vi/playback.ts`, marker labels built
  by `components/field/markers.ts`. Engine unchanged.

## D-35 QB tự ném: pick again without "Thử lại" (user request 2026-11-08)
- Decision: a throw no longer locks the mode. After a throw the user can pause or scrub the timeline, press a key or
  click another receiver, and the throw is replaced at the playhead time; the re-run keeps the playhead, so playing or
  dragging shows the change at once. Same target at the same time is ignored. The panel keeps the key legend and the
  "open nhất" buttons after a throw, with a hint. Each pick counts as an attempt in the tally. "Thử lại" still clears the
  throw and restarts. Matchup and Freestyle; engine unchanged.

## D-36 Space is always play/pause on Matchup and Freestyle (user request 2026-11-08)
- Context: after scrubbing or clicking a receiver, focus stayed on the scrubber or a button, so Space did not toggle
  playback (or activated that button).
- Decision: in every mode (not only QB tự ném) Space toggles play/pause whatever control has the focus (range,
  button, checkbox); its default action is prevented on keydown and keyup. Only text fields and selects keep Space.
  Matchup and the Freestyle trial.

## D-37 The ball starts on the LOS and is the animated one (user request 2026-11-08)
- Context: the static ball marker on the LOS (D-30) stayed there during playback next to the animated ball, and the
  animated ball only appeared at the QB.
- Decision: `FieldSvg` gets `ballMarker` (default on). Matchup, the Freestyle trial, Present and the route preview turn
  it off and draw the animated ball instead (`components/field/Ball.tsx`). `displayBallPos` (engine/frames) puts a held
  ball on the LOS until the snap and flies it to the QB over 0.25 s; thrown or loose it is the engine position. Drawing
  only: sim frames are unchanged. The Editor and the Freestyle board keep the static marker.

## D-38 QB tự ném shows no verdict (user request 2026-11-08)
- Decision: the QB mode panel no longer says whether the pick was the best receiver ("Bạn chọn đúng người tốt nhất" /
  "Tốt nhất lúc đó…"), no longer shows the outcome ("Kết quả: …") and no longer has the heading above the "open nhất"
  buttons (the group keeps its tooltip and aria-label). The panel still shows target, throw time, read score and
  separation. The tally keeps counting best picks internally.

## D-39 QB tự ném has no tally (user request 2026-11-08)
- Decision: the "Đã ném N lần · bắt được … · …/N ném đúng người tốt nhất" line and the counting behind it (`tally`,
  `record`) are removed. The panel shows only the current throw (target, time, read score, separation), the key legend,
  the "open nhất" buttons, Thử lại and Thoát.

## D-40 Area-match coverage, "Bunch Killer (Bangkok)" (user request 2026-11-08)
- Decision: `PlayerSlot.areaMatch?: { role: 'corner' | 'inside'; squeezeAfter?: number }` (default 0.5 s). Area-match
  defenders own vertical lanes, boundaries at the midpoint of neighbours' `start.x` (after flips), outer lanes to the
  sidelines (`src/domain/areaLanes.ts`). A corner takes the first released receiver into its lane (ties: nearer the
  sideline first); with nobody by `squeezeAfter` it takes the deepest vertical receiver in the next lane inside, else
  shifts its zone onto the inner boundary. An inside defender skips the first receiver into its corner's lane and takes
  the second; with none it plays its base zone, ignoring receivers the others claimed ("whoever is left"). Claims are
  sticky. Each defender infers teammates' claims from its own delayed Perception with the same rules: no
  communication, no opponent Play (NFR-ARC-06). Editor (user request 2026-11-08): area match is an option of the
  "Luật pattern match" section ("Kiểu": Luật tự đặt / Bunch Killer (Bangkok): Corner / Inside), not a separate
  control; choosing it hides (keeps) the custom rules. No press (user request 2026-11-08): until it has a man, an
  area defender holds its alignment spot and depth (zone agent `holdDepth`), mirrors threats sideways and only drops
  deeper for a receiver past it; it never comes up to the LOS. The slot's zone action is the base coverage; without one, a rectangle
  over its lane. `areaMatch` on a rusher / man / spy slot is ignored with a warning; it overrides `matchRules`.
- Spec: `docs/superpowers/specs/2026-11-08-bangkok-bunch-killer-design.md`.

## D-41 Touchdown result (user request 2026-11-08)
- Decision: `Outcome` `complete` gets `touchdown?: true` when the catch point is at or past the goal line
  (`landing.y ≥ goalLineY(field, ballSpot)`). The result panel shows "Touchdown" instead of "Hoàn thành", and the
  Simple-mode summary says the catch was in the end zone. Aggregates still count it as complete.

## D-42 Versioned sample content: Bunch Killer (Bangkok) (user request 2026-11-08)
- Decision: `Settings.seedVersion?: number` (missing = 1). `ensureSeeded` on a fresh DB writes settings with
  `seedVersion: 2`, the 6 sample plays and the v2 content. On a DB at version 1 it adds, once, each v2 record whose
  fixed id is missing — plays "Bunch Tight", "Zone: Bunch Killer (Bangkok) Rush", "Zone: Bunch Killer (Bangkok) No
  Rush Spy"; four matchups (both defenses vs Bunch Tight and vs Trips Flood, ball 5 yd from the goal line, a matchup
  only when both plays exist); Install "Red Zone – Bunch Killer (Bangkok)" — then sets version 2. Nothing is
  overwritten and nothing deleted later comes back. `createDefaultSettings()` does not carry `seedVersion` (so
  `normalizeSettings` can't mark an old DB as seeded). Content: `src/db/seed/bangkok.ts`.

## D-43 Freestyle: drag the LOS (user request 2026-11-08)
- Decision: with the Select tool and no armed tray chip, a transparent strip along the LOS (under the tokens) can be
  dragged up/down. The ball spot's yard line follows in whole yards (own 1 … opponent 1, `dragYardLine`); the stage
  shifts the view by the same yards (`FieldStage.anchorFieldOnBallMove`) so the field stays put and the LOS and the
  players follow the pointer. The spot is kept in localStorage (`flagbook.freestyle.ball.v1`, survives "Mới") and is
  used by Chạy thử, the live split and the warnings badge. Plays stay ball-relative, so a saved play does not store
  it. The hash (x) is not draggable.

## D-44 Bunch Killer Spy: R's zone reaches the back of the end zone (user request 2026-11-08)
- Decision: the seeded "Zone: Bunch Killer (Bangkok) No Rush Spy" play's R zone "MID" is x −6..7, y 1.5 .. 5 +
  endZoneDepth (15 in 5v5): from just past the LOS to the end line with the ball on the 5, as the design text says.
  It was y 1.5..10 (half way into the end zone). `SEED_VERSION = 3`: a database at v2 or below whose Spy play still
  has the v2 zone exactly gets only that one action replaced (name and other players kept); an edited zone or a
  deleted play is left alone.

## D-45 Select tool: box select, Ctrl+A, move the selection (user request 2026-11-08)
- Decision: with the Select tool, dragging on the empty field draws a dashed box (raw, unsnapped yards) and selects
  the active side's players whose spot is inside it, live while dragging; Shift adds to the selection. Ctrl+A / ⌘A
  selects every player of the side being edited and switches to the Select tool. Pressing a player that is already
  selected drags the whole selection: the grabbed player follows the (snapped) pointer and the others keep their
  spacing; routes, motion, options, zones and drop points move with their players (`movePlayers`); one drag = one
  undo step. A click without movement on one player of a group selects just that one. Freestyle edits one side at
  a time, so the box and Ctrl+A never pick the faded side. Same tool in the play editor and Freestyle.

## D-46 Area match: no squeeze while a receiver is breaking out to the corner (user report 2026-11-08)
- Problem: B, Z, C, X bunch vs CB1 / FS / SS / CB2. X ran vertical in SS's lane while C ran out toward CB2. At the
  squeeze time nobody was in CB2's lane yet, so CB2 squeezed onto X as soon as X was 3 yd deep; C crossed into
  CB2's lane 0.3 s later and SS took him as "second". The user expects CB2 on C: C is the first one coming to him.
- Decision: a corner past `squeezeAfter` does not squeeze while an unclaimed receiver in the adjacent inside lane
  is breaking toward the corner's lane: sideways speed toward the corner ≥ 1 yd/s and ≥ its downfield speed
  (`headsOut`). A vertical stem that drifts outward does not count. The corner holds (no inward zone shift) and
  takes that receiver as first-in when he arrives; if the receiver stops or turns, the squeeze goes ahead.

## D-47 Area match: no squeeze; a corner with nobody in his lane stays (user request 2026-11-08)
- Decision: the time-based squeeze is removed (supersedes the squeeze part of D-40 and D-46). A corner takes the
  first receiver into his lane, whenever that happens; until then he stays on his alignment spot: his zone reacts
  to nobody (it does not shade toward receivers near his lane), only to a ball in the air. Inside defenders are
  unchanged (second-out, else their zone). `AreaMatch.squeezeAfter`, the "Squeeze sau (s)" input and the
  `squeeze` claim reason are gone; an old export or saved play that still has `squeezeAfter` loads and the key is
  ignored (import drops it).

## D-48 Bunch Killer as custom pattern-match rules: one system (user request 2026-11-09)
- Decision: custom rules gain receiver "Bất kỳ" / "Người thứ 1/2", event "vào khu vực của" (tôi / a teammate) and
  reaction "Man người đó" (`manTrigger`). Areas are the D-40 alignment lanes of the "lane members" (slots with an
  area rule or named by one, not rush / man / spy). Every member evaluates all members' area rules on its own
  perception (order: nth 1, nth 2, any; lanes left → right), so it infers who teammates took. Area rules fire
  with no iq delay (as the old tracker); direction rules keep it. Base before a rule fires: never press; zone
  action → that zone ignoring taken receivers; no zone → stand on the spot, react only to the ball.
- The "Kiểu" select becomes "Mẫu": Bunch Killer Corner / Inside fill in the rule (Inside picks the neighbouring
  corner-rule holder, left first, else the neighbour toward the nearer sideline; a zone-less inside also gets its
  lane as a zone). The separate `areaMatch` mode, `areaMatch.ts`, `areaMatchDefender` and `areaClaim` are gone.
- Conversion (`areaMatchToRules`): corner → corner rule, its zone removed (it had no effect); inside → inside rule
  on its old outside corner, lane rectangle zone if it had none (ball centred for an outer lane); old custom rules
  on an area slot dropped; a note line added. Runs in the Dexie v3 upgrade (schemaVersion 2 on every record), in
  import of schemaVersion ≤ 1 files and in the Freestyle draft loader. A converted play gives the same frames as
  the old one (checked before the old path was removed).

## D-49 Quarter zone presets (user request 2026-11-09)
- Decision: four presets split the field width in quarters, like Cover 4: `quarter-out-L` (x −15..−7.5 at W 30),
  `quarter-mid-L` (−7.5..0), `quarter-mid-R` (0..7.5), `quarter-out-R` (7.5..15). They run from the LOS to y 30
  (the user chose "from the LOS to the back", for the Bangkok four-way split), drop point at the quarter centre,
  5 yd deep. They play the closest receiver (zone kind `curl`), flip L↔R, and scale with the field width.

## D-50 Ctrl+C / Ctrl+V copy and paste players (user request 2026-11-09)
- Decision: Ctrl+C (⌘C) copies the selected players to an in-app clipboard (not the OS clipboard; with nothing
  selected the normal copy happens and the old clipboard stays). Ctrl+V (⌘V) pastes them on the same side 1 yd to
  the right, then 2 yd on the next paste of the same copy, and so on; the pasted players are selected (Select
  tool) and it is one undo step. Copies get new slot and rule ids and the next default labels; the player limit
  stops extra copies. Ctrl+D keeps working as a one-step duplicate.
- Fix (2026-11-09): a copy (Ctrl+V or Ctrl+D) moves its routes AND its zone / drop point with it, on both sides
  (D-29). Before, only offense actions moved, so a pasted defender's zone stayed on the original.

## D-51 A defender's zone is his area; live lane zone (user request 2026-11-09)
- Context: after dragging FS a little, his quarter zone and the dashed lane lines no longer lined up. A zone moves
  the full drag with its defender (D-29), but a lane line sits halfway between two area-rule defenders, so it moves
  half. They only matched while every defender stood at his zone's centre. The Inside template's automatic zone (a
  frozen copy of the lane rectangle) drifted the same way.
- Decision (user: "Zone is his area"): for "vào khu vực của" rules, a lane member with a zone (preset or drawn)
  uses that zone outline as his area; a receiver behind the LOS counts as level with a zone that starts at the
  LOS. A member with no zone keeps his lane between the midlines. Dashed lines are drawn only where they bound
  such a lane. New zone value `'lane'` ("Làn của tôi (theo vạch đứt)"): the member's live lane rectangle, worked
  out from the lanes every time, dropped on the defender; the Inside template and the D-48 conversion now write it.
  Lanes are still computed from all members' spots (midpoints), for zone-less members, `'lane'` zones and the
  Inside template's teammate.
- Data: SCHEMA_VERSION 3, Dexie v4. Frozen lane rectangles (an axis-aligned 4-point rectangle 10 yd tall on a lane
  member) become `'lane'` on DB upgrade, import of older files and Freestyle draft load.
- Cost: a gap between two zones is nobody's area, and overlapping zones can both log the same receiver (claims
  still stop a double pick-up). A zone that starts deep is not entered by a shallow receiver.

## D-52 Backpedal at the snap (user request 2026-11-09)
- Context: a defender with pattern-match rules stood at his alignment depth until a rule fired. The user wanted a
  template to backpedal on his own at the snap, then read how receivers come in, with the rules still run top to
  bottom.
- Decision (user approved the playback): new event "bóng được snap" (`snap`, watches no receiver) and new reaction
  "Lùi" (`{ type: 'backpedal', yards }`). The checkbox "Lùi khi bóng snap" under "Mẫu" puts
  "Khi bóng snap thì Lùi 3 yd" on top of the rules; picking a Bunch Killer template keeps it, and the template
  select still shows the template. The defender goes straight back from where he stands at 0.8 × speed (the man
  cushion backpedal), still reading his rules; a rule that changes his coverage, or the ball, cuts it short. Once
  there, that depth is his new hold depth (base zone, or standing corner); a man defender goes back to his man.
- Rules: a snap rule fires after the usual iq delay, only while no other rule of that defender has fired, and only
  with a reaction that needs no receiver (Man on a receiver, Zone, Lùi). "Lùi" may also follow a receiver event.
- Data: no schema bump (new union members only); older app versions reject files that use them.
- Cost: the backpedal is straight back only, with no sideways mirroring while he drops. This may replace the
  "no press under x yards" option asked earlier; that one is not built.
- UI follow-up (user: "gộp lại 1 controller dễ sử dụng hơn"): the checkbox and the rule card are one control,
  "☑ Lùi khi bóng snap [3] yard". The snap backpedal rule has no card in the list (it always runs first), and the
  event select no longer offers "bóng được snap" (it still shows on an old snap rule with another reaction).

## D-53 Pick whoever is left: "chưa ai nhận" past a depth (user request 2026-11-09)
- Context: the coaching text says LB and S "pick whoever is left" when there is no second threat outside. On the
  user's quarter board both crossers went to the corners first, the two verticals (C, Z) had no rule to take them,
  and FS and SS both shadowed them in the middle at their alignment depth. A first idea ("only while nobody has
  gone out", "only in my own zone") would not have fired there: the corners already had their crossers, and both
  verticals started in FS's zone.
- Decision (user: "khi qua độ sâu", then approved the corrected design): new rule event "chưa ai nhận"
  (`unclaimed`). A receiver nobody took who is at least `minDepth` deep (default 5 yd) is a leftover; members still
  free with such a rule take leftovers nearest first, by distance from their alignment spot (then lane, then
  receiver id), one each, anywhere on the field. It runs in the area coordinator after the area rules, so a
  second-out pick on the same tick wins. The Inside template is now [Người thứ 2 · vào khu vực của corner → Man
  người đó] + [Bất kỳ · chưa ai nhận · sâu ≥ 5 → Man người đó]; the form hides the receiver and only offers
  "Man người đó" for it.
- Data: no migration. A saved inside with only the old rule shows as "Luật tự đặt" and keeps zoning; picking
  Inside again (or adding the rule) gives it the leftover rule. Template rule ids are now `<slot>-bk`,
  `<slot>-bk2`… (seed, old-data conversion), since a slot's rule ids must be distinct.
- Cost: a seam past 5 yd before the second one gets outside is taken first, and the late outside one is left to the
  corner. Picks are made once and kept, so two leftovers whose routes cross (C corner, Z post) make FS and SS cross
  too.

## D-54 "Đọc 2 người" template for LB/S (user request 2026-11-11)
- Context: coaching line "LB only focuses on the X and the C. If the X goes outside, [he] locks in on the C". The
  user then set every case (approved playback).
- Decision: new template "Đọc 2 người (LB/S)" = one rule with event `pairRead` ("đọc 2 người với"): người 1
  (`receiver`, a number or role ref), người 2 (`when.second`), the corner beside (`area` teammate, picked like the
  Inside teammate) and `minDepth` (default 5). Run in the area coordinator after the area rules, once per
  defender, first case that holds wins:
  1. người 1 in the corner's entry log first → LB takes người 2; 2. người 2 first → LB takes người 1;
  3. người 1 cuts inside (`in`/`under` on his perceived velocity) → LB takes người 2 and lets người 1 go to
     whoever's rules take him; 4. both at least 5 yd deep → LB takes the deeper, the corner (if free) the shallower,
     even outside the corner's area; 5. both stopped short of 5 yd → LB presses the one nearer his alignment spot.
  Before a read the LB zones (a zone-less LB gets the live lane zone, like Inside). "Press" is "Man người đó"
  (trail, no cushion); there is no jam at the line.
- Calls made for the user (marked as guesses in the playback, not corrected): cut inside = the existing in/under
  event; both short = both "dừng"; press target = the nearer one; the other one is left to the other rules.
- Cost: người 1 who aligns inside the corner's area is "out" at the snap (case 1), so case 3 needs him to start
  outside it. Reads are made once and kept.
