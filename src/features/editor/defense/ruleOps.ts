/**
 * Pure match-rule recipes (FR-DEF-07). Immutable; return the same Play when nothing changes.
 * Priorities are always re-packed to 0..n-1 in list order.
 */
import type { ID, MatchRule, Play, PlayerSlot } from '@/domain/types';
import type { Recipe } from '../ops';

/** Rules in run order (priority ascending, stable). */
const ordered = (slot: PlayerSlot): MatchRule[] =>
  (slot.matchRules ?? []).slice().sort((a, b) => a.priority - b.priority);

const repack = (rules: MatchRule[]): MatchRule[] =>
  rules.map((r, i) => (r.priority === i ? r : { ...r, priority: i }));

function withRules(play: Play, slotId: ID, build: (rules: MatchRule[]) => MatchRule[] | null): Play {
  const i = play.players.findIndex((s) => s.id === slotId);
  const slot = play.players[i];
  if (i < 0 || !slot) return play;
  const next = build(ordered(slot));
  if (!next) return play;
  const players = play.players.slice();
  players[i] = { ...slot, matchRules: repack(next) };
  return { ...play, players };
}

/** Append a default rule: when strong #1 vertical, depth >= 8, then carry. Priority = max + 1. */
export function addRule(slotId: ID, idGen: () => ID): Recipe {
  return (play) =>
    withRules(play, slotId, (rules) => {
      const priority = rules.reduce((m, r) => Math.max(m, r.priority), -1) + 1;
      const rule: MatchRule = {
        id: idGen(),
        priority,
        when: { receiver: { kind: 'number', side: 'strong', number: 1 }, event: 'vertical', minDepth: 8 },
        then: { type: 'carry' },
      };
      return [...rules, rule];
    });
}

/** Patch a rule (id and priority are not patchable). Keys set to undefined in `when` are removed. */
export function updateRule(
  slotId: ID,
  ruleId: ID,
  patch: { when?: Partial<MatchRule['when']>; then?: MatchRule['then'] },
): Recipe {
  return (play) =>
    withRules(play, slotId, (rules) => {
      const i = rules.findIndex((r) => r.id === ruleId);
      const cur = rules[i];
      if (i < 0 || !cur) return null;
      const when: Record<string, unknown> = { ...cur.when, ...patch.when };
      for (const k of Object.keys(when)) if (when[k] === undefined) delete when[k];
      const next: MatchRule = {
        ...cur,
        when: when as MatchRule['when'],
        then: patch.then ?? cur.then,
      };
      if (JSON.stringify(next) === JSON.stringify(cur)) return null;
      const out = rules.slice();
      out[i] = next;
      return out;
    });
}

export function removeRule(slotId: ID, ruleId: ID): Recipe {
  return (play) =>
    withRules(play, slotId, (rules) =>
      rules.some((r) => r.id === ruleId) ? rules.filter((r) => r.id !== ruleId) : null,
    );
}

/** Move a rule to list index `toIndex` (clamped). */
export function moveRule(slotId: ID, ruleId: ID, toIndex: number): Recipe {
  return (play) =>
    withRules(play, slotId, (rules) => {
      const from = rules.findIndex((r) => r.id === ruleId);
      const cur = rules[from];
      if (from < 0 || !cur) return null;
      const to = Math.max(0, Math.min(rules.length - 1, toIndex));
      if (to === from) return null;
      const out = rules.slice();
      out.splice(from, 1);
      out.splice(to, 0, cur);
      return out;
    });
}
