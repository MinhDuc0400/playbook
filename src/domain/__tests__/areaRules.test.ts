import { describe, expect, it } from 'vitest';
import {
  computeRuleLanes,
  cornerRules,
  insideRules,
  insideTeammate,
  laneMemberIds,
  laneRectangle,
  matchTemplate,
} from '../areaRules';
import { createDefaultFields } from '../field';
import type { MatchRule, PlayerSlot } from '../types';

const field = createDefaultFields()['5v5'];
let n = 0;
const idGen = () => `r${++n}`;

function def(
  label: string,
  x: number,
  matchRules?: MatchRule[],
  role: PlayerSlot['role'] = 'CB',
): PlayerSlot {
  const s: PlayerSlot = { id: label, role, label, start: { x, y: 3.5 }, actions: [] };
  if (matchRules) s.matchRules = matchRules;
  return s;
}

/** CB2 −8, LB −1.5, S 4, CB1 9 — the Bangkok alignment, as rules. */
const bangkok = (): PlayerSlot[] => [
  def('CB2', -8, cornerRules(idGen)),
  def('LB', -1.5, insideRules(idGen, 'CB2')),
  def('S', 4, insideRules(idGen, 'CB1')),
  def('CB1', 9, cornerRules(idGen)),
];

describe('D-48 area rules (domain)', () => {
  it('lane members: area-rule holders and named teammates; rushers excluded', () => {
    expect(
      laneMemberIds([
        def('CB2', -8, cornerRules(idGen)),
        def('S', 4, insideRules(idGen, 'CB1')),
        def('CB1', 9),
      ]),
    ).toEqual(['CB2', 'S', 'CB1']);
    const lb = def('LB', -1.5);
    expect(laneMemberIds([lb, def('S', 4, insideRules(idGen, 'LB'))])).toEqual(['LB', 'S']);
    const rusher: PlayerSlot = {
      ...def('R', 0, cornerRules(idGen), 'R'),
      actions: [{ type: 'rush', path: [{ x: 0, y: -5 }] }],
    };
    expect(laneMemberIds([rusher, ...bangkok()])).toEqual(['CB2', 'LB', 'S', 'CB1']);
  });

  it('rule lanes match the D-40 boundaries for the Bangkok alignment', () => {
    expect(computeRuleLanes(bangkok())!.boundaries).toEqual([-4.75, 1.25, 6.5]);
    expect(computeRuleLanes([def('X', 0)])).toBeNull();
  });

  it('matchTemplate compares structure only', () => {
    expect(matchTemplate(cornerRules(idGen))).toBe('corner');
    expect(matchTemplate(insideRules(idGen, 'X'))).toBe('inside');
    expect(matchTemplate(insideRules(idGen, null))).toBe('inside');
    expect(matchTemplate([...cornerRules(idGen), ...cornerRules(idGen)])).toBeNull();
    expect(matchTemplate([{ ...cornerRules(idGen)[0]!, then: { type: 'carry' } }])).toBeNull();
    expect(matchTemplate(undefined)).toBeNull();
    expect(matchTemplate([])).toBeNull();
  });

  it('insideTeammate: the neighbour holding the corner rule, left first', () => {
    const slots = bangkok();
    expect(insideTeammate(slots, 'S')).toBe('CB1');
    expect(insideTeammate(slots, 'LB')).toBe('CB2');
  });

  it('insideTeammate: no templated corner → the neighbour toward the nearer sideline', () => {
    const slots = [def('CB2', -8), def('LB', -1.5), def('S', 4), def('CB1', 9)];
    // CB2/CB1 are not lane members yet; the candidates are lane members plus the slot itself.
    expect(insideTeammate(slots, 'S')).toBeNull();
    const withMembers = [
      def('CB2', -8, insideRules(idGen, 'LB')),
      def('LB', -1.5),
      def('S', 4),
      def('CB1', 9, insideRules(idGen, 'S')),
    ];
    expect(insideTeammate(withMembers, 'S')).toBe('CB1');
    expect(insideTeammate(withMembers, 'LB')).toBe('CB2');
  });

  it("insideTeammate: the reviewer's case keeps today's left-first choice", () => {
    const slots = [def('CB2', -8, cornerRules(idGen)), def('S', 2), def('CB1', 9, cornerRules(idGen))];
    expect(insideTeammate(slots, 'S')).toBe('CB2');
  });

  it('laneRectangle: the slot lane, y 0..10', () => {
    const rect = laneRectangle(bangkok(), 'S', field);
    const xs = rect.map((p) => p.x);
    const ys = rect.map((p) => p.y);
    expect(Math.min(...xs)).toBeCloseTo(1.25);
    expect(Math.max(...xs)).toBeCloseTo(6.5);
    expect(Math.min(...ys)).toBe(0);
    expect(Math.max(...ys)).toBe(10);
  });
});
