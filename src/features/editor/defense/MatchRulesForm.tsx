/**
 * FR-DEF-07: per-defender rule list "Khi [receiver] [sự kiện] [sâu ≥ n yd] thì [phản ứng]", drag to reorder
 * (priority = list order), add / edit / delete. D-48: the "Mẫu" select fills in the Bunch Killer (Bangkok)
 * corner / inside rule; rules may watch an alignment lane ("vào khu vực của") and man the trigger.
 * D-52: "Lùi khi bóng snap" puts "Khi bóng snap thì Lùi 3 yd" on top of the rules (templates keep it).
 */
import { nanoid } from 'nanoid';
import { useState } from 'react';
import { Button, IconButton, Select } from '@/components/ui';
import {
  ZONE_PRESET_IDS,
  type FieldConfig,
  type ID,
  type PlayerSlot,
  type MatchEvent,
  type MatchRule,
  type ReceiverRef,
  type RuleReceiver,
  type ZonePresetId,
} from '@/domain/types';
import {
  BACKPEDAL_YARDS,
  canCover,
  cornerRules,
  hasSnapBackpedal,
  insideRules,
  insideTeammate,
  isReceiverRef,
  isSnapBackpedal,
  matchTemplate,
  withSnapBackpedal,
} from '@/domain/areaRules';
import { createDefaultFields } from '@/domain/field';
import { t } from '@/i18n/vi';
import { useEditorStore } from '@/store/editorStore';
import { setZone } from './ops';
import { addRule, moveRule, removeRule, setRules, updateRule } from './ruleOps';

export interface MatchRulesFormProps {
  slotId: ID;
  /** Field for the Inside template's lane zone (D-48); default 5v5. */
  field?: FieldConfig;
}

const DEFAULT_FIELD = createDefaultFields()['5v5'];

const r = t.rules;

const EVENTS: readonly MatchEvent[] = [
  'vertical',
  'out',
  'in',
  'under',
  'release',
  'stop',
  'entersArea',
  'snap',
];
const REACTIONS = ['man', 'manTrigger', 'zone', 'carry', 'passOff', 'backpedal'] as const;
type Reaction = (typeof REACTIONS)[number];
/** D-52: reactions that act on the receiver that made the rule fire; a snap rule has none. */
const TRIGGER_REACTIONS: readonly Reaction[] = ['manTrigger', 'carry', 'passOff'];

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

/** D-48 receivers: "any", "nth-1", "nth-2" next to the ReceiverRef keys. */
const receiverKey = (rcv: RuleReceiver): string =>
  isReceiverRef(rcv) ? refKey(rcv) : rcv.kind === 'nth' ? `nth-${rcv.n}` : 'any';
const parseReceiver = (key: string): RuleReceiver | undefined =>
  key === 'any'
    ? { kind: 'any' }
    : key === 'nth-1'
      ? { kind: 'nth', n: 1 }
      : key === 'nth-2'
        ? { kind: 'nth', n: 2 }
        : parseRef(key);

const isEvent = (v: string): v is MatchEvent => (EVENTS as readonly string[]).includes(v);
const isReaction = (v: string): v is Reaction => (REACTIONS as readonly string[]).includes(v);
const isZone = (v: string): v is ZonePresetId => (ZONE_PRESET_IDS as readonly string[]).includes(v);

const DEFAULT_ZONE: ZonePresetId = 'hook-M';

/** Backpedal yards input -> value; undefined when empty / invalid / not positive. */
function parseYards(raw: string): number | undefined {
  const n = parseOptional(raw);
  return n !== undefined && n > 0 ? n : undefined;
}

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
  teammates,
}: {
  slotId: ID;
  teammates: readonly { id: ID; label: string }[];
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
  const area = rule.when.event === 'entersArea';
  const snap = rule.when.event === 'snap';
  const a = rule.when.area;
  const areaKey =
    a?.kind === 'teammate' ? (teammates.some((m) => m.id === a.slotId) ? a.slotId : '') : 'self';

  const onReaction = (v: Reaction): void => {
    if (v === 'man') setThen({ type: 'man', target: { kind: 'number', side: 'strong', number: 1 } });
    else if (v === 'manTrigger') setThen({ type: 'manTrigger' });
    else if (v === 'zone') setThen({ type: 'zone', zone: DEFAULT_ZONE });
    else if (v === 'backpedal') setThen({ type: 'backpedal', yards: BACKPEDAL_YARDS });
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
      {snap ? null : (
        <Select
          label={r.receiver}
          data-testid={`rule-receiver-${id}`}
          value={receiverKey(rule.when.receiver)}
          onChange={(e) => {
            const rcv = parseReceiver(e.target.value);
            if (rcv) patchWhen({ receiver: rcv });
          }}
        >
          <option value="any">{r.any}</option>
          {area ? (
            <>
              <option value="nth-1">{r.nth[1]}</option>
              <option value="nth-2">{r.nth[2]}</option>
            </>
          ) : null}
          <ReceiverOptions />
        </Select>
      )}
      <Select
        label={r.event}
        data-testid={`rule-event-${id}`}
        value={rule.when.event}
        onChange={(e) => {
          const ev = e.target.value;
          if (!isEvent(ev)) return;
          if (ev === 'entersArea') patchWhen({ event: ev, area: rule.when.area ?? { kind: 'self' } });
          else if (ev === 'snap') {
            const then: MatchRule['then'] = (TRIGGER_REACTIONS as readonly string[]).includes(rule.then.type)
              ? { type: 'backpedal', yards: BACKPEDAL_YARDS }
              : rule.then;
            apply(
              'match rule',
              updateRule(slotId, id, {
                when: {
                  event: ev,
                  receiver: { kind: 'any' },
                  area: undefined,
                  minDepth: undefined,
                  beforeTime: undefined,
                },
                then,
              }),
            );
          } else
            patchWhen({
              event: ev,
              area: undefined,
              ...(rule.when.receiver.kind === 'nth' ? { receiver: { kind: 'any' } } : {}),
            });
        }}
      >
        {EVENTS.map((ev) => (
          <option key={ev} value={ev}>
            {r.events[ev]}
          </option>
        ))}
      </Select>
      {area ? (
        <Select
          label={r.areaOf}
          data-testid={`rule-area-${id}`}
          value={areaKey}
          onChange={(e) => {
            const v = e.target.value;
            if (v === 'self') patchWhen({ area: { kind: 'self' } });
            else if (v) patchWhen({ area: { kind: 'teammate', slotId: v } });
          }}
        >
          {areaKey === '' ? <option value="">{r.noTeammate}</option> : null}
          <option value="self">{r.self}</option>
          {teammates.map((m) => (
            <option key={m.id} value={m.id}>
              {m.label}
            </option>
          ))}
        </Select>
      ) : null}
      {snap ? null : (
        <>
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
        </>
      )}
      <span className="pb-1">{r.then}</span>
      <Select
        label={r.reaction}
        data-testid={`rule-then-${id}`}
        value={rule.then.type}
        onChange={(e) => {
          if (isReaction(e.target.value)) onReaction(e.target.value);
        }}
      >
        {REACTIONS.filter((k) => !snap || !TRIGGER_REACTIONS.includes(k)).map((k) => (
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
      {rule.then.type === 'backpedal' ? (
        <label className="flex flex-col gap-1 font-medium">
          {r.yards}
          <input
            type="number"
            min={0.5}
            step={0.5}
            className={numberInputClass()}
            data-testid={`rule-yards-${id}`}
            defaultValue={rule.then.yards}
            key={rule.then.yards}
            onChange={(e) => {
              const yards = parseYards(e.target.value);
              if (yards !== undefined) setThen({ type: 'backpedal', yards });
            }}
          />
        </label>
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

/** D-48: Bunch Killer template select. Picking a template replaces this slot's rules (one undo step). */
function TemplateControls({ slot, field }: { slot: PlayerSlot; field: FieldConfig }): JSX.Element {
  const current = matchTemplate(slot.matchRules) ?? 'rules';
  const backpedal = hasSnapBackpedal(slot.matchRules);
  const onTemplate = (v: string): void => {
    if (v !== 'corner' && v !== 'inside') return;
    const ruleId = () => nanoid();
    // D-52: the snap backpedal stays on top of the template.
    const keep = (slot.matchRules ?? []).filter(isSnapBackpedal);
    useEditorStore.getState().apply('rule template', (play) => {
      if (v === 'corner') return setRules(slot.id, [...keep, ...cornerRules(ruleId)])(play);
      const inside = insideRules(ruleId, insideTeammate(play.players, slot.id));
      const withRules = setRules(slot.id, [...keep, ...inside])(play);
      const s = withRules.players.find((p) => p.id === slot.id);
      const covers = s?.actions.some(
        (x) => x.type === 'zone' || x.type === 'man' || x.type === 'spy' || x.type === 'rush',
      );
      if (!s || covers) return withRules;
      // A zone-less inside defender keeps zoning its lane: the live lane zone (D-51).
      return setZone(slot.id, 'lane', field)(withRules);
    });
  };
  return (
    <>
      <Select
        label={r.template}
        data-testid="rule-template"
        value={current}
        onChange={(e) => onTemplate(e.target.value)}
      >
        <option value="rules">{r.areaMatch.rules}</option>
        <option value="corner">{r.areaMatch.corner}</option>
        <option value="inside">{r.areaMatch.inside}</option>
      </Select>
      {current !== 'rules' ? (
        <p data-testid="rule-area-hint" className="text-xs text-slate-500 dark:text-slate-400">
          {current === 'corner' ? r.areaMatch.cornerHint : r.areaMatch.insideHint}
        </p>
      ) : null}
      <label className="flex items-center gap-2 text-sm" title={r.snapBackpedalHint}>
        <input
          type="checkbox"
          data-testid="rule-snap-backpedal"
          checked={backpedal}
          onChange={(e) => {
            const on = e.target.checked;
            useEditorStore.getState().apply(
              'snap backpedal',
              setRules(
                slot.id,
                withSnapBackpedal(slot.matchRules ?? [], on, () => nanoid()),
              ),
            );
          }}
        />
        {r.snapBackpedal}
      </label>
    </>
  );
}

export function MatchRulesForm({ slotId, field = DEFAULT_FIELD }: MatchRulesFormProps): JSX.Element | null {
  const slot = useEditorStore((st) => st.play?.players.find((p) => p.id === slotId));
  const players = useEditorStore((st) => st.play?.players);
  const [dragId, setDragId] = useState<ID | null>(null);
  if (!slot) return null;
  const teammates = (players ?? [])
    .filter((p) => p.id !== slotId && canCover(p))
    .map((p) => ({ id: p.id, label: p.label }));
  const rules = (slot.matchRules ?? []).slice().sort((a, b) => a.priority - b.priority);
  const rusher = slot.actions.some((a) => a.type === 'rush');

  return (
    <section aria-label={r.title} className="flex flex-col gap-2">
      <h4 className="text-sm font-semibold text-slate-900 dark:text-slate-100">{r.title}</h4>
      {!rusher ? <TemplateControls slot={slot} field={field} /> : null}
      <>
        {rules.length === 0 ? <p className="text-sm text-slate-500 dark:text-slate-400">{r.empty}</p> : null}
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
              teammates={teammates}
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
    </section>
  );
}
