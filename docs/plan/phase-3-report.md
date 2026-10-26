# Phase 3 report — Engine + Matchup

Result: **PASS** (verifier, 2026-10-26). Manual browser check: a Smash vs Cover 2 matchup created from
the dialog plays back with overlays, separation numbers, result panel and timeline markers.

## FRs done
| FR | Covering tests |
| --- | --- |
| FR-ENG-01 | `simulate.test.ts` (basics), `perf.test.ts` |
| FR-ENG-02 | `prepare.test.ts` (T-ENG-10), `numbering.test.ts` |
| FR-ENG-03 | `world.test.ts`, `perception.test.ts`, `simulate.test.ts` (T-ENG-02) |
| FR-ENG-04 | `movement.test.ts` |
| FR-ENG-05 | `receiver/rusher/manDefender/zoneDefender.test.ts`, T-ENG-05 |
| FR-ENG-06 | `qb.test.ts`, `ball.test.ts`, T-ENG-08 |
| FR-ENG-07 | `metrics.test.ts` |
| FR-ENG-10 (early, D-11) | `outcome.test.ts` (resolveContest 100k ±1 pp) |
| FR-MU-01..09 | `NewMatchupDialog/ControlsPanel/MatchupPage/MatchupField/PlayerPanel/ResultPanel.test.tsx`, `useMatchupShortcuts.test.tsx`, `Timeline.test.tsx` |
| FR-FLP-03/04 | `matchupFlip.test.ts` (T-DOM-02, T-DOM-03) |
| FR-ATH-01/02 | `PlayerPanel.test.tsx`, `MatchupField.test.tsx`, `PlayerToken.test.tsx` |
| FR-TUN-03 core | `benchmark.test.ts`, `pnpm benchmark` |

## Tests and budgets
1060 unit tests, 84 files. Coverage domain 99.4 %, engine 98.0 %. simulate 5v5 6 s: bench mean 3.7 ms
(budget 20 ms). Benchmark (50 seeds): Flood/C3 62 %, Mesh/C1 68 %, Smash/C2 64 % (target 60–70 %).

## Deviations
- D-20: `inaccuracyK` tuned 0.05 → 0.34.
- T-ENG-05 measures separation 0.3 s after the break (defender sees the break only after its reaction).
- T-ENG-06 measures mean separation over 0–3 s with the QB not throwing (otherwise the QB throws as
  soon as the good WR is open, biasing the window).

## Known issues
- 0 % sacks with TB players in every seed pairing: the QB throws first-read (~1.3 s) before the single
  rusher arrives. Sacks do occur in T-ENG-08 (good rusher, nobody open).
- Mesh averages < 1 yd per attempt (drags caught at ~2 yd); it also scores ~68 % vs every coverage.
- Viewport doesn't refit on window resize (fit button).
