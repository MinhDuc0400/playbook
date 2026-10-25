# Flagbook

Personal web app to draw, save, combine and animate flag football plays (offense vs defense).
Runs fully in the browser. No backend.

- Source of truth: `docs/SRS.md` (Vietnamese). Cite requirement IDs (FR-xxx, NFR-xxx, T-xxx).
- Plan and status: `docs/plan/PLAN.md`, `docs/plan/STATUS.md`, `docs/plan/DECISIONS.md`.

## Stack

Vite, React 18, TypeScript strict, React Router, Zustand + immer (+ zundo for undo), Dexie +
dexie-react-hooks, SVG + d3-shape, Zod, nanoid, Comlink + Web Worker, html-to-image, jsPDF,
Tailwind CSS, Vitest + Testing Library + fast-check + fake-indexeddb, Playwright. Package manager: pnpm.

## Commands

| Command | Does |
| --- | --- |
| `pnpm dev` | Dev server |
| `pnpm build` | Production build |
| `pnpm typecheck` | `tsc --noEmit` |
| `pnpm lint` | ESLint + Prettier check |
| `pnpm test` | Vitest run (unit + db) |
| `pnpm test:e2e` | Playwright |
| `pnpm bench` | Vitest bench (engine perf) |

## Layout

```
src/domain/    types, field, geometry, flip, numbering, presets, routeTree  (pure TS)
src/engine/    simulate, world, perception, agents/, anticipation, matchRules, ball, outcome, rng  (pure TS)
src/suggest/   scoring, mismatch  (pure TS)
src/db/        Dexie schema, migrations, repositories
src/workers/   sim.worker.ts
src/store/     Zustand stores
src/features/  editor/ matchup/ playbook/ install/ roster/ settings/ suggest/
src/components/field/  FieldSvg, PlayerToken, RoutePath, ZoneShape, Timeline
src/i18n/vi.ts all UI strings
```

## Rules (NFR-ARC)

1. `domain/`, `engine/`, `suggest/` never import React, Dexie or the DOM.
2. Engine is pure: same input + seed gives the same frames.
3. UI never computes player positions; it draws frames from the engine.
4. Components access data only through repositories in `db/`.
5. All coordinates are yards. x right, y downfield, origin = ball on LOS. Only `toScreen()` / `toField()`
   convert to pixels.
6. Engine agents only get their own state, assignment, stats and a delayed `Perception`. Never the
   opponent's `Play` (the only exception is the oracle path in `anticipation.ts` when anticipation > 0.5).

## Conventions

- Code, comments, commit messages: English. UI text: Vietnamese, from `src/i18n/vi.ts`. Football terms
  stay English (route, coverage, LOS...).
- Commits: `feat(<area>): T<id> <title> [<FR ids>]`, `fix(...)`, `chore(...)`, `test(...)`.
- Tests next to code in `__tests__/`. Name tests after SRS IDs when one exists (`T-ENG-02 no lookahead`).
- Default rules: NFL FLAG 5v5 (SRS §4.2).
