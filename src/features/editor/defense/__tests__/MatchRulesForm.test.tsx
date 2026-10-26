import { act, fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it } from 'vitest';
import { SCHEMA_VERSION, type MatchRule, type Play } from '@/domain/types';
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
