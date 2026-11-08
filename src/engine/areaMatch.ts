/**
 * Area-match claim tracker (D-40, "Bunch Killer"). Pure.
 *
 * Every area defender runs one tracker on its OWN delayed perception and computes the claims of ALL area
 * defenders with the same rules, so it knows what its teammates took without communication (NFR-ARC-06).
 * Per update (perception time t, offense non-QB players seen):
 * 1. Log: after the snap (t > 0), a receiver seen in a lane it has not been logged in is appended to that
 *    lane's entry list; same-tick entries ordered nearer-the-sideline first.
 * 2. Corner first-in: an unclaimed corner takes the first unclaimed receiver in its lane's entry list.
 * 3. Corner squeeze: an unclaimed corner at t ≥ squeezeAfter takes the deepest unclaimed receiver now in the
 *    adjacent inside lane that runs vertical and is ≥ SQUEEZE_MIN_DEPTH deep; none → `squeezed`.
 * 4. Inside second-out: an unclaimed inside defender whose outside (corner) lane's corner has a man takes the
 *    first unclaimed receiver in that lane's entry list other than the corner's man.
 * Claims are sticky. The view of "self" lists every receiver claimed by someone else in `ignore`.
 */
import { laneOf, type AreaLanes } from '@/domain/areaLanes';
import type { ID } from '@/domain/types';
import { VERTICAL_RATIO } from './matchRules';
import type { PerceivedPlayer } from './types';

/** Minimum depth (yd past the LOS) of a vertical receiver a squeezing corner picks up. */
export const SQUEEZE_MIN_DEPTH = 3;

export type ClaimReason = 'first' | 'second' | 'squeeze';

export interface ClaimView {
  manId: ID | null;
  reason: ClaimReason | null;
  ignore: ReadonlySet<ID>;
  squeezed: boolean;
}

export interface ClaimTracker {
  /** Feed one perception (offense non-QB players only); returns this defender's view. */
  update(t: number, seen: readonly PerceivedPlayer[]): ClaimView;
}

export function createClaimTracker(opts: {
  lanes: AreaLanes;
  selfIndex: number;
  /** Per lane index; only corners use it. */
  squeezeAfter: readonly number[];
  minX: number;
  maxX: number;
}): ClaimTracker {
  const { lanes, selfIndex, squeezeAfter, minX, maxX } = opts;
  const n = lanes.order.length;
  const entries: ID[][] = Array.from({ length: n }, () => []);
  const claims: ({ id: ID; reason: ClaimReason } | null)[] = Array.from({ length: n }, () => null);
  const squeezed: boolean[] = Array.from({ length: n }, () => false);

  const claimed = (id: ID): boolean => claims.some((c) => c?.id === id);
  const sidelineDist = (x: number): number => Math.min(x - minX, maxX - x);
  const innerLane = (c: number): number | null => {
    const i = c === 0 ? 1 : c - 1;
    return i >= 0 && i < n && i !== c ? i : null;
  };
  const isVertical = (p: PerceivedPlayer): boolean => {
    const speed = Math.hypot(p.vel.x, p.vel.y);
    return speed > 0 && p.vel.y > 0 && p.vel.y / speed >= VERTICAL_RATIO;
  };

  return {
    update(t, seen) {
      if (t > 0) {
        const fresh = seen
          .map((p) => ({ p, lane: laneOf(lanes, p.pos.x) }))
          .filter(({ p, lane }) => !entries[lane]!.includes(p.id))
          .sort((a, b) => sidelineDist(a.p.pos.x) - sidelineDist(b.p.pos.x) || (a.p.id < b.p.id ? -1 : 1));
        for (const { p, lane } of fresh) entries[lane]!.push(p.id);
      }

      for (let c = 0; c < n; c++) {
        if (lanes.roles[c] !== 'corner' || claims[c]) continue;
        const first = entries[c]!.find((id) => !claimed(id));
        if (first !== undefined) {
          claims[c] = { id: first, reason: 'first' };
          continue;
        }
        if (t < (squeezeAfter[c] ?? Infinity)) continue;
        squeezed[c] = true;
        const inner = innerLane(c);
        if (inner === null) continue;
        let best: PerceivedPlayer | undefined;
        for (const p of seen) {
          if (claimed(p.id) || laneOf(lanes, p.pos.x) !== inner) continue;
          if (p.pos.y < SQUEEZE_MIN_DEPTH || !isVertical(p)) continue;
          if (!best || p.pos.y > best.pos.y) best = p;
        }
        if (best) claims[c] = { id: best.id, reason: 'squeeze' };
      }

      for (let i = 0; i < n; i++) {
        const out = lanes.outside[i];
        if (lanes.roles[i] !== 'inside' || claims[i] || out === null || out === undefined) continue;
        const cornerMan = claims[out]?.id;
        if (cornerMan === undefined) continue;
        const second = entries[out]!.find((id) => id !== cornerMan && !claimed(id));
        if (second !== undefined) claims[i] = { id: second, reason: 'second' };
      }

      const mine = claims[selfIndex] ?? null;
      const ignore = new Set<ID>();
      claims.forEach((c, i) => {
        if (c && i !== selfIndex) ignore.add(c.id);
      });
      return {
        manId: mine?.id ?? null,
        reason: mine?.reason ?? null,
        ignore,
        squeezed: squeezed[selfIndex] ?? false,
      };
    },
  };
}
