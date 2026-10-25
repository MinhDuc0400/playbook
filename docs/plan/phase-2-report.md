# Phase 2 report — Editor defense

Result: **PASS** (verifier, 2026-10-25). Manual browser check: seeded Cover 1 shows the ghost 2x1 with
S1/S2/S3/W1 numbers, man lines to the right ghosts, deep-middle zone, rush arrow, leverage dots.

## FRs done
| FR | Covering tests |
| --- | --- |
| FR-DEF-01 | `ghost.test.ts`, `GhostLayer.test.tsx`, `DefensePanel.test.tsx` (ghost select + design strength) |
| FR-DEF-02 | `manTool.test.ts`, `defense/ops.test.ts` (setMan stores ReceiverRef), `DefensePanel.test.tsx` |
| FR-DEF-03 | `zones.test.ts`, `ZoneShape.test.tsx`, `zoneRushTools.test.ts`, `DefensePanel.test.tsx` |
| FR-DEF-04 | `zoneRushTools.test.ts`, `DefensePanel.test.tsx` (count warns), `validate.test.ts` |
| FR-DEF-05 | `align.test.ts`, `DefensePanel.test.tsx` |
| FR-DEF-06 | `DefensePanel.test.tsx`, `defense/ops.test.ts` |

## Tests
825 unit tests, 57 files. Coverage domain 99.4 %, engine 99.3 %.

## Deviations
- Man assignments from the panel are read-only text; re-targeting uses the Man tool (M).
- Rush path editing: drag points / double-click to insert with the Rush tool; no Delete on rush points.
- Lead fix: leverage dot now points toward the ball for defenders right of the ball.

## Known issues
- The viewport does not refit when the window is resized (fit button restores it).
