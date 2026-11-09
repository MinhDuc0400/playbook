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

export function isAreaRule(r: MatchRule): boolean {
  return r.when.event === 'entersArea';
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

/** Bunch Killer inside: Khi [Người thứ 2] [vào khu vực của] [teammate] thì [Man người đó]. */
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
  ];
}

/** Which Bunch Killer template the rules are, by structure only (never ids or the teammate). */
export function matchTemplate(rules: readonly MatchRule[] | undefined): 'corner' | 'inside' | null {
  if (!rules || rules.length !== 1) return null;
  const { when, then } = rules[0]!;
  if (then.type !== 'manTrigger' || when.event !== 'entersArea' || when.receiver.kind !== 'nth') return null;
  if (when.minDepth !== undefined || when.beforeTime !== undefined) return null;
  if (when.receiver.n === 1 && when.area?.kind === 'self') return 'corner';
  if (when.receiver.n === 2 && when.area?.kind === 'teammate') return 'inside';
  return null;
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
