import { describe, expect, it } from 'vitest';
import { SCHEMA_VERSION, type Play } from '@/domain/types';
import { facets, filterPlays, normalizeText } from '../filterPlays';

function mk(i: number, o: Partial<Play> = {}): Play {
  return {
    id: `p${i}`,
    schemaVersion: SCHEMA_VERSION,
    name: `Play ${i}`,
    side: 'offense',
    format: '5v5',
    formation: 'Trips',
    strength: 'right',
    players: [],
    tags: [],
    createdAt: i,
    updatedAt: i,
    ...o,
  };
}

const plays = [
  mk(1, { name: 'Đường chéo', formation: 'Trips', tags: ['red zone'], updatedAt: 10 }),
  mk(2, { name: 'Bravo', side: 'defense', formation: 'Cover 3', tags: ['deep'], updatedAt: 30 }),
  mk(3, { name: 'Alpha', format: '7v7', formation: 'Bunch', tags: ['red zone', 'deep'], updatedAt: 20 }),
];
const ids = (l: Play[]) => l.map((p) => p.id);

describe('normalizeText (FR-PB-02)', () => {
  it('lowercases and strips Vietnamese diacritics', () => {
    expect(normalizeText('Đường Chéo')).toBe('duong cheo');
    expect(normalizeText('Trắng')).toBe('trang');
  });
});

describe('filterPlays (FR-PB-02)', () => {
  it('each filter alone', () => {
    expect(ids(filterPlays(plays, { sort: 'updated', side: 'defense' }))).toEqual(['p2']);
    expect(ids(filterPlays(plays, { sort: 'updated', format: '7v7' }))).toEqual(['p3']);
    expect(ids(filterPlays(plays, { sort: 'updated', formation: 'Trips' }))).toEqual(['p1']);
    expect(ids(filterPlays(plays, { sort: 'updated', tag: 'deep' }))).toEqual(['p2', 'p3']);
    expect(ids(filterPlays(plays, { sort: 'updated', q: 'BRAV' }))).toEqual(['p2']);
  });
  it('diacritic-insensitive search', () => {
    expect(ids(filterPlays(plays, { sort: 'updated', q: 'duong' }))).toEqual(['p1']);
    expect(ids(filterPlays(plays, { sort: 'updated', q: 'Đường' }))).toEqual(['p1']);
  });
  it('combined filters are ANDed', () => {
    expect(ids(filterPlays(plays, { sort: 'updated', tag: 'red zone', format: '5v5' }))).toEqual(['p1']);
    expect(filterPlays(plays, { sort: 'updated', tag: 'deep', side: 'offense', format: '5v5' })).toEqual([]);
  });
  it('sorts updated desc and name asc without mutating input', () => {
    expect(ids(filterPlays(plays, { sort: 'updated' }))).toEqual(['p2', 'p3', 'p1']);
    expect(ids(filterPlays(plays, { sort: 'name' }))).toEqual(['p3', 'p2', 'p1']);
    expect(ids(plays)).toEqual(['p1', 'p2', 'p3']);
  });
});

describe('facets', () => {
  it('returns distinct sorted formations and tags', () => {
    expect(facets(plays)).toEqual({
      formations: ['Bunch', 'Cover 3', 'Trips'],
      tags: ['deep', 'red zone'],
    });
  });
});

describe('NFR-PERF-04 filter 500 plays < 100 ms', () => {
  it('each of 20 filter+search calls takes < 100 ms', () => {
    const many = Array.from({ length: 500 }, (_, i) =>
      mk(i, {
        name: `Đường số ${i}`,
        side: i % 2 ? 'offense' : 'defense',
        tags: [`t${i % 7}`, 'common'],
        formation: `F${i % 11}`,
        updatedAt: (i * 7919) % 1000,
      }),
    );
    let max = 0;
    for (let k = 0; k < 20; k += 1) {
      const start = performance.now();
      filterPlays(many, { sort: k % 2 ? 'name' : 'updated', q: 'duong so 4', tag: 'common' });
      max = Math.max(max, performance.now() - start);
    }
    expect(max).toBeLessThan(100);
  });
});
