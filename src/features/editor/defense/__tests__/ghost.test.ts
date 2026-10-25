import { describe, expect, it } from 'vitest';
import { ghostFormation, ghostId, ghostNumbering, ghostPlayers } from '../ghost';

describe('ghost helpers (FR-DEF-01)', () => {
  it('defaults to the 2x1 preset for 5v5 and falls back on unknown ids', () => {
    expect(ghostFormation('5v5', null).id).toBe('5v5-off-2x1');
    expect(ghostFormation('5v5', 'nope').id).toBe('5v5-off-2x1');
    expect(ghostFormation('5v5', '5v5-def-cover-1').id).toBe('5v5-off-2x1');
    expect(ghostFormation('5v5', '5v5-off-trips').id).toBe('5v5-off-trips');
  });

  it('builds ghost players with ghost ids and numbers them', () => {
    const players = ghostPlayers('5v5', '5v5-off-trips');
    expect(players.map((p) => p.id)).toContain(ghostId('Z'));
    const n = ghostNumbering('5v5', '5v5-off-trips');
    expect(n.strongSide).toBe('right');
    expect(n.strong[0]).toBe(ghostId('Z'));
  });
});
