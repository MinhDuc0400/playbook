# Status

Live tracker. Status: todo / in progress / review / done.

| Task | Title | Status | Commit |
| --- | --- | --- | --- |
| C0 | Contracts phase 0 | done | 60a4c7c |
| T0.1 | Implement geometry and field helpers | done | 90c78ab |
| T0.2 | Implement route tree templates | done | a2faf9b |
| T0.3 | Implement presets, defaults and resolveStats | done | 9db9991 |
| T0.4 | Build viewport math and FieldSvg | done | e8cd265 |
| T0.5 | Implement repositories, migrations, cascade | done | 7da0114 |
| T0.6 | Seed default settings and sample plays | done | f8fcff1 |
| T0.7 | Build app shell, theme, error boundary, autosave hook | done | 7e52444 |
| C1 | Contracts phase 1 | done | cc5c57b |
| T1.1 | Implement flipPlay | done | 65a687c |
| T1.2 | Implement strength, numbering, ReceiverRef binding | done | e444a72 |
| T1.3 | Implement movement model, route follower, offense preview | done | db4023a |
| T1.4 | Implement formations and play validation | done | 3dca0bd |
| T1.5 | Implement editor ops and store with undo | done | 7252e5e |
| T1.6 | Build Timeline and playback hook | done | 58418fc |
| T1.7 | Build PlayerToken and RoutePath | done | 94b2b22 |
| T1.8 | Build editor canvas and select/place/route tools | done | 4a760c4 |
| T1.9 | Build editor page, new-play dialog, metadata, warnings | done | f03771b |
| T1.10 | Build offense panel and Chạy thử | done | f2058aa |
| C2 | Contracts phase 2 | done | 8b6bf13 |
| T2.1 | Implement zone presets, defense ops, auto-align | done | 85ec88f |
| T2.2 | Build ghost offense layer and man tool | done | f466093 |
| T2.3 | Build zone/rush tools and assignment rendering | done | 2c182aa |
| T2.4 | Build defense panel | done | aa3ff43 |
| C3 | Contracts phase 3 | done | 14ffecf |
| T3.1 | Implement RNG, ball flight, catch resolution | done | 1fb086a |
| T3.2 | Implement world history and perception | done | 7d1c6a6 |
| T3.3 | Implement matchup prep: flips, binding, stats noise | done | 3c30c21 |
| T3.4 | Implement receiver and rusher agents | done | f568818 |
| T3.5 | Implement man and zone defenders | done | 7f9bc44 |
| T3.6 | Implement QB agent | done | 641a248 |
| T3.7 | Implement simulate loop and metrics | done | b6cb683 |
| T3.8 | Implement tuning benchmark runner | done | 7720d69 |
| T3.9 | Build matchup sim hook and store | done | 1f8d3ea |
| T3.10 | Build matchup page, create dialog, controls | done | 40b9f4b |
| T3.11 | Build matchup field, overlays, player panel | done | 2a379e0 |
| T3.12 | Build result panel | done | 1a50157 |
| C4 | Contracts phase 4 | todo | |
| T4.1 | Build thumbnails and playbook grid with filters | done | ddf1f9d |
| T4.2 | Build play actions, delete cascade dialog, matchup list | done | 5a77b4b |
| T4.3 | Build install list and detail | done | 7e6d73e |
| T4.4 | Build present mode | done | a7bed4b |
| T4.5 | Implement JSON export/import and data settings | done | b5c6391 |
| T4.6 | Write E2E scenarios 1–7 | done | fe44891 |
| C5 | Contracts phase 5 | todo | |
| T5.1 | Implement anticipation: route prior, tells, QB eyes, oracle | done | 213ae0c |
| T5.2 | Implement pattern-match rules | done | a70b882 |
| T5.3 | Implement option routes, motion, route delay in engine | done | ae851a5 |
| T5.4 | Integrate rules into sim; add simulateMany and Worker | done | 9d8f6ea |
| T5.5 | Build advanced matchup UI | done | d6dde11 |
| T5.6 | Build motion, option route, route delay editing | done | 9299c20 |
| T5.7 | Build match-rule form | done | 551e9af |
| T5.8 | Build tuning screen and benchmark UI | done | 8d78e53 |
| C6 | Contracts phase 6 | done | af57972 |
| T6.1 | Implement suggest scoring and cache | done | 06820dd |
| T6.2 | Build roster and lineup screens | done | 7182477 |
| T6.3 | Build backup banner, selective export, PNG/PDF export | done | fc0f9ad |
| T6.4 | Build suggest page | done | 2fe24c9 |
| T6.5 | Build random defense mode | done | 1d2d98b |
| T6.6 | Build lineup picker and advanced stat sliders | done | 51bde41 |
| T6.7 | Extend E2E and perf checks | done | 01ee99e |

## Phase gates

| Phase | Verifier | Report | Tag |
| --- | --- | --- | --- |
| 0 | PASS | phase-0-report.md | phase-0 |
| 1 | PASS | phase-1-report.md | phase-1 |
| 2 | PASS | phase-2-report.md | phase-2 |
| 3 | PASS | phase-3-report.md | phase-3 |
| 4 + MVP | PASS | phase-4-report.md | phase-4 |
| 5 | PASS | phase-5-report.md | phase-5 |
| 6 + final | PASS | phase-6-report.md | phase-6 |
| 6b (QB reads) | PASS (unit + E2E) | phase-6b-report.md | phase-6b |
| 6c (QB tự ném, D-23) | PASS (1352 unit, 38/38 E2E) | DECISIONS.md D-23 | phase-6c |
| 6d (aim fix D-24, zoom clamp + mini-map) | PASS (1364 unit, 38/38 E2E) | DECISIONS.md D-24 | phase-6d |
| 6f (Simple mode + QB throw controls, D-26) | PASS (1418 unit, 48 E2E) | SIMPLIFY.md, DECISIONS.md D-26 | phase-6f |
| 6e (responsive, D-25) | PASS (1379 unit, 44 E2E incl. iPhone + iPad overflow checks) | DECISIONS.md D-25 | phase-6e |

## Open questions / blockers

None.

## Final summary (2026-10-26)

Phases 0–6 complete; every phase gate passed and is tagged (`phase-0` … `phase-6`). MVP gate (§14.5)
passed at the end of phase 4. Phase 7 (P2) is out of scope.

### FR status
| FR | Pri | Status | Covering test |
| --- | --- | --- | --- |
| FR-FLD-01 | P0 | done | `FieldSvg.test.tsx` |
| FR-FLD-02 | P0 | done | `viewport.test.ts` (T-DOM-07) |
| FR-FLD-03 | P0 | done | `FieldStage.test.tsx` |
| FR-FLD-04 | P0 | done | `viewport.test.ts` |
| FR-DAT-01 | P0 | done | `migrations.test.ts` |
| FR-DAT-02 | P0 | done | `cascade.test.ts`, `DeletePlayDialog.test.tsx` |
| FR-DAT-03 | P0 | done | `bundle.test.ts`, `MatchupPage.test.tsx` |
| FR-DAT-04 | P0 | done | `useAutoSave.test.tsx`, `repos.test.ts` |
| FR-DAT-05 | P0 | done | `seed.test.ts` |
| FR-ED-01 | P0 | done | `NewPlayDialog.test.tsx` |
| FR-ED-02 | P0 | done | `tools.test.ts`, `EditorCanvas.test.tsx` |
| FR-ED-03 | P0 | done | `snap.test.ts` |
| FR-ED-04 | P0 | done | `editorStore.test.ts` |
| FR-ED-05 | P0 | done | `MetaPanel.test.tsx` |
| FR-ED-06 | P0 | done | `EditorPage.test.tsx` |
| FR-ED-07 | P0 | done | `validate.test.ts`, `WarningsPanel.test.tsx` |
| FR-ED-08 | P1 | partial | multi-select (Shift), delete, Ctrl+D duplicate — `tools.test.ts`, `useEditorShortcuts.test.tsx`; no clipboard copy/paste |
| FR-ED-09 | P1 | done | `EditorPage.test.tsx`, `export.test.ts` |
| FR-OFF-01..06 | P0 | done | `tools.test.ts`, `ops.test.ts`, `routeTree.test.ts`, `OffensePanel.test.tsx`, `numbering.test.ts`, `preview.test.ts` |
| FR-OFF-07 | P1 | done | `motionOption.test.tsx`, `optionMotion.test.ts`, E2E 14 |
| FR-OFF-08 | P1 | done | `motionOption.test.tsx`, `optionMotion.test.ts` (T-ENG-04) |
| FR-OFF-09 | P1 | done | `motionOption.test.tsx`, `optionMotion.test.ts` |
| FR-DEF-01..06 | P0 | done | `GhostLayer/manTool/zoneRushTools/align/DefensePanel` tests, E2E 02 |
| FR-DEF-07 | P1 | done | `MatchRulesForm.test.tsx`, `ruleOps.test.ts` |
| FR-DEF-08 | P2 | not done | — |
| FR-FLP-01..04 | P0 | done | `flip.test.ts`, `matchupFlip.test.ts`, E2E 04 |
| FR-FLP-05 | P2 | not done | — |
| FR-ATH-01/02 | P0 | done | `PlayerPanel.test.tsx`, `MatchupField.test.tsx`, E2E 05 |
| FR-ATH-03..06 | P1 | done | `PlayerPanel.test.tsx`, `roster.test.tsx`, `ControlsPanel.test.tsx`, E2E 11 |
| FR-ATH-07 | P2 | not done | — |
| FR-ENG-01..07 | P0 | done | `simulate.test.ts` (T-ENG-01/02/05/06/08/10), agent/world/perception/metrics tests, `perf.test.ts` |
| FR-ENG-08 | P1 | done | `anticipation(-sim).test.ts` (T-ENG-03/07) |
| FR-ENG-09 | P1 | done | `rulesSim.test.ts` (T-ENG-09), `optionMotion.test.ts` |
| FR-ENG-10 | P1 | done | `outcome.test.ts` (100k ±1 pp), `ball.test.ts` |
| FR-ENG-11 | P1 | done | `aggregate.test.ts`, `simClient.test.ts`, E2E 08/13 |
| FR-ENG-12 | P2 | not done | — |
| FR-MU-01..09 | P0 | done | Matchup tests, E2E 03–05 |
| FR-MU-10..14 | P1 | done | `ControlsPanel`, `advancedOverlays`, `RunManyPanel`, `MatchupPage` tests |
| FR-PB-01..04 | P0 | done | `PlaybookPage/PlayCard/filterPlays/MatchupList` tests |
| FR-PB-05/06 | P1 | done | `PlayCard.test.tsx`, `PlaybookPage.test.tsx` |
| FR-IN-01..04 | P0 | done | `install.test.tsx`, `PresentPage.test.tsx`, E2E 06 |
| FR-IN-05/06 | P1 | done | `PresentPage.test.tsx`, `export.test.ts` |
| FR-SG-01..04, 06 | P1 | done | `suggest.test.ts`, `SuggestPage.test.tsx`, E2E 09 |
| FR-SG-05 | P2 | not done | — |
| FR-RD-01..03 | P1 | done | `RandomDefense.test.tsx`, E2E 10 |
| FR-RD-04 | P2 | done (simple session counter) | `RandomDefense.test.tsx` |
| FR-IO-01..04 | P0 | done | `io.test.ts`, `bootstrap.test.ts`, E2E 07 |
| FR-IO-05..07 | P1 | done | `BackupBanner.test.tsx`, `export.test.ts` |
| FR-IO-08 | P2 | not done | — |
| FR-TUN-01..03 | P1 | done | `tuning/presets/field/benchmark` tests, E2E 12 |
| FR-TUN-04 | P2 | not done | — |

NFRs: PERF-01..04 measured and met (E2E 13 + unit perf); REL-01..04, UX-01..04, OFF-01 (offline after
load; PWA install not done — P1), PRV-01, CODE-01/02, ARC-01..05 verified.

### Deviations from the SRS
See `DECISIONS.md` (D-01 … D-21). Notable: `inaccuracyK` tuned 0.05 → 0.34 (D-20); outcome logic
(FR-ENG-10) shipped in phase 3 (D-11); push-apart between teammates only (D-10); `Play.strengthOverridden`
added (D-17); i18n split into namespaces behind `src/i18n/vi.ts` (D-06); WebKit stands in for Safari.

### Known issues
- QB read model added after phase 6 (D-22, `phase-6b-report.md`): reads, windows, scores are now
  customisable and visualised. 0 % sacks with TB players; Mesh averages ≈ 1 yd per attempt; Mesh/C1 71 %.
- A hard reload within the 800 ms auto-save window can lose the last edit (pagehide flush is best-effort).
- Editor clipboard copy/paste (FR-ED-08) and PWA install (NFR-OFF-01 P1) not implemented.
- Viewport does not refit on window resize (fit button does).

### Suggested next steps (phase 7)
1. YAC after the catch (FR-ENG-12) — would also fix Mesh's near-zero yards.
2. Mismatch tier in Suggest (FR-SG-05) using lineups.
3. Lineup comparison (FR-ATH-07), flipped thumbnails (FR-FLP-05), spy QB (FR-DEF-08).
4. GIF/video export (FR-IO-08), route-prior table editor (FR-TUN-04).
5. PWA manifest + service worker; clipboard copy/paste in the editor.
6. Pass-rush tuning so a TB rusher produces some sacks vs long-developing concepts.

