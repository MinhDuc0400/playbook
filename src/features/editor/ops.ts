/**
 * Pure play-editing recipes (D-14). Each takes a Play and returns a new Play (or the same object when
 * nothing changes). Used through `editorStore.apply(label, recipe)`. Never mutate the input.
 */
import { flipPlay } from '@/domain/flip';
import { nextDefaultLabel } from '@/domain/formations';
import { alignedPlayers, computeStrength } from '@/domain/numbering';
import { buildRoute, outwardSign, type RouteTemplateId } from '@/domain/routeTree';
import type {
  Action,
  ID,
  MotionAction,
  OptionRouteAction,
  Play,
  PlayerSlot,
  Point,
  QbDropAction,
  ReadMode,
  ReadPlan,
  ReadWindowSpec,
  Role,
  RouteAction,
  Strength,
} from '@/domain/types';

export type Recipe = (play: Play) => Play;

// ---------- helpers ----------

function clone<T>(v: T): T {
  return JSON.parse(JSON.stringify(v)) as T;
}

const translate = (pts: readonly Point[], dx: number, dy: number): Point[] =>
  pts.map((p) => ({ x: p.x + dx, y: p.y + dy }));

/** Shift the geometry of an offense player's actions (route, option, motion); other actions are kept. */
function translateActions(actions: readonly Action[], dx: number, dy: number): Action[] {
  return actions.map((a): Action => {
    switch (a.type) {
      case 'route':
      case 'motion':
        return { ...a, path: translate(a.path, dx, dy) };
      case 'option':
        return {
          ...a,
          stem: translate(a.stem, dx, dy),
          vsMan: translate(a.vsMan, dx, dy),
          vsZone: translate(a.vsZone, dx, dy),
        };
      default:
        return a;
    }
  });
}

function replaceSlot(play: Play, slotId: ID, fn: (s: PlayerSlot) => PlayerSlot): Play {
  const i = play.players.findIndex((s) => s.id === slotId);
  const cur = play.players[i];
  if (i < 0 || !cur) return play;
  const next = fn(cur);
  if (next === cur) return play;
  const players = play.players.slice();
  players[i] = next;
  return { ...play, players };
}

/** Recompute offense strength from alignment unless overridden; returns the same play when unchanged. */
function withStrength(play: Play): Play {
  if (play.side !== 'offense' || play.strengthOverridden) return play;
  const strength = computeStrength(alignedPlayers(play));
  return strength === play.strength ? play : { ...play, strength };
}

/** Index of the slot's first 'route' action (-1 when none). */
function routeIndex(slot: PlayerSlot): number {
  return slot.actions.findIndex((a) => a.type === 'route');
}

/** Replace/append/remove the slot's route-ish (route or option) action. */
function putRoute(slot: PlayerSlot, route: RouteAction | null): PlayerSlot {
  const i = slot.actions.findIndex((a) => a.type === 'route' || a.type === 'option');
  if (route === null) {
    if (i < 0) return slot;
    return { ...slot, actions: slot.actions.filter((_, j) => j !== i) };
  }
  const actions = slot.actions.slice();
  if (i < 0) actions.push(route);
  else actions[i] = route;
  return { ...slot, actions };
}

/** Edit the slot's first 'route' action; `fn` returns the same route (no-op), a new one, or null (remove). */
function editRoute(slotId: ID, fn: (r: RouteAction) => RouteAction | null): Recipe {
  return (play) =>
    replaceSlot(play, slotId, (slot) => {
      const i = routeIndex(slot);
      const route = slot.actions[i];
      if (i < 0 || route?.type !== 'route') return slot;
      const next = fn(route);
      if (next === route) return slot;
      const actions = slot.actions.slice();
      if (next === null) actions.splice(i, 1);
      else actions[i] = next;
      return { ...slot, actions };
    });
}

/** New route without templateId (manual edit). */
function manual(route: RouteAction, patch: Partial<RouteAction>): RouteAction {
  const next: RouteAction = { ...route, ...patch };
  delete next.templateId;
  return next;
}

// ---------- players ----------

/** False when play already has `maxPlayers` players. */
export function canAddPlayer(play: Play, maxPlayers: number): boolean {
  return play.players.length < maxPlayers;
}

/**
 * Add a player at pos with the next default label for its role (nextDefaultLabel). Offense QB gets a
 * qbDrop {depth 2, shotgun}; defense 'R' gets a rush to (0,-5) with delay 0. No-op at maxPlayers.
 * Recomputes strength (unless strengthOverridden).
 */
export function addPlayer(role: Role, pos: Point, maxPlayers: number, idGen: () => ID): Recipe {
  return (play) => {
    if (!canAddPlayer(play, maxPlayers)) return play;
    const actions: Action[] = [];
    if (role === 'QB') actions.push({ type: 'qbDrop', depth: 2, style: 'shotgun' });
    if (role === 'R') actions.push({ type: 'rush', path: [{ x: 0, y: -5 }], delay: 0 });
    const slot: PlayerSlot = {
      id: idGen(),
      role,
      label: nextDefaultLabel(
        role,
        play.players.map((s) => s.label),
      ),
      start: { x: pos.x, y: pos.y },
      actions,
    };
    return withStrength({ ...play, players: [...play.players, slot] });
  };
}

/**
 * Move a player's start. Offense: its route/option/motion points translate by the same delta (shape kept).
 * Defense: actions unchanged. Recomputes strength (unless strengthOverridden).
 */
export function movePlayer(slotId: ID, pos: Point): Recipe {
  return (play) => {
    const moved = replaceSlot(play, slotId, (slot) => {
      const dx = pos.x - slot.start.x;
      const dy = pos.y - slot.start.y;
      if (dx === 0 && dy === 0) return slot;
      return {
        ...slot,
        start: { x: pos.x, y: pos.y },
        actions: play.side === 'offense' ? translateActions(slot.actions, dx, dy) : slot.actions,
      };
    });
    return moved === play ? play : withStrength(moved);
  };
}

/** Remove slot ids from a read plan's windows / minScore. */
function dropSlots(plan: ReadPlan, gone: ReadonlySet<ID>): ReadPlan {
  const out: ReadPlan = { mode: plan.mode };
  const keep = <T>(m: Record<ID, T>): Record<ID, T> =>
    Object.fromEntries(Object.entries(m).filter(([id]) => !gone.has(id)));
  if (plan.windows) out.windows = keep(plan.windows);
  if (plan.minScore) out.minScore = keep(plan.minScore);
  return out;
}

/** Drop empty maps; a default progression plan with nothing custom becomes undefined. */
function cleanReadPlan(plan: ReadPlan): ReadPlan | undefined {
  const out: ReadPlan = { mode: plan.mode };
  if (plan.windows && Object.keys(plan.windows).length > 0) out.windows = plan.windows;
  if (plan.minScore && Object.keys(plan.minScore).length > 0) out.minScore = plan.minScore;
  return out.mode === 'progression' && !out.windows && !out.minScore ? undefined : out;
}

function withReadPlan(play: Play, plan: ReadPlan | undefined): Play {
  const next: Play = { ...play };
  if (plan) next.readPlan = plan;
  else delete next.readPlan;
  return next;
}

/** Remove players; also drops them from progression. Recomputes strength. */
export function removePlayers(slotIds: readonly ID[]): Recipe {
  return (play) => {
    const gone = new Set(slotIds);
    const players = play.players.filter((s) => !gone.has(s.id));
    if (players.length === play.players.length) return play;
    let next: Play = { ...play, players };
    if (play.progression) next.progression = play.progression.filter((id) => !gone.has(id));
    if (play.readPlan) next = withReadPlan(next, cleanReadPlan(dropSlots(play.readPlan, gone)));
    return withStrength(next);
  };
}

/** Copy a player (Ctrl+D) offset +1 yd in x with a new id and the next default label. No-op at max. */
export function duplicatePlayer(slotId: ID, maxPlayers: number, idGen: () => ID): Recipe {
  return (play) => {
    const src = play.players.find((s) => s.id === slotId);
    if (!src || !canAddPlayer(play, maxPlayers)) return play;
    const copy = clone(src);
    copy.id = idGen();
    copy.label = nextDefaultLabel(
      src.role,
      play.players.map((s) => s.label),
    );
    copy.start = { x: src.start.x + 1, y: src.start.y };
    if (play.side === 'offense') copy.actions = translateActions(copy.actions, 1, 0);
    return withStrength({ ...play, players: [...play.players, copy] });
  };
}

export function setLabel(slotId: ID, label: string): Recipe {
  return (play) => replaceSlot(play, slotId, (s) => (s.label === label ? s : { ...s, label }));
}

// ---------- routes ----------

/** The slot's first 'route' action, if any. */
export function getRoute(play: Play, slotId: ID): RouteAction | undefined {
  const slot = play.players.find((s) => s.id === slotId);
  return slot?.actions.find((a): a is RouteAction => a.type === 'route');
}

/** Replace the slot's route (first 'route' or 'option' action) with `route`; null removes it. */
export function setRoute(slotId: ID, route: RouteAction | null): Recipe {
  return (play) => replaceSlot(play, slotId, (slot) => putRoute(slot, route));
}

export function moveRoutePoint(slotId: ID, index: number, pos: Point): Recipe {
  return editRoute(slotId, (r) => {
    const cur = r.path[index];
    if (!cur || (cur.x === pos.x && cur.y === pos.y)) return r;
    const path = r.path.slice();
    path[index] = { x: pos.x, y: pos.y };
    return manual(r, { path });
  });
}

/** Insert pos at `index` in the path (0 = first point after the start). smooth[] stays aligned (new = false). */
export function insertRoutePoint(slotId: ID, index: number, pos: Point): Recipe {
  return editRoute(slotId, (r) => {
    const at = Math.min(Math.max(Math.trunc(index), 0), r.path.length);
    const path = r.path.slice();
    path.splice(at, 0, { x: pos.x, y: pos.y });
    const patch: Partial<RouteAction> = { path };
    if (r.smooth) {
      const smooth = r.path.map((_, i) => r.smooth?.[i] ?? false);
      smooth.splice(at, 0, false);
      patch.smooth = smooth;
    }
    return manual(r, patch);
  });
}

/** Delete a point; an empty path removes the route. templateId is cleared on any manual point edit. */
export function deleteRoutePoint(slotId: ID, index: number): Recipe {
  return editRoute(slotId, (r) => {
    if (!r.path[index]) return r;
    const path = r.path.filter((_, i) => i !== index);
    if (path.length === 0) return null;
    const patch: Partial<RouteAction> = { path };
    if (r.smooth) patch.smooth = r.path.map((_, i) => r.smooth?.[i] ?? false).filter((_, i) => i !== index);
    return manual(r, patch);
  });
}

export function toggleRoutePointSmooth(slotId: ID, index: number): Recipe {
  return editRoute(slotId, (r) => {
    if (!r.path[index]) return r;
    const smooth = r.path.map((_, i) => r.smooth?.[i] ?? false);
    smooth[index] = !smooth[index];
    return manual(r, { smooth });
  });
}

export function setRouteEndBehavior(slotId: ID, endBehavior: 'stop' | 'continue'): Recipe {
  return editRoute(slotId, (r) => (r.endBehavior === endBehavior ? r : { ...r, endBehavior }));
}

/**
 * FR-OFF-03: replace the slot's route with buildRoute(templateId, start, { depth, outward }) where
 * outward = outwardSign(start, strong side of the play: play.strength left → 'left', else 'right').
 */
export function applyRouteTemplate(slotId: ID, templateId: RouteTemplateId, depth?: number): Recipe {
  return (play) =>
    replaceSlot(play, slotId, (slot) => {
      const start = slotRouteStart(slot);
      const outward = outwardSign(start, play.strength === 'left' ? 'left' : 'right');
      return putRoute(slot, buildRoute(templateId, start, { depth, outward }));
    });
}

// ---------- motion, option, delay (FR-OFF-07/08/09) ----------

function slotRouteStart(slot: PlayerSlot): Point {
  const motion = slot.actions.find((a): a is MotionAction => a.type === 'motion');
  return motion?.path[motion.path.length - 1] ?? slot.start;
}

/** Where the slot's route begins: the end of its pre-snap motion, else its start (D-08). */
export function routeStart(play: Play, slotId: ID): Point {
  const slot = play.players.find((s) => s.id === slotId);
  return slot ? slotRouteStart(slot) : { x: 0, y: 0 };
}

/** The slot's motion action, if any. */
export function getMotion(play: Play, slotId: ID): MotionAction | undefined {
  return play.players
    .find((s) => s.id === slotId)
    ?.actions.find((a): a is MotionAction => a.type === 'motion');
}

/** Set (or add) the pre-snap motion; null or an empty path removes it. Duration defaults to 1 s. */
export function setMotion(slotId: ID, path: readonly Point[] | null, duration = 1): Recipe {
  return (play) =>
    replaceSlot(play, slotId, (slot) => {
      const i = slot.actions.findIndex((a) => a.type === 'motion');
      if (path === null || path.length === 0) {
        return i < 0 ? slot : { ...slot, actions: slot.actions.filter((_, j) => j !== i) };
      }
      const motion: MotionAction = { type: 'motion', path: path.map((p) => ({ x: p.x, y: p.y })), duration };
      const actions = slot.actions.slice();
      if (i < 0) actions.push(motion);
      else actions[i] = motion;
      return { ...slot, actions };
    });
}

export function setMotionDuration(slotId: ID, duration: number): Recipe {
  return (play) =>
    replaceSlot(play, slotId, (slot) => {
      const i = slot.actions.findIndex((a) => a.type === 'motion');
      const cur = slot.actions[i];
      if (cur?.type !== 'motion' || cur.duration === duration) return slot;
      const actions = slot.actions.slice();
      actions[i] = { ...cur, duration };
      return { ...slot, actions };
    });
}

/** Seconds the route waits after the snap; 0 (or less) removes the field. */
export function setRouteDelay(slotId: ID, delay: number): Recipe {
  return editRoute(slotId, (r) => {
    if (delay <= 0) {
      if (r.delay === undefined) return r;
      const next: RouteAction = { ...r };
      delete next.delay;
      return next;
    }
    return r.delay === delay ? r : { ...r, delay };
  });
}

/** Replace the slot's route/option action with an option route; null removes the option action only. */
export function setOptionRoute(
  slotId: ID,
  option: Pick<OptionRouteAction, 'stem' | 'vsMan' | 'vsZone'> | null,
): Recipe {
  return (play) =>
    replaceSlot(play, slotId, (slot) => {
      if (option === null) {
        const i = slot.actions.findIndex((a) => a.type === 'option');
        return i < 0 ? slot : { ...slot, actions: slot.actions.filter((_, j) => j !== i) };
      }
      const action: OptionRouteAction = {
        type: 'option',
        stem: translate(option.stem, 0, 0),
        vsMan: translate(option.vsMan, 0, 0),
        vsZone: translate(option.vsZone, 0, 0),
        decideAtStemEnd: true,
      };
      const i = slot.actions.findIndex((a) => a.type === 'route' || a.type === 'option');
      const actions = slot.actions.slice();
      if (i < 0) actions.push(action);
      else actions[i] = action;
      return { ...slot, actions };
    });
}

// ---------- QB, progression ----------

/** Set (or add) the QB drop action. */
export function setQbDrop(slotId: ID, depth: number, style: QbDropAction['style']): Recipe {
  return (play) =>
    replaceSlot(play, slotId, (slot) => {
      const drop: QbDropAction = { type: 'qbDrop', depth, style };
      const i = slot.actions.findIndex((a) => a.type === 'qbDrop');
      const cur = slot.actions[i];
      if (cur?.type === 'qbDrop' && cur.depth === depth && cur.style === style) return slot;
      const actions = slot.actions.slice();
      if (i < 0) actions.push(drop);
      else actions[i] = drop;
      return { ...slot, actions };
    });
}

/** FR-OFF-04 click order: append slotId to progression, or remove it if already present. QB is ignored. */
export function toggleProgression(slotId: ID): Recipe {
  return (play) => {
    const slot = play.players.find((s) => s.id === slotId);
    if (!slot || slot.role === 'QB') return play;
    const cur = play.progression ?? [];
    const progression = cur.includes(slotId) ? cur.filter((id) => id !== slotId) : [...cur, slotId];
    return { ...play, progression };
  };
}

export function clearProgression(): Recipe {
  return (play) => (play.progression && play.progression.length > 0 ? { ...play, progression: [] } : play);
}

// ---------- read plan (D-22) ----------

/** Set the QB read order mode. Progression with no windows / minScore removes `readPlan` entirely. */
export function setReadMode(mode: ReadMode): Recipe {
  return (play) => {
    if ((play.readPlan?.mode ?? 'progression') === mode) return play;
    return withReadPlan(play, cleanReadPlan({ ...play.readPlan, mode }));
  };
}

/** Manual read window for a receiver (0 <= from < to <= 9); null = back to auto. Invalid input is a no-op. */
export function setReadWindow(slotId: ID, window: ReadWindowSpec | null): Recipe {
  return (play) => {
    const cur = play.readPlan?.windows?.[slotId];
    const windows = { ...play.readPlan?.windows };
    if (window === null) {
      if (!cur) return play;
      delete windows[slotId];
    } else {
      const { from, to } = window;
      if (!Number.isFinite(from) || !Number.isFinite(to) || from < 0 || to > 9 || from >= to) return play;
      if (cur && cur.from === from && cur.to === to) return play;
      windows[slotId] = { from, to };
    }
    return withReadPlan(
      play,
      cleanReadPlan({ ...play.readPlan, mode: play.readPlan?.mode ?? 'progression', windows }),
    );
  };
}

/** Minimum read score (0..100) to throw to a receiver; null = default. Invalid input is a no-op. */
export function setReadMinScore(slotId: ID, score: number | null): Recipe {
  return (play) => {
    const cur = play.readPlan?.minScore?.[slotId];
    const minScore = { ...play.readPlan?.minScore };
    if (score === null) {
      if (cur === undefined) return play;
      delete minScore[slotId];
    } else {
      if (!Number.isFinite(score) || score < 0 || score > 100 || cur === score) return play;
      minScore[slotId] = score;
    }
    return withReadPlan(
      play,
      cleanReadPlan({ ...play.readPlan, mode: play.readPlan?.mode ?? 'progression', minScore }),
    );
  };
}

// ---------- strength, meta, flip ----------

/**
 * FR-OFF-05: 'auto' → strengthOverridden = false and strength = computeStrength(alignment);
 * otherwise strength = value and strengthOverridden = true. Offense only (defense: sets strength as is).
 */
export function setStrength(value: Strength | 'auto'): Recipe {
  return (play) => {
    if (play.side !== 'offense') {
      if (value === 'auto' || value === play.strength) return play;
      return { ...play, strength: value };
    }
    if (value === 'auto') {
      const strength = computeStrength(alignedPlayers(play));
      if (strength === play.strength && play.strengthOverridden === false) return play;
      return { ...play, strength, strengthOverridden: false };
    }
    if (value === play.strength && play.strengthOverridden === true) return play;
    return { ...play, strength: value, strengthOverridden: true };
  };
}

/** Recompute offense strength from alignment unless strengthOverridden. */
export function refreshStrength(): Recipe {
  return withStrength;
}

export function setMeta(patch: Partial<Pick<Play, 'name' | 'formation' | 'tags' | 'notes'>>): Recipe {
  return (play) => {
    const next: Play = { ...play };
    let changed = false;
    if (patch.name !== undefined && patch.name !== play.name) {
      next.name = patch.name;
      changed = true;
    }
    if (patch.formation !== undefined && patch.formation !== play.formation) {
      next.formation = patch.formation;
      changed = true;
    }
    if ('notes' in patch && patch.notes !== play.notes) {
      next.notes = patch.notes;
      changed = true;
    }
    const tags = patch.tags;
    if (tags && (tags.length !== play.tags.length || tags.some((t, i) => t !== play.tags[i]))) {
      next.tags = tags.slice();
      changed = true;
    }
    return changed ? next : play;
  };
}

/** FR-FLP-02: flipPlay. */
export function flip(): Recipe {
  return (play) => flipPlay(play);
}
