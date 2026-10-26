import { beforeEach, describe, expect, it } from 'vitest';
import { useMatchupStore } from '../matchupStore';

beforeEach(() => useMatchupStore.getState().reset());

describe('matchupStore', () => {
  it('has default overlays and no selection', () => {
    const s = useMatchupStore.getState();
    expect(s.overlays).toEqual({
      plannedRoutes: true,
      trails: false,
      zones: true,
      manLines: true,
      ballPath: true,
      separation: true,
    });
    expect(s.selected).toBeNull();
  });

  it('toggles and sets overlays', () => {
    useMatchupStore.getState().toggleOverlay('trails');
    expect(useMatchupStore.getState().overlays.trails).toBe(true);
    useMatchupStore.getState().toggleOverlay('trails');
    expect(useMatchupStore.getState().overlays.trails).toBe(false);
    useMatchupStore.getState().setOverlay('zones', false);
    expect(useMatchupStore.getState().overlays.zones).toBe(false);
    expect(useMatchupStore.getState().overlays.manLines).toBe(true);
  });

  it('selects and resets', () => {
    const sel = { side: 'defense' as const, slotId: 's1', label: 'CB1' };
    useMatchupStore.getState().select(sel);
    expect(useMatchupStore.getState().selected).toEqual(sel);
    useMatchupStore.getState().toggleOverlay('zones');
    useMatchupStore.getState().reset();
    expect(useMatchupStore.getState().selected).toBeNull();
    expect(useMatchupStore.getState().overlays.zones).toBe(true);
  });
});
