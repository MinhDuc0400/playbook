/**
 * Strength, receiver numbering (#1/#2/#3 from outside in) and ReceiverRef binding
 * (SRS §8.2 steps 2–3, FR-OFF-05, D-09). Pure.
 */
import type { ID, LateralSide, Play, Point, ReceiverRef, Role, Strength } from './types';

/** A player as seen at the snap (alignment only). */
export interface AlignedPlayer {
  id: ID;
  role: Role;
  pos: Point;
}

export interface Numbering {
  strength: Strength;
  /** Side that `{ side: 'strong' }` refers to. */
  strongSide: LateralSide;
  /** Receivers by number, index 0 = #1. At most 3 per side. */
  strong: ID[];
  weak: ID[];
  /** Number ref of every numbered receiver. */
  refs: Record<ID, ReceiverRef>;
  qbId?: ID;
  cId?: ID;
  /** Backfield RB (never numbered). */
  rbId?: ID;
}

const ON_BALL_X = 0.25;
const EPS = 1e-9;
const OFFENSE_ROLES: readonly Role[] = ['QB', 'C', 'WR', 'RB', 'TE'];

/** |x| < 0.25: on the ball (the C). */
export function isOnBall(p: AlignedPlayer): boolean {
  return Math.abs(p.pos.x) < ON_BALL_X;
}

/** RB with |x| < 3 and y < −2. */
export function isBackfieldRb(p: AlignedPlayer): boolean {
  return p.role === 'RB' && Math.abs(p.pos.x) < 3 && p.pos.y < -2;
}

/** Eligible receiver for numbering: offense role, not QB, not a backfield RB. */
export function isEligibleReceiver(p: AlignedPlayer): boolean {
  return OFFENSE_ROLES.includes(p.role) && p.role !== 'QB' && !isBackfieldRb(p);
}

/** Eligible receivers that are off the ball, split by side (x >= 0.25 right, x <= -0.25 left). */
function splitSides(players: readonly AlignedPlayer[]): { left: AlignedPlayer[]; right: AlignedPlayer[] } {
  const left: AlignedPlayer[] = [];
  const right: AlignedPlayer[] = [];
  for (const p of players) {
    if (!isEligibleReceiver(p) || isOnBall(p)) continue;
    (p.pos.x > 0 ? right : left).push(p);
  }
  return { left, right };
}

/**
 * FR-OFF-05: count eligible receivers on each side of the ball, excluding QB, players on the ball
 * (|x| < 0.25) and backfield RBs. More on the right → 'right', more on the left → 'left', equal → 'balanced'.
 */
export function computeStrength(players: readonly AlignedPlayer[]): Strength {
  const { left, right } = splitSides(players);
  if (right.length > left.length) return 'right';
  if (left.length > right.length) return 'left';
  return 'balanced';
}

function sumAbsX(list: readonly AlignedPlayer[]): number {
  return list.reduce((acc, p) => acc + Math.abs(p.pos.x), 0);
}

/**
 * D-09: `left`/`right` when strength says so. For `balanced`: larger Σ|x| of the side's counted receivers,
 * then the side of a backfield RB (x sign, x = 0 → none), then 'right'.
 */
export function strongSideOf(players: readonly AlignedPlayer[], strength: Strength): LateralSide {
  if (strength !== 'balanced') return strength;
  const { left, right } = splitSides(players);
  const diff = sumAbsX(right) - sumAbsX(left);
  if (diff > EPS) return 'right';
  if (diff < -EPS) return 'left';
  const rb = players.find(isBackfieldRb);
  if (rb) {
    if (rb.pos.x > 0) return 'right';
    if (rb.pos.x < 0) return 'left';
  }
  return 'right';
}

/** |x| descending, then deeper (smaller y) first, then id. Mirror-invariant. */
function byOutsideIn(a: AlignedPlayer, b: AlignedPlayer): number {
  const dx = Math.abs(b.pos.x) - Math.abs(a.pos.x);
  if (Math.abs(dx) > EPS) return dx;
  const dy = a.pos.y - b.pos.y;
  if (Math.abs(dy) > EPS) return dy;
  return a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
}

function byId(a: AlignedPlayer, b: AlignedPlayer): number {
  return a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
}

/**
 * D-09 numbering: per side sort eligible receivers (not on the ball) by |x| descending → #1, #2, #3.
 * Ties on |x| → deeper (smaller y) first, then id. A receiver on the ball (the C) is appended as the
 * innermost receiver of the strong side. Max 3 per side; extras get no number.
 * `strength` defaults to computeStrength(players).
 */
export function numberReceivers(
  players: readonly AlignedPlayer[],
  strength: Strength = computeStrength(players),
): Numbering {
  const strongSide = strongSideOf(players, strength);
  const { left, right } = splitSides(players);
  const strongList = (strongSide === 'right' ? right : left).sort(byOutsideIn);
  const weakList = (strongSide === 'right' ? left : right).sort(byOutsideIn);
  const onBall = players.filter((p) => isEligibleReceiver(p) && isOnBall(p)).sort(byId);
  strongList.push(...onBall);

  const strong = strongList.slice(0, 3).map((p) => p.id);
  const weak = weakList.slice(0, 3).map((p) => p.id);
  const refs: Record<ID, ReceiverRef> = {};
  const assign = (ids: ID[], side: 'strong' | 'weak'): void => {
    ids.forEach((id, i) => {
      refs[id] = { kind: 'number', side, number: (i + 1) as 1 | 2 | 3 };
    });
  };
  assign(strong, 'strong');
  assign(weak, 'weak');

  return {
    strength,
    strongSide,
    strong,
    weak,
    refs,
    qbId: players.find((p) => p.role === 'QB')?.id,
    cId: players.find((p) => p.role === 'C')?.id,
    rbId: players.find(isBackfieldRb)?.id,
  };
}

/**
 * Bind a ref to a slot id. Number refs → numbering lists; role refs: 'QB' → qbId, 'C' → cId,
 * 'RB' → rbId (the backfield RB). null when not found.
 */
export function resolveReceiverRef(ref: ReceiverRef, n: Numbering): ID | null {
  if (ref.kind === 'number') {
    const list = ref.side === 'strong' ? n.strong : n.weak;
    return list[ref.number - 1] ?? null;
  }
  switch (ref.role) {
    case 'QB':
      return n.qbId ?? null;
    case 'C':
      return n.cId ?? null;
    case 'RB':
      return n.rbId ?? null;
  }
}

/**
 * Ref to store for a clicked receiver (FR-DEF-02): its number ref if numbered, else a role ref for
 * QB / C / RB, else null.
 */
export function refForPlayer(id: ID, n: Numbering, players: readonly AlignedPlayer[]): ReceiverRef | null {
  const numbered = n.refs[id];
  if (numbered) return numbered;
  const role = players.find((p) => p.id === id)?.role;
  if (role === 'QB' || role === 'C' || role === 'RB') return { kind: 'role', role };
  return null;
}

export function sameRef(a: ReceiverRef, b: ReceiverRef): boolean {
  if (a.kind === 'number' && b.kind === 'number') return a.side === b.side && a.number === b.number;
  if (a.kind === 'role' && b.kind === 'role') return a.role === b.role;
  return false;
}

/** Alignment at the snap: each slot's start (motion end in phase 5). */
export function alignedPlayers(play: Play): AlignedPlayer[] {
  return play.players.map((s) => ({ id: s.id, role: s.role, pos: s.start }));
}
