/** Editor warnings panel rules (FR-ED-07). Warnings never block saving. Pure. */
import { DEFAULT_BALL_SPOT, isInsideField } from './field';
import { defaultGhostFormation } from './formations';
import { numberReceivers, resolveReceiverRef } from './numbering';
import type { AlignedPlayer, Numbering } from './numbering';
import type { BallSpot, FieldConfig, ID, Play, PlayerSlot, Point, ReceiverRef } from './types';

export type WarningCode =
  | 'too-few-players' // params: { count, expected }
  | 'too-many-players' // params: { count, expected }
  | 'route-out-of-bounds' // slotId; a path point outside sidelines or past the back of the end zone
  | 'wrong-side-of-los' // slotId; offense start y > 0, defense start y < 0
  | 'rusher-inside-rush-line' // slotId; rusher start y < field.rushLine
  | 'too-many-rushers' // params: { count, max }; rushers = slots with a 'rush' action
  | 'rush-delay' // slotId; rush.delay > 0 while field.rusherGoesOnSnap
  | 'catch-behind-los' // slotId; route/option whose every point (incl. start) has y ≤ 0
  | 'man-target-missing'; // slotId; man target ref does not resolve against the ghost formation

export interface PlayWarning {
  code: WarningCode;
  slotId?: ID;
  params?: Record<string, number | string>;
}

/** Every drawn point of the slot's motion / route / option actions (start excluded). */
function pathPoints(slot: PlayerSlot): Point[] {
  const pts: Point[] = [];
  for (const a of slot.actions) {
    if (a.type === 'motion' || a.type === 'route') pts.push(...a.path);
    else if (a.type === 'option') pts.push(...a.stem, ...a.vsMan, ...a.vsZone);
  }
  return pts;
}

/** True when a route/option action exists and the start plus all its points have y ≤ 0. */
function catchesBehindLos(slot: PlayerSlot): boolean {
  if (slot.role === 'QB') return false;
  return slot.actions.some((a) => {
    let pts: Point[];
    if (a.type === 'route') pts = a.path;
    else if (a.type === 'option') pts = [...a.stem, ...a.vsMan, ...a.vsZone];
    else return false;
    return slot.start.y <= 0 && pts.every((p) => p.y <= 0);
  });
}

function manTargets(slot: PlayerSlot): ReceiverRef[] {
  const refs: ReceiverRef[] = [];
  for (const a of slot.actions) if (a.type === 'man') refs.push(a.target);
  for (const r of slot.matchRules ?? []) if (r.then.type === 'man') refs.push(r.then.target);
  return refs;
}

/**
 * All warnings for a play. `ballSpot` defaults to DEFAULT_BALL_SPOT. `ghost` = offense alignment to bind
 * man targets against (defense only); defaults to defaultGhostFormation(play.format) players.
 * Deterministic order: play-level warnings first, then by slot order, then by code.
 */
export function validatePlay(
  play: Play,
  field: FieldConfig,
  opts?: { ballSpot?: BallSpot; ghost?: readonly AlignedPlayer[] },
): PlayWarning[] {
  const ballSpot = opts?.ballSpot ?? DEFAULT_BALL_SPOT;
  const out: PlayWarning[] = [];
  const isDefense = play.side === 'defense';

  const count = play.players.length;
  const expected = field.playersPerSide;
  if (count < expected) out.push({ code: 'too-few-players', params: { count, expected } });
  if (count > expected) out.push({ code: 'too-many-players', params: { count, expected } });

  const isRusher = (s: PlayerSlot): boolean => s.actions.some((a) => a.type === 'rush');
  const rusherCount = isDefense ? play.players.filter(isRusher).length : 0;
  if (rusherCount > field.maxRushers) {
    out.push({ code: 'too-many-rushers', params: { count: rusherCount, max: field.maxRushers } });
  }

  let numbering: Numbering | undefined;
  const ghostNumbering = (): Numbering => {
    numbering ??= numberReceivers(
      opts?.ghost ??
        defaultGhostFormation(play.format).players.map((p) => ({ id: p.label, role: p.role, pos: p.start })),
    );
    return numbering;
  };

  for (const slot of play.players) {
    const id = slot.id;
    if (pathPoints(slot).some((p) => !isInsideField(p, field, ballSpot))) {
      out.push({ code: 'route-out-of-bounds', slotId: id });
    }
    if (isDefense ? slot.start.y < 0 : slot.start.y > 0) {
      out.push({ code: 'wrong-side-of-los', slotId: id });
    }
    if (isDefense && isRusher(slot)) {
      if (slot.start.y < field.rushLine) out.push({ code: 'rusher-inside-rush-line', slotId: id });
      if (field.rusherGoesOnSnap && slot.actions.some((a) => a.type === 'rush' && (a.delay ?? 0) > 0)) {
        out.push({ code: 'rush-delay', slotId: id });
      }
    }
    if (!isDefense && catchesBehindLos(slot)) out.push({ code: 'catch-behind-los', slotId: id });
    if (isDefense) {
      const refs = manTargets(slot);
      if (refs.length > 0) {
        const n = ghostNumbering();
        if (refs.some((r) => resolveReceiverRef(r, n) === null)) {
          out.push({ code: 'man-target-missing', slotId: id });
        }
      }
    }
  }
  return out;
}
