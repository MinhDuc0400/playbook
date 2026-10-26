# Flagbook — Plan (phases 0–6)

Source of truth: `docs/SRS.md`. Decisions: `DECISIONS.md`. Live status: `STATUS.md`.
Phase 7 (P2 items) is out of scope.

Conventions for every task:
- Acceptance always includes `pnpm typecheck && pnpm lint && pnpm test -- <task test paths>`.
- "C<N>" = lead-written contracts for phase N (types, signatures, stubs, test skeletons), committed as
  `chore(contracts): phase <N>` before dispatch.
- Parallel group = tasks that run at the same time (max 3), disjoint files, no mutual dependency.
- File ownership is per phase (D-05). "takes over" marks a file owned in an earlier phase.
- Size target ≤ ~400 changed lines per task.

---

## Phase 0 — Foundation

Goal: project skeleton, domain types, field drawing, Dexie schema + repositories, seed data, app shell.

Exit criteria: FR-FLD-01..04, FR-DAT-01..05, NFR-ARC-01..05 (lint rule enforces ARC-01), T-DOM-07,
T-DOM-08, §14.3 CRUD/tag-query/migration tests, `pnpm build` passes, app boots with seeded data.

C0 (lead): `package.json`, Vite/TS/ESLint/Prettier/Tailwind/Vitest/Playwright configs, `src/main.tsx`,
`src/app/router.tsx` (placeholder pages), `src/domain/types.ts` (all §5/§8.1 types + TuningParams etc.),
`src/domain/field.ts` constants, `src/db/schema.ts` (FlagDB v1 + v2), `src/i18n/vi.ts`, stubs below.

| ID | Title | SRS refs | Owned files | Depends | Group | Acceptance |
| --- | --- | --- | --- | --- | --- | --- |
| T0.1 | Implement geometry and field helpers | §4.1–4.3, FR-FLD-01 data, §8.4 helpers | `src/domain/geometry.ts`, `src/domain/field.ts` (functions), `src/domain/__tests__/geometry.test.ts`, `src/domain/__tests__/field.test.ts` | C0 | A | geometry: length, interpolation, turn angle, polygon contains, clamp; field: sideline bounds by ballSpot, yard-line ↔ y, no-run zone check |
| T0.2 | Implement route tree templates | FR-OFF-03, §6.2 | `src/domain/routeTree.ts`, `src/domain/__tests__/routeTree.test.ts` | C0 | A | 15 templates, inside/outside orientation, depth scaling; T-DOM-06 (orientation half) |
| T0.3 | Implement presets, defaults and resolveStats | §7.1, §7.2, §11.2, §8.7 table type | `src/domain/presets.ts`, `src/domain/defaults.ts`, `src/domain/stats.ts`, `src/domain/__tests__/stats.test.ts`, `src/domain/__tests__/defaults.test.ts` | C0 | A | T-DOM-08; defaults equal SRS tables |
| T0.4 | Build viewport math and FieldSvg | FR-FLD-01..04, NFR-ARC-05 | `src/components/field/viewport.ts`, `src/components/field/FieldSvg.tsx`, `src/components/field/useZoomPan.ts`, `src/components/field/__tests__/*` | T0.1 | B | T-DOM-07; render test: sidelines, 5-yd lines, LOS, rush line, line-to-gain, end zone, no-run badge |
| T0.5 | Implement repositories, migrations, cascade | FR-DAT-01..04, §5.7, §14.3 | `src/db/repos/*.ts`, `src/db/migrations.ts`, `src/db/hooks.ts`, `src/db/errors.ts`, `src/db/__tests__/*` | C0 | B | CRUD each table; tag multiEntry query; v1→v2 migration keeps data; cascade delete (FR-DAT-02); missing-play bundle (FR-DAT-03); transactions |
| T0.6 | Seed default settings and sample plays | FR-DAT-05, D-16 | `src/db/seed/samplePlays.ts`, `src/db/seed/seed.ts`, `src/db/__tests__/seed.test.ts` | T0.2, T0.3, T0.5 | C | first open seeds Settings + 3 offense + 3 defense 5v5; idempotent |
| T0.7 | Build app shell, theme, error boundary, autosave hook | NFR-REL-01/02/04, NFR-UX-02/04, FR-IO-04, FR-DAT-04 | `src/app/Layout.tsx`, `src/app/ErrorBoundary.tsx`, `src/app/bootstrap.ts`, `src/app/theme.ts`, `src/app/DbErrorBanner.tsx`, `src/lib/useAutoSave.ts`, `src/components/ui/*`, `src/i18n/vi/common.ts`, `src/app/__tests__/*`, `src/lib/__tests__/useAutoSave.test.ts` | T0.5 | C | debounce 800 ms + status; flush on visibilitychange/pagehide; boundary isolates a throwing page; persist() called once |

## Phase 1 — Editor offense

Goal: draw, edit, flip and preview an offense play, auto-saved.

Exit criteria: FR-ED-01..07, FR-OFF-01..06, FR-FLP-01..02; T-DOM-01, T-DOM-04, T-DOM-05, T-DOM-06.

C1 (lead): stubs for `domain/flip.ts`, `domain/numbering.ts`, `domain/formations.ts`, `domain/validate.ts`,
`engine/movement.ts`, `engine/routeFollower.ts`, `engine/preview.ts`, `store/editorStore.ts` interface,
`features/editor/ops.ts` signatures, `features/editor/tools/types.ts` + `tools/index.ts`, component prop
types for Timeline / PlayerToken / RoutePath, null-rendering stubs for EditorCanvas, OffensePanel,
DefensePanel, GhostLayer.

| ID | Title | SRS refs | Owned files | Depends | Group | Acceptance |
| --- | --- | --- | --- | --- | --- | --- |
| T1.1 | Implement flipPlay | FR-FLP-01, §6.4 | `src/domain/flip.ts`, `src/domain/__tests__/flip.test.ts` | C1 | A | T-DOM-01 (fast-check), T-DOM-06 flip half, zone L↔R |
| T1.2 | Implement strength, numbering, ReceiverRef binding | FR-OFF-05, §8.2.2–3, D-09 | `src/domain/numbering.ts`, `src/domain/__tests__/numbering.test.ts` | C1 | A | T-DOM-04, T-DOM-05 |
| T1.3 | Implement movement model, route follower, offense preview | §8.4, §8.5 receiver path, FR-OFF-06, D-13 | `src/engine/movement.ts`, `src/engine/routeFollower.ts`, `src/engine/preview.ts`, `src/engine/__tests__/movement.test.ts`, `src/engine/__tests__/preview.test.ts` | C1 | A | accel limit, max speed, cut loss formula, sideline clamp, endBehavior stop/continue, tell slowdown |
| T1.4 | Implement formations and play validation | FR-ED-01 data, FR-ED-07, §4.2 | `src/domain/formations.ts`, `src/domain/validate.ts`, `src/domain/__tests__/validate.test.ts`, `src/domain/__tests__/formations.test.ts` | T1.2 | B | every FR-ED-07 warning has a test |
| T1.5 | Implement editor ops and store with undo | FR-ED-02/03/04, FR-FLP-02, D-14 | `src/features/editor/ops.ts`, `src/store/editorStore.ts`, `src/features/editor/__tests__/ops.test.ts`, `src/store/__tests__/editorStore.test.ts` | T1.1 | B | ≥ 100 undo steps; max players per format; default labels; flip undoable |
| T1.6 | Build Timeline and playback hook | FR-MU-03/04 (generic), FR-OFF-06 | `src/components/field/Timeline.tsx`, `src/components/field/usePlayback.ts`, `src/components/field/__tests__/Timeline.test.tsx` | C1 | B | play/pause, scrub, speeds 0.25–2, event markers, prev/next event |
| T1.7 | Build PlayerToken and RoutePath | §12.2 | `src/components/field/PlayerToken.tsx`, `src/components/field/RoutePath.tsx`, `src/components/field/paths.ts`, `src/components/field/__tests__/paths.test.ts`, `src/components/field/__tests__/PlayerToken.test.tsx` | C1 | C | circle vs triangle, label, ring colours; sharp/smooth path d, arrowhead, bold primary, dashed motion |
| T1.8 | Build editor canvas and select/place/route tools | FR-ED-02/03, FR-OFF-01/02 | `src/features/editor/EditorCanvas.tsx`, `src/features/editor/Toolbar.tsx`, `src/i18n/vi/tools.ts`, `src/features/editor/snap.ts`, `src/features/editor/tools/selectTool.ts`, `src/features/editor/tools/placeTool.ts`, `src/features/editor/tools/routeTool.ts`, `src/features/editor/__tests__/snap.test.ts`, `src/features/editor/__tests__/tools.test.ts` | T1.5, T1.7 | D | snap 0.5/Alt; Enter/dblclick/Esc/Shift-45°; drag point, insert, delete, sharp/smooth |
| T1.9 | Build editor page, new-play dialog, metadata, warnings | FR-ED-01/05/06/07, FR-DAT-04 | `src/features/editor/EditorPage.tsx`, `src/features/editor/NewPlayDialog.tsx`, `src/features/editor/TopBar.tsx`, `src/features/editor/MetaPanel.tsx`, `src/features/editor/WarningsPanel.tsx`, `src/features/editor/useEditorShortcuts.ts`, `src/i18n/vi/editor.ts`, `src/features/editor/__tests__/EditorPage.test.tsx` | T1.4, T1.5 | D | create blank/from formation; tag autocomplete; autosave status; duplicate; F flips; Ctrl+Z |
| T1.10 | Build offense panel and Chạy thử | FR-OFF-03/04/05/06 | `src/features/editor/offense/OffensePanel.tsx`, `src/features/editor/offense/PreviewOverlay.tsx`, `src/i18n/vi/offense.ts`, `src/features/editor/offense/__tests__/*` | T1.3, T1.5, T1.6 | D | route tree apply; QB drop/style; progression badges; strength override; preview plays frames |

## Phase 2 — Editor defense

Goal: draw a defense against a ghost offense: man / zone / rush, leverage, auto-align, alignTo.

Exit criteria: FR-DEF-01..06; validate warnings for defense (FR-ED-07 rows) pass.

C2 (lead): `domain/zones.ts` stub, `features/editor/defense/ops.ts` + `align.ts` signatures, register tool ids.

| ID | Title | SRS refs | Owned files | Depends | Group | Acceptance |
| --- | --- | --- | --- | --- | --- | --- |
| T2.1 | Implement zone presets, defense ops, auto-align | FR-DEF-02..06, §5.3 zones | `src/domain/zones.ts`, `src/features/editor/defense/ops.ts`, `src/features/editor/defense/align.ts`, tests in `src/domain/__tests__/zones.test.ts`, `src/features/editor/defense/__tests__/*` | C2 | A | every preset inside field; man stores ReceiverRef; maxRushers; rush path to QB; auto-align by leverage/cushion |
| T2.2 | Build ghost offense layer and man tool | FR-DEF-01/02 | `src/features/editor/defense/GhostLayer.tsx`, `src/features/editor/tools/manTool.ts`, `src/features/editor/defense/__tests__/manTool.test.ts` | T2.1 | B | ghost formation selectable; click defender → ghost receiver stores strong/weak #n |
| T2.3 | Build zone/rush tools and assignment rendering | FR-DEF-03/04, §12.2 | `src/components/field/ZoneShape.tsx`, `src/features/editor/defense/AssignmentLayer.tsx`, `src/features/editor/tools/zoneTool.ts`, `src/features/editor/tools/rushTool.ts`, tests | T2.1 | B | zone fill per type; polygon draw; drag drop point; rusher hand + arrow |
| T2.4 | Build defense panel | FR-DEF-02/04/05/06 | `src/features/editor/defense/DefensePanel.tsx`, `src/i18n/vi/defense.ts`, tests | T2.1 | B | leverage, technique, cushion, auto-align, alignTo, ghost picker, zone preset picker |

## Phase 3 — Engine + Matchup

Goal: deterministic, anti-lookahead pass-play simulation and the Matchup screen.

Rule: engine tasks T3.1–T3.8 (unit tests T-ENG-01/02/05/06/08/10, resolveContest 100k) pass before any
Matchup UI task (T3.9+) starts. After T3.8 run the tuning benchmark and set `TuningParams` defaults so the
D-16 pairings land at 60–70 % complete.

Exit criteria: FR-ENG-01..07 (+ FR-ENG-10 per D-11), FR-MU-01..09, FR-FLP-03..04, FR-ATH-01..02,
T-DOM-02, T-DOM-03, T-ENG-01, 02, 05, 06, 08, 10, 11; resolveContest test.

C3 (lead): `src/engine/types.ts` (AgentState, Intent, Perception, Agent, Assignment), stubs for every
engine file, test skeletons naming T-ENG ids.

| ID | Title | SRS refs | Owned files | Depends | Group | Acceptance |
| --- | --- | --- | --- | --- | --- | --- |
| T3.1 | Implement RNG, ball flight, catch resolution | §8.8, FR-ENG-06/10 | `src/engine/rng.ts`, `src/engine/ball.ts`, `src/engine/outcome.ts`, tests | C3 | A | resolveContest 100k ±1 pp; seeded determinism; throw error σ; flight time |
| T3.2 | Implement world history and perception | §8.3, FR-ENG-03 | `src/engine/world.ts`, `src/engine/perception.ts`, tests | C3 | A | interpolation at t − reaction; leverage focus factor; no future data |
| T3.3 | Implement matchup prep: flips, binding, stats noise | §8.2, FR-FLP-03/04, FR-ENG-02 | `src/domain/matchupFlip.ts`, `src/engine/prepare.ts`, tests | C3 | A | T-DOM-02, T-DOM-03, T-ENG-10 (unit level) |
| T3.4 | Implement receiver and rusher agents | §8.5 receiver, §8.6 rush | `src/engine/agents/receiver.ts`, `src/engine/agents/rusher.ts`, tests | T3.2 | B | path follow, tell, endBehavior, ball adjust; rusher path then chase seen QB |
| T3.5 | Implement man and zone defenders | §8.6 man/zone, FR-ENG-05 | `src/engine/agents/manDefender.ts`, `src/engine/agents/zoneDefender.ts`, `src/engine/agents/common.ts`, tests | T3.2 | B | leverage offset, trail/cushion, zone drop, threat pick, buffer, ball break |
| T3.6 | Implement QB agent | §8.5 QB, D-15 | `src/engine/agents/qb.ts`, tests | T3.1, T3.2 | B | drop, readTime, open threshold, pressure, clock, look-off, no throws to y ≤ 0 |
| T3.7 | Implement simulate loop and metrics | §8.1, FR-ENG-01/07 | `src/engine/simulate.ts`, `src/engine/metrics.ts`, `src/engine/__tests__/simulate.test.ts`, `src/engine/__tests__/perf.test.ts`, `src/engine/__bench__/simulate.bench.ts` | T3.3–T3.6 | C | T-ENG-01, 02, 05, 06, 08, 10, 11 |
| T3.8 | Implement tuning benchmark runner | FR-TUN-03 (core), D-16 | `src/engine/benchmark.ts`, `scripts/benchmark.ts`, `src/engine/__tests__/benchmark.test.ts` | T3.7 | D | prints % complete per seed pairing |
| T3.9 | Build matchup sim hook and store | §7.2, §9 intro, FR-MU-02 | `src/store/matchupStore.ts`, `src/features/matchup/buildSimInput.ts`, `src/features/matchup/useMatchupSim.ts`, tests | T3.7 | E | builds SimInput from matchup + DbSnapshot; rerun keeps playhead |
| T3.10 | Build matchup page, create dialog, controls | FR-MU-01/02/03/04/08, FR-DAT-03 | `src/features/matchup/MatchupPage.tsx`, `src/features/matchup/NewMatchupDialog.tsx`, `src/features/matchup/ControlsPanel.tsx`, `src/features/matchup/useMatchupShortcuts.ts`, `src/i18n/vi/matchup.ts`, tests | T3.9 | F | same-format only; flip/defenseFlip/ballSpot/seed/noise; Space, ←/→, [ ]; error state |
| T3.11 | Build matchup field, overlays, player panel | FR-MU-05/06/09, FR-ATH-01/02 | `src/features/matchup/MatchupField.tsx`, `src/features/matchup/overlays.tsx`, `src/features/matchup/PlayerPanel.tsx`, tests | T3.9 | F | overlays toggle; separation colours; ring colours; 1/2/3 keys write overrides |
| T3.12 | Build result panel | FR-MU-07 | `src/features/matchup/ResultPanel.tsx`, tests | T3.9 | F | outcome, target, yards, TTT, separation at throw, open-window bars |

## Phase 4 — Playbook + Install + import/export

Goal: browse/filter plays and matchups, build installs and present them, backup JSON.

Exit criteria: FR-PB-01..04, FR-IN-01..04, FR-IO-01..04; §14.3 import tests; E2E 1–7 on chromium + webkit;
NFR-PERF-04 filter < 100 ms on 500 plays.

**MVP gate after phase 4**: §14.5 item by item (every P0 FR done with a test; T-DOM-01..08,
T-ENG-01/02/05/06/08/10; 7 E2E on Chrome + Safari(webkit); benchmark 60–70 %; 9 seed matchups look sane).

| ID | Title | SRS refs | Owned files | Depends | Group | Acceptance |
| --- | --- | --- | --- | --- | --- | --- |
| T4.1 | Build thumbnails and playbook grid with filters | FR-PB-01/02, NFR-PERF-04 | `src/components/field/PlayThumbnail.tsx`, `src/features/playbook/PlaybookPage.tsx`, `src/features/playbook/filterPlays.ts`, `src/i18n/vi/playbook.ts`, tests | P3 | A | filter side/format/formation/tag, search, sort; 500 plays < 100 ms |
| T4.2 | Build play actions, delete cascade dialog, matchup list | FR-PB-03/04, FR-DAT-02 | `src/features/playbook/PlayCard.tsx`, `src/features/playbook/DeletePlayDialog.tsx`, `src/features/playbook/MatchupList.tsx`, tests | T4.1 contracts | A | open/duplicate/delete/create matchup; affected list; double thumbnails; filter |
| T4.3 | Build install list and detail | FR-IN-01/02/03 | `src/features/install/InstallListPage.tsx`, `src/features/install/InstallDetailPage.tsx`, `src/features/install/MatchupPicker.tsx`, `src/features/install/AddToInstallButton.tsx`, `src/features/install/NoteText.tsx`, `src/i18n/vi/install.ts`, tests | P3 | A | create; add via picker; reorder by drag + keyboard; remove; multiline/bullet notes |
| T4.4 | Build present mode | FR-IN-04 | `src/features/install/PresentPage.tsx`, tests | T4.3 | B | fullscreen, autoplay, ←/→, N, L, Space |
| T4.5 | Implement JSON export/import and data settings | FR-IO-01/02/03/04 | `src/lib/io/*.ts`, `src/features/settings/SettingsPage.tsx`, `src/features/settings/DataSection.tsx`, `src/i18n/vi/settings.ts`, tests | P3 | B | zod reject writes nothing; migrate old version; merge newer/copy; replace with confirm; report counts |
| T4.6 | Write E2E scenarios 1–7 | §14.4 | `e2e/*.spec.ts`, `e2e/fixtures.ts` | T4.1–T4.5 | C | 7 specs pass on chromium + webkit |

## Phase 5 — Engine advanced

Goal: anticipation, route prior, match rules, option routes, motion, Worker; advanced matchup/editor UI;
tuning screen.

Exit criteria: FR-ENG-08/09/11, FR-MU-10..14, FR-OFF-07..09, FR-DEF-07, FR-TUN-01..03; T-ENG-03, 04, 07, 09;
NFR-PERF-03. Re-run benchmark; DoD pairings still 60–70 %.

| ID | Title | SRS refs | Owned files | Depends | Group | Acceptance |
| --- | --- | --- | --- | --- | --- | --- |
| T5.1 | Implement anticipation: route prior, tells, QB eyes, oracle | §8.7, FR-ENG-08 | `src/engine/anticipation.ts`, takes over `src/engine/agents/manDefender.ts`, `zoneDefender.ts`, `common.ts`, `src/engine/simulate.ts`, tests | P4 | A | T-ENG-03, T-ENG-07, T-ENG-02 still green |
| T5.2 | Implement pattern-match rules | §5.4, §8.6 rules, FR-ENG-09 | `src/engine/matchRules.ts`, tests | P4 | A | T-ENG-09; events per table; iq delay; carry/passOff |
| T5.3 | Implement option routes, motion, route delay in engine | FR-ENG-09, §8.2.5, §8.5 option | takes over `src/engine/agents/receiver.ts`, `src/engine/prepare.ts`, `src/engine/routeFollower.ts`, `src/engine/preview.ts`, `src/engine/simulate.ts` (after T5.1), tests | T5.1 | B | T-ENG-04; motion t < 0; renumber at snap; delay |
| T5.4 | Integrate rules into sim; add simulateMany and Worker | FR-ENG-09/11, NFR-PERF-03 | takes over `src/engine/simulate.ts`, `agents/{manDefender,zoneDefender}.ts`, `src/engine/aggregate.ts`, `src/workers/sim.worker.ts`, `src/workers/simClient.ts`, tests | T5.1–T5.3 | B | aggregate stats; 50 runs < 1.5 s; cancel |
| T5.5 | Build advanced matchup UI | FR-MU-10..14 | takes over `src/features/matchup/ControlsPanel.tsx`, `src/features/matchup/overlays.tsx`, new `src/features/matchup/RunManyPanel.tsx`, tests | T5.4 | C | slider marks + Oracle label; perception ghost; QB eye line; run 50; edit play round-trip |
| T5.6 | Build motion, option route, route delay editing | FR-OFF-07/08/09 | `src/features/editor/tools/motionTool.ts`, `src/features/editor/tools/optionTool.ts`, takes over `src/features/editor/offense/OffensePanel.tsx`, tests | P4 | C | dashed motion + duration; stem + 2 branches M/Z; delay input |
| T5.7 | Build match-rule form | FR-DEF-07 | `src/features/editor/defense/MatchRulesForm.tsx`, takes over `src/features/editor/defense/DefensePanel.tsx`, tests | P4 | C | add/edit/delete rules; drag + keyboard reorder sets priority |
| T5.8 | Build tuning screen and benchmark UI | FR-TUN-01/02/03 | `src/features/settings/TuningSection.tsx`, `src/features/settings/PresetsSection.tsx`, `src/features/settings/FieldSection.tsx`, `src/features/settings/BenchmarkSection.tsx`, takes over `SettingsPage.tsx`, tests | T5.4 | D | sliders + reset; preset/field edit persists; benchmark table |

## Phase 6 — Suggest + Roster

Goal: suggestions, random defense, roster/lineups, advanced stat sliders, backup banner, selective and
PNG/PDF export.

Exit criteria: FR-SG-01..04, FR-SG-06, FR-RD-01..03, FR-ATH-03..06, FR-IO-05..07 (+ FR-ED-09, FR-PB-05/06
which have no phase in §15); full verification incl. NFR-PERF-01..04.

| ID | Title | SRS refs | Owned files | Depends | Group | Acceptance |
| --- | --- | --- | --- | --- | --- | --- |
| T6.1 | Implement suggest scoring and cache | §10.3, FR-SG-01/03/06 | `src/suggest/*.ts`, tests | P5 | A | tag tier; simScore formula; reason strings data; hash cache |
| T6.2 | Build roster and lineup screens | FR-ATH-04/05 | `src/features/roster/*`, `src/i18n/vi/roster.ts`, tests | P5 | A | Athlete CRUD; lineup by side+format, slot → athlete/preset |
| T6.3 | Build backup banner, selective export, PNG/PDF export | FR-IO-05/06/07, FR-ED-09, FR-PB-05/06 | `src/lib/export/*.ts`, `src/app/BackupBanner.tsx`, tests | P5 | A | banner > 14 days; install export with deps; PNG of play/frame; PDF per item |
| T6.4 | Build suggest page | FR-SG-02/03/04 | `src/features/suggest/*`, `src/i18n/vi/suggest.ts`, tests | T6.1 | B | worker progress + cancel; top 5 with reasons; create matchup |
| T6.5 | Build random defense mode | FR-RD-01/02/03 | `src/features/matchup/RandomDefense.tsx`, takes over matchup page/overlays as needed, tests | T6.1 | B | hidden name/overlays; guess list; reveal + right/wrong |
| T6.6 | Build lineup picker and advanced stat sliders | FR-ATH-03/06 | takes over `src/features/matchup/PlayerPanel.tsx`, `ControlsPanel.tsx`, tests | T6.2 | C | sliders + "Về preset"; lineup per side |
| T6.7 | Extend E2E and perf checks | §14.4, NFR-PERF-01..04 | `e2e/*` | all | D | full suite + perf budgets |

## Phase 6b — QB read model (D-22, user request)

Goal: realistic QB openness + customisable reads (order, windows, scores) and their visualisation.

Exit criteria: seed matchups no longer 100 % first read; target pairs still 60–70 % complete; read plan
editable; read timeline + scores on the Matchup screen; all tests + E2E green.

| ID | Title | Owned files | Depends | Group |
| --- | --- | --- | --- | --- |
| T7.1 | Implement read model (order, windows, closing openness, score) | `src/engine/readModel.ts`, tests | C6b | A |
| T7.2 | Rework QB agent on the read model; wire frames/metrics/aggregate | takes over `src/engine/agents/qb.ts`, `simulate.ts`, `aggregate.ts`, tests | T7.1 | B |
| T7.3 | Build read-plan editor in the QB panel | takes over `src/features/editor/offense/OffensePanel.tsx`, `src/features/editor/ops.ts`, `src/i18n/vi/offense.ts`, tests | C6b | A |
| T7.4 | Build read timeline, score chart, read distribution | new `src/features/matchup/ReadTimeline.tsx`, takes over `ResultPanel.tsx`, `RunManyPanel.tsx`, `src/i18n/vi/result.ts`, tests | T7.2 | C |
