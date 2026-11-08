/**
 * FR-DEF-07: per-defender rule list "Khi [receiver] [sự kiện] [sâu ≥ n yd] thì [phản ứng]", drag to reorder
 * (priority = list order), add / edit / delete. D-40: the "Kiểu" select also offers the Bunch Killer
 * (Bangkok) area match (corner / inside); then the custom rules are hidden (the engine ignores them) and kept.
 */
import { nanoid } from 'nanoid';
import { useState } from 'react';
import { Button, IconButton, Select, TextInput } from '@/components/ui';
import {
  DEFAULT_SQUEEZE_AFTER,
  ZONE_PRESET_IDS,
  type AreaMatch,
  type ID,
  type PlayerSlot,
  type MatchEvent,
  type MatchRule,
  type ReceiverRef,
  type ZonePresetId,
} from '@/domain/types';
import { t } from '@/i18n/vi';
import { useEditorStore } from '@/store/editorStore';
import { setAreaMatch } from './ops';
import { addRule, moveRule, removeRule, updateRule } from './ruleOps';

export interface MatchRulesFormProps {
  slotId: ID;
}

const r = t.rules;

const EVENTS: readonly MatchEvent[] = ['vertical', 'out', 'in', 'under', 'release', 'stop'];
const REACTIONS = ['man', 'zone', 'carry', 'passOff'] as const;
type Reaction = (typeof REACTIONS)[number];

/** Option value <-> ReceiverRef: "strong-1", "weak-3", "RB". */
const REFS: readonly ReceiverRef[] = [
  ...(['strong', 'weak'] as const).flatMap((side) =>
    ([1, 2, 3] as const).map((number): ReceiverRef => ({ kind: 'number', side, number })),
  ),
  { kind: 'role', role: 'RB' },
  { kind: 'role', role: 'QB' },
  { kind: 'role', role: 'C' },
];
const refKey = (ref: ReceiverRef): string => (ref.kind === 'role' ? ref.role : `${ref.side}-${ref.number}`);
const refText = (ref: ReceiverRef): string =>
  ref.kind === 'role' ? ref.role : `${ref.side === 'strong' ? r.strong : r.weak} #${ref.number}`;
const parseRef = (key: string): ReceiverRef | undefined => REFS.find((x) => refKey(x) === key);

const isEvent = (v: string): v is MatchEvent => (EVENTS as readonly string[]).includes(v);
const isReaction = (v: string): v is Reaction => (REACTIONS as readonly string[]).includes(v);
const isZone = (v: string): v is ZonePresetId => (ZONE_PRESET_IDS as readonly string[]).includes(v);

const DEFAULT_ZONE: ZonePresetId = 'hook-M';

/** Number input text -> value; undefined when empty / invalid / negative. */
function parseOptional(raw: string): number | undefined {
  if (raw.trim() === '') return undefined;
  const n = Number(raw);
  return Number.isFinite(n) && n >= 0 ? n : undefined;
}

function ReceiverOptions(): JSX.Element {
  return (
    <>
      {REFS.map((ref) => (
        <option key={refKey(ref)} value={refKey(ref)}>
          {refText(ref)}
        </option>
      ))}
    </>
  );
}

function numberInputClass(): string {
  return 'w-16 rounded-md border border-slate-300 bg-white px-2 py-1 text-sm dark:border-slate-600 dark:bg-slate-900';
}

function RuleRow({
  slotId,
  rule,
  index,
  count,
  dragId,
  setDragId,
}: {
  slotId: ID;
  rule: MatchRule;
  index: number;
  count: number;
  dragId: ID | null;
  setDragId: (id: ID | null) => void;
}): JSX.Element {
  const apply = useEditorStore.getState().apply;
  const id = rule.id;
  const patchWhen = (when: Partial<MatchRule['when']>): void =>
    apply('match rule', updateRule(slotId, id, { when }));
  const setThen = (then: MatchRule['then']): void => apply('match rule', updateRule(slotId, id, { then }));

  const onReaction = (v: Reaction): void => {
    if (v === 'man') setThen({ type: 'man', target: { kind: 'number', side: 'strong', number: 1 } });
    else if (v === 'zone') setThen({ type: 'zone', zone: DEFAULT_ZONE });
    else setThen({ type: v });
  };

  return (
    <li
      data-testid={`rule-${id}`}
      draggable
      onDragStart={(e) => {
        setDragId(id);
        e.dataTransfer?.setData('text/plain', id);
      }}
      onDragOver={(e) => e.preventDefault()}
      onDrop={(e) => {
        e.preventDefault();
        if (dragId && dragId !== id) apply('move rule', moveRule(slotId, dragId, index));
        setDragId(null);
      }}
      onDragEnd={() => setDragId(null)}
      className="flex flex-wrap items-end gap-2 rounded-md border border-slate-200 p-2 text-sm dark:border-slate-700"
    >
      <span aria-hidden title={r.drag} className="cursor-grab select-none">
        ⠿
      </span>
      <span className="pb-1">{r.when}</span>
      <Select
        label={r.receiver}
        data-testid={`rule-receiver-${id}`}
        value={refKey(rule.when.receiver)}
        onChange={(e) => {
          const ref = parseRef(e.target.value);
          if (ref) patchWhen({ receiver: ref });
        }}
      >
        <ReceiverOptions />
      </Select>
      <Select
        label={r.event}
        data-testid={`rule-event-${id}`}
        value={rule.when.event}
        onChange={(e) => {
          if (isEvent(e.target.value)) patchWhen({ event: e.target.value });
        }}
      >
        {EVENTS.map((ev) => (
          <option key={ev} value={ev}>
            {r.events[ev]}
          </option>
        ))}
      </Select>
      <label className="flex flex-col gap-1 font-medium">
        {r.depth}
        <input
          type="number"
          min={0}
          step={1}
          className={numberInputClass()}
          data-testid={`rule-depth-${id}`}
          value={rule.when.minDepth ?? ''}
          onChange={(e) => patchWhen({ minDepth: parseOptional(e.target.value) })}
        />
      </label>
      <label className="flex flex-col gap-1 font-medium">
        {`${r.before} (${r.beforeUnit})`}
        <input
          type="number"
          min={0}
          step={0.5}
          className={numberInputClass()}
          data-testid={`rule-before-${id}`}
          value={rule.when.beforeTime ?? ''}
          onChange={(e) => patchWhen({ beforeTime: parseOptional(e.target.value) })}
        />
      </label>
      <span className="pb-1">{r.then}</span>
      <Select
        label={r.reaction}
        data-testid={`rule-then-${id}`}
        value={rule.then.type}
        onChange={(e) => {
          if (isReaction(e.target.value)) onReaction(e.target.value);
        }}
      >
        {REACTIONS.map((k) => (
          <option key={k} value={k}>
            {r.reactions[k]}
          </option>
        ))}
      </Select>
      {rule.then.type === 'man' ? (
        <Select
          label={r.target}
          data-testid={`rule-target-${id}`}
          value={refKey(rule.then.target)}
          onChange={(e) => {
            const ref = parseRef(e.target.value);
            if (ref) setThen({ type: 'man', target: ref });
          }}
        >
          <ReceiverOptions />
        </Select>
      ) : null}
      {rule.then.type === 'zone' ? (
        <Select
          label={r.zone}
          data-testid={`rule-zone-${id}`}
          value={rule.then.zone}
          onChange={(e) => {
            if (isZone(e.target.value)) setThen({ type: 'zone', zone: e.target.value });
          }}
        >
          {ZONE_PRESET_IDS.map((z) => (
            <option key={z} value={z}>
              {z}
            </option>
          ))}
        </Select>
      ) : null}
      <IconButton
        label={r.moveUp}
        data-testid={`rule-up-${id}`}
        disabled={index === 0}
        onClick={() => apply('move rule', moveRule(slotId, id, index - 1))}
      >
        ↑
      </IconButton>
      <IconButton
        label={r.moveDown}
        data-testid={`rule-down-${id}`}
        disabled={index === count - 1}
        onClick={() => apply('move rule', moveRule(slotId, id, index + 1))}
      >
        ↓
      </IconButton>
      <IconButton
        label={r.remove}
        variant="danger"
        data-testid={`rule-delete-${id}`}
        onClick={() => apply('delete rule', removeRule(slotId, id))}
      >
        ×
      </IconButton>
    </li>
  );
}

const SQUEEZE_MIN = 0;
const SQUEEZE_MAX = 3;

/** D-40: pattern-match mode select (custom rules / Bangkok corner / Bangkok inside) + corner squeeze time. */
function ModeControls({ slot }: { slot: PlayerSlot }): JSX.Element {
  const apply = useEditorStore.getState().apply;
  const [draft, setDraft] = useState<string | null>(null);
  const am = slot.areaMatch;
  const onMode = (v: string): void => {
    setDraft(null);
    const next: AreaMatch | undefined = v === 'corner' || v === 'inside' ? { role: v } : undefined;
    apply('area match', setAreaMatch(slot.id, next));
  };
  const onSqueeze = (raw: string): void => {
    setDraft(raw);
    const n = parseOptional(raw);
    if (n === undefined || n < SQUEEZE_MIN || n > SQUEEZE_MAX || !am) return;
    apply('squeeze after', setAreaMatch(slot.id, { ...am, squeezeAfter: n }));
  };
  return (
    <>
      <Select
        label={r.mode}
        data-testid="rule-mode"
        value={am?.role ?? 'rules'}
        onChange={(e) => onMode(e.target.value)}
      >
        <option value="rules">{r.areaMatch.rules}</option>
        <option value="corner">{r.areaMatch.corner}</option>
        <option value="inside">{r.areaMatch.inside}</option>
      </Select>
      {am ? (
        <p data-testid="rule-area-hint" className="text-xs text-slate-500 dark:text-slate-400">
          {am.role === 'corner' ? r.areaMatch.cornerHint : r.areaMatch.insideHint}
        </p>
      ) : null}
      {am?.role === 'corner' ? (
        <TextInput
          label={r.areaMatch.squeezeAfter}
          type="number"
          data-testid="rule-squeeze-after"
          min={SQUEEZE_MIN}
          max={SQUEEZE_MAX}
          step={0.1}
          value={draft ?? String(am.squeezeAfter ?? DEFAULT_SQUEEZE_AFTER)}
          onChange={(e) => onSqueeze(e.target.value)}
          onBlur={() => setDraft(null)}
        />
      ) : null}
    </>
  );
}

export function MatchRulesForm({ slotId }: MatchRulesFormProps): JSX.Element | null {
  const slot = useEditorStore((st) => st.play?.players.find((p) => p.id === slotId));
  const [dragId, setDragId] = useState<ID | null>(null);
  if (!slot) return null;
  const rules = (slot.matchRules ?? []).slice().sort((a, b) => a.priority - b.priority);
  const rusher = slot.actions.some((a) => a.type === 'rush');
  const area = !rusher && slot.areaMatch !== undefined;

  return (
    <section aria-label={r.title} className="flex flex-col gap-2">
      <h4 className="text-sm font-semibold text-slate-900 dark:text-slate-100">{r.title}</h4>
      {!rusher || slot.areaMatch ? <ModeControls slot={slot} /> : null}
      {area ? null : (
        <>
          {rules.length === 0 ? (
            <p className="text-sm text-slate-500 dark:text-slate-400">{r.empty}</p>
          ) : null}
          <ol data-testid="rules-list" className="flex flex-col gap-2">
            {rules.map((rule, i) => (
              <RuleRow
                key={rule.id}
                slotId={slotId}
                rule={rule}
                index={i}
                count={rules.length}
                dragId={dragId}
                setDragId={setDragId}
              />
            ))}
          </ol>
          <div>
            <Button
              size="sm"
              data-testid="rule-add"
              onClick={() => {
                const id = nanoid();
                useEditorStore.getState().apply(
                  'add rule',
                  addRule(slotId, () => id),
                );
              }}
            >
              {r.add}
            </Button>
          </div>
        </>
      )}
    </section>
  );
}
