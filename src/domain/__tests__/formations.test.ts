import { describe, expect, it } from 'vitest';
import { createDefaultFields } from '../field';
import {
  FORMATIONS,
  LABEL_POOLS,
  createPlay,
  defaultGhostFormation,
  formationsFor,
  getFormation,
  nextDefaultLabel,
} from '../formations';
import { SCHEMA_VERSION } from '../types';
import type { Format } from '../types';

const fields = createDefaultFields();

function counter(): () => string {
  let n = 0;
  return () => `id${++n}`;
}

describe('FR-ED-01 formation presets', () => {
  it('has unique ids following <format>-<off|def>-<slug>', () => {
    const ids = FORMATIONS.map((f) => f.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const f of FORMATIONS) {
      expect(f.id).toMatch(new RegExp(`^${f.format}-${f.side === 'offense' ? 'off' : 'def'}-[a-z0-9-]+$`));
    }
  });

  it.each(FORMATIONS.map((f) => [f.id, f] as const))('%s is well formed', (_id, f) => {
    expect(f.players).toHaveLength(fields[f.format].playersPerSide);
    const labels = f.players.map((p) => p.label);
    expect(new Set(labels).size).toBe(labels.length);
    if (f.side === 'offense') {
      expect(f.players.every((p) => p.start.y <= 0)).toBe(true);
      expect(f.players.filter((p) => p.role === 'QB')).toHaveLength(1);
      expect(f.players.filter((p) => p.role === 'C')).toHaveLength(1);
    } else {
      expect(f.players.every((p) => p.start.y >= 0)).toBe(true);
      const rushers = f.players.filter((p) => p.role === 'R');
      expect(rushers).toHaveLength(1);
      expect(rushers[0]?.start.y).toBeGreaterThanOrEqual(7);
    }
  });

  it('contains the expected preset names', () => {
    const names = (side: 'offense' | 'defense', format: Format) =>
      formationsFor(side, format).map((f) => f.name);
    expect(names('offense', '5v5')).toEqual(['2x1', 'Trips', 'Bunch', 'Stack', 'Spread RB']);
    expect(names('defense', '5v5')).toEqual(['Cover 1', 'Cover 2', 'Cover 3']);
    expect(names('offense', '7v7')).toEqual(['3x2', 'Trips 7v7']);
    expect(names('defense', '7v7')).toEqual(['Cover 2 7v7', 'Cover 3 7v7']);
  });

  it('formationsFor filters by side/format and custom uses the 5v5 list', () => {
    for (const f of formationsFor('offense', '7v7')) {
      expect(f.side).toBe('offense');
      expect(f.format).toBe('7v7');
    }
    expect(formationsFor('offense', 'custom')).toEqual(formationsFor('offense', '5v5'));
    expect(formationsFor('defense', 'custom')).toEqual(formationsFor('defense', '5v5'));
    expect(formationsFor('defense', 'custom').map((f) => f.id)).toContain('5v5-def-cover-3');
  });

  it('getFormation finds by id', () => {
    expect(getFormation('5v5-off-trips')?.name).toBe('Trips');
    expect(getFormation('7v7-def-cover-3')?.name).toBe('Cover 3 7v7');
    expect(getFormation('nope')).toBeUndefined();
  });

  it('defaultGhostFormation: 2x1 for 5v5/custom, 3x2 for 7v7', () => {
    expect(defaultGhostFormation('5v5').id).toBe('5v5-off-2x1');
    expect(defaultGhostFormation('custom').id).toBe('5v5-off-2x1');
    expect(defaultGhostFormation('7v7').id).toBe('7v7-off-3x2');
  });
});

describe('FR-OFF-05 computed strength of presets', () => {
  it.each([
    ['5v5-off-trips', 'right'],
    ['5v5-off-2x1', 'right'],
    ['5v5-off-stack', 'right'],
    ['5v5-off-spread-rb', 'balanced'],
  ] as const)('%s -> %s', (id, strength) => {
    const play = createPlay({ side: 'offense', format: '5v5', formationId: id, now: 1, idGen: counter() });
    expect(play.strength).toBe(strength);
  });
});

describe('FR-ED-01 createPlay', () => {
  it('blank offense', () => {
    const play = createPlay({ side: 'offense', format: '5v5', formationId: null, now: 42, idGen: counter() });
    expect(play).toMatchObject({
      id: 'id1',
      schemaVersion: SCHEMA_VERSION,
      name: '',
      side: 'offense',
      format: '5v5',
      formation: '',
      players: [],
      tags: [],
      createdAt: 42,
      updatedAt: 42,
    });
    expect(play.progression).toBeUndefined();
    expect(play.alignTo).toBeUndefined();
  });

  it('blank defense uses alignTo ball and strength right', () => {
    const play = createPlay({ side: 'defense', format: '7v7', formationId: null, now: 1, idGen: counter() });
    expect(play.players).toEqual([]);
    expect(play.alignTo).toBe('ball');
    expect(play.strength).toBe('right');
    expect(play.format).toBe('7v7');
  });

  it('offense from preset: ids from idGen, QB drop, empty progression, timestamps', () => {
    const play = createPlay({
      side: 'offense',
      format: '5v5',
      formationId: '5v5-off-trips',
      now: 1000,
      idGen: counter(),
    });
    expect(play.id).toBe('id1');
    expect(play.formation).toBe('Trips');
    expect(play.name).toBe('');
    expect(play.players.map((p) => p.id)).toEqual(['id2', 'id3', 'id4', 'id5', 'id6']);
    expect(play.players.map((p) => p.label)).toEqual(['Q', 'C', 'Z', 'Y', 'H']);
    expect(play.progression).toEqual([]);
    expect(play.createdAt).toBe(1000);
    expect(play.updatedAt).toBe(1000);
    for (const s of play.players) {
      if (s.role === 'QB') expect(s.actions).toEqual([{ type: 'qbDrop', depth: 2, style: 'shotgun' }]);
      else expect(s.actions).toEqual([]);
    }
  });

  it('defense from preset: rusher gets rush with delay 0, others empty, alignTo ball', () => {
    const play = createPlay({
      side: 'defense',
      format: '5v5',
      formationId: '5v5-def-cover-3',
      now: 5,
      idGen: counter(),
    });
    expect(play.formation).toBe('Cover 3');
    expect(play.alignTo).toBe('ball');
    expect(play.strength).toBe('right');
    expect(play.progression).toBeUndefined();
    for (const s of play.players) {
      if (s.role === 'R') expect(s.actions).toEqual([{ type: 'rush', path: [{ x: 0, y: -5 }], delay: 0 }]);
      else expect(s.actions).toEqual([]);
    }
  });

  it('copies positions so edits do not touch the preset', () => {
    const play = createPlay({
      side: 'offense',
      format: '5v5',
      formationId: '5v5-off-2x1',
      now: 1,
      idGen: counter(),
    });
    play.players[2]!.start.x = 99;
    expect(getFormation('5v5-off-2x1')!.players[2]!.start.x).toBe(-12);
  });

  it('throws on unknown or wrong-side formation', () => {
    const base = { format: '5v5', now: 1, idGen: counter() } as const;
    expect(() => createPlay({ ...base, side: 'offense', formationId: 'nope' })).toThrow();
    expect(() => createPlay({ ...base, side: 'offense', formationId: '5v5-def-cover-1' })).toThrow();
  });
});

describe('FR-ED-02 nextDefaultLabel', () => {
  it('assigns pool labels in order and falls back to role+n', () => {
    expect(nextDefaultLabel('WR', [])).toBe('X');
    expect(nextDefaultLabel('WR', ['X', 'Z'])).toBe('Y');
    expect(nextDefaultLabel('WR', [...LABEL_POOLS.WR])).toBe('WR2');
    expect(nextDefaultLabel('WR', [...LABEL_POOLS.WR, 'WR2'])).toBe('WR3');
    expect(nextDefaultLabel('CB', ['CB1'])).toBe('CB2');
  });
});
