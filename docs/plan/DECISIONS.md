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
