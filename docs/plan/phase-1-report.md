# Phase 1 report — Editor offense

Result: **PASS** (verifier, 2026-10-25). Manual browser check: new play from Trips, route tree,
hand-drawn route, warnings panel, "Chạy thử" animation all work.

## FRs done
| FR | Covering tests |
| --- | --- |
| FR-ED-01 | `NewPlayDialog.test.tsx`, `formations.test.ts`, `EditorPage.test.tsx` |
| FR-ED-02 | `tools.test.ts` (place/drag, labels, max), `ops.test.ts`, `EditorCanvas.test.tsx` |
| FR-ED-03 | `snap.test.ts`, `EditorCanvas.test.tsx` (Alt) |
| FR-ED-04 | `editorStore.test.ts` (150 undo steps, limit 200) |
| FR-ED-05 | `MetaPanel.test.tsx` |
| FR-ED-06 | `EditorPage.test.tsx` (auto-save, FR-ED-06 duplicate), `useAutoSave.test.tsx` |
| FR-ED-07 | `validate.test.ts` (every code), `WarningsPanel.test.tsx` |
| FR-OFF-01/02 | `tools.test.ts`, `ops.test.ts`, `EditorCanvas.test.tsx` |
| FR-OFF-03/04/05 | `routeTree.test.ts`, `OffensePanel.test.tsx`, `numbering.test.ts` |
| FR-OFF-06 | `preview.test.ts`, `PreviewOverlay.test.tsx`, `Timeline.test.tsx`, `usePlayback.test.tsx` |
| FR-FLP-01 | `flip.test.ts` (T-DOM-01 fast-check, FR-FLP-01 table) |
| FR-FLP-02 | `ops.test.ts`, `editorStore.test.ts`, `useEditorShortcuts.test.tsx`, `EditorPage.test.tsx` |
| Bonus | FR-ENG-04 movement model (`movement.test.ts`), FR-MU-03/04 playback bar |

## Tests
666 unit tests, 47 files. Coverage domain 99.4 %, engine 99.3 %. T-DOM-01, 04, 05, 06 pass.

## Deviations
- D-17 `Play.strengthOverridden`; D-18 labels/formations/tell details.
- Route-tree templates are not clamped to the field: a corner from a wide receiver can leave the field
  and the warnings panel flags it (engine clamps at the sideline).
- `useEditorShortcuts(maxPlayers)` takes the player limit as a parameter.
- Tag suggestions are side-specific (cov:* for defense, beats:*/concept:* for offense).

## Known issues
- Selected route point has no highlight (store tracks it; cosmetic).
- Defense editing is phase 2 (DefensePanel/GhostLayer/AssignmentLayer render nothing yet).
