import { describe, expect, it } from 'vitest';
import { cornerRules, insideRules, withSnapBackpedal } from '@/domain/areaRules';
import { SCHEMA_VERSION, type Play, type PlayerSlot } from '@/domain/types';
import { PlaySchema } from '../schemas';

let n = 0;
const idGen = () => `r${++n}`;

const def = (label: string, x: number, matchRules: PlayerSlot['matchRules']): PlayerSlot => ({
  id: label,
  role: 'CB',
  label,
  start: { x, y: 3.5 },
  actions: [],
  ...(matchRules ? { matchRules } : {}),
});

const play = (players: PlayerSlot[]): Play => ({
  id: 'p',
  schemaVersion: SCHEMA_VERSION,
  name: 'Bangkok rules',
  side: 'defense',
  format: '5v5',
  formation: 'Bunch Killer',
  strength: 'right',
  players,
  tags: [],
  createdAt: 1,
  updatedAt: 1,
});

describe('D-48 area rule schema', () => {
  it('a play with the corner and inside templates parses unchanged', () => {
    const p = play([def('CB1', 9, cornerRules(idGen)), def('S', 4, insideRules(idGen, 'CB1'))]);
    expect(PlaySchema.parse(p)).toEqual(p);
  });

  it('any receiver and manTrigger parse; nth 3 is rejected', () => {
    const ok = play([
      def('CB1', 9, [
        {
          id: 'a',
          priority: 0,
          when: { receiver: { kind: 'any' }, event: 'out' },
          then: { type: 'manTrigger' },
        },
      ]),
    ]);
    expect(PlaySchema.safeParse(ok).success).toBe(true);
    const bad = structuredClone(ok) as unknown as {
      players: { matchRules: { when: { receiver: unknown } }[] }[];
    };
    bad.players[0]!.matchRules[0]!.when.receiver = { kind: 'nth', n: 3 };
    expect(PlaySchema.safeParse(bad).success).toBe(false);
  });
});

describe('D-52 snap backpedal schema', () => {
  it('a corner with the snap backpedal on top parses unchanged; a backpedal without yards is rejected', () => {
    const rules = withSnapBackpedal(cornerRules(idGen), true, idGen);
    const p = play([def('CB1', 9, rules)]);
    expect(PlaySchema.parse(p)).toEqual(p);
    const bad = play([def('CB1', 9, [{ ...rules[0]!, then: { type: 'backpedal' } as never }])]);
    expect(PlaySchema.safeParse(bad).success).toBe(false);
  });
});
