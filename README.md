# Flagbook

A personal web app to **draw, save, combine and animate flag football plays** (offense vs defense).
Everything runs in the browser — no backend, no account, no analytics. Data lives in IndexedDB and can be
backed up as JSON.

UI language: Vietnamese (football terms in English). Default rules: NFL FLAG 5v5.

## What it does

- **Editor** (`/play/new`, `/play/:id`) — place players, draw routes (click break points, Enter to finish,
  Shift locks 45°, Alt disables the 0.5 yd snap), pick from a 15-route tree, QB drop and read order,
  pre-snap motion, option routes, route delays. Defense: ghost offense, man / zone / rush tools, leverage,
  "Tự căn" auto-align, pattern-match rules. Flip (F), undo/redo (Ctrl+Z / Ctrl+Shift+Z), auto-save,
  warnings panel, "Chạy thử" offense-only preview, PNG export.
- **Matchup** (`/matchup/:id`) — one offense + one defense of the same format, animated by a
  deterministic simulation engine where every player reacts only to what it can see (delayed by its
  reaction time). Flip offense, auto defense flip, ball spot, seed, noise, anticipation slider (above 0.5 =
  "oracle"), per-player Kém / TB / Hay or custom stats, lineups, overlays (planned routes, trails, zones,
  man lines, ball path, separation, perception debug, QB eyes), result panel, 50-run Monte Carlo in a Web
  Worker, random-defense training mode.
- **Playbook** (`/`) — filterable grid of play thumbnails, matchup list, duplicate / delete (with cascade
  warning) / create matchup, multi-select JSON export.
- **Install** (`/install`) — playlists of matchups with coach notes, drag to reorder, fullscreen present
  mode (← → items, Space play, N notes, L loop), JSON bundle and PDF export.
- **Suggest** (`/suggest`) — top-5 plays against a given play, ranked by tags then simulation, with numeric
  reasons.
- **Roster** (`/roster`) — athletes with stats and lineups by side + format.
- **Settings** (`/settings`) — field rules per format, stat presets, every engine tuning parameter,
  benchmark, JSON import/export (merge or replace), theme.

Press `?` anywhere for the keyboard shortcut sheet.

## Requirements

Node 22, pnpm 9 (`corepack enable pnpm` or `corepack prepare pnpm@9.15.9 --activate`).

## Run

```bash
pnpm install
```

```bash
pnpm dev
```

Opens on http://localhost:5173. The first open seeds default settings and six sample 5v5 plays
(Trips Flood, Mesh, Smash, Cover 1, Cover 2, Cover 3).

## Develop, test, build

| Command | Does |
| --- | --- |
| `pnpm dev` | Vite dev server |
| `pnpm typecheck` | `tsc --noEmit` (strict) |
| `pnpm lint` | ESLint (incl. architecture rules) + Prettier check |
| `pnpm test` | Vitest unit + DB tests (fake-indexeddb) |
| `pnpm test -- --coverage` | with coverage (domain/engine ≥ 80 %) |
| `pnpm test:e2e` | Playwright E2E on Chromium and WebKit (`pnpm exec playwright install chromium webkit` once) |
| `pnpm bench` | engine micro-benchmark (`simulate()` 5v5 budget 20 ms) |
| `pnpm benchmark [runs]` | tuning benchmark: % complete for every seed offense × defense pair |
| `pnpm build` | type-check + production build into `dist/` |
| `pnpm preview` | serve the production build |

## Architecture

```
src/domain/    types, field, geometry, flip, numbering, presets, route tree, zones, validation (pure TS)
src/engine/    simulate, world/perception, agents, anticipation, match rules, ball, outcome, rng (pure TS)
src/suggest/   tag + simulation scoring, cache (pure TS)
src/db/        Dexie schema, migrations, repositories, live-query hooks, seed data
src/workers/   sim Web Worker + Comlink client
src/store/     Zustand stores (editor with undo, matchup UI)
src/features/  editor, matchup, playbook, install, roster, settings, suggest screens
src/components/field/  FieldSvg, PlayerToken, RoutePath, ZoneShape, Timeline, thumbnails
src/lib/       JSON import/export, PNG/PDF export, auto-save
src/i18n/vi.ts all UI strings
```

Rules (enforced by ESLint and tests): `domain/`, `engine/`, `suggest/` never import React, Dexie or the
DOM; the engine is pure and deterministic per seed; the UI only draws engine frames; components reach
data only through `src/db`; all coordinates are yards (x right, y downfield, origin = ball on the LOS);
agents never receive the opponent's play (the only exception is the anticipation oracle above 0.5).

Requirements and design: `docs/SRS.md`. Plan, decisions and status: `docs/plan/`.
