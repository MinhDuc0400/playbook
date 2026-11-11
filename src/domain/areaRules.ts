/**
 * Area rules (D-48): pattern-match rules on alignment lanes, and the Bunch Killer (Bangkok) templates built
 * from them. Pure.
 */
import { computeLanes, laneSpan, type Lanes } from './areaLanes';
import { sidelineBounds } from './field';
import type {
  FieldConfig,
  ID,
  MatchRule,
  Play,
  PlayerSlot,
  Point,
  ReceiverRef,
  RuleReceiver,
  ZoneAction,
} from './types';
import { zonePolygon } from './zones';

/** Lane rectangle depth (yd past the LOS), as the D-40 base zone. */
export const LANE_ZONE_DEPTH = 10;

/** Rules the area coordinator runs: "vào khu vực của" (D-48), "chưa ai nhận" (D-53), "Đọc 2 người" (D-54). */
export function isAreaRule(r: MatchRule): boolean {
  return r.when.event === 'entersArea' || r.when.event === 'unclaimed' || r.when.event === 'pairRead';
}

export function isReceiverRef(r: RuleReceiver): r is ReceiverRef {
  return r.kind === 'number' || r.kind === 'role';
}

/** A slot that covers (no rush / man / spy action) can own a lane. */
export function canCover(slot: PlayerSlot): boolean {
  return !slot.actions.some((a) => a.type === 'rush' || a.type === 'man' || a.type === 'spy');
}

function areaTeammates(slot: PlayerSlot): ID[] {
  const out: ID[] = [];
  for (const r of slot.matchRules ?? []) {
    if (isAreaRule(r) && r.when.area?.kind === 'teammate') out.push(r.when.area.slotId);
  }
  return out;
}

/** Slots that cover and either hold an area rule or are named by another slot's area rule (slot order). */
export function laneMemberIds(slots: readonly PlayerSlot[]): ID[] {
  const named = new Set(slots.filter(canCover).flatMap(areaTeammates));
  return slots
    .filter((s) => canCover(s) && ((s.matchRules ?? []).some(isAreaRule) || named.has(s.id)))
    .map((s) => s.id);
}

export function computeRuleLanes(slots: readonly PlayerSlot[]): Lanes | null {
  const members = new Set(laneMemberIds(slots));
  return computeLanes(slots, (s) => members.has(s.id));
}

/** Bunch Killer corner: Khi [Người thứ 1] [vào khu vực của] [tôi] thì [Man người đó]. */
export function cornerRules(idGen: () => ID): MatchRule[] {
  return [
    {
      id: idGen(),
      priority: 0,
      when: { receiver: { kind: 'nth', n: 1 }, event: 'entersArea', area: { kind: 'self' } },
      then: { type: 'manTrigger' },
    },
  ];
}

/** Template rule ids for a slot: `<slot>-bk`, then `<slot>-bk2`, `<slot>-bk3`… (unique per slot). */
export function templateRuleIds(slotId: ID): () => ID {
  let i = 0;
  return () => (++i === 1 ? `${slotId}-bk` : `${slotId}-bk${i}`);
}

/** D-54 default depth (yd) at which "Đọc 2 người" calls both verticals (or both short). */
export const PAIR_READ_DEPTH = 5;

/**
 * D-54 "Đọc 2 người" (LB/S): Khi [Người 1] [đọc 2 người với] [Người 2], corner bên cạnh, sâu 5 thì Man người đó.
 */
export function pairReadRules(
  idGen: () => ID,
  first: ReceiverRef,
  second: ReceiverRef,
  cornerId: ID | null,
  minDepth = PAIR_READ_DEPTH,
): MatchRule[] {
  return [
    {
      id: idGen(),
      priority: 0,
      when: {
        receiver: first,
        event: 'pairRead',
        second,
        area: { kind: 'teammate', slotId: cornerId ?? '' },
        minDepth,
      },
      then: { type: 'manTrigger' },
    },
  ];
}

/** D-53 default depth (yd) past which a receiver nobody took is a leftover. */
export const LEFTOVER_DEPTH = 5;

/** D-53: Khi [Bất kỳ] [chưa ai nhận] [sâu ≥ 5] thì [Man người đó]. */
export function leftoverRule(idGen: () => ID, priority = 0, minDepth = LEFTOVER_DEPTH): MatchRule {
  return {
    id: idGen(),
    priority,
    when: { receiver: { kind: 'any' }, event: 'unclaimed', minDepth },
    then: { type: 'manTrigger' },
  };
}

/**
 * Bunch Killer inside: Khi [Người thứ 2] [vào khu vực của] [teammate] thì [Man người đó]; then (D-53) "pick
 * whoever is left": Khi [Bất kỳ] [chưa ai nhận] [sâu ≥ 5] thì [Man người đó].
 */
export function insideRules(idGen: () => ID, teammateId: ID | null): MatchRule[] {
  return [
    {
      id: idGen(),
      priority: 0,
      when: {
        receiver: { kind: 'nth', n: 2 },
        event: 'entersArea',
        area: { kind: 'teammate', slotId: teammateId ?? '' },
      },
      then: { type: 'manTrigger' },
    },
    leftoverRule(idGen, 1),
  ];
}

/** D-52 default backpedal at the snap (yd). */
export const BACKPEDAL_YARDS = 3;

/** D-52: Khi [bóng snap] thì [Lùi 3 yd]. */
export function snapBackpedalRule(idGen: () => ID, yards = BACKPEDAL_YARDS): MatchRule {
  return {
    id: idGen(),
    priority: 0,
    when: { receiver: { kind: 'any' }, event: 'snap' },
    then: { type: 'backpedal', yards },
  };
}

export function isSnapBackpedal(r: MatchRule): boolean {
  return r.when.event === 'snap' && r.then.type === 'backpedal';
}

export function hasSnapBackpedal(rules: readonly MatchRule[] | undefined): boolean {
  return (rules ?? []).some(isSnapBackpedal);
}

/**
 * D-52: rules (run order) with the snap backpedal first (`on`) or without it. Priorities re-packed 0..n-1;
 * the same array when nothing changes.
 */
export function withSnapBackpedal(rules: readonly MatchRule[], on: boolean, idGen: () => ID): MatchRule[] {
  const ordered = rules.slice().sort((a, b) => a.priority - b.priority);
  if (on === hasSnapBackpedal(ordered)) return rules as MatchRule[];
  const rest = ordered.filter((r) => !isSnapBackpedal(r));
  const next = on ? [snapBackpedalRule(idGen), ...rest] : rest;
  return next.map((r, i) => (r.priority === i ? r : { ...r, priority: i }));
}

/**
 * Which Bunch Killer template the rules are, by structure only (never ids or the teammate). A D-52 snap
 * backpedal next to it does not change the template.
 */
export function matchTemplate(all: readonly MatchRule[] | undefined): 'corner' | 'inside' | 'pair' | null {
  const rules = all?.filter((r) => !isSnapBackpedal(r));
  if (!rules || rules.length === 0 || rules.length > 2) return null;
  // D-54: one "Đọc 2 người" rule (its people, corner and depth may be edited).
  if (rules.length === 1 && rules[0]!.when.event === 'pairRead' && rules[0]!.then.type === 'manTrigger') {
    return rules[0]!.when.beforeTime === undefined ? 'pair' : null;
  }
  const { when, then } = rules[0]!;
  if (then.type !== 'manTrigger' || when.event !== 'entersArea' || when.receiver.kind !== 'nth') return null;
  if (when.minDepth !== undefined || when.beforeTime !== undefined) return null;
  if (rules.length === 1) return when.receiver.n === 1 && when.area?.kind === 'self' ? 'corner' : null;
  // D-53: the inside template is the second-out rule plus the leftover rule (its depth may be edited).
  const left = rules[1]!;
  const isLeftover =
    left.when.event === 'unclaimed' &&
    left.when.receiver.kind === 'any' &&
    left.when.beforeTime === undefined &&
    left.then.type === 'manTrigger';
  return when.receiver.n === 2 && when.area?.kind === 'teammate' && isLeftover ? 'inside' : null;
}

/** Lane members plus `slotId`, left → right. */
function lanesWith(slots: readonly PlayerSlot[], slotId: ID): Lanes | null {
  const members = new Set(laneMemberIds(slots));
  members.add(slotId);
  return computeLanes(slots, (s) => members.has(s.id));
}

/**
 * Teammate for the Inside template: the neighbouring lane member holding the corner rule (left first), else
 * the neighbour on the side of the nearer sideline, else null.
 */
export function insideTeammate(slots: readonly PlayerSlot[], slotId: ID): ID | null {
  const lanes = lanesWith(slots, slotId);
  const self = slots.find((s) => s.id === slotId);
  if (!lanes || !self) return null;
  const i = lanes.order.indexOf(slotId);
  const left = lanes.order[i - 1];
  const right = lanes.order[i + 1];
  const byId = new Map(slots.map((s) => [s.id, s]));
  const isCorner = (id: ID | undefined) =>
    id !== undefined && matchTemplate(byId.get(id)?.matchRules) === 'corner';
  if (isCorner(left)) return left!;
  if (isCorner(right)) return right!;
  const toward = self.start.x < 0 ? left : right;
  return toward ?? left ?? right ?? null;
}

/** The lane of `slotId` (lane members plus it) as a rectangle y 0..LANE_ZONE_DEPTH; ball centred. */
export function laneRectangle(slots: readonly PlayerSlot[], slotId: ID, field: FieldConfig): Point[] {
  const lanes = lanesWith(slots, slotId);
  const { minX, maxX } = sidelineBounds(field, { x: 0, yardLine: field.length / 2 });
  const i = lanes ? lanes.order.indexOf(slotId) : -1;
  const [left, right] = lanes && i >= 0 ? laneSpan(lanes, i, minX, maxX) : [minX, maxX];
  return [
    { x: left, y: 0 },
    { x: right, y: 0 },
    { x: right, y: LANE_ZONE_DEPTH },
    { x: left, y: LANE_ZONE_DEPTH },
  ];
}

/** What a zone action covers: its polygon and drop point. */
export interface ZoneShape {
  polygon: Point[];
  dropPoint: Point;
}

/**
 * D-51: polygon and drop point of a slot's zone action. 'lane' is the slot's live lane rectangle (its edges are
 * the dashed lane lines, so it follows any lane member that moves), dropped on the defender, who holds his spot
 * (D-47). Presets and drawn polygons keep their own shape.
 */
export function zoneShapeOf(
  action: ZoneAction,
  slotId: ID,
  slots: readonly PlayerSlot[],
  field: FieldConfig,
): ZoneShape {
  if (action.zone === 'lane') {
    const start = slots.find((s) => s.id === slotId)?.start ?? action.dropPoint;
    return { polygon: laneRectangle(slots, slotId, field), dropPoint: { x: start.x, y: start.y } };
  }
  return {
    polygon: zonePolygon(action.zone, field, action.offset),
    dropPoint: { x: action.dropPoint.x, y: action.dropPoint.y },
  };
}

/**
 * D-51: a lane member's area for "vào khu vực của" rules when it is his zone outline (a preset or drawn zone),
 * else null: no zone, or the live 'lane' zone, means his lane between the midlines.
 */
export function zoneArea(slot: PlayerSlot, slots: readonly PlayerSlot[], field: FieldConfig): Point[] | null {
  const zone = slot.actions.find((a): a is ZoneAction => a.type === 'zone');
  if (!zone || zone.zone === 'lane') return null;
  return zoneShapeOf(zone, slot.id, slots, field).polygon;
}

const EPS = 1e-6;

/** An axis-aligned 4-point rectangle LANE_ZONE_DEPTH tall: a lane rectangle frozen by D-48 (maybe dragged since). */
function isFrozenLane(zone: ZoneAction['zone']): boolean {
  if (typeof zone === 'string' || zone.polygon.length !== 4) return false;
  const xs = [...new Set(zone.polygon.map((p) => p.x))];
  const ys = [...new Set(zone.polygon.map((p) => p.y))];
  return xs.length === 2 && ys.length === 2 && Math.abs(Math.abs(ys[0]! - ys[1]!) - LANE_ZONE_DEPTH) < EPS;
}

/**
 * D-51 conversion: a lane member whose zone is a frozen lane rectangle gets the live 'lane' zone. Returns the
 * same object when nothing changes.
 */
export function liveLaneZones(play: Play): Play {
  const members = new Set(laneMemberIds(play.players));
  let changed = false;
  const players = play.players.map((slot) => {
    if (!members.has(slot.id)) return slot;
    const i = slot.actions.findIndex((a) => a.type === 'zone' && isFrozenLane(a.zone));
    if (i < 0) return slot;
    changed = true;
    const actions = [...slot.actions];
    actions[i] = { type: 'zone', zone: 'lane', dropPoint: { x: slot.start.x, y: slot.start.y } };
    return { ...slot, actions };
  });
  return changed ? { ...play, players } : play;
}
