# Phase 0 report — Foundation

Result: **PASS** (verifier, 2026-10-25).

## FRs done
| FR | Covering tests |
| --- | --- |
| FR-FLD-01 | `src/components/field/__tests__/FieldSvg.test.tsx` |
| FR-FLD-02 | `viewport.test.ts` (T-DOM-07 fast-check round trip) |
| FR-FLD-03 | `FieldStage.test.tsx` (wheel, pinch, Space+drag, fit) |
| FR-FLD-04 | `viewport.test.ts` (default view −10..25 yd) |
| FR-DAT-01 | `src/db/__tests__/migrations.test.ts` (Dexie v1 → v2, migrateRecord) |
| FR-DAT-02 | `cascade.test.ts` |
| FR-DAT-03 | `bundle.test.ts` |
| FR-DAT-04 | `repos.test.ts` (rw transactions), `src/lib/__tests__/useAutoSave.test.tsx` |
| FR-DAT-05 | `seed.test.ts`, `defaults.test.ts` |
| NFR-ARC-01..05 | ESLint `no-restricted-imports` / `no-restricted-globals` rules + verifier greps |
| Also | FR-IO-04 (`bootstrap.test.ts`), NFR-REL-01/02/04, NFR-UX-02 (app tests) |

## Tests
270 unit tests, 22 files. Coverage: domain 99.5 % lines, db 98.2 %. T-DOM-07, T-DOM-08 pass. `pnpm build` passes.
Manual check: dev server boots, first open seeds Settings + 6 sample plays.

## Deviations
- D-04: custom agent types not registered in this session → general-purpose agents on Sonnet with the
  role files.
- `useAutoSave`: values that arrive while `enabled: false` become the saved baseline (avoids a spurious
  save of freshly loaded data).
- Dialog renders via a portal.

## Known issues
- Screens other than the shell are placeholders (by plan).
