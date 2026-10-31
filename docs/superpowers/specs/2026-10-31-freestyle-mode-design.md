# Freestyle mode — design (draft for approval)

Status: **proposed, nothing built.** Sources: product-owner brief and business-analyst analysis (this session).
Will become D-27 and FR-FS-xx in the SRS/PLAN once approved.

## 1. Intent

A whiteboard that plays back. For a 5-minute huddle or a solo brainstorm: open one screen, sketch offense
routes and defense zones on the same field, tap "Chạy thử" and see who is open. No naming, no dialogs, no
setup. Today this takes 3 dialogs and 3 screens (offense play, defense play, matchup).

## 2. Goals / non-goals / anti-goals

Goals: one field, both sides drawable from a blank board (place players, draw routes/zones, run);
edits re-run the trial automatically; works one-handed on a tablet and on phones (D-25).

Non-goals (MVP): stats, roster, lineups, seed/noise, multi-run %, Suggest, Install/Present, tags/notes,
formats other than 5v5, sharing.

Anti-goals (failure even if it "works"): a second editor with its own bugs; any dialog before the first draw;
losing a good sketch because it was "only a scratchpad"; trial results that differ from the same two plays in
Matchup; needing Advanced mode.

## 3. Behaviour

- Route `/freestyle`; nav item **Freestyle** (both modes) and a button on Playbook.
- Opens as a **blank whiteboard**: empty field, no default formation, no dialog. (Changed after review: you
  drag the players in yourself, then draw.)
- **Player tray** beside/below the field (per side): chips QB, C, X, Y, Z, RB for offense; defender chips
  (CB, S, LB, DL...) for defense. Drag a chip onto the field (or tap chip, then tap the field) to place it;
  drag a placed token to move it; drag it off the field or use Xóa to remove it. Tray chips show how many are
  still unplaced (5 per side, 5v5). Snap follows the existing setting.
- Optional one-tap helpers (not required): "Đội hình" menu to drop a preset formation onto the active side.
- Run with an incomplete board is allowed: sides that are empty/partial simulate with what is there; a missing
  QB or an empty side shows an inline hint ("Thêm QB để chạy thử") instead of an error.
- **Segmented switch Tấn công | Phòng thủ** (Tab key). Active side: full tools (existing toolbar and shortcuts,
  unchanged). Passive side: dimmed (~0.45), not interactive. Switching resets the tool to Chọn.
  Exception: the defense **Man** tool can click the real offense tokens (stored as the existing strong/weak
  `#n` receiver ref, never an id).
- **Chạy thử** (Space) switches the same field to playback: playback bar + "Khoảng open" strip.
  After the first run, every *committed* edit (gesture end, never during drag) re-simulates, keeping the playhead.
- QB tự ném (Q/W/E/R/T) and "Ném lúc open nhất" are available in the trial view (as in Simple Matchup).
- Flip tấn công / phòng thủ, one undo/redo history across both sides (>= 100 steps), warnings as a small badge
  that never blocks a run.
- **Mới** clears the board back to blank (confirm only if the board is non-empty).
- **Lưu thành play** creates 2 Plays + 1 Matchup (tag `freestyle`, auto names "Freestyle dd/MM hh:mm") and opens
  the Matchup. Nothing reaches the Playbook before that.

## 4. Technical design

- Trial uses the same pure path as Matchup: transient `createMatchup({seed:1})`, `buildSimInput(..., simple=true)`,
  `useMatchupSim`, `OpenWindows`, `MatchupField`. Golden test: freestyle result == Simple Matchup result for the
  same two plays. Engine untouched (NFR-ARC holds).
- Editing: `editorStore.play` stays the **active** side so all tools keep working; add `companion: Play | null`
  for the passive side. Zundo history slice becomes `{play, companion}`; side swap is a non-recorded set; after
  undo the active side follows `play.side`. No second store, no merged Play.
- Canvas draws the passive play in a read-only dimmed layer (`data-side` on tokens for hit tests).
- Persistence (my call, differs between the two reports): one draft in `localStorage` key
  `flagbook.freestyle.v1` = `{v:1, offense, defense, activeSide}`, validated with `PlaySchema.safeParse`, all
  access in try/catch. No Dexie table, no schema bump, no migration. Save-as goes through `playsRepo`/`matchupsRepo`.
- Sim runs on the main thread (< 20 ms). If it ever exceeds 50 ms, move to the existing Comlink worker.
- Mobile (D-25): field >= 50 dvh, 40 px touch targets, on-screen Xong/Hủy/Xóa and side switch, no horizontal scroll
  at 360/390/430/768.
- Strings in `src/i18n/vi.ts` (English code, Vietnamese UI).

## 5. Requirements (summary)

P0: FR-FS-01 route/nav/blank board · FR-FS-16 player tray: drag-in/move/remove players, incomplete-board hints · 02 one field, active-side switch · 03 existing tools unchanged ·
04 Man tool on real offense · 05 Chạy thử == Matchup (golden: same result as Simple Matchup) · 08 shared undo.
P1: 06 auto re-run on commit · 07 Khoảng open + QB tự ném · 09 flip · 10 warnings badge · 11 draft restore + Mới ·
12 Lưu thành play.
P2 (later): 13 start from a saved play · 14 PNG export · 15 projector/present layout.

## 6. Tasks (each <= 400 changed lines)

| ID | Task | Depends |
| --- | --- | --- |
| T13.1 | Store `companion` + pair history + unit tests | — |
| T13.2 | Canvas passive layer, `data-side`, Man tool on live offense | T13.1 |
| T13.2b | Player tray: drag/tap-to-place chips, remove, counters, optional "Đội hình" preset menu | T13.1, T13.2 |
| T13.3 | `FreestylePage` shell (blank start), route, nav, i18n, responsive layout | T13.1, T13.2, T13.2b |
| T13.4 | Trial view: field, playback, Khoảng open, QB mode, auto re-run | T13.3 |
| T13.5 | Draft persistence, Mới, Lưu thành play, warnings, flip | T13.3 |
| T13.6 | E2E `18-freestyle.spec.ts` + responsive checks (chromium, webkit, mobile, tablet) | T13.4, T13.5 |
| T13.7 | P2 items | T13.5 |

## 7. Risks and defaults

1. Editor assumes one `store.play` → keep `play` = active side, add `companion` (rejects second store / merged Play).
2. Crowded field hit conflicts → strict active-side-only, Man exception, side switch + Tab, min touch hit radius.
3. Trial flicker/lag → no run during drag, `useDeferredValue` on commit, keep playhead.
4. Scope creep into a "second Matchup page" → anything outside the P0/P1 list goes to P2.

## 8. Calls I made (check these)

- Name **Freestyle** (not "Vẽ nhanh"), per your wording.
- Auto re-run and QB tự ném are in the first release (PO had them as "next"; BA as P1).
- localStorage draft rather than Dexie.
- Always the Simple sim input, even when Advanced is on.
- 5v5 only.
- Blank start; the preset formation menu is an optional helper, and its place in the first release is my call.
- Tray placement works by drag (mouse/touch) and by tap-chip-then-tap-field, so phones don't depend on drag.
- A sim on a partial board runs with what exists (hint shown) rather than being blocked.
