import { describe, expect, it } from 'vitest';
import { createDefaultFields } from '../field';
import { pointInPolygon } from '../geometry';
import { ZONE_PRESET_IDS, type Point, type ZonePresetId } from '../types';
import { hookZoneForX, isDeepZone, zoneKind, zonePolygon, zonePreset, zoneSide } from '../zones';

const fields = createDefaultFields();
const F5 = fields['5v5'];
const F7 = fields['7v7'];

/** [x0, x1, y0, y1, dropX, dropY] for W = 30 (SRS table). */
const TABLE: Record<ZonePresetId, [number, number, number, number, number, number]> = {
  'deep-half-L': [-15, 0, 10, 30, -7.5, 15],
  'deep-half-R': [0, 15, 10, 30, 7.5, 15],
  'deep-third-L': [-15, -5, 10, 30, -10, 15],
  'deep-third-M': [-5, 5, 10, 30, 0, 16],
  'deep-third-R': [5, 15, 10, 30, 10, 15],
  'deep-middle': [-7, 7, 10, 30, 0, 14],
  'flat-L': [-15, -8, 0, 7, -10, 5],
  'flat-R': [8, 15, 0, 7, 10, 5],
  'hook-L': [-8, -1, 3, 10, -4, 7],
  'hook-R': [1, 8, 3, 10, 4, 7],
  'hook-M': [-4, 4, 3, 10, 0, 6],
  'curl-flat-L': [-15, -4, 0, 12, -9, 7],
  'curl-flat-R': [4, 15, 0, 12, 9, 7],
};

describe('zonePreset (FR-DEF-03)', () => {
  it('table covers every preset id', () => {
    expect(Object.keys(TABLE).sort()).toEqual([...ZONE_PRESET_IDS].sort());
  });

  it.each(ZONE_PRESET_IDS)('%s matches the SRS table on 5v5', (id) => {
    const [x0, x1, y0, y1, dx, dy] = TABLE[id];
    const z = zonePreset(id, F5);
    expect(z.polygon).toEqual([
      { x: x0, y: y0 },
      { x: x1, y: y0 },
      { x: x1, y: y1 },
      { x: x0, y: y1 },
    ]);
    expect(z.dropPoint).toEqual({ x: dx, y: dy });
    expect(pointInPolygon(z.dropPoint, z.polygon)).toBe(true);
  });

  it.each(ZONE_PRESET_IDS)('%s scales x by 4/3 on 7v7 and keeps y', (id) => {
    const a = zonePreset(id, F5);
    const b = zonePreset(id, F7);
    b.polygon.forEach((p, i) => {
      const q = a.polygon[i] as Point;
      expect(p.x).toBeCloseTo((q.x * 4) / 3, 9);
      expect(p.y).toBe(q.y);
    });
    expect(b.dropPoint.x).toBeCloseTo((a.dropPoint.x * 4) / 3, 9);
    expect(b.dropPoint.y).toBe(a.dropPoint.y);
    expect(pointInPolygon(b.dropPoint, b.polygon)).toBe(true);
  });

  it('polygons are counter-clockwise from the bottom-left corner', () => {
    for (const id of ZONE_PRESET_IDS) {
      const [p0, p1, p2, p3] = zonePreset(id, F5).polygon as [Point, Point, Point, Point];
      expect(p0.x).toBeLessThan(p1.x);
      expect(p0.y).toBe(p1.y);
      expect(p2.y).toBeGreaterThan(p1.y);
      expect(p3.x).toBe(p0.x);
    }
  });

  it('-L and -R presets mirror each other', () => {
    const pairs: [ZonePresetId, ZonePresetId][] = [
      ['deep-half-L', 'deep-half-R'],
      ['deep-third-L', 'deep-third-R'],
      ['flat-L', 'flat-R'],
      ['hook-L', 'hook-R'],
      ['curl-flat-L', 'curl-flat-R'],
    ];
    const xs = (pts: Point[]): number[] => pts.map((p) => p.x + 0).sort((a, b) => a - b);
    for (const field of [F5, F7]) {
      for (const [l, r] of pairs) {
        const zl = zonePreset(l, field);
        const zr = zonePreset(r, field);
        expect(xs(zr.polygon)).toEqual(xs(zl.polygon.map((p) => ({ x: -p.x + 0, y: p.y }))));
        expect(zr.dropPoint.x).toBeCloseTo(-zl.dropPoint.x, 9);
        expect(zr.dropPoint.y).toBe(zl.dropPoint.y);
      }
    }
  });

  it('never produces -0', () => {
    for (const id of ZONE_PRESET_IDS) {
      const z = zonePreset(id, F5);
      for (const p of [...z.polygon, z.dropPoint]) {
        expect(Object.is(p.x, -0)).toBe(false);
        expect(Object.is(p.y, -0)).toBe(false);
      }
    }
  });

  it('returns fresh objects each call', () => {
    const a = zonePreset('hook-M', F5);
    a.polygon[0] = { x: 99, y: 99 };
    expect(zonePreset('hook-M', F5).polygon[0]).toEqual({ x: -4, y: 3 });
  });
});

describe('zonePolygon', () => {
  it('preset → zonePreset polygon', () => {
    expect(zonePolygon('flat-R', F5)).toEqual(zonePreset('flat-R', F5).polygon);
    expect(zonePolygon('flat-R', F7)).toEqual(zonePreset('flat-R', F7).polygon);
  });

  it('custom → copy of its polygon', () => {
    const polygon = [
      { x: 0, y: 0 },
      { x: 3, y: 0 },
      { x: 3, y: 4 },
    ];
    const out = zonePolygon({ polygon }, F5);
    expect(out).toEqual(polygon);
    expect(out).not.toBe(polygon);
    expect(out[0]).not.toBe(polygon[0]);
  });
});

describe('zoneKind / isDeepZone (§8.6)', () => {
  const expected: Record<ZonePresetId, ReturnType<typeof zoneKind>> = {
    'deep-half-L': 'deep',
    'deep-half-R': 'deep',
    'deep-third-L': 'deep',
    'deep-third-M': 'deep',
    'deep-third-R': 'deep',
    'deep-middle': 'deep',
    'flat-L': 'flat',
    'flat-R': 'flat',
    'hook-L': 'hook',
    'hook-R': 'hook',
    'hook-M': 'hook',
    'curl-flat-L': 'curl',
    'curl-flat-R': 'curl',
  };

  it.each(ZONE_PRESET_IDS)('%s', (id) => {
    expect(zoneKind(id)).toBe(expected[id]);
    expect(isDeepZone(id)).toBe(expected[id] === 'deep');
  });

  it('custom polygon: deep when min y >= 8, else custom', () => {
    const deep = {
      polygon: [
        { x: 0, y: 8 },
        { x: 5, y: 8 },
        { x: 5, y: 20 },
      ],
    };
    const shallow = {
      polygon: [
        { x: 0, y: 7.9 },
        { x: 5, y: 8 },
        { x: 5, y: 20 },
      ],
    };
    expect(zoneKind(deep)).toBe('deep');
    expect(isDeepZone(deep)).toBe(true);
    expect(zoneKind(shallow)).toBe('custom');
    expect(isDeepZone(shallow)).toBe(false);
  });
});

describe('hookZoneForX (§8.2.3)', () => {
  it('picks the hook zone on the same side', () => {
    expect(hookZoneForX(-10)).toBe('hook-L');
    expect(hookZoneForX(-0.26)).toBe('hook-L');
    expect(hookZoneForX(-0.25)).toBe('hook-M');
    expect(hookZoneForX(0)).toBe('hook-M');
    expect(hookZoneForX(0.25)).toBe('hook-M');
    expect(hookZoneForX(0.26)).toBe('hook-R');
    expect(hookZoneForX(12)).toBe('hook-R');
  });
});

describe('zoneSide', () => {
  it('maps -L/-R to sides and middle zones to null', () => {
    expect(zoneSide('deep-half-L')).toBe('left');
    expect(zoneSide('curl-flat-R')).toBe('right');
    expect(zoneSide('hook-M')).toBeNull();
    expect(zoneSide('deep-third-M')).toBeNull();
    expect(zoneSide('deep-middle')).toBeNull();
  });
});
