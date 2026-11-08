/**
 * Area-match claim tracker (D-40, "Bunch Killer"). Pure.
 *
 * Every area defender runs one tracker on its OWN delayed perception and computes the claims of ALL area
 * defenders with the same rules, so it knows what its teammates took without communication (NFR-ARC-06).
 * Per update (perception time t, offense non-QB players seen):
 * 1. Log: after the snap (t > 0), a receiver seen in a lane it has not been logged in is appended to that
 *    lane's entry list; same-tick entries ordered nearer-the-sideline first.
 * 2. Corner first-in: an unclaimed corner takes the first unclaimed receiver in its lane's entry list. Nobody
 *    in its lane → no man: it holds its spot however long it takes (D-47; there is no squeeze).
 * 3. Inside second-out: an unclaimed inside defender whose outside (corner) lane's corner has a man takes the
 *    first unclaimed receiver in that lane's entry list other than the corner's man.
 * Claims are sticky. The view of "self" lists every receiver claimed by someone else in `ignore`.
 */
import { laneOf, type AreaLanes } from '@/domain/areaLanes';
import type { ID } from '@/domain/types';
import type { PerceivedPlayer } from './types';

export type ClaimReason = 'first' | 'second';

export interface ClaimView {
  manId: ID | null;
  reason: ClaimReason | null;
  ignore: ReadonlySet<ID>;
}

export interface ClaimTracker {
  /** Feed one perception (offense non-QB players only); returns this defender's view. */
  update(t: number, seen: readonly PerceivedPlayer[]): ClaimView;
}

export function createClaimTracker(opts: {
  lanes: AreaLanes;
  selfIndex: number;
  minX: number;
  maxX: number;
}): ClaimTracker {
  const { lanes, selfIndex, minX, maxX } = opts;
  const n = lanes.order.length;
  const entries: ID[][] = Array.from({ length: n }, () => []);
  const claims: ({ id: ID; reason: ClaimReason } | null)[] = Array.from({ length: n }, () => null);

  const claimed = (id: ID): boolean => claims.some((c) => c?.id === id);
  const sidelineDist = (x: number): number => Math.min(x - minX, maxX - x);

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
        if (first !== undefined) claims[c] = { id: first, reason: 'first' };
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
      };
    },
  };
}
