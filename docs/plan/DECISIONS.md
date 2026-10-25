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
