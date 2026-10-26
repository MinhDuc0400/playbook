# Phase 6 report — Suggest + Roster (final)

Result: **PASS** after two lead fixes (contrast-toggle test for FR-IN-05; aria suffix moved into i18n).

## FRs done
| FR | Covering tests |
| --- | --- |
| FR-SG-01..04, FR-SG-06 | `src/suggest/__tests__/suggest.test.ts`, `SuggestPage.test.tsx`, E2E 09 |
| FR-RD-01..03 (+ FR-RD-04 counter) | `RandomDefense.test.tsx`, `MatchupPageRandomOverlay.test.tsx`, E2E 10 |
| FR-ATH-03..06 | `PlayerPanel.test.tsx`, `roster.test.tsx`, `ControlsPanel.test.tsx`, E2E 11 |
| FR-IO-05/06/07, FR-ED-09, FR-PB-05/06, FR-IN-05/06 | `BackupBanner.test.tsx`, `export.test.ts`, `PlaybookPage/PlayCard/install/EditorPage/MatchupPage/PresentPage` tests, E2E 14 |

## Final verification
- typecheck, lint, build: pass (sim worker chunk bundled).
- Unit: 1283 tests, 119 files. Coverage: domain 99.4 %, engine 98.4 %, suggest 100 %, db 99.7 %, lib 97 %.
- E2E: 36/36 (18 specs × Chromium + WebKit), stable over repeated runs.
- Perf (Chromium / WebKit): first open 70 / 74 ms (< 2 s); filter 500 plays 16 / 51 ms (< 100 ms);
  50 runs in Worker 202 / 198 ms with max frame gap 17 / 31 ms (< 1.5 s, UI responsive); editor drag
  median 16.7 / 16 ms, p95 16.7 / 24 ms (60 fps); simulate 5v5 6 s mean 3.8 ms (< 20 ms).
- Benchmark (50 seeds): Flood/C3 62 %, Mesh/C1 68 %, Smash/C2 64 %.
- Architecture rules, no network calls (NFR-PRV-01), strings centralised (NFR-UX-04): pass.

## Deviations
- Suggest lineup select applies to the given play's side.
- Random defense guesses use cov:cover-0..3 / man / zone (not blitz).
