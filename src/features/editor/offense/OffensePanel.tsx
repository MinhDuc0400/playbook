/** Right panel for offense plays (FR-OFF-03/04/05): route tree, QB drop, progression, strength. */
import { useState, type ReactNode } from 'react';
import { Button, Select, TextInput } from '@/components/ui';
import { DEFAULT_TUNING } from '@/domain/defaults';
import { alignedPlayers, computeStrength, numberReceivers } from '@/domain/numbering';
import {
  buildRoute,
  isRouteTemplateId,
  outwardSign,
  ROUTE_TEMPLATE_IDS,
  ROUTE_TEMPLATES,
  type RouteTemplateId,
} from '@/domain/routeTree';
import type { ID, Play, PlayerSlot, QbDropAction, ReadMode, RouteAction, Strength } from '@/domain/types';
import { readOrder } from '@/engine/readModel';
import {
  applyRouteTemplate,
  clearProgression,
  getMotion,
  getRoute,
  routeStart,
  setLabel,
  setMotion,
  setMotionDuration,
  setOptionRoute,
  setRouteDelay,
  setQbDrop,
  setReadMinScore,
  setReadMode,
  setReadWindow,
  setRoute,
  setRouteEndBehavior,
  setStrength,
  toggleProgression,
} from '@/features/editor/ops';
import { useFeatures } from '@/config/features';
import { t } from '@/i18n/vi';
import { useEditorStore } from '@/store/editorStore';

const DEPTH_STEP = 0.5;
const QB_DEPTH_MIN = 0;
const QB_DEPTH_MAX = 10;
const DEPTH_EPS = 1e-6;
const DEFAULT_QB_DROP: Pick<QbDropAction, 'depth' | 'style'> = { depth: 2, style: 'shotgun' };

const s = t.offense;

function Section({ title, children }: { title: string; children: ReactNode }): JSX.Element {
  return (
    <section className="flex flex-col gap-2">
      <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100">{title}</h3>
      {children}
    </section>
  );
}

/** Parse a number input value; null when empty / not a number. */
function parseNumber(raw: string): number | null {
  if (raw.trim() === '') return null;
  const n = Number(raw);
  return Number.isFinite(n) ? n : null;
}

function samePath(a: RouteAction['path'], b: RouteAction['path']): boolean {
  return (
    a.length === b.length &&
    a.every((p, i) => {
      const q = b[i];
      return q !== undefined && Math.abs(p.x - q.x) < DEPTH_EPS && Math.abs(p.y - q.y) < DEPTH_EPS;
    })
  );
}

/** Depth the route was built with: the template depth (0.5 grid) whose route equals the current path. */
function deriveDepth(play: Play, slot: PlayerSlot, templateId: RouteTemplateId, route: RouteAction): number {
  const tpl = ROUTE_TEMPLATES[templateId];
  const start = routeStart(play, slot.id);
  const outward = outwardSign(start, play.strength === 'left' ? 'left' : 'right');
  for (let d = tpl.minDepth; d <= tpl.maxDepth + DEPTH_EPS; d += DEPTH_STEP) {
    const built = buildRoute(templateId, start, { depth: d, outward });
    if (samePath(built.path, route.path)) return d;
  }
  return tpl.defaultDepth;
}

function RouteControls({ play, slot }: { play: Play; slot: PlayerSlot }): JSX.Element {
  const apply = useEditorStore.getState().apply;
  const { showReadModel } = useFeatures();
  const route = getRoute(play, slot.id);
  const activeId = route?.templateId && isRouteTemplateId(route.templateId) ? route.templateId : null;
  const tpl = activeId ? ROUTE_TEMPLATES[activeId] : null;
  const derived = activeId && route ? deriveDepth(play, slot, activeId, route) : null;
  const [draft, setDraft] = useState<string | null>(null);
  const depthShown = draft ?? (derived !== null ? String(derived) : '');

  const onDepth = (raw: string): void => {
    setDraft(raw);
    const n = parseNumber(raw);
    if (n === null || !tpl || !activeId || n < tpl.minDepth || n > tpl.maxDepth) return;
    apply('route-depth', applyRouteTemplate(slot.id, activeId, n));
  };

  return (
    <Section title={s.route.title}>
      <div role="group" aria-label={s.route.templates} className="grid grid-cols-3 gap-1">
        {ROUTE_TEMPLATE_IDS.map((id) => (
          <Button
            key={id}
            size="sm"
            variant={activeId === id ? 'primary' : 'secondary'}
            data-testid={`route-template-${id}`}
            aria-pressed={activeId === id}
            onClick={() => {
              setDraft(null);
              apply('route-template', applyRouteTemplate(slot.id, id));
            }}
          >
            {s.routeNames[id]}
          </Button>
        ))}
      </div>
      <TextInput
        label={s.route.depth}
        type="number"
        data-testid="route-depth"
        min={tpl?.minDepth}
        max={tpl?.maxDepth}
        step={DEPTH_STEP}
        disabled={!tpl}
        value={depthShown}
        onChange={(e) => onDepth(e.target.value)}
        onBlur={() => setDraft(null)}
      />
      {showReadModel ? (
        <Select
          label={s.route.endBehavior}
          data-testid="route-end-behavior"
          disabled={!route}
          value={route?.endBehavior ?? 'stop'}
          onChange={(e) =>
            apply(
              'route-end-behavior',
              setRouteEndBehavior(slot.id, e.target.value === 'continue' ? 'continue' : 'stop'),
            )
          }
        >
          <option value="stop">{s.route.stop}</option>
          <option value="continue">{s.route.continue}</option>
        </Select>
      ) : null}
      <Button
        variant="danger"
        size="sm"
        data-testid="route-remove"
        disabled={!route}
        onClick={() => apply('route-remove', setRoute(slot.id, null))}
      >
        {s.route.remove}
      </Button>
    </Section>
  );
}

const DELAY_MAX = 3;
const MOTION_MIN = 0.2;
const MOTION_MAX = 3;
const TIME_STEP = 0.1;

/** FR-OFF-07/09: route delay, pre-snap motion duration / removal, option route removal. */
function TimingControls({ play, slot }: { play: Play; slot: PlayerSlot }): JSX.Element {
  const apply = useEditorStore.getState().apply;
  const route = getRoute(play, slot.id);
  const motion = getMotion(play, slot.id);
  const hasOption = slot.actions.some((a) => a.type === 'option');
  const [delayDraft, setDelayDraft] = useState<string | null>(null);
  const [durDraft, setDurDraft] = useState<string | null>(null);

  return (
    <Section title={s.timing.title}>
      <TextInput
        label={s.timing.delay}
        type="number"
        data-testid="route-delay"
        min={0}
        max={DELAY_MAX}
        step={TIME_STEP}
        disabled={!route}
        value={delayDraft ?? String(route?.delay ?? 0)}
        onChange={(e) => {
          setDelayDraft(e.target.value);
          const n = parseNumber(e.target.value);
          if (n === null || n < 0 || n > DELAY_MAX) return;
          apply('route-delay', setRouteDelay(slot.id, n));
        }}
        onBlur={() => setDelayDraft(null)}
      />
      <TextInput
        label={s.timing.motionDuration}
        type="number"
        data-testid="motion-duration"
        min={MOTION_MIN}
        max={MOTION_MAX}
        step={TIME_STEP}
        disabled={!motion}
        value={durDraft ?? (motion ? String(motion.duration) : '')}
        onChange={(e) => {
          setDurDraft(e.target.value);
          const n = parseNumber(e.target.value);
          if (n === null || n < MOTION_MIN || n > MOTION_MAX) return;
          apply('motion-duration', setMotionDuration(slot.id, n));
        }}
        onBlur={() => setDurDraft(null)}
      />
      <Button
        variant="danger"
        size="sm"
        data-testid="motion-remove"
        disabled={!motion}
        onClick={() => apply('motion-remove', setMotion(slot.id, null))}
      >
        {s.timing.removeMotion}
      </Button>
      <Button
        variant="danger"
        size="sm"
        data-testid="option-remove"
        disabled={!hasOption}
        onClick={() => apply('option-remove', setOptionRoute(slot.id, null))}
      >
        {s.timing.removeOption}
      </Button>
    </Section>
  );
}

function QbControls({ slot }: { slot: PlayerSlot }): JSX.Element {
  const apply = useEditorStore.getState().apply;
  const { showReadModel } = useFeatures();
  const drop = slot.actions.find((a): a is QbDropAction => a.type === 'qbDrop') ?? DEFAULT_QB_DROP;
  const [draft, setDraft] = useState<string | null>(null);

  const onDepth = (raw: string): void => {
    setDraft(raw);
    const n = parseNumber(raw);
    if (n === null || n < QB_DEPTH_MIN || n > QB_DEPTH_MAX) return;
    apply('qb-drop', setQbDrop(slot.id, n, drop.style));
  };

  return (
    <Section title={s.qb.title}>
      <TextInput
        label={s.qb.depth}
        type="number"
        data-testid="qb-drop-depth"
        min={QB_DEPTH_MIN}
        max={QB_DEPTH_MAX}
        step={DEPTH_STEP}
        value={draft ?? String(drop.depth)}
        onChange={(e) => onDepth(e.target.value)}
        onBlur={() => setDraft(null)}
      />
      {showReadModel ? (
        <Select
          label={s.qb.style}
          data-testid="qb-drop-style"
          value={drop.style}
          onChange={(e) =>
            apply('qb-drop', setQbDrop(slot.id, drop.depth, e.target.value === 'under' ? 'under' : 'shotgun'))
          }
        >
          <option value="shotgun">{s.qb.shotgun}</option>
          <option value="under">{s.qb.under}</option>
        </Select>
      ) : null}
    </Section>
  );
}

function SelectedPlayer({ play, slot }: { play: Play; slot: PlayerSlot }): JSX.Element {
  const apply = useEditorStore.getState().apply;
  const [draft, setDraft] = useState<string | null>(null);

  return (
    <>
      <Section title={s.player.title}>
        <TextInput
          label={s.player.label}
          data-testid="player-label"
          value={draft ?? slot.label}
          onChange={(e) => {
            const raw = e.target.value;
            setDraft(raw);
            const label = raw.trim();
            if (label !== '') apply('label', setLabel(slot.id, label));
          }}
          onBlur={() => setDraft(null)}
        />
      </Section>
      {slot.role === 'QB' ? (
        <QbControls slot={slot} />
      ) : (
        <>
          <RouteControls play={play} slot={slot} />
          <TimingControls play={play} slot={slot} />
        </>
      )}
    </>
  );
}

function ProgressionSection({ play }: { play: Play }): JSX.Element {
  const apply = useEditorStore.getState().apply;
  const order = play.progression ?? [];
  const byId = new Map(play.players.map((p) => [p.id, p]));
  const receivers = play.players.filter((p) => p.role !== 'QB');

  return (
    <Section title={s.progression.title}>
      {order.length === 0 ? (
        <p className="text-sm text-slate-500 dark:text-slate-400">{s.progression.empty}</p>
      ) : (
        <ol
          aria-label={s.progression.list}
          data-testid="progression-list"
          className="flex flex-wrap gap-1 text-sm"
        >
          {order.map((id, i) => (
            <li
              key={id}
              className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2 py-0.5 text-slate-900 dark:bg-amber-400/20 dark:text-slate-100"
            >
              <span className="font-bold">{i + 1}</span>
              <span>{byId.get(id)?.label ?? id}</span>
            </li>
          ))}
        </ol>
      )}
      <div role="group" aria-label={s.progression.toggle} className="flex flex-wrap gap-1">
        {receivers.map((p) => {
          const on = order.includes(p.id);
          return (
            <Button
              key={p.id}
              size="sm"
              variant={on ? 'primary' : 'secondary'}
              data-testid={`progression-toggle-${p.label}`}
              aria-pressed={on}
              onClick={() => apply('progression', toggleProgression(p.id))}
            >
              {p.label}
            </Button>
          );
        })}
      </div>
      <Button
        size="sm"
        data-testid="progression-clear"
        disabled={order.length === 0}
        onClick={() => apply('progression-clear', clearProgression())}
      >
        {s.progression.clear}
      </Button>
    </Section>
  );
}

const READ_MODES: readonly ReadMode[] = [
  'progression',
  'leftToRight',
  'rightToLeft',
  'strongToWeak',
  'weakToStrong',
  'best',
];
const READ_MAX = 9;
const READ_STEP = 0.05;

/** Effective read order of receiver ids for the play's read mode. */
function effectiveReadOrder(play: Play, mode: ReadMode): ID[] {
  if (mode === 'progression' || mode === 'best') return play.progression ?? [];
  const receivers = play.players
    .filter((p) => p.role !== 'QB')
    .map((p) => ({ id: p.id, pos: routeStart(play, p.id) }));
  const strongSide = numberReceivers(alignedPlayers(play), play.strength).strongSide;
  return readOrder(mode, play.progression ?? [], receivers, strongSide);
}

function ReadRow({ play, id, index }: { play: Play; id: ID; index: number }): JSX.Element | null {
  const apply = useEditorStore.getState().apply;
  const label = play.players.find((p) => p.id === id)?.label;
  const win = play.readPlan?.windows?.[id];
  const min = play.readPlan?.minScore?.[id];
  const [fromDraft, setFromDraft] = useState<string | null>(null);
  const [toDraft, setToDraft] = useState<string | null>(null);
  const [minDraft, setMinDraft] = useState<string | null>(null);
  if (label === undefined) return null;

  const onWindow = (rawFrom: string, rawTo: string): void => {
    const from = parseNumber(rawFrom);
    const to = parseNumber(rawTo);
    if (from === null || to === null || from < 0 || to > READ_MAX || from >= to) return;
    apply('read-window', setReadWindow(id, { from, to }));
  };

  return (
    <li
      data-testid={`read-row-${label}`}
      className="flex flex-wrap items-center gap-2 rounded border border-slate-200 p-1 text-sm dark:border-slate-700"
    >
      <span className="font-bold">{index + 1}</span>
      <span>{label}</span>
      <label className="inline-flex items-center gap-1">
        <input
          type="checkbox"
          data-testid={`read-auto-${label}`}
          checked={!win}
          onChange={(e) => {
            setFromDraft(null);
            setToDraft(null);
            if (e.target.checked) apply('read-window', setReadWindow(id, null));
            else {
              const from = 1 + 0.5 * index;
              apply('read-window', setReadWindow(id, { from, to: from + 0.5 }));
            }
          }}
        />
        {s.readPlan.auto}
      </label>
      {win ? (
        <>
          <TextInput
            label={s.readPlan.from}
            type="number"
            data-testid={`read-from-${label}`}
            min={0}
            max={READ_MAX}
            step={READ_STEP}
            value={fromDraft ?? String(win.from)}
            onChange={(e) => {
              setFromDraft(e.target.value);
              onWindow(e.target.value, toDraft ?? String(win.to));
            }}
            onBlur={() => setFromDraft(null)}
          />
          <TextInput
            label={s.readPlan.to}
            type="number"
            data-testid={`read-to-${label}`}
            min={0}
            max={READ_MAX}
            step={READ_STEP}
            value={toDraft ?? String(win.to)}
            onChange={(e) => {
              setToDraft(e.target.value);
              onWindow(fromDraft ?? String(win.from), e.target.value);
            }}
            onBlur={() => setToDraft(null)}
          />
        </>
      ) : null}
      <TextInput
        label={s.readPlan.minScore}
        type="number"
        data-testid={`read-min-${label}`}
        min={0}
        max={100}
        step={1}
        placeholder={`${s.readPlan.minPlaceholder} (${DEFAULT_TUNING.scoreThrow})`}
        value={minDraft ?? (min === undefined ? '' : String(min))}
        onChange={(e) => {
          setMinDraft(e.target.value);
          const n = parseNumber(e.target.value);
          if (n === null) apply('read-min', setReadMinScore(id, null));
          else if (n >= 0 && n <= 100) apply('read-min', setReadMinScore(id, n));
        }}
        onBlur={() => setMinDraft(null)}
      />
    </li>
  );
}

function ReadPlanSection({ play }: { play: Play }): JSX.Element {
  const apply = useEditorStore.getState().apply;
  const mode = play.readPlan?.mode ?? 'progression';
  const order = effectiveReadOrder(play, mode);

  return (
    <Section title={s.readPlan.title}>
      <div data-testid="read-plan" className="flex flex-col gap-2">
        <Select
          label={s.readPlan.mode}
          data-testid="read-mode"
          value={mode}
          onChange={(e) => {
            const m = READ_MODES.find((x) => x === e.target.value);
            if (m) apply('read-mode', setReadMode(m));
          }}
        >
          {READ_MODES.map((m) => (
            <option key={m} value={m}>
              {s.readPlan.modes[m]}
            </option>
          ))}
        </Select>
        {order.length === 0 ? (
          <p className="text-sm text-slate-500 dark:text-slate-400">{s.readPlan.empty}</p>
        ) : (
          <ol aria-label={s.readPlan.rows} className="flex flex-col gap-1">
            {order.map((id, i) => (
              <ReadRow key={id} play={play} id={id} index={i} />
            ))}
          </ol>
        )}
        <p className="text-xs text-slate-500 dark:text-slate-400">{s.readPlan.hint}</p>
      </div>
    </Section>
  );
}

function StrengthSection({ play }: { play: Play }): JSX.Element {
  const apply = useEditorStore.getState().apply;
  const computed = computeStrength(alignedPlayers(play));
  const value: Strength | 'auto' = play.strengthOverridden ? play.strength : 'auto';

  return (
    <Section title={s.strength.title}>
      <Select
        label={s.strength.label}
        data-testid="strength-select"
        value={value}
        onChange={(e) => {
          const v = e.target.value;
          const next: Strength | 'auto' = v === 'left' || v === 'right' || v === 'balanced' ? v : 'auto';
          apply('strength', setStrength(next));
        }}
      >
        <option value="auto">{`${s.strength.auto} (${s.strength[computed]})`}</option>
        <option value="left">{s.strength.left}</option>
        <option value="right">{s.strength.right}</option>
        <option value="balanced">{s.strength.balanced}</option>
      </Select>
    </Section>
  );
}

export function OffensePanel(): JSX.Element | null {
  const play = useEditorStore((st) => st.play);
  const selection = useEditorStore((st) => st.selection);
  const { showReadModel } = useFeatures();
  if (!play || play.side !== 'offense') return null;

  const only = selection.length === 1 ? selection[0] : undefined;
  const slot = only === undefined ? undefined : play.players.find((p) => p.id === only);

  return (
    <aside aria-label={s.panel} data-testid="offense-panel" className="flex flex-col gap-4 p-3">
      {slot ? (
        <SelectedPlayer key={slot.id} play={play} slot={slot} />
      ) : (
        <Section title={s.player.title}>
          <p className="text-sm text-slate-500 dark:text-slate-400">{s.player.empty}</p>
        </Section>
      )}
      <ProgressionSection play={play} />
      {showReadModel ? <ReadPlanSection play={play} /> : null}
      {showReadModel ? <StrengthSection play={play} /> : null}
    </aside>
  );
}
