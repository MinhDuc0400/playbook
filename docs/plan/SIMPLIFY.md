# Plan — Simplify Flagbook (Simple mode)

Status: **proposed, not started.** Requested 2026-10-27. Nothing is deleted; hidden features stay in the code
behind a flag so they can be switched back on.

## 1. Purpose (what the app is for)

Four things, in this order:

1. **Draw an offense play** (players, routes, motion, read order).
2. **Draw a defense play** (man / zone / rush, leverage, pattern-match rules).
3. **Make a matchup between two plays** and watch it.
4. **See the open windows** — for every receiver, *when* he is open — and use that when **installing**
   (teaching) the play: Install list → present mode.

Everything else is secondary and is hidden in "Simple mode" (the new default).

## 2. Decisions (defaults — say if you want a different one)

| # | Question | Default taken |
| --- | --- | --- |
| Q1 | "Chạy thử xem %" = the percentage tools. | Hide: **Chạy 50 lần**, **Benchmark**, **Suggest** (its simulation tier), and the % / outcome statistics. **Keep** the editor's **"Chạy thử"** (offense-only animation) because it is how you check route timing; it shows no percentages. |
| Q2 | "Chỉ số" = player stats. | Hide: Kém/TB/Hay per player, the stat sliders, lineups, the Roster screen, the Settings sections for presets/field/tuning, token level rings. Everyone plays as **TB**. |
| Q3 | Hide or delete? | **Hide** with one setting, **"Chế độ nâng cao"** (Settings, off by default). Turning it on brings every current feature back. No code is removed. |
| Q4 | Random result per run. | Keep the matchup deterministic (fixed seed, noise off). The seed/noise/ball-spot/anticipation controls move to Advanced. |
| Q5 | QB reads (windows, scores, "QB tự ném"). | Keep a **simple read order** (numbers 1-2-3 on the receivers, already in the editor). Move read windows/scores, read-mode, min-score and "QB tự ném" to Advanced. |

## 3. What the user sees in Simple mode

**Navigation:** Playbook · Install · Cài đặt. (Roster and Suggest disappear.)

**Playbook:** unchanged grid; filters collapsed behind one "Bộ lọc" button; card actions = Mở, Nhân bản,
Tạo matchup, Xóa. Matchup tab stays.

**Editor (offense):** tools Chọn · Đặt cầu thủ · Route · Motion · Option; right side = **Play** (name,
formation, tags, notes) and **Route** (template picker, depth, delay) tabs. Hidden: strength override,
QB drop style details, route-end option, read-plan section ("Cách đọc"), warnings stay as a small badge.
Keep: Flip, undo/redo, Chạy thử, Nhân bản, Export PNG.

**Editor (defense):** tools Chọn · Đặt · Man · Zone · Rush; right side = ghost formation, selected defender
(assignment, leverage, "Tự căn"), **pattern-match rules stay** (they are core to a defense play). Hidden:
alignTo, design-strength control.

**Matchup (the main screen):**
- Field with the animation, the playback bar, and the **Khoảng open** panel directly under the field:
  one row per receiver, a green bar for each time window in which he is open (separation ≥ 2.5 yd), the
  moving playhead, and a number on each token while playing (colour: red < 1 yd, amber, green).
- Controls kept: **Flip tấn công**, **Flip phòng thủ** (auto/none/flip), play/pause/speed/scrub, overlay
  menu (routes, zones, man lines, separation).
- Result line: who got the ball and when (one sentence), no statistics.
- Hidden: seed dice, noise, ball spot, anticipation slider, lineup selects, Random defense, per-player
  Kém/TB/Hay, advanced sliders, Chạy 50 lần, read timeline/score chart.
- Kept: **QB tự ném** (press Q W E R T while the play runs to throw at that moment) and **Ném lúc open
  nhất** (pick a receiver, the QB throws when he is most open). The manual throw overrides the forced
  QB auto; stats/seed/noise stay forced.

**Install / Present:** list of matchups with coach notes (as now). In Present, under the field, show the
same **Khoảng open** strip for the item on screen (large, readable on a projector), plus notes (N), loop (L),
← →. This is the "see the open windows when installing" goal.

**Settings:** Dữ liệu (export/import/backup), Giao diện (theme), **Chế độ nâng cao** toggle. Field/preset/
tuning/benchmark sections appear only in Advanced.

## 4. How (technical approach)

- `src/config/features.ts` (+ `useFeatures()` hook): one flag `advanced: boolean` persisted in
  `Settings.ui.advanced` (default `false`), plus derived flags (`showStats`, `showSimulationStats`,
  `showReadModel`, `showRoster`, `showSuggest`, `showMatchupTuning`). One place to change what "Simple" hides.
- Components read flags and **do not mount** hidden panels (no hidden-but-active listeners, e.g. Q W E R T).
- Routes `/roster` and `/suggest` stay registered; in Simple mode they redirect to `/`.
- Engine untouched. `buildSimInput` forces TB stats, `noise: false`, `qbControl: 'auto'`, anticipation 0.5
  when the flag is off, so a matchup never depends on hidden settings.
- New small component `OpenWindows` (reuses `metrics.openWindows` + `metrics.separation`; no new engine
  code) used by Matchup and Present. Advanced mode keeps the existing Read timeline.
- Settings schema: `ui.advanced?: boolean` (optional → no migration; `normalizeSettings` defaults it).
- Tests: existing unit tests render with advanced **on** via a test helper (they keep covering all
  features); new tests cover Simple mode. E2E: a fixture sets `advanced` in IndexedDB for specs 05, 08–12,
  14 and 15; new spec `17-simple-mode.spec.ts` follows the four core flows with advanced **off**.

## 5. Tasks

| ID | Title | Owns | Depends | Group |
| --- | --- | --- | --- | --- |
| T11.1 | Feature flags + Settings toggle + redirects | `src/config/*`, `src/domain/{types,defaults}.ts` (ui.advanced), `src/lib/io/schemas.ts`, `src/app/{Layout,router}.tsx`, `src/features/settings/SettingsPage.tsx`, tests | — | A |
| T11.2 | `OpenWindows` panel (matchup + present) | `src/features/matchup/OpenWindows.tsx`, `src/features/install/PresentPage.tsx` (panel only), tests | — | A |
| T11.3 | Simple Matchup screen | `src/features/matchup/{MatchupPage,ControlsPanel,PlayerPanel,ResultPanel,RandomDefense,RunManyPanel,QbModePanel,ReadTimeline}.tsx`, `src/features/matchup/buildSimInput.ts`, tests | T11.1, T11.2 | B |
| T11.4 | Simple Editor | `src/features/editor/offense/OffensePanel.tsx`, `src/features/editor/defense/DefensePanel.tsx`, `src/features/editor/{MetaPanel,TopBar,Toolbar}.tsx`, tests | T11.1 | B |
| T11.5 | Simple Playbook / Install | `src/features/playbook/*`, `src/features/install/{InstallDetailPage,InstallListPage}.tsx`, tests | T11.1 | B |
| T11.6 | E2E: advanced fixture + `17-simple-mode` + responsive re-check | `e2e/*` | T11.3–5 | C |

Each task ≤ 400 changed lines; T11.3 is the largest (split if needed). Order: A (parallel) → B (parallel) → C.

## 6. Acceptance

- Fresh install (advanced off): nav shows Playbook / Install / Cài đặt; `/roster` and `/suggest` redirect.
- Core flows work with no hidden control reachable: create offense → create defense → create matchup →
  play it → **Khoảng open** rows with correct windows (equal to `metrics.openWindows`) → add to Install →
  Present shows the same strip.
- Matchup results in Simple mode equal the Advanced result with TB stats, seed 1, noise off.
- Toggling **Chế độ nâng cao** restores every current feature; no data is lost either way.
- `pnpm typecheck && pnpm lint && pnpm test && pnpm test:e2e` green (incl. iPhone/iPad overflow checks).

## 7. Risks

- Hidden defaults silently affecting results → mitigated by forcing the sim inputs in `buildSimInput`.
- Users with existing matchups that have overrides/lineups: they keep their data; Simple mode ignores them
  (the matchup shows a small "Đang dùng chỉ số tuỳ chỉnh — bật Chế độ nâng cao" note).
- "Simple" screens still show 4–5 receivers × several windows on a phone: the strip scrolls inside its own
  container and uses a compact layout (D-25).
