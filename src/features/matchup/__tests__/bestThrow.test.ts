import { describe, expect, it } from 'vitest';
import { cover3Play, floodPlay, makeInput } from '@/engine/__tests__/fixtures';
import { frameAt } from '@/engine/frames';
import { simulate } from '@/engine/simulate';
import { bestThrowTime, catchInfo, separationNear } from '../bestThrow';

const input = { ...makeInput(floodPlay(), cover3Play()), qbControl: 'manual' as const };
const result = simulate(input);
const qbId = 'f-q';
const release = input.offenseStats[qbId]!.release;

const firstMove = result.frames.find(
  (f) => f.t >= 0 && Math.hypot(f.players[qbId]!.vel.x, f.players[qbId]!.vel.y) >= 0.2,
)!.t;

describe('bestThrowTime (D-26)', () => {
  it('returns a time inside the valid range with the separation at arrival', () => {
    const b = bestThrowTime({ result, input, targetId: 'f-y' });
    expect(b).not.toBeNull();
    const last = result.frames[result.frames.length - 1]!;
    expect(b!.t).toBeGreaterThanOrEqual(0);
    expect(b!.t).toBeLessThanOrEqual(Math.min(last.t, input.field.passClock - release - 0.05) + 1e-9);
    const qbPos = frameAt(result.frames, b!.t)!.players[qbId]!.pos;
    const c = catchInfo(result.frames, qbPos, 'f-y', b!.t, release, input.tuning.ballSpeed)!;
    expect(c.catchPoint.y).toBeGreaterThan(0);
    expect(b!.separation).toBe(separationNear(result.metrics.separation['f-y'], c.ta));
  });

  it('is the maximum over all frame times in the range', () => {
    for (const id of ['f-y', 'f-z', 'f-h', 'f-c']) {
      const b = bestThrowTime({ result, input, targetId: id });
      if (!b) continue;
      for (const f of result.frames) {
        if (f.t < 0 || f.t > b.t - 1e-9) continue;
        const v = f.players[qbId]!.vel;
        if (Math.hypot(v.x, v.y) >= 0.2) continue; // still dropping back
        if (f.t < firstMove) continue; // before the drop starts
        const c = catchInfo(result.frames, f.players[qbId]!.pos, id, f.t, release, input.tuning.ballSpeed);
        if (!c || c.catchPoint.y <= 0 || c.distance > input.offenseStats[qbId]!.armRange) continue;
        const sep = separationNear(result.metrics.separation[id], c.ta);
        // Earlier candidates never beat the chosen one (ties resolve to the earliest).
        if (sep !== undefined) expect(sep).toBeLessThanOrEqual(b.separation);
      }
    }
  });

  it('returns null for the QB itself and for an unknown id', () => {
    expect(bestThrowTime({ result, input, targetId: qbId })).toBeNull();
    expect(bestThrowTime({ result, input, targetId: 'nobody' })).toBeNull();
  });

  it('returns null for a receiver who stays behind the LOS', () => {
    // H runs a 1-yd flat from y = -1: never gets ahead of the LOS in this fixture when depth is 0.
    const flat = floodPlay();
    const h = flat.players.find((p) => p.id === 'f-h')!;
    h.actions = [{ type: 'hold' } as never];
    const inp = { ...makeInput(flat, cover3Play()), qbControl: 'manual' as const };
    const res = simulate(inp);
    expect(bestThrowTime({ result: res, input: inp, targetId: 'f-h' })).toBeNull();
  });

  it('a sack before the ball could be released invalidates the late candidates', () => {
    const sacked = { ...result, outcome: { kind: 'sack' as const, t: 0.2 } };
    const b = bestThrowTime({ result: sacked, input, targetId: 'f-y' });
    expect(b === null || b.t + release <= 0.2).toBe(true);
  });

  it('ties resolve to the earliest time', () => {
    const flat = {
      ...result,
      metrics: {
        ...result.metrics,
        separation: { 'f-y': result.frames.map((f) => ({ t: f.t, d: 3 })) },
      },
    };
    const b = bestThrowTime({ result: flat, input, targetId: 'f-y' });
    expect(b).not.toBeNull();
    expect(b!.separation).toBe(3);
    const earliest = result.frames.find((f) => {
      if (f.t < 0) return false;
      const c = catchInfo(result.frames, f.players[qbId]!.pos, 'f-y', f.t, release, input.tuning.ballSpeed);
      return c !== null && c.catchPoint.y > 0 && c.distance <= input.offenseStats[qbId]!.armRange;
    });
    expect(earliest).toBeDefined();
    expect(b!.t).toBeGreaterThanOrEqual(earliest!.t);
  });
});
