# Phase 6b report — QB read model (D-22)

Trigger: user report "tại sao lúc nào mục tiêu cũng là Y" — all 9 seed matchups threw to read #1 at
1.27 s in 100 % of runs.

## Done
- Engine `readModel.ts`: read order modes, auto/manual read windows on the drop rhythm, closing-speed
  openness, lane risk, read score (T7.1). QB agent rebuilt on it: per-read throw rule with min score,
  check-down, pressure anticipation (time-to-QB), look-off per window; `Frame.qb`, `SimMetrics.reads`,
  `AggregateResult.readDistribution` (T7.2).
- Editor: "Cách đọc" section — mode, per-receiver manual window, min score (T7.3).
- Matchup: read timeline (read windows vs open windows, current read, decision marker), score chart
  with thresholds, decision line in the result panel, decision distribution in "Chạy 50 lần" (T7.4).
- Settings: 11 new tuning parameters editable; stored settings / old import files are filled with
  defaults (`normalizeSettings`) — found in the browser check (NaN scores with pre-existing settings).

## Results (TB players, noise on)
| Pair | Targets (50 runs) | Decisions |
| --- | --- | --- |
| Flood vs C1 | C 64 %, Z 34 %, Y 2 % | mostly check-down |
| Flood vs C2 | Y 100 % | read #1 |
| Flood vs C3 | Y 80 %, C 20 % | read #1 / check-down |
| Mesh vs C1 | Y 84 %, Z 10 %, X 4 %, C 2 % | read #1/#2, check-down |
| Mesh vs C2 | Y 98 %, Z 2 % | read #1 |
| Mesh vs C3 | Y 100 % | read #1 |
| Smash vs C1 | Y 100 % | read #1 |
| Smash vs C2 | C 76 %, X 18 %, Y 6 % | mostly check-down |
| Smash vs C3 | Z 100 % | check-down |

Benchmark (200 seeds): Flood/C3 61 %, Mesh/C1 71 %, Smash/C2 65 % (`inaccuracyK` 0.34 → 0.2).
Average time to throw now 1.3–2.0 s (was 1.27 s everywhere). Sacks 0 % with TB players.

## Tests
1339 unit (124 files), 36/36 E2E (Chromium + WebKit). Bench 6–8 ms. E2E scenario 5 now samples the
separation at Smash's hitch break (the old times fell after the throw with the new QB timing).

## Known issues
- Four pairs still go 100 % to one receiver — the tactically open read (e.g. Smash vs Cover 1 hitch vs
  cushion), plus Mesh/C1 at 71 % (1 pp over the band).
- 0 % sacks with TB players (pressure anticipation gets the ball out).
