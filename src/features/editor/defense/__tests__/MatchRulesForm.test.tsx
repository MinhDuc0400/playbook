import { act, fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it } from 'vitest';
import { SCHEMA_VERSION, type MatchRule, type Play } from '@/domain/types';
import { t } from '@/i18n/vi';
import { useEditorStore } from '@/store/editorStore';
import { MatchRulesForm } from '../MatchRulesForm';

const store = () => useEditorStore.getState();

function mk(rules?: MatchRule[]): Play {
  return {
    id: 'd',
    schemaVersion: SCHEMA_VERSION,
    name: 'D',
    side: 'defense',
    format: '5v5',
    formation: 'T',
    strength: 'right',
    tags: [],
    createdAt: 1,
    updatedAt: 2,
    players: [
      {
        id: 'cb',
        role: 'CB',
        label: 'CB',
        start: { x: 0, y: 5 },
        actions: [],
        ...(rules ? { matchRules: rules } : {}),
      },
    ],
  };
}
const rules = (): MatchRule[] => store().play?.players[0]?.matchRules ?? [];
const past = (): number => useEditorStore.temporal.getState().pastStates.length;

function setup(r?: MatchRule[]): void {
  act(() => store().load(mk(r)));
  render(<MatchRulesForm slotId="cb" />);
}
const rule = (id: string, priority: number): MatchRule => ({
  id,
  priority,
  when: { receiver: { kind: 'role', role: 'RB' }, event: 'out' },
  then: { type: 'carry' },
});
const change = (testId: string, value: string) =>
  fireEvent.change(screen.getByTestId(testId), { target: { value } });

describe('MatchRulesForm (FR-DEF-07)', () => {
  beforeEach(() => act(() => store().load(null)));

  it('adds a rule, edits every field, and stores the exact MatchRule (one undo step per edit)', () => {
    setup();
    fireEvent.click(screen.getByTestId('rule-add'));
    expect(rules()).toHaveLength(1);
    const id = rules()[0]?.id ?? '';
    expect(rules()[0]).toMatchObject({
      priority: 0,
      when: { minDepth: 8, event: 'vertical' },
      then: { type: 'carry' },
    });

    let n = past();
    change(`rule-receiver-${id}`, 'strong-2');
    change(`rule-event-${id}`, 'out');
    change(`rule-depth-${id}`, '5');
    expect(past()).toBe(n + 3);
    change(`rule-then-${id}`, 'man');
    n = past();
    change(`rule-target-${id}`, 'weak-1');
    expect(past()).toBe(n + 1);
    expect(rules()[0]).toEqual({
      id,
      priority: 0,
      when: { receiver: { kind: 'number', side: 'strong', number: 2 }, event: 'out', minDepth: 5 },
      then: { type: 'man', target: { kind: 'number', side: 'weak', number: 1 } },
    });

    change(`rule-before-${id}`, '2.5');
    expect(rules()[0]?.when.beforeTime).toBe(2.5);
    change(`rule-before-${id}`, '');
    expect(rules()[0]?.when).not.toHaveProperty('beforeTime');

    act(() => store().undo());
    expect(rules()[0]?.when).toHaveProperty('beforeTime');
  });

  it('zone reaction stores the preset; clearing depth removes minDepth', () => {
    setup([{ ...rule('a', 0), when: { ...rule('a', 0).when, minDepth: 6 } }]);
    change('rule-then-a', 'zone');
    change('rule-zone-a', 'flat-L');
    expect(rules()[0]?.then).toEqual({ type: 'zone', zone: 'flat-L' });
    change('rule-depth-a', '');
    expect(rules()[0]?.when).not.toHaveProperty('minDepth');
    change('rule-then-a', 'passOff');
    expect(rules()[0]?.then).toEqual({ type: 'passOff' });
    expect(screen.queryByTestId('rule-zone-a')).toBeNull();
  });

  it('up/down buttons and drag-drop reorder priorities; delete removes', () => {
    setup([rule('a', 0), rule('b', 1), rule('c', 2)]);
    expect((screen.getByTestId('rule-up-a') as HTMLButtonElement).disabled).toBe(true);
    fireEvent.click(screen.getByTestId('rule-down-a'));
    expect(rules().map((r) => [r.id, r.priority])).toEqual([
      ['b', 0],
      ['a', 1],
      ['c', 2],
    ]);
    fireEvent.click(screen.getByTestId('rule-up-c'));
    expect(rules().map((r) => r.id)).toEqual(['b', 'c', 'a']);

    fireEvent.dragStart(screen.getByTestId('rule-b'));
    fireEvent.drop(screen.getByTestId('rule-a'));
    expect(rules().map((r) => [r.id, r.priority])).toEqual([
      ['c', 0],
      ['a', 1],
      ['b', 2],
    ]);

    const n = past();
    fireEvent.click(screen.getByTestId('rule-delete-a'));
    expect(rules().map((r) => [r.id, r.priority])).toEqual([
      ['c', 0],
      ['b', 1],
    ]);
    expect(past()).toBe(n + 1);
    expect(screen.queryByTestId('rule-a')).toBeNull();
  });
});

describe('D-48 template select on a plain slot', () => {
  beforeEach(() => act(() => store().load(null)));

  it('shows the template select (value "rules") and the rule list stays visible', () => {
    setup([rule('a', 0)]);
    expect(screen.queryByTestId('rule-mode')).toBeNull();
    expect((screen.getByTestId('rule-template') as HTMLSelectElement).value).toBe('rules');
    expect(screen.getByTestId('rules-list')).toBeInTheDocument();
  });
});

describe('D-48 Bunch Killer template and area options', () => {
  const slot = (id: string, x: number, extra: Partial<Play['players'][number]> = {}) => ({
    id,
    role: 'CB' as const,
    label: id.toUpperCase(),
    start: { x, y: 3.5 },
    actions: [],
    ...extra,
  });
  function board(): Play {
    return {
      ...mk(),
      players: [
        slot('cb2', -8),
        slot('s', 4),
        slot('cb1', 9),
        slot('r', 0, { role: 'R', actions: [{ type: 'rush', path: [{ x: 0, y: -5 }] }] }),
      ],
    };
  }
  const get = (id: string) => store().play!.players.find((p) => p.id === id)!;
  function open(id: string): void {
    act(() => store().load(board()));
    render(<MatchRulesForm slotId={id} />);
  }

  it('template Corner writes the corner rule in one undo step and shows the hint', () => {
    open('cb1');
    const select = screen.getByTestId('rule-template') as HTMLSelectElement;
    expect(select.value).toBe('rules');
    change('rule-template', 'corner');
    const rs = get('cb1').matchRules!;
    expect(rs).toHaveLength(1);
    expect(rs[0]).toMatchObject({
      when: { receiver: { kind: 'nth', n: 1 }, event: 'entersArea', area: { kind: 'self' } },
      then: { type: 'manTrigger' },
    });
    expect((screen.getByTestId('rule-template') as HTMLSelectElement).value).toBe('corner');
    expect(screen.getByTestId('rule-area-hint')).toHaveTextContent(t.rules.areaMatch.cornerHint);
    expect(screen.getByTestId('rules-list')).toBeInTheDocument();
    expect(past()).toBe(1);
  });

  it('template Inside picks the templated corner beside it and gives a zone-less slot its lane zone', () => {
    act(() => store().load(board()));
    act(() =>
      store().apply('t', (p) => ({
        ...p,
        players: p.players.map((s) =>
          s.id === 'cb1'
            ? {
                ...s,
                matchRules: [
                  {
                    id: 'k',
                    priority: 0,
                    when: { receiver: { kind: 'nth', n: 1 }, event: 'entersArea', area: { kind: 'self' } },
                    then: { type: 'manTrigger' },
                  },
                ],
              }
            : s,
        ),
      })),
    );
    render(<MatchRulesForm slotId="s" />);
    change('rule-template', 'inside');
    const s = get('s');
    expect(s.matchRules![0]!.when.area).toEqual({ kind: 'teammate', slotId: 'cb1' });
    const z = s.actions.find((a) => a.type === 'zone');
    // D-51: the live lane zone, not a frozen copy of today's lane.
    expect(z).toMatchObject({ type: 'zone', zone: 'lane' });
    expect((screen.getByTestId('rule-template') as HTMLSelectElement).value).toBe('inside');
  });

  it('event "vào khu vực của" shows the area select (default tôi) and offers Người thứ 1/2', () => {
    open('cb1');
    fireEvent.click(screen.getByTestId('rule-add'));
    const id = get('cb1').matchRules![0]!.id;
    expect(screen.queryByTestId(`rule-area-${id}`)).toBeNull();
    change(`rule-event-${id}`, 'entersArea');
    expect(get('cb1').matchRules![0]!.when.area).toEqual({ kind: 'self' });
    const area = screen.getByTestId(`rule-area-${id}`) as HTMLSelectElement;
    expect(area.value).toBe('self');
    const opts = [...area.options].map((o) => o.value);
    expect(opts).toEqual(['self', 'cb2', 's']); // rusher excluded
    change(`rule-area-${id}`, 'cb2');
    expect(get('cb1').matchRules![0]!.when.area).toEqual({ kind: 'teammate', slotId: 'cb2' });
    change(`rule-receiver-${id}`, 'nth-2');
    expect(get('cb1').matchRules![0]!.when.receiver).toEqual({ kind: 'nth', n: 2 });
    // back to a direction event: nth → any, area removed
    change(`rule-event-${id}`, 'out');
    const w = get('cb1').matchRules![0]!.when;
    expect(w.receiver).toEqual({ kind: 'any' });
    expect('area' in w).toBe(false);
    const recv = screen.getByTestId(`rule-receiver-${id}`) as HTMLSelectElement;
    expect([...recv.options].map((o) => o.value)).not.toContain('nth-1');
    expect([...recv.options].map((o) => o.value)).toContain('any');
  });

  it('Phản ứng "Man người đó" is stored as manTrigger', () => {
    open('cb1');
    fireEvent.click(screen.getByTestId('rule-add'));
    const id = get('cb1').matchRules![0]!.id;
    change(`rule-then-${id}`, 'manTrigger');
    expect(get('cb1').matchRules![0]!.then).toEqual({ type: 'manTrigger' });
  });

  it('a rusher gets no template select', () => {
    open('r');
    expect(screen.queryByTestId('rule-template')).toBeNull();
  });
});

describe('D-52 backpedal at the snap', () => {
  beforeEach(() => act(() => store().load(null)));
  const box = () => screen.getByTestId('rule-snap-backpedal') as HTMLInputElement;

  it('the checkbox puts "Khi bóng snap thì Lùi 3 yd" on top in one undo step; unticking removes it', () => {
    setup([rule('a', 0)]);
    expect(box().checked).toBe(false);
    fireEvent.click(box());
    expect(past()).toBe(1);
    expect(rules().map((x) => x.when.event)).toEqual(['snap', 'out']);
    expect(rules()[0]).toMatchObject({
      priority: 0,
      when: { receiver: { kind: 'any' }, event: 'snap' },
      then: { type: 'backpedal', yards: 3 },
    });
    expect(box().checked).toBe(true);
    fireEvent.click(box());
    expect(rules().map((x) => x.id)).toEqual(['a']);
  });

  it('the snap row edits the yards and hides receiver, depth and time', () => {
    setup();
    fireEvent.click(box());
    const id = rules()[0]!.id;
    expect(screen.queryByTestId(`rule-receiver-${id}`)).toBeNull();
    expect(screen.queryByTestId(`rule-depth-${id}`)).toBeNull();
    expect(screen.queryByTestId(`rule-before-${id}`)).toBeNull();
    change(`rule-yards-${id}`, '4.5');
    expect(rules()[0]!.then).toEqual({ type: 'backpedal', yards: 4.5 });
    change(`rule-yards-${id}`, '');
    expect(rules()[0]!.then).toEqual({ type: 'backpedal', yards: 4.5 });
    const then = screen.getByTestId(`rule-then-${id}`) as HTMLSelectElement;
    expect([...then.options].map((o) => o.value)).toEqual(['man', 'zone', 'backpedal']);
  });

  it('switching a rule to the snap event drops what needs a receiver', () => {
    setup([rule('a', 0)]);
    change('rule-event-a', 'snap');
    expect(rules()[0]).toEqual({
      id: 'a',
      priority: 0,
      when: { receiver: { kind: 'any' }, event: 'snap' },
      then: { type: 'backpedal', yards: 3 },
    });
  });

  it('picking a template keeps the backpedal on top and still shows the template', () => {
    setup();
    fireEvent.click(box());
    change('rule-template', 'corner');
    expect(rules().map((x) => x.when.event)).toEqual(['snap', 'entersArea']);
    expect((screen.getByTestId('rule-template') as HTMLSelectElement).value).toBe('corner');
    expect(box().checked).toBe(true);
  });
});
