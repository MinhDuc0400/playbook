# Phase 5 report — Engine advanced

Result: **PASS** (verifier, 2026-10-26). Browser check: "Chạy 50 lần" runs in the real Web Worker.

## FRs done
| FR | Covering tests |
| --- | --- |
| FR-ENG-08 | `anticipation.test.ts`, `anticipation-sim.test.ts` (T-ENG-03, T-ENG-07); T-ENG-02 at a = 0 and 0.5 |
| FR-ENG-09 | `matchRules.test.ts`, `rulesSim.test.ts` (T-ENG-09), `optionMotion.test.ts` (T-ENG-04, motion, renumbering) |
| FR-ENG-11 | `aggregate.test.ts` (NFR-PERF-03: 50 runs ≈ 0.2–0.5 s), `simClient.test.ts` |
| FR-MU-10..14 | `ControlsPanel`, `advancedOverlays`, `RunManyPanel`, `MatchupPage` tests |
| FR-OFF-07/08/09 | `motionOption.test.tsx`, `OffensePanel.test.tsx`, `validate.test.ts` (too-many-motions) |
| FR-DEF-07 | `MatchRulesForm.test.tsx`, `ruleOps.test.ts`, `DefensePanel.test.tsx` |
| FR-TUN-01/02/03 | `tuning/presets/field/benchmark.test.tsx` |

## Tests and budgets
1238 unit tests (112 files); 14/14 E2E; coverage domain 99.4 %, engine 98.3 %; bench 3.7 ms.
Benchmark after phase 5 (200 seeds): Flood/C3 67 %, Mesh/C1 69 %, Smash/C2 61 % — no re-tune needed.

## Deviations
- D-21 ordering. Rules are wrapped by `agents/ruleDefender.ts` around man/zone agents.
- Tell episodes are counted in ticks (30-tick hold), tell RNG is its own fork per defender.
- Motion: each motion starts at −(its duration); frames start at the first k/30 ≥ −max duration.
- Option man-read: nearest defender ≤ 2 yd + velocity correlation ≥ 0.7 over 0.8 s; with TB reaction a
  trailing defender reads as man only when it starts level with the receiver.

## Known issues
- The a = 0 → 0.5 separation drop is small (route-prior effect is modest with σ 1.5 yd).
- The Timeline has no marker colour for `motion` / `optionChoice` events (falls back to neutral).
