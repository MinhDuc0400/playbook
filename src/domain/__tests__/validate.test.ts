import { describe, expect, it } from 'vitest';
import { createDefaultFields } from '../field';
import { createPlay, formationsFor } from '../formations';
import type { AlignedPlayer } from '../numbering';
import type { Action, FieldConfig, Format, Play, PlayerSlot, Point, ReceiverRef } from '../types';
import { validatePlay, type PlayWarning } from '../validate';

const fields = createDefaultFields();
const field5: FieldConfig = fields['5v5'];

function counter(): () => string {
  let n = 0;
  return () => `id${++n}`;
}

function make(side: 'offense' | 'defense', formationId: string | null, format: Format = '5v5'): Play {
  return createPlay({ side, format, formationId, now: 1, idGen: counter() });
}

const offense = (id = '5v5-off-2x1'): Play => make('offense', id);
const defense = (id = '5v5-def-cover-1'): Play => make('defense', id);

function slot(play: Play, label: string): PlayerSlot {
  const s = play.players.find((p) => p.label === label);
  if (!s) throw new Error(`no slot ${label}`);
  return s;
}

const route = (path: Point[]): Action => ({ type: 'route', path, endBehavior: 'stop' });
const man = (target: ReceiverRef): Action => ({ type: 'man', target, technique: 'trail' });
const codes = (ws: PlayWarning[]): string[] => ws.map((w) => w.code);

describe('FR-ED-07 clean plays', () => {
  it.each(formationsFor('offense', '5v5').map((f) => [f.id] as const))(
    'offense preset %s with downfield routes has no warnings',
    (id) => {
      const play = offense(id);
      for (const s of play.players) {
        if (s.role === 'WR' || s.role === 'RB') s.actions.push(route([{ x: s.start.x, y: 8 }]));
      }
      expect(validatePlay(play, field5)).toEqual([]);
    },
  );

  it.each(formationsFor('defense', '5v5').map((f) => [f.id] as const))(
    'defense preset %s has no warnings',
    (id) => {
      expect(validatePlay(defense(id), field5)).toEqual([]);
    },
  );

  it('7v7 presets are clean with the 7v7 field', () => {
    for (const side of ['offense', 'defense'] as const) {
      for (const f of formationsFor(side, '7v7')) {
        expect(validatePlay(make(side, f.id, '7v7'), fields['7v7'])).toEqual([]);
      }
    }
  });

  it('blank play only reports too-few-players', () => {
    expect(validatePlay(make('offense', null), field5)).toEqual([
      { code: 'too-few-players', params: { count: 0, expected: 5 } },
    ]);
  });
});

describe('FR-ED-07 player count', () => {
  it('too-few-players', () => {
    const play = offense();
    play.players.pop();
    expect(validatePlay(play, field5)).toEqual([
      { code: 'too-few-players', params: { count: 4, expected: 5 } },
    ]);
  });

  it('too-many-players', () => {
    const play = offense();
    play.players.push({ ...slot(play, 'X'), id: 'extra', label: 'W' });
    expect(validatePlay(play, field5)).toEqual([
      { code: 'too-many-players', params: { count: 6, expected: 5 } },
    ]);
  });

  it('uses the field playersPerSide', () => {
    expect(codes(validatePlay(offense(), fields['7v7']))).toEqual(['too-few-players']);
  });
});

describe('FR-ED-07 route-out-of-bounds', () => {
  it('flags a route past the sideline, once per slot', () => {
    const play = offense();
    const z = slot(play, 'Z');
    z.actions.push(
      route([
        { x: 16, y: 5 },
        { x: 17, y: 6 },
      ]),
    );
    expect(validatePlay(play, field5)).toEqual([{ code: 'route-out-of-bounds', slotId: z.id }]);
  });

  it('flags past the back of the end zone and behind own end zone', () => {
    const play = offense();
    slot(play, 'X').actions.push(route([{ x: -12, y: 46 }]));
    slot(play, 'Y').actions.push(route([{ x: 7, y: 5 }]), route([{ x: 7, y: -26 }]));
    const ws = validatePlay(play, field5).filter((w) => w.code === 'route-out-of-bounds');
    expect(ws.map((w) => w.slotId)).toEqual(
      [slot(play, 'Y').id, slot(play, 'X').id].sort((a, b) => order(play, a, b)),
    );
  });

  it('checks option stem and both branches and motion', () => {
    const play = offense();
    slot(play, 'X').actions.push({
      type: 'option',
      stem: [{ x: -12, y: 5 }],
      vsMan: [{ x: -12, y: 8 }],
      vsZone: [{ x: -20, y: 8 }],
      decideAtStemEnd: true,
    });
    slot(play, 'Z').actions.push({ type: 'motion', path: [{ x: 30, y: -1 }], duration: 1 });
    const ws = validatePlay(play, field5);
    expect(ws.map((w) => w.slotId)).toEqual(
      [slot(play, 'X').id, slot(play, 'Z').id].sort((a, b) => order(play, a, b)),
    );
    expect(codes(ws)).toEqual(['route-out-of-bounds', 'route-out-of-bounds']);
  });

  it('ballSpot hash changes the result', () => {
    const play = offense();
    const y = slot(play, 'Y');
    y.actions.push(route([{ x: 14, y: 5 }]));
    expect(validatePlay(play, field5)).toEqual([]);
    expect(validatePlay(play, field5, { ballSpot: { x: 3, yardLine: 15 } })).toEqual([
      { code: 'route-out-of-bounds', slotId: y.id },
    ]);
  });

  it('ballSpot yard line moves the end zone', () => {
    const play = offense();
    const y = slot(play, 'Y');
    y.actions.push(route([{ x: 7, y: 40 }]));
    expect(validatePlay(play, field5)).toEqual([]);
    expect(codes(validatePlay(play, field5, { ballSpot: { x: 0, yardLine: 25 } }))).toEqual([
      'route-out-of-bounds',
    ]);
  });
});

/** Sort helper: slot-order comparison. */
function order(play: Play, a: string, b: string): number {
  const ia = play.players.findIndex((p) => p.id === a);
  const ib = play.players.findIndex((p) => p.id === b);
  return ia - ib;
}

describe('FR-ED-07 wrong-side-of-los', () => {
  it('offense starting downfield of the LOS', () => {
    const play = offense();
    const y = slot(play, 'Y');
    y.start = { x: 7, y: 0.5 };
    y.actions.push(route([{ x: 7, y: 8 }]));
    expect(validatePlay(play, field5)).toEqual([{ code: 'wrong-side-of-los', slotId: y.id }]);
  });

  it('defense starting behind the LOS', () => {
    const play = defense();
    const lb = slot(play, 'LB');
    lb.start = { x: 5, y: -1 };
    expect(validatePlay(play, field5)).toEqual([{ code: 'wrong-side-of-los', slotId: lb.id }]);
  });

  it('y = 0 is legal for both sides', () => {
    const o = offense();
    slot(o, 'C').start = { x: 0, y: 0 };
    expect(validatePlay(o, field5)).toEqual([]);
    const d = defense();
    slot(d, 'LB').start = { x: 5, y: 0 };
    expect(validatePlay(d, field5)).toEqual([]);
  });
});

describe('FR-ED-07 rushers', () => {
  it('rusher-inside-rush-line', () => {
    const play = defense();
    const r = slot(play, 'R1');
    r.start = { x: 0, y: 6.5 };
    expect(validatePlay(play, field5)).toEqual([{ code: 'rusher-inside-rush-line', slotId: r.id }]);
  });

  it('rusher exactly on the rush line is fine', () => {
    const play = defense();
    slot(play, 'R1').start = { x: 0, y: 7 };
    expect(validatePlay(play, field5)).toEqual([]);
  });

  it('too-many-rushers is play-level and comes first', () => {
    const play = defense();
    for (const label of ['CB1', 'CB2']) {
      const s = slot(play, label);
      s.start = { x: s.start.x, y: 8 };
      s.actions.push({ type: 'rush', path: [{ x: 0, y: -5 }], delay: 0 });
    }
    expect(validatePlay(play, field5)).toEqual([{ code: 'too-many-rushers', params: { count: 3, max: 2 } }]);
  });

  it('exactly maxRushers is fine; max follows the field', () => {
    const play = defense();
    const cb = slot(play, 'CB1');
    cb.start = { x: 11, y: 8 };
    cb.actions.push({ type: 'rush', path: [{ x: 0, y: -5 }], delay: 0 });
    expect(validatePlay(play, field5)).toEqual([]);
    const strict = { ...field5, maxRushers: 1 };
    expect(validatePlay(play, strict)).toEqual([{ code: 'too-many-rushers', params: { count: 2, max: 1 } }]);
  });

  it('non-rushers inside the rush line are not flagged', () => {
    const play = defense();
    expect(slot(play, 'LB').start.y).toBeLessThan(7);
    expect(validatePlay(play, field5)).toEqual([]);
  });

  it('rush-delay when rusherGoesOnSnap', () => {
    const play = defense();
    const r = slot(play, 'R1');
    r.actions = [{ type: 'rush', path: [{ x: 0, y: -5 }], delay: 0.5 }];
    expect(validatePlay(play, field5)).toEqual([{ code: 'rush-delay', slotId: r.id }]);
    expect(validatePlay(play, { ...field5, rusherGoesOnSnap: false })).toEqual([]);
  });

  it('does not treat offense actions as rushes', () => {
    const play = offense();
    expect(codes(validatePlay(play, field5))).toEqual([]);
  });
});

describe('FR-ED-07 catch-behind-los', () => {
  it('route entirely at y <= 0', () => {
    const play = offense();
    const y = slot(play, 'Y');
    y.actions.push(
      route([
        { x: 3, y: -1 },
        { x: 0, y: 0 },
      ]),
    );
    expect(validatePlay(play, field5)).toEqual([{ code: 'catch-behind-los', slotId: y.id }]);
  });

  it('a single point past the LOS is enough to avoid the warning', () => {
    const play = offense();
    slot(play, 'Y').actions.push(
      route([
        { x: 3, y: -1 },
        { x: 3, y: 0.5 },
      ]),
    );
    expect(validatePlay(play, field5)).toEqual([]);
  });

  it('applies to option routes (all branches)', () => {
    const play = offense();
    const x = slot(play, 'X');
    x.actions.push({
      type: 'option',
      stem: [{ x: -12, y: -2 }],
      vsMan: [{ x: -8, y: -2 }],
      vsZone: [{ x: -14, y: 0 }],
      decideAtStemEnd: true,
    });
    expect(validatePlay(play, field5)).toEqual([{ code: 'catch-behind-los', slotId: x.id }]);
    x.actions = [
      {
        type: 'option',
        stem: [{ x: -12, y: -2 }],
        vsMan: [{ x: -8, y: 4 }],
        vsZone: [{ x: -14, y: 0 }],
        decideAtStemEnd: true,
      },
    ];
    expect(validatePlay(play, field5)).toEqual([]);
  });

  it('excludes the QB and players without routes', () => {
    const play = offense();
    slot(play, 'Q').actions.push(route([{ x: 0, y: -7 }]));
    expect(validatePlay(play, field5)).toEqual([]);
  });
});

describe('FR-ED-07 man-target-missing', () => {
  const strong = (n: 1 | 2 | 3): ReceiverRef => ({ kind: 'number', side: 'strong', number: n });
  const weak = (n: 1 | 2 | 3): ReceiverRef => ({ kind: 'number', side: 'weak', number: n });

  it('strong #3 (the C) exists against the default 2x1 ghost', () => {
    const play = defense();
    slot(play, 'CB1').actions.push(man(strong(3)));
    expect(validatePlay(play, field5)).toEqual([]);
  });

  it('weak #2 does not exist against the default 2x1 ghost', () => {
    const play = defense();
    const cb = slot(play, 'CB1');
    cb.actions.push(man(weak(2)));
    expect(validatePlay(play, field5)).toEqual([{ code: 'man-target-missing', slotId: cb.id }]);
  });

  it('role refs: RB missing in 2x1, QB present', () => {
    const play = defense();
    const cb1 = slot(play, 'CB1');
    cb1.actions.push(man({ kind: 'role', role: 'RB' }));
    slot(play, 'CB2').actions.push(man({ kind: 'role', role: 'QB' }));
    expect(validatePlay(play, field5)).toEqual([{ code: 'man-target-missing', slotId: cb1.id }]);
  });

  it('checks match rules that switch to a man target', () => {
    const play = defense();
    const lb = slot(play, 'LB');
    lb.actions.push(man(strong(1)));
    lb.matchRules = [
      {
        id: 'r1',
        priority: 1,
        when: { receiver: strong(1), event: 'vertical' },
        then: { type: 'man', target: weak(3) },
      },
    ];
    expect(validatePlay(play, field5)).toEqual([{ code: 'man-target-missing', slotId: lb.id }]);
    lb.matchRules = [
      {
        id: 'r1',
        priority: 1,
        when: { receiver: strong(1), event: 'vertical' },
        then: { type: 'carry' },
      },
    ];
    expect(validatePlay(play, field5)).toEqual([]);
  });

  it('one warning per slot even with several bad refs', () => {
    const play = defense();
    const cb = slot(play, 'CB1');
    cb.actions.push(man(weak(2)));
    cb.matchRules = [
      {
        id: 'r1',
        priority: 1,
        when: { receiver: strong(1), event: 'out' },
        then: { type: 'man', target: weak(3) },
      },
    ];
    expect(validatePlay(play, field5)).toHaveLength(1);
  });

  it('custom ghost via opts', () => {
    const play = defense();
    const cb = slot(play, 'CB1');
    cb.actions.push(man(weak(2)));
    const ghost: AlignedPlayer[] = [
      { id: 'q', role: 'QB', pos: { x: 0, y: -5 } },
      { id: 'c', role: 'C', pos: { x: 0, y: -0.5 } },
      { id: 'a', role: 'WR', pos: { x: -12, y: -1 } },
      { id: 'b', role: 'WR', pos: { x: -8, y: -1 } },
      { id: 'd', role: 'WR', pos: { x: 12, y: -1 } },
      { id: 'e', role: 'WR', pos: { x: 8, y: -1 } },
    ];
    // left 2, right 2 -> balanced; strong/weak both have 2 receivers
    expect(validatePlay(play, field5, { ghost })).toEqual([]);
    expect(validatePlay(play, field5, { ghost: ghost.slice(0, 3) })).toEqual([
      { code: 'man-target-missing', slotId: cb.id },
    ]);
  });

  it('default ghost follows the play format (7v7 3x2 has weak #2)', () => {
    const play = make('defense', null, '7v7');
    const cb: PlayerSlot = {
      id: 'cb',
      role: 'CB',
      label: 'CB1',
      start: { x: 10, y: 5 },
      actions: [man(weak(2))],
    };
    play.players.push(cb);
    expect(codes(validatePlay(play, { ...fields['7v7'], playersPerSide: 1 }))).toEqual([]);
  });

  it('is not evaluated for offense plays', () => {
    const play = offense();
    slot(play, 'X').actions.push(man(weak(3)));
    expect(validatePlay(play, field5)).toEqual([]);
  });
});

describe('FR-ED-07 ordering', () => {
  it('play-level first, then per slot in play order, codes in union order', () => {
    const play = defense();
    // too-few-players (drop S) + too-many-rushers
    play.players = play.players.filter((p) => p.label !== 'FS');
    const cb1 = slot(play, 'CB1');
    const cb2 = slot(play, 'CB2');
    const r1 = slot(play, 'R1');
    const lb = slot(play, 'LB');
    cb1.start = { x: 11, y: -1 }; // wrong side
    cb1.actions.push(
      { type: 'rush', path: [{ x: 0, y: -5 }], delay: 1 },
      { type: 'motion', path: [{ x: 50, y: 0 }], duration: 1 },
      man({ kind: 'number', side: 'weak', number: 3 }),
    );
    cb2.actions.push({ type: 'rush', path: [{ x: 0, y: -5 }], delay: 0 });
    r1.start = { x: 0, y: 3 };
    lb.actions.push(man({ kind: 'role', role: 'RB' }));

    const ws = validatePlay(play, field5);
    expect(ws).toEqual([
      { code: 'too-few-players', params: { count: 4, expected: 5 } },
      { code: 'too-many-rushers', params: { count: 3, max: 2 } },
      { code: 'route-out-of-bounds', slotId: cb1.id },
      { code: 'wrong-side-of-los', slotId: cb1.id },
      { code: 'rusher-inside-rush-line', slotId: cb1.id },
      { code: 'rush-delay', slotId: cb1.id },
      { code: 'man-target-missing', slotId: cb1.id },
      { code: 'rusher-inside-rush-line', slotId: cb2.id },
      { code: 'man-target-missing', slotId: lb.id },
      { code: 'rusher-inside-rush-line', slotId: r1.id },
    ]);
    expect(validatePlay(play, field5)).toEqual(ws);
  });

  it('does not mutate its input', () => {
    const play = defense();
    slot(play, 'CB1').actions.push(man({ kind: 'role', role: 'RB' }));
    const snapshot = JSON.stringify(play);
    validatePlay(play, field5);
    expect(JSON.stringify(play)).toBe(snapshot);
  });
});

describe('too-many-motions (D-01)', () => {
  const motion = (): Action => ({ type: 'motion', path: [{ x: 0, y: 0 }], duration: 1 });
  it('warns for 2 motions, not for 1', () => {
    const play = offense();
    const wrs = play.players.filter((p) => p.role === 'WR');
    wrs[0]?.actions.push(motion());
    expect(codes(validatePlay(play, field5))).not.toContain('too-many-motions');
    wrs[1]?.actions.push(motion());
    const w = validatePlay(play, field5).find((x) => x.code === 'too-many-motions');
    expect(w?.params).toEqual({ count: 2 });
  });
});
