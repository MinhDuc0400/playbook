import { describe, expect, it } from 'vitest';
import { flipPlay } from '../flip';
import { alignedPlayers, numberReceivers, resolveReceiverRef } from '../numbering';
import { applyMatchupFlips } from '../matchupFlip';
import { SCHEMA_VERSION } from '../types';
import type { Action, ID, Play, PlayerSlot, Point, ReceiverRef, Role, Side, Strength } from '../types';

function slot(id: ID, role: Role, label: string, x: number, y: number, actions: Action[] = []): PlayerSlot {
  return { id, role, label, start: { x, y } satisfies Point, actions };
}

function play(side: Side, strength: Strength, players: PlayerSlot[], alignTo?: 'ball' | 'strength'): Play {
  const p: Play = {
    id: `${side}-play`,
    schemaVersion: SCHEMA_VERSION,
    name: 't',
    side,
    format: '5v5',
    formation: 'T',
    strength,
    players,
    tags: [],
    createdAt: 1,
    updatedAt: 1,
  };
  if (alignTo) p.alignTo = alignTo;
  return p;
}

const route = (path: Point[]): Action => ({ type: 'route', path, endBehavior: 'stop' });
const wr = (id: string, x: number, y = -1) => slot(id, 'WR', id, x, y, [route([{ x, y: 10 }])]);
const core = () => [
  slot('qb', 'QB', 'Q', 0, -5, [{ type: 'qbDrop', depth: 2, style: 'shotgun' }]),
  slot('c', 'C', 'C', 0, -0.5),
];

const tripsRight = () => play('offense', 'right', [...core(), wr('Z', 12), wr('Y', 8), wr('H', 4.5)]);
const twoByOne = () => play('offense', 'right', [...core(), wr('X', -12), wr('Y', 7), wr('Z', 12)]);
// 2 receivers each side, balanced count; the right side is wider (D-09 tie-break by sum |x|).
const balancedWide = () =>
  play('offense', 'balanced', [...core(), wr('A', -13), wr('B', -4), wr('D', 12), wr('E', 6)]);

const man = (target: ReceiverRef): Action => ({ type: 'man', target, technique: 'trail' });
const num = (side: 'strong' | 'weak', number: 1 | 2 | 3): ReceiverRef => ({ kind: 'number', side, number });

/** Cover-1-style defense designed for a strong-right offense. */
function cover1(third: ReceiverRef = num('weak', 1), cb2x = -11): Play {
  return play(
    'defense',
    'right',
    [
      slot('cb1', 'CB', 'CB1', 11, 5, [man(num('strong', 1))]),
      slot('lb', 'LB', 'LB', 5, 4, [man(num('strong', 2))]),
      slot('cb2', 'CB', 'CB2', cb2x, 5, [man(third)]),
      slot('fs', 'S', 'FS', 0, 12, [{ type: 'zone', zone: 'deep-middle', dropPoint: { x: 0, y: 14 } }]),
      slot('r1', 'R', 'R1', 0, 7, [{ type: 'rush', path: [{ x: 0, y: -5 }], delay: 0 }]),
    ],
    'strength',
  );
}

/** Man defender slot id → bound offense slot id (via numbering of the given offense). */
function bind(offense: Play, defense: Play): Record<ID, ID | null> {
  const n = numberReceivers(alignedPlayers(offense));
  const out: Record<ID, ID | null> = {};
  for (const s of defense.players) {
    const a = s.actions.find((x) => x.type === 'man');
    if (a?.type === 'man') out[s.id] = resolveReceiverRef(a.target, n);
  }
  return out;
}

const startX = (p: Play, id: ID): number => p.players.find((s) => s.id === id)?.start.x ?? NaN;

describe('T-DOM-02 flip offense keeps man bindings', () => {
  // Trips has no weak receiver, so its third man defender covers strong #3.
  const cases: [string, () => Play, ReceiverRef, number][] = [
    ['trips right', tripsRight, num('strong', 3), 5],
    ['2x1', twoByOne, num('weak', 1), -11],
    ['balanced but wider (D-09 tie-break)', balancedWide, num('weak', 1), -11],
  ];
  for (const [name, make, third, cb2x] of cases) {
    it(`${name}: offense flipped + defense auto → same slot ids, defender stays on target side`, () => {
      const offense = make();
      // Design the defense for the offense's real strong side, then check both orientations.
      const base = cover1(third, cb2x);
      const flippedAtDesign = applyMatchupFlips(offense, base, {
        offenseFlipped: false,
        defenseFlip: 'auto',
      });
      const unflipped = flippedAtDesign.defense;
      const before = bind(flippedAtDesign.offense, unflipped);
      expect(Object.keys(before)).toEqual(['cb1', 'lb', 'cb2']);
      for (const id of Object.keys(before)) expect(before[id]).not.toBeNull();

      const r = applyMatchupFlips(offense, base, { offenseFlipped: true, defenseFlip: 'auto' });
      expect(r.offense).toEqual(flipPlay(offense));
      expect(r.defenseFlipped).toBe(!flippedAtDesign.defenseFlipped);
      expect(bind(r.offense, r.defense)).toEqual(before);

      // Each man defender lines up on the same side of the field as the receiver it covers.
      for (const [defId, tgt] of Object.entries(before)) {
        expect(Math.sign(startX(r.defense, defId))).toBe(Math.sign(startX(r.offense, tgt as ID)));
        expect(Math.sign(startX(unflipped, defId))).toBe(
          Math.sign(startX(flippedAtDesign.offense, tgt as ID)),
        );
      }
    });
  }

  it('trips right: unflipped → defense not flipped, bindings are the concrete slot ids', () => {
    const r = applyMatchupFlips(tripsRight(), cover1(num('strong', 3), 5), {
      offenseFlipped: false,
      defenseFlip: 'auto',
    });
    expect(r.defenseFlipped).toBe(false);
    expect(bind(r.offense, r.defense)).toEqual({ cb1: 'Z', lb: 'Y', cb2: 'H' });
  });
});

describe('T-DOM-03 flip both keeps assignments', () => {
  it('offenseFlipped + defenseFlip "flip" gives identical bindings to both unflipped', () => {
    const cases: [() => Play, ReceiverRef, number][] = [
      [tripsRight, num('strong', 3), 5],
      [twoByOne, num('weak', 1), -11],
      [balancedWide, num('weak', 1), -11],
    ];
    for (const [make, third, cb2x] of cases) {
      const offense = make();
      const d = cover1(third, cb2x);
      const a = applyMatchupFlips(offense, d, { offenseFlipped: false, defenseFlip: 'none' });
      const b = applyMatchupFlips(offense, d, { offenseFlipped: true, defenseFlip: 'flip' });
      expect(b.defenseFlipped).toBe(true);
      expect(b.offense).toEqual(flipPlay(offense));
      expect(b.defense).toEqual(flipPlay(d));
      const before = bind(a.offense, a.defense);
      expect(Object.values(before).every((id) => id !== null)).toBe(true);
      expect(bind(b.offense, b.defense)).toEqual(before);
    }
  });
});

describe('applyMatchupFlips modes (FR-FLP-03, FR-FLP-04)', () => {
  it("'none' never flips the defense, even with the offense flipped", () => {
    const d = cover1();
    const r = applyMatchupFlips(tripsRight(), d, { offenseFlipped: true, defenseFlip: 'none' });
    expect(r.defenseFlipped).toBe(false);
    expect(r.defense).toBe(d);
  });

  it("'flip' always flips the defense", () => {
    const d = cover1();
    const r = applyMatchupFlips(tripsRight(), d, { offenseFlipped: false, defenseFlip: 'flip' });
    expect(r.defenseFlipped).toBe(true);
    expect(r.defense).toEqual(flipPlay(d));
  });

  it('does not mutate the inputs or copy plays when nothing flips', () => {
    const o = tripsRight();
    const d = cover1();
    const oCopy = structuredClone(o);
    const dCopy = structuredClone(d);
    const r = applyMatchupFlips(o, d, { offenseFlipped: false, defenseFlip: 'auto' });
    expect(r.offense).toBe(o);
    expect(r.defense).toBe(d);
    applyMatchupFlips(o, d, { offenseFlipped: true, defenseFlip: 'flip' });
    expect(o).toEqual(oCopy);
    expect(d).toEqual(dCopy);
  });

  it("'auto' with alignTo 'ball' never flips", () => {
    const d = { ...cover1(), alignTo: 'ball' as const };
    for (const flipped of [false, true]) {
      const r = applyMatchupFlips(tripsRight(), d, { offenseFlipped: flipped, defenseFlip: 'auto' });
      expect(r.defenseFlipped).toBe(false);
    }
  });

  it("'auto' with matching strength does not flip; mismatching strength flips", () => {
    const d = cover1(); // designed right
    expect(
      applyMatchupFlips(tripsRight(), d, { offenseFlipped: false, defenseFlip: 'auto' }).defenseFlipped,
    ).toBe(false);
    const left = applyMatchupFlips(tripsRight(), d, { offenseFlipped: true, defenseFlip: 'auto' });
    expect(left.defenseFlipped).toBe(true);
    expect(left.defense).toEqual(flipPlay(d));
    // A left-designed defense against the unflipped right-strong offense flips; vs the flipped one it does not.
    const dLeft = flipPlay(d);
    expect(
      applyMatchupFlips(tripsRight(), dLeft, { offenseFlipped: false, defenseFlip: 'auto' }).defenseFlipped,
    ).toBe(true);
    expect(
      applyMatchupFlips(tripsRight(), dLeft, { offenseFlipped: true, defenseFlip: 'auto' }).defenseFlipped,
    ).toBe(false);
  });

  it("'auto' with a balanced design strength does not flip", () => {
    const d = { ...cover1(), strength: 'balanced' as const };
    const r = applyMatchupFlips(tripsRight(), d, { offenseFlipped: true, defenseFlip: 'auto' });
    expect(r.defenseFlipped).toBe(false);
  });

  it('auto uses the computed alignment, not Play.strength of the offense', () => {
    const o = { ...tripsRight(), strength: 'left' as const }; // stale/overridden label
    const r = applyMatchupFlips(o, cover1(), { offenseFlipped: false, defenseFlip: 'auto' });
    expect(r.defenseFlipped).toBe(false);
  });
});
