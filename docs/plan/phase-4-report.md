# Phase 4 report — Playbook + Install + import/export, and MVP gate

Result: **PASS** (verifier, 2026-10-26). **MVP gate (§14.5): PASS.**

## FRs done
| FR | Covering tests |
| --- | --- |
| FR-PB-01/02 | `PlaybookPage.test.tsx`, `PlayThumbnail.test.tsx`, `filterPlays.test.ts` (NFR-PERF-04 500 plays < 100 ms) |
| FR-PB-03 | `PlayCard.test.tsx`, `DeletePlayDialog.test.tsx` (FR-DAT-02 UI) |
| FR-PB-04, FR-PB-05 | `MatchupList.test.tsx`, `PlayCard.test.tsx` |
| FR-IN-01/02/03 | `install.test.tsx`, `items.test.ts`, `NoteText.test.tsx`; "Thêm vào Install" on the Matchup page |
| FR-IN-04 (+ FR-IN-05 contrast toggle) | `PresentPage.test.tsx`, E2E 06 |
| FR-IO-01/02/03 | `src/lib/io/__tests__/io.test.ts`, `settings.test.tsx`, E2E 07 |
| FR-IO-04 | `bootstrap.test.ts` |

## MVP Definition of Done (§14.5)
1. Every P0 requirement implemented with a covering test — PASS (verifier mapped each id to a test file).
2. T-DOM-01..08, T-ENG-01/02/05/06/08/10 — PASS.
3. 7 E2E scenarios on Chromium and WebKit (Safari) — PASS, 14/14, stable over 3 runs.
4. Benchmark TB, good concept vs matching coverage: Flood/C3 62 %, Mesh/C1 68 %, Smash/C2 64 % — PASS.
5. 9 seed matchups run without errors; lead visual check of Flood/C3, Smash/C2, Mesh/C1: plausible
   movement (deep thirds sink, hook LB, rusher closes, man trails) — PASS.

## Tests and budgets
1114 unit tests (96 files), coverage domain 99.4 %, engine 98.3 %; simulate 5v5 6 s mean 3.4 ms.

## Deviations
- E2E 5 uses Flood vs Cover 1 (Mesh's separation-at-throw doesn't move because throw timing shifts).
- Import strips unknown keys; merge-copy also remaps lineup/athlete references.

## Known issues
- A hard full-page navigation inside the 800 ms auto-save window can lose the pending save (pagehide flush
  is best-effort for IndexedDB). In-app navigation flushes on unmount.
- 0 % sacks and Mesh ≈ 0.7 yd/attempt with TB players (see phase 3 report).
