import { describe, expect, it } from 'vitest';
import { SCHEMA_VERSION, type AreaMatch, type Play, type PlayerSlot } from '@/domain/types';
import { createDefaultSettings } from '@/domain/defaults';
import { PlaySchema, SettingsSchema } from '../schemas';

function def(label: string, x: number, areaMatch?: AreaMatch): PlayerSlot {
  const s: PlayerSlot = { id: label, role: 'CB', label, start: { x, y: 3.5 }, actions: [] };
  if (areaMatch) s.areaMatch = areaMatch;
  return s;
}

describe('D-40 schema', () => {
  it('the schema accepts areaMatch and plays without it', () => {
    const play: Play = {
      id: 'p',
      schemaVersion: SCHEMA_VERSION,
      name: 'Bangkok',
      side: 'defense',
      format: '5v5',
      formation: 'Bunch Killer',
      strength: 'right',
      players: [def('CB1', 9, { role: 'corner' }), def('LB', 0)],
      tags: [],
      createdAt: 1,
      updatedAt: 1,
    };
    expect(PlaySchema.parse(play).players[0]!.areaMatch).toEqual({ role: 'corner' });
    expect(PlaySchema.parse(play).players[1]!.areaMatch).toBeUndefined();
    // D-47: an old export with the removed squeeze time still imports; the field is dropped.
    const old = {
      ...play,
      players: [{ ...play.players[0]!, areaMatch: { role: 'corner', squeezeAfter: 0.8 } }],
    };
    expect(PlaySchema.parse(old).players[0]!.areaMatch).toEqual({ role: 'corner' });
  });

  it('D-42 settings keep seedVersion through the schema', () => {
    expect(SettingsSchema.parse({ ...createDefaultSettings(), seedVersion: 2 }).seedVersion).toBe(2);
    expect(SettingsSchema.parse(createDefaultSettings()).seedVersion).toBeUndefined();
  });
});
