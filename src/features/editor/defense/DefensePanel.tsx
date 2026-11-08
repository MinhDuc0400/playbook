/** Right panel for defense plays (FR-DEF-01..06): ghost offense, alignTo, per-defender assignment. */
import { useState, type ReactNode } from 'react';
import { Button, Select, TextInput } from '@/components/ui';
import { useSettings } from '@/db/hooks';
import { createDefaultFields } from '@/domain/field';
import { formationsFor } from '@/domain/formations';
import { computeStrength } from '@/domain/numbering';
import {
  ZONE_PRESET_IDS,
  type FieldConfig,
  type Format,
  type Leverage,
  type ManAction,
  type Play,
  type PlayerSlot,
  type ReceiverRef,
  type ZoneAction,
  type ZonePresetId,
} from '@/domain/types';
import { hookZoneForX } from '@/domain/zones';
import { autoAlign } from '@/features/editor/defense/align';
import { ghostFormation, ghostPlayers } from '@/features/editor/defense/ghost';
import {
  clearAssignment,
  setAlignTo,
  setDesignStrength,
  setLeverage,
  setManTechnique,
  setRush,
  setZone,
} from '@/features/editor/defense/ops';
import { MatchRulesForm } from '@/features/editor/defense/MatchRulesForm';
import { setLabel } from '@/features/editor/ops';
import { useFeatures } from '@/config/features';
import { t } from '@/i18n/vi';
import { useEditorStore } from '@/store/editorStore';

const CUSHION_MIN = 0.5;
const CUSHION_MAX = 15;
const CUSHION_STEP = 0.5;

const s = t.defense;

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

const isZonePreset = (v: string): v is ZonePresetId => (ZONE_PRESET_IDS as readonly string[]).includes(v);

function parseLeverage(v: string): Leverage | undefined {
  return v === 'inside' || v === 'outside' || v === 'head-up' ? v : undefined;
}

/** "Strong #1", "Weak #2", "QB". */
function targetText(ref: ReceiverRef): string {
  if (ref.kind === 'role') return ref.role;
  return `${ref.side === 'strong' ? s.man.strong : s.man.weak} #${ref.number}`;
}

const isRusher = (slot: PlayerSlot): boolean => slot.actions.some((a) => a.type === 'rush');

function assignmentKind(slot: PlayerSlot): keyof typeof s.assignmentKind {
  for (const a of slot.actions) {
    if (a.type === 'man' || a.type === 'zone' || a.type === 'rush' || a.type === 'spy') return a.type;
  }
  return 'none';
}

function PlaySection({ play }: { play: Play }): JSX.Element {
  const apply = useEditorStore.getState().apply;
  const ghostFormationId = useEditorStore((st) => st.ghostFormationId);
  const { showMatchupTuning } = useFeatures();
  const current = ghostFormation(play.format, ghostFormationId);

  return (
    <Section title={s.play.title}>
      <Select
        label={s.play.ghostFormation}
        data-testid="ghost-formation"
        value={current.id}
        onChange={(e) => {
          const id = e.target.value;
          useEditorStore.getState().setGhostFormation(id);
          apply('design strength', setDesignStrength(computeStrength(ghostPlayers(play.format, id))));
        }}
      >
        {formationsFor('offense', play.format).map((f) => (
          <option key={f.id} value={f.id}>
            {f.name}
          </option>
        ))}
      </Select>
      {showMatchupTuning ? (
        <Select
          label={s.play.alignTo}
          data-testid="def-align-to"
          value={play.alignTo ?? 'ball'}
          onChange={(e) => apply('align to', setAlignTo(e.target.value === 'strength' ? 'strength' : 'ball'))}
        >
          <option value="ball">{s.play.alignBall}</option>
          <option value="strength">{s.play.alignStrength}</option>
        </Select>
      ) : null}
      <Button
        size="sm"
        data-testid="btn-auto-align-all"
        onClick={() => {
          const ghost = ghostPlayers(play.format, useEditorStore.getState().ghostFormationId);
          apply('auto align all', (p) => autoAlign(p, ghost));
        }}
      >
        {s.play.autoAlignAll}
      </Button>
    </Section>
  );
}

function ManControls({ slot, man }: { slot: PlayerSlot; man: ManAction }): JSX.Element {
  const apply = useEditorStore.getState().apply;
  const [draft, setDraft] = useState<string | null>(null);

  const onCushion = (raw: string): void => {
    setDraft(raw);
    const n = parseNumber(raw);
    if (n === null || n < CUSHION_MIN || n > CUSHION_MAX) return;
    apply('cushion', setManTechnique(slot.id, 'cushion', n));
  };

  return (
    <>
      <p className="text-sm text-slate-700 dark:text-slate-200">
        {s.man.target}: <strong data-testid="def-man-target">{targetText(man.target)}</strong>
      </p>
      <p className="text-xs text-slate-500 dark:text-slate-400">{s.man.targetHint}</p>
      <Select
        label={s.man.technique}
        data-testid="def-technique"
        value={man.technique}
        onChange={(e) => {
          setDraft(null);
          apply('technique', setManTechnique(slot.id, e.target.value === 'cushion' ? 'cushion' : 'trail'));
        }}
      >
        <option value="trail">{s.man.trail}</option>
        <option value="cushion">{s.man.cushion}</option>
      </Select>
      {man.technique === 'cushion' ? (
        <TextInput
          label={s.man.cushionYards}
          type="number"
          data-testid="def-cushion"
          min={CUSHION_MIN}
          max={CUSHION_MAX}
          step={CUSHION_STEP}
          value={draft ?? String(man.cushion ?? 5)}
          onChange={(e) => onCushion(e.target.value)}
          onBlur={() => setDraft(null)}
        />
      ) : null}
    </>
  );
}

function ZoneControls({
  slot,
  zone,
  field,
}: {
  slot: PlayerSlot;
  zone: ZoneAction['zone'];
  field: FieldConfig;
}): JSX.Element {
  const apply = useEditorStore.getState().apply;
  const custom = typeof zone !== 'string';
  return (
    <Select
      label={s.zone.preset}
      data-testid="def-zone-preset"
      value={custom ? 'custom' : zone}
      onChange={(e) => {
        const v = e.target.value;
        if (isZonePreset(v)) apply('zone preset', setZone(slot.id, v, field));
      }}
    >
      {ZONE_PRESET_IDS.map((id) => (
        <option key={id} value={id}>
          {id}
        </option>
      ))}
      {custom ? (
        <option value="custom" disabled>
          {s.zone.custom}
        </option>
      ) : null}
    </Select>
  );
}

function SelectedDefender({
  slot,
  field,
  format,
}: {
  slot: PlayerSlot;
  field: FieldConfig;
  format: Format;
}): JSX.Element {
  const apply = useEditorStore.getState().apply;
  const [draft, setDraft] = useState<string | null>(null);
  const man = slot.actions.find((a): a is ManAction => a.type === 'man');
  const zone = slot.actions.find((a) => a.type === 'zone');
  const rusher = isRusher(slot);

  return (
    <Section title={s.defender.title}>
      <TextInput
        label={s.defender.label}
        data-testid="def-label"
        value={draft ?? slot.label}
        onChange={(e) => {
          const raw = e.target.value;
          setDraft(raw);
          const label = raw.trim();
          if (label !== '') apply('label', setLabel(slot.id, label));
        }}
        onBlur={() => setDraft(null)}
      />
      <Select
        label={s.defender.leverage}
        data-testid="def-leverage"
        disabled={rusher}
        value={slot.leverage ?? 'none'}
        onChange={(e) => apply('leverage', setLeverage(slot.id, parseLeverage(e.target.value)))}
      >
        <option value="none">{s.leverage.none}</option>
        <option value="inside">{s.leverage.inside}</option>
        <option value="outside">{s.leverage.outside}</option>
        <option value="head-up">{s.leverage.headUp}</option>
      </Select>
      <p className="text-sm text-slate-700 dark:text-slate-200">
        {s.defender.assignment}:{' '}
        <strong data-testid="def-assignment">{s.assignmentKind[assignmentKind(slot)]}</strong>
      </p>
      {man ? <ManControls slot={slot} man={man} /> : null}
      {zone?.type === 'zone' ? <ZoneControls slot={slot} zone={zone.zone} field={field} /> : null}
      {!zone ? (
        <Button
          size="sm"
          data-testid="def-make-zone"
          onClick={() => apply('make zone', setZone(slot.id, hookZoneForX(slot.start.x), field))}
        >
          {s.zone.makeZone}
        </Button>
      ) : null}
      <Button
        size="sm"
        variant={rusher ? 'primary' : 'secondary'}
        data-testid="def-rush-toggle"
        aria-pressed={rusher}
        onClick={() => apply('rush', rusher ? clearAssignment(slot.id) : setRush(slot.id))}
      >
        {s.rush.toggle}
      </Button>
      <Button
        size="sm"
        data-testid="btn-auto-align"
        disabled={!man}
        onClick={() => {
          const ghost = ghostPlayers(format, useEditorStore.getState().ghostFormationId);
          apply('auto align', (p) => autoAlign(p, ghost, [slot.id]));
        }}
      >
        {s.defender.autoAlign}
      </Button>
      <Button
        variant="danger"
        size="sm"
        data-testid="def-clear"
        disabled={assignmentKind(slot) === 'none'}
        onClick={() => apply('clear assignment', clearAssignment(slot.id))}
      >
        {s.defender.clear}
      </Button>
      <MatchRulesForm slotId={slot.id} />
    </Section>
  );
}

function RushersLine({ play, field }: { play: Play; field: FieldConfig }): JSX.Element {
  const count = play.players.filter(isRusher).length;
  const over = count > field.maxRushers;
  return (
    <p
      data-testid="def-rusher-count"
      data-over={over ? 'true' : 'false'}
      role={over ? 'alert' : undefined}
      className={
        over
          ? 'text-sm font-semibold text-red-700 dark:text-red-400'
          : 'text-sm text-slate-700 dark:text-slate-200'
      }
    >
      {`${s.rush.count}: ${count} / ${field.maxRushers}`}
      {over ? ` (${s.rush.over})` : ''}
    </p>
  );
}

export function DefensePanel(): JSX.Element | null {
  const play = useEditorStore((st) => st.play);
  const selection = useEditorStore((st) => st.selection);
  const settings = useSettings();
  if (!play || play.side !== 'defense') return null;

  const field = settings?.fields[play.format] ?? createDefaultFields()[play.format];
  const only = selection.length === 1 ? selection[0] : undefined;
  const slot = only === undefined ? undefined : play.players.find((p) => p.id === only);

  return (
    <aside aria-label={s.panel} data-testid="defense-panel" className="flex flex-col gap-4 p-3">
      <PlaySection play={play} />
      {slot ? (
        <SelectedDefender key={slot.id} slot={slot} field={field} format={play.format} />
      ) : (
        <Section title={s.defender.title}>
          <p className="text-sm text-slate-500 dark:text-slate-400">{s.defender.empty}</p>
        </Section>
      )}
      <RushersLine play={play} field={field} />
    </aside>
  );
}
