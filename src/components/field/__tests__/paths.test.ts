import { describe, expect, it } from 'vitest';
import { arrowHeadPoints, routePathD, zigzagD } from '../paths';

const nums = (s: string): number[] => (s.match(/-?\d+(\.\d+)?/g) ?? []).map(Number);
const coordPairs = (s: string): [number, number][] => {
  const n = nums(s);
  const out: [number, number][] = [];
  for (let i = 0; i + 1 < n.length; i += 2) out.push([n[i] as number, n[i + 1] as number]);
  return out;
};

type P = [number, number];
const tri = (s: string): [P, P, P] => {
  const [a, b, c] = coordPairs(s) as [P, P, P];
  return [a, b, c];
};

describe('routePathD', () => {
  const pts = [
    { x: 0, y: 100 },
    { x: 0, y: 0 },
    { x: 100, y: 0 },
  ];

  it('all-sharp uses only M/L commands through every point', () => {
    const d = routePathD(pts, [false, false]);
    expect(d.replace(/[\d.\s-]/g, '')).toBe('ML' + 'L');
    expect(coordPairs(d)).toEqual([
      [0, 100],
      [0, 0],
      [100, 0],
    ]);
  });

  it('a smooth interior vertex emits Q and does not pass through the vertex', () => {
    const d = routePathD(pts, [true, false], 18);
    expect(d).toContain('Q');
    // control point is the vertex; the curve start/end are 18 px away from it
    expect(coordPairs(d)).toContainEqual([0, 0]);
    expect(d).toContain('L0 18');
    expect(d).toContain('18 0');
    expect(d).not.toMatch(/L0 0(\s|$)/);
  });

  it('limits the corner radius to half of the shorter adjacent segment', () => {
    const short = [
      { x: 0, y: 100 },
      { x: 0, y: 0 },
      { x: 20, y: 0 },
    ];
    const d = routePathD(short, [true, false], 18);
    expect(d).toContain('10 0'); // 20 / 2
    expect(d).toContain('0 10');
  });

  it('never rounds the start or the final point', () => {
    const d = routePathD(pts, [true, true], 18);
    expect(d.startsWith('M0 100')).toBe(true);
    expect(d.endsWith('L100 0')).toBe(true);
    expect(d.match(/Q/g)).toHaveLength(1);
  });

  it('handles tiny inputs', () => {
    expect(routePathD([], [])).toBe('');
    expect(routePathD([{ x: 1, y: 2 }], [])).toBe('M1 2');
  });
});

describe('zigzagD', () => {
  it('starts at the first and ends at the last point', () => {
    const d = zigzagD(
      [
        { x: 10, y: 10 },
        { x: 10, y: 110 },
      ],
      3,
      8,
    );
    const pairs = coordPairs(d);
    expect(pairs[0]).toEqual([10, 10]);
    expect(pairs[pairs.length - 1]).toEqual([10, 110]);
    expect(pairs.length).toBeGreaterThan(10);
  });

  it('alternates perpendicular offsets of ±amplitude', () => {
    const d = zigzagD(
      [
        { x: 0, y: 0 },
        { x: 100, y: 0 },
      ],
      3,
      8,
    );
    const mids = coordPairs(d).slice(1, -1);
    expect(mids.length).toBeGreaterThan(4);
    mids.forEach(([, y], i) => expect(y).toBeCloseTo(i % 2 === 0 ? 3 : -3, 5));
  });

  it('is a single move for a degenerate polyline', () => {
    expect(zigzagD([{ x: 5, y: 5 }])).toBe('M5 5');
    expect(zigzagD([])).toBe('');
  });
});

describe('arrowHeadPoints', () => {
  it('tip equals the last point and points along the last segment', () => {
    const [tip, p1, p2] = tri(
      arrowHeadPoints(
        [
          { x: 0, y: 0 },
          { x: 50, y: 0 },
        ],
        8,
      ),
    );
    expect(tip).toEqual([50, 0]);
    expect(p1[0]).toBeCloseTo(42);
    expect(p2[0]).toBeCloseTo(42);
    expect(p1[1]).toBeCloseTo(-p2[1]);
  });

  it('follows the last segment direction (upward)', () => {
    const [tip, p1] = tri(
      arrowHeadPoints([
        { x: 0, y: 0 },
        { x: 30, y: 0 },
        { x: 30, y: -40 },
      ]),
    );
    expect(tip).toEqual([30, -40]);
    expect(p1[1]).toBeGreaterThan(-40); // base is below the tip on screen
  });

  it('falls back to the previous segment when the last one is zero-length', () => {
    const pts = [
      { x: 0, y: 0 },
      { x: 20, y: 0 },
      { x: 20, y: 0 },
    ];
    const [tip, p1] = tri(arrowHeadPoints(pts, 8));
    expect(tip).toEqual([20, 0]);
    expect(p1[0]).toBeCloseTo(12);
  });

  it('returns an empty string without a non-zero segment', () => {
    expect(arrowHeadPoints([])).toBe('');
    expect(arrowHeadPoints([{ x: 1, y: 1 }])).toBe('');
    expect(
      arrowHeadPoints([
        { x: 1, y: 1 },
        { x: 1, y: 1 },
      ]),
    ).toBe('');
  });
});
