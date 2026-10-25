/**
 * Strength, receiver numbering (#1/#2/#3 from outside in) and ReceiverRef binding
 * (SRS §8.2 steps 2–3, FR-OFF-05, D-09). Pure.
 */
import { notImplemented } from './notImplemented';
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

/** |x| < 0.25: on the ball (the C). */
export function isOnBall(p: AlignedPlayer): boolean {
  return notImplemented(`isOnBall ${p.id}`);
}

/** RB with |x| < 3 and y < −2. */
export function isBackfieldRb(p: AlignedPlayer): boolean {
  return notImplemented(`isBackfieldRb ${p.id}`);
}

/** Eligible receiver for numbering: offense role, not QB, not a backfield RB. */
export function isEligibleReceiver(p: AlignedPlayer): boolean {
  return notImplemented(`isEligibleReceiver ${p.id}`);
}

/**
 * FR-OFF-05: count eligible receivers on each side of the ball, excluding QB, players on the ball
 * (|x| < 0.25) and backfield RBs. More on the right → 'right', more on the left → 'left', equal → 'balanced'.
 */
export function computeStrength(players: readonly AlignedPlayer[]): Strength {
  return notImplemented(`computeStrength ${players.length}`);
}

/**
 * D-09: `left`/`right` when strength says so. For `balanced`: larger Σ|x| of the side's counted receivers,
 * then the side of a backfield RB (x sign, x = 0 → none), then 'right'.
 */
export function strongSideOf(players: readonly AlignedPlayer[], strength: Strength): LateralSide {
  return notImplemented(`strongSideOf ${players.length}${strength}`);
}

/**
 * D-09 numbering: per side sort eligible receivers (not on the ball) by |x| descending → #1, #2, #3.
 * Ties on |x| → deeper (smaller y) first, then id. A receiver on the ball (the C) is appended as the
 * innermost receiver of the strong side. Max 3 per side; extras get no number.
 * `strength` defaults to computeStrength(players).
 */
export function numberReceivers(players: readonly AlignedPlayer[], strength?: Strength): Numbering {
  return notImplemented(`numberReceivers ${players.length}${String(strength)}`);
}

/**
 * Bind a ref to a slot id. Number refs → numbering lists; role refs: 'QB' → qbId, 'C' → cId,
 * 'RB' → rbId, else any player with role RB. null when not found.
 */
export function resolveReceiverRef(ref: ReceiverRef, n: Numbering): ID | null {
  return notImplemented(`resolveReceiverRef ${ref.kind}${String(n)}`);
}

/**
 * Ref to store for a clicked receiver (FR-DEF-02): its number ref if numbered, else a role ref for
 * QB / C / RB, else null.
 */
export function refForPlayer(id: ID, n: Numbering, players: readonly AlignedPlayer[]): ReceiverRef | null {
  return notImplemented(`refForPlayer ${id}${String(n)}${players.length}`);
}

export function sameRef(a: ReceiverRef, b: ReceiverRef): boolean {
  return notImplemented(`sameRef ${a.kind}${b.kind}`);
}

/** Alignment at the snap: each slot's start (motion end in phase 5). */
export function alignedPlayers(play: Play): AlignedPlayer[] {
  return notImplemented(`alignedPlayers ${play.id}`);
}
