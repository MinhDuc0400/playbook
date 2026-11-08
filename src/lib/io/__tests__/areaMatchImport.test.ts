import { describe, expect, it } from 'vitest';
import { cornerRules, insideRules } from '@/domain/areaRules';
import { SCHEMA_VERSION, type Play } from '@/domain/types';
import { parseImport } from '../importData';

const base = (players: unknown[]): Record<string, unknown> => ({
  id: 'bk',
  schemaVersion: 1,
  name: 'Bangkok',
  side: 'defense',
  format: '5v5',
  formation: 'Bunch Killer',
  strength: 'right',
  players,
  tags: [],
  createdAt: 1,
  updatedAt: 1,
});

const file = (version: number, plays: unknown[]) =>
  JSON.stringify({
    app: 'flagbook',
    schemaVersion: version,
    exportedAt: '2026-11-09T00:00:00Z',
    data: { plays },
  });

describe('D-48 import converts areaMatch (Review Focus 5)', () => {
  it('a schemaVersion 1 file with areaMatch imports as rules', () => {
    const old = base([
      {
        id: 'CB1',
        role: 'CB',
        label: 'CB1',
        start: { x: 9, y: 3.5 },
        actions: [],
        areaMatch: { role: 'corner', squeezeAfter: 0.5 },
      },
      { id: 'S', role: 'S', label: 'S', start: { x: 4, y: 3.5 }, actions: [], areaMatch: { role: 'inside' } },
    ]);
    const r = parseImport(file(1, [old]));
    if (!r.ok) throw new Error(r.errors.join('; '));
    const play = r.file.data.plays![0]!;
    expect(play.schemaVersion).toBe(SCHEMA_VERSION);
    const cb1 = play.players.find((s) => s.id === 'CB1')!;
    expect(cb1.matchRules).toEqual(cornerRules(() => 'CB1-bk'));
    expect('areaMatch' in cb1).toBe(false);
  });

  it('a schemaVersion 2 play with rules round-trips unchanged', () => {
    const play = {
      ...base([
        {
          id: 'CB1',
          role: 'CB',
          label: 'CB1',
          start: { x: 9, y: 3.5 },
          actions: [],
          matchRules: cornerRules(() => 'a'),
        },
        {
          id: 'S',
          role: 'S',
          label: 'S',
          start: { x: 4, y: 3.5 },
          actions: [],
          matchRules: insideRules(() => 'b', 'CB1'),
        },
      ]),
      schemaVersion: SCHEMA_VERSION,
    } as unknown as Play;
    const r = parseImport(file(SCHEMA_VERSION, [play]));
    if (!r.ok) throw new Error(r.errors.join('; '));
    expect(r.file.data.plays![0]).toEqual(play);
  });
});
