import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { FieldSvg } from '@/components/field/FieldSvg';
import { defaultViewport, toScreen } from '@/components/field/viewport';
import { createDefaultFields, DEFAULT_BALL_SPOT } from '@/domain/field';
import { createPlay } from '@/domain/formations';
import type { Play } from '@/domain/types';
import { useEditorStore } from '@/store/editorStore';
import { offenseFixture } from '../../__tests__/fixtures';
import { ghostId, ghostPlayers } from '../ghost';
import { clearAssignment, setMan, setRush, setZone } from '../ops';
import { AssignmentLayer } from '../AssignmentLayer';

const field = createDefaultFields()['5v5'];
const viewport = defaultViewport(900, 700, field, DEFAULT_BALL_SPOT);
const store = () => useEditorStore.getState();

function newDefense(formationId: string): Play {
  let n = 0;
  return createPlay({ side: 'defense', format: '5v5', formationId, now: 1, idGen: () => `id${++n}` });
}

function renderLayer() {
  return render(
    <FieldSvg field={field} ballSpot={DEFAULT_BALL_SPOT} viewport={viewport}>
      <AssignmentLayer />
    </FieldSvg>,
  );
}

function slotId(play: Play, label: string): string {
  const s = play.players.find((p) => p.label === label);
  if (!s) throw new Error(`no slot ${label}`);
  return s.id;
}

beforeEach(() => {
  store().setTool('select');
  store().setGhostFormation(null);
});
afterEach(cleanup);

describe('AssignmentLayer (FR-DEF-02..04, §12.2)', () => {
  it('draws nothing for an offense play', () => {
    store().load(offenseFixture());
    renderLayer();
    expect(screen.queryByTestId('assignment-layer')).toBeNull();
  });

  it('Cover 1 style: man lines end at the ghost receivers, deep zone and rush arrow are drawn', () => {
    const base = newDefense('5v5-def-cover-1');
    store().load(base);
    // Default ghost is 2x1: strong side right → strong #1 = Z (12), #2 = Y (7), weak #1 = X.
    store().apply('cb1', setMan(slotId(base, 'CB1'), { kind: 'number', side: 'strong', number: 1 }));
    store().apply('cb2', setMan(slotId(base, 'CB2'), { kind: 'number', side: 'weak', number: 1 }));
    store().apply('lb', setMan(slotId(base, 'LB'), { kind: 'number', side: 'strong', number: 2 }));
    store().apply('fs', setZone(slotId(base, 'FS'), 'deep-middle', field));
    renderLayer();

    const ghosts = ghostPlayers('5v5', null);
    const posOf = (label: string) => ghosts.find((g) => g.id === ghostId(label))?.pos;
    const endOf = (testId: string) => {
      const d = screen.getByTestId(testId).querySelector('[data-part="line"]')?.getAttribute('d') ?? '';
      const nums = d.match(/-?\d+(\.\d+)?/g)?.map(Number) ?? [];
      return { x: nums[nums.length - 2], y: nums[nums.length - 1] };
    };
    for (const [def, ghost] of [
      ['CB1', 'Z'],
      ['CB2', 'X'],
      ['LB', 'Y'],
    ] as const) {
      const p = posOf(ghost);
      if (!p) throw new Error('missing ghost');
      const s = toScreen(p, viewport);
      const end = endOf(`man-${def}`);
      expect(end.x).toBeCloseTo(s.x, 0);
      expect(end.y).toBeCloseTo(s.y, 0);
      expect(screen.getByTestId(`man-${def}`)).toHaveAttribute('data-variant', 'man');
    }
    expect(screen.getByTestId('zone-FS')).toHaveAttribute('data-zone-kind', 'deep');
    expect(screen.getByTestId('rush-R1')).toHaveAttribute('data-variant', 'rush');
    expect(screen.getByTestId('rush-R1')).toHaveAttribute('data-slot-id', slotId(base, 'R1'));
  });

  it('a man target that does not resolve on the ghost draws no line', () => {
    const base = newDefense('5v5-def-cover-1');
    store().load(base);
    store().apply('cb1', setMan(slotId(base, 'CB1'), { kind: 'number', side: 'weak', number: 2 }));
    renderLayer();
    expect(screen.queryByTestId('man-CB1')).toBeNull();
  });

  it('Cover 2 zones: flat and deep kinds', () => {
    const base = newDefense('5v5-def-cover-2');
    store().load(base);
    store().apply('cb1', setZone(slotId(base, 'CB1'), 'flat-R', field));
    store().apply('cb2', setZone(slotId(base, 'CB2'), 'flat-L', field));
    store().apply('s1', setZone(slotId(base, 'S1'), 'deep-half-R', field));
    store().apply('s2', setZone(slotId(base, 'S2'), 'deep-half-L', field));
    renderLayer();
    expect(screen.getByTestId('zone-CB1')).toHaveAttribute('data-zone-kind', 'flat');
    expect(screen.getByTestId('zone-CB2')).toHaveAttribute('data-zone-kind', 'flat');
    expect(screen.getByTestId('zone-S1')).toHaveAttribute('data-zone-kind', 'deep');
    expect(screen.getByTestId('zone-S2')).toHaveAttribute('data-zone-kind', 'deep');
  });

  it('drop handle and rush handles follow selection / tool', () => {
    const base = newDefense('5v5-def-cover-3');
    store().load(base);
    const fs = slotId(base, 'FS');
    const r1 = slotId(base, 'R1');
    store().apply('fs', setZone(fs, 'deep-third-M', field));
    const { rerender } = renderLayer();
    expect(document.querySelector('[data-kind="dropPoint"]')).toBeNull();
    expect(document.querySelectorAll('[data-kind="routePoint"]')).toHaveLength(0);

    store().select([fs]);
    rerender(
      <FieldSvg field={field} ballSpot={DEFAULT_BALL_SPOT} viewport={viewport}>
        <AssignmentLayer />
      </FieldSvg>,
    );
    expect(document.querySelector('[data-kind="dropPoint"]')).toHaveAttribute('data-slot-id', fs);
    cleanup();

    store().select([]);
    store().setTool('zone');
    renderLayer();
    expect(document.querySelector('[data-kind="dropPoint"]')).not.toBeNull();
    cleanup();

    store().select([r1]);
    store().setTool('rush');
    renderLayer();
    expect(document.querySelectorAll('[data-kind="routePoint"]').length).toBeGreaterThan(0);
  });

  it('renders the polygon draft with its points and cursor', () => {
    const base = newDefense('5v5-def-cover-3');
    store().load(base);
    store().setDraft({
      kind: 'polygon',
      slotId: slotId(base, 'FS'),
      points: [
        { x: -5, y: 10 },
        { x: 5, y: 10 },
      ],
      cursor: { x: 5, y: 20 },
    });
    renderLayer();
    const draft = screen.getByTestId('zone-draft');
    expect(draft.querySelectorAll('circle')).toHaveLength(2);
    expect(draft.querySelector('polyline')?.getAttribute('points')?.split(' ')).toHaveLength(3);
    expect(draft.querySelector('polyline')).toHaveAttribute('stroke-dasharray');
  });

  it('rush and zone are replaced when the assignment changes', () => {
    const base = newDefense('5v5-def-cover-3');
    store().load(base);
    const r1 = slotId(base, 'R1');
    store().apply('clear', clearAssignment(r1));
    store().apply('rush', setRush(slotId(base, 'LB')));
    renderLayer();
    expect(screen.queryByTestId('rush-R1')).toBeNull();
    expect(screen.getByTestId('rush-LB')).toBeInTheDocument();
  });
});
