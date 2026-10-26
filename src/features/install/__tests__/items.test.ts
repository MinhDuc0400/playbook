import { describe, expect, it } from 'vitest';
import { SCHEMA_VERSION, type Install } from '@/domain/types';
import { addItems, moveItem, removeItem, setNote, sortedItems } from '../items';

const base: Install = {
  id: 'i',
  schemaVersion: SCHEMA_VERSION,
  name: 'x',
  items: [],
  createdAt: 1,
  updatedAt: 1,
};
let n = 0;
const gen = () => `it${++n}`;
const orders = (i: Install) => sortedItems(i).map((x) => x.order);
const ids = (i: Install) => sortedItems(i).map((x) => x.id);

describe('install items helpers (FR-IN-02)', () => {
  it('addItems appends in order with orders 0..n-1 and does not mutate', () => {
    const a = addItems(base, ['m1', 'm2', 'm3'], gen);
    expect(base.items).toHaveLength(0);
    expect(sortedItems(a).map((x) => x.matchupId)).toEqual(['m1', 'm2', 'm3']);
    expect(orders(a)).toEqual([0, 1, 2]);
    const b = addItems(a, ['m4'], gen);
    expect(orders(b)).toEqual([0, 1, 2, 3]);
    expect(a.items).toHaveLength(3);
  });

  it('removeItem repacks orders', () => {
    const a = addItems(base, ['m1', 'm2', 'm3'], gen);
    const mid = sortedItems(a)[1]!.id;
    const b = removeItem(a, mid);
    expect(b.items).toHaveLength(2);
    expect(orders(b)).toEqual([0, 1]);
    expect(a.items).toHaveLength(3);
  });

  it('moveItem reorders, clamps and repacks', () => {
    const a = addItems(base, ['m1', 'm2', 'm3'], gen);
    const [x, y, z] = ids(a) as [string, string, string];
    expect(ids(moveItem(a, x, 2))).toEqual([y, z, x]);
    expect(ids(moveItem(a, z, 0))).toEqual([z, x, y]);
    expect(ids(moveItem(a, x, 99))).toEqual([y, z, x]);
    expect(ids(moveItem(a, y, -5))).toEqual([y, x, z]);
    expect(orders(moveItem(a, x, 2))).toEqual([0, 1, 2]);
    expect(ids(a)).toEqual([x, y, z]);
  });

  it('setNote sets only the target note without mutating', () => {
    const a = addItems(base, ['m1', 'm2'], gen);
    const [x, y] = ids(a) as [string, string];
    const b = setNote(a, y, 'hello');
    expect(sortedItems(b).find((i) => i.id === y)?.coachNote).toBe('hello');
    expect(sortedItems(b).find((i) => i.id === x)?.coachNote).toBeUndefined();
    expect(sortedItems(a).find((i) => i.id === y)?.coachNote).toBeUndefined();
  });
});
