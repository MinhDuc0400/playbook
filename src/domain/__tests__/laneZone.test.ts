import { describe, expect, it } from 'vitest';
import { computeRuleLanes, cornerRules, insideRules, liveLaneZones, zoneShapeOf } from '../areaRules';
import { createDefaultFields } from '../field';
import { flipAction } from '../flip';
import type { Play, PlayerSlot, ZoneAction } from '../types';
import { isDeepZone, zoneKind } from '../zones';

const field = createDefaultFields()['5v5'];
let n = 0;
const idGen = () => `r${++n}`;

const laneZone: ZoneAction = { type: 'zone', zone: 'lane', dropPoint: { x: 0, y: 0 } };

/** The user's board: CB1 −10, FS −2 (inside of CB1), SS 2.5 (inside of CB2), CB2 7.5. */
function board(fsX: number): PlayerSlot[] {
  const at = (id: string, x: number, rest: Partial<PlayerSlot>): PlayerSlot => ({
    id,
    role: 'CB',
    label: id,
    start: { x, y: 7 },
    actions: [],
    ...rest,
  });
  return [
    at('CB1', -10, { matchRules: cornerRules(idGen) }),
    at('FS', fsX, { role: 'S', actions: [laneZone], matchRules: insideRules(idGen, 'CB1') }),
    at('SS', 2.5, { role: 'S', actions: [laneZone], matchRules: insideRules(idGen, 'CB2') }),
    at('CB2', 7.5, { matchRules: cornerRules(idGen) }),
  ];
}

const xRange = (pts: { x: number }[]) => [Math.min(...pts.map((p) => p.x)), Math.max(...pts.map((p) => p.x))];

describe('D-51 live lane zone', () => {
  it('the lane zone edges are the dashed lane lines, before and after FS moves', () => {
    for (const fsX of [-2, -1, -3.5]) {
      const slots = board(fsX);
      const [b0, b1] = computeRuleLanes(slots)!.boundaries;
      const fs = zoneShapeOf(laneZone, 'FS', slots, field);
      expect(xRange(fs.polygon)).toEqual([b0, b1]);
      const ss = zoneShapeOf(laneZone, 'SS', slots, field);
      expect(xRange(ss.polygon)[0]).toBe(b1);
    }
  });

  it('the lane zone runs from the LOS 10 yd deep and drops on the defender (the engine holds his spot)', () => {
    const slots = board(-2);
    const fs = zoneShapeOf(laneZone, 'FS', slots, field);
    expect(fs.polygon.map((p) => p.y).sort()).toEqual([0, 0, 10, 10]);
    expect(fs.dropPoint).toEqual({ x: -2, y: 7 });
  });

  it('other zones keep their own shape', () => {
    const preset: ZoneAction = {
      type: 'zone',
      zone: 'quarter-mid-L',
      dropPoint: { x: -3, y: 5 },
      offset: { x: 1, y: 0 },
    };
    const shape = zoneShapeOf(preset, 'FS', board(-2), field);
    expect(xRange(shape.polygon)).toEqual([-6.5, 1]);
    expect(shape.dropPoint).toEqual({ x: -3, y: 5 });
  });

  it('kind custom, not deep; a flip keeps it a lane zone', () => {
    expect(zoneKind('lane')).toBe('custom');
    expect(isDeepZone('lane')).toBe(false);
    expect(flipAction(laneZone)).toMatchObject({ zone: 'lane' });
  });
});

describe('D-51 liveLaneZones (saved boards)', () => {
  const rect = (x0: number, x1: number, y0 = 0) => ({
    polygon: [
      { x: x0, y: y0 },
      { x: x1, y: y0 },
      { x: x1, y: y0 + 10 },
      { x: x0, y: y0 + 10 },
    ],
  });
  const play = (players: PlayerSlot[]): Play =>
    ({ id: 'p', side: 'defense', format: '5v5', players }) as unknown as Play;
  const withZone = (slots: PlayerSlot[], id: string, zone: ZoneAction['zone']): PlayerSlot[] =>
    slots.map((s) =>
      s.id === id ? { ...s, actions: [{ type: 'zone', zone, dropPoint: { x: 1, y: 5 } }] } : s,
    );

  it('a lane member whose zone is a frozen lane rectangle (even dragged off) gets the live lane zone', () => {
    let slots = withZone(board(-1), 'FS', rect(-5, 1.25, 0.5));
    slots = withZone(slots, 'SS', rect(0.25, 5));
    const out = liveLaneZones(play(slots));
    expect(out.players.find((s) => s.id === 'FS')!.actions).toEqual([
      { type: 'zone', zone: 'lane', dropPoint: { x: -1, y: 7 } },
    ]);
    expect(out.players.find((s) => s.id === 'SS')!.actions[0]).toMatchObject({ zone: 'lane' });
  });

  it('leaves drawn zones, presets and non-members alone (same object when nothing changes)', () => {
    const tri = {
      polygon: [
        { x: -4.8, y: 0 },
        { x: 1.4, y: 0 },
        { x: -1.3, y: 6.5 },
      ],
    };
    let slots = withZone(board(-2), 'FS', tri);
    slots = withZone(slots, 'SS', 'quarter-mid-R');
    const r: PlayerSlot = { id: 'R', role: 'R', label: 'R', start: { x: 0, y: 7 }, actions: [] };
    const free: PlayerSlot = {
      ...r,
      id: 'LB',
      role: 'LB',
      label: 'LB',
      actions: [{ type: 'zone', zone: rect(-2, 2), dropPoint: { x: 0, y: 5 } }],
    };
    const p = play([...slots, r, free]);
    expect(liveLaneZones(p)).toBe(p);
  });
});
