/**
 * Pure defense editing recipes (FR-DEF-02..06, D-14). Same rules as ../ops.ts: return a new Play, or the
 * same object when nothing changes; never mutate; never touch updatedAt.
 * A defender has at most one coverage action (man | zone | spy) OR a rush action.
 */
import { polygonCentroid } from '@/domain/geometry';
import type {
  Action,
  FieldConfig,
  ID,
  Leverage,
  ManAction,
  Play,
  PlayerSlot,
  Point,
  ReceiverRef,
  RushAction,
  Strength,
  ZoneAction,
} from '@/domain/types';
import { zonePreset } from '@/domain/zones';
import type { Recipe } from '../ops';

/** Default QB spot a rush path aims at. */
export const DEFAULT_QB_SPOT: Point = { x: 0, y: -5 };

// ---------- helpers ----------

const copyPoint = (p: Point): Point => ({ x: p.x, y: p.y });

/** Structural equality for small JSON-like objects (key order is stable: slots are built by spreading). */
function same(a: unknown, b: unknown): boolean {
  return JSON.stringify(a) === JSON.stringify(b);
}

/** man | zone | spy | rush: the actions a defender holds at most one of. */
function isAssignment(a: Action): boolean {
  return a.type === 'man' || a.type === 'zone' || a.type === 'spy' || a.type === 'rush';
}

function replaceSlot(play: Play, slotId: ID, fn: (s: PlayerSlot) => PlayerSlot): Play {
  const i = play.players.findIndex((s) => s.id === slotId);
  const cur = play.players[i];
  if (i < 0 || !cur) return play;
  const next = fn(cur);
  if (next === cur || same(next, cur)) return play;
  const players = play.players.slice();
  players[i] = next;
  return { ...play, players };
}

/** Replace the slot's coverage/rush action with `action` (null removes it); other action types are kept. */
function withAssignment(slot: PlayerSlot, action: Action | null, role: PlayerSlot['role']): PlayerSlot {
  const actions = slot.actions.filter((a) => !isAssignment(a));
  if (action) actions.push(action);
  return { ...slot, role, actions };
}

/** Role after taking a coverage assignment (or none): a rusher becomes an LB. */
const coverageRole = (slot: PlayerSlot): PlayerSlot['role'] => (slot.role === 'R' ? 'LB' : slot.role);

/** Edit the slot's first action of `type`; `fn` returns the new action (or the same one for a no-op). */
function editAction<T extends Action['type']>(
  slotId: ID,
  type: T,
  fn: (a: Extract<Action, { type: T }>) => Extract<Action, { type: T }>,
): Recipe {
  return (play) =>
    replaceSlot(play, slotId, (slot) => {
      const i = slot.actions.findIndex((a) => a.type === type);
      const cur = slot.actions[i] as Extract<Action, { type: T }> | undefined;
      if (i < 0 || !cur) return slot;
      const next = fn(cur);
      if (next === cur) return slot;
      const actions = slot.actions.slice();
      actions[i] = next;
      return { ...slot, actions };
    });
}

function manAction(target: ReceiverRef, technique: ManAction['technique'], cushion?: number): ManAction {
  const t: ReceiverRef = { ...target };
  if (technique === 'cushion') return { type: 'man', target: t, technique, cushion: cushion ?? 5 };
  return { type: 'man', target: t, technique };
}

// ---------- recipes ----------

/**
 * FR-DEF-02: replace the slot's coverage/rush with `{type:'man', target, technique, cushion?}`
 * (technique default 'trail'; cushion default 5 when technique is 'cushion'). A slot with role 'R'
 * becomes role 'LB'.
 */
export function setMan(
  slotId: ID,
  target: ReceiverRef,
  technique?: ManAction['technique'],
  cushion?: number,
): Recipe {
  return (play) =>
    replaceSlot(play, slotId, (slot) =>
      withAssignment(slot, manAction(target, technique ?? 'trail', cushion), coverageRole(slot)),
    );
}

/** Change technique/cushion of an existing man action (no-op without one). */
export function setManTechnique(slotId: ID, technique: ManAction['technique'], cushion?: number): Recipe {
  return editAction(slotId, 'man', (m) => {
    const next = manAction(m.target, technique, cushion ?? m.cushion);
    return same(next, m) ? m : next;
  });
}

/**
 * FR-DEF-03: replace coverage/rush with a zone. dropPoint defaults to the preset's (zonePreset) or the
 * polygon centroid. Role 'R' becomes 'LB'.
 */
export function setZone(slotId: ID, zone: ZoneAction['zone'], field: FieldConfig, dropPoint?: Point): Recipe {
  return (play) =>
    replaceSlot(play, slotId, (slot) => {
      const stored: ZoneAction['zone'] =
        typeof zone === 'string' ? zone : { polygon: zone.polygon.map(copyPoint) };
      const drop =
        dropPoint ??
        (typeof zone === 'string' ? zonePreset(zone, field).dropPoint : polygonCentroid(zone.polygon));
      const action: ZoneAction = { type: 'zone', zone: stored, dropPoint: copyPoint(drop) };
      return withAssignment(slot, action, coverageRole(slot));
    });
}

/** Move the zone drop point (FR-DEF-03 "Kéo drop point"). */
export function setDropPoint(slotId: ID, p: Point): Recipe {
  return editAction(slotId, 'zone', (z) =>
    z.dropPoint.x === p.x && z.dropPoint.y === p.y ? z : { ...z, dropPoint: copyPoint(p) },
  );
}

/**
 * FR-DEF-04: make the slot a designated rusher: role 'R', leverage removed, actions = [rush with
 * path [qbSpot ?? DEFAULT_QB_SPOT], delay 0]. Allowed beyond maxRushers (validate warns).
 */
export function setRush(slotId: ID, qbSpot?: Point): Recipe {
  return (play) =>
    replaceSlot(play, slotId, (slot) => {
      const action: RushAction = { type: 'rush', path: [copyPoint(qbSpot ?? DEFAULT_QB_SPOT)], delay: 0 };
      const next = withAssignment(slot, action, 'R');
      delete next.leverage;
      return next;
    });
}

/** Replace the rush path (editable, FR-DEF-04). */
export function setRushPath(slotId: ID, path: Point[]): Recipe {
  return editAction(slotId, 'rush', (r) => (same(r.path, path) ? r : { ...r, path: path.map(copyPoint) }));
}

/** Remove the slot's coverage or rush action; role 'R' becomes 'LB'. */
export function clearAssignment(slotId: ID): Recipe {
  return (play) => replaceSlot(play, slotId, (slot) => withAssignment(slot, null, coverageRole(slot)));
}

/** FR-DEF-05. undefined removes it. */
export function setLeverage(slotId: ID, leverage: Leverage | undefined): Recipe {
  return (play) =>
    replaceSlot(play, slotId, (slot) => {
      if (slot.leverage === leverage) return slot;
      const next: PlayerSlot = { ...slot };
      if (leverage === undefined) delete next.leverage;
      else next.leverage = leverage;
      return next;
    });
}

/** FR-DEF-06. */
export function setAlignTo(alignTo: 'ball' | 'strength'): Recipe {
  return (play) => (play.alignTo === alignTo ? play : { ...play, alignTo });
}

/** FR-DEF-01: Play.strength = strength of the ghost at design time. */
export function setDesignStrength(strength: Strength): Recipe {
  return (play) => (play.strength === strength ? play : { ...play, strength });
}
