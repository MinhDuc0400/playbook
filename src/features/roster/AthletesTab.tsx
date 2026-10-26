/** Roster → Athletes: list + editor (FR-ATH-04). */
import { nanoid } from 'nanoid';
import { useState } from 'react';
import { Button, Dialog, Select, TextInput } from '@/components/ui';
import { useAthletes, useSettings } from '@/db/hooks';
import { athletesRepo, lineupsRepo } from '@/db/repos';
import { DEFAULT_PRESETS } from '@/domain/presets';
import { classifyStats } from '@/domain/stats';
import { SCHEMA_VERSION, STAT_KEYS } from '@/domain/types';
import type { Athlete, Preset, Role, Stats } from '@/domain/types';
import { t } from '@/i18n/vi';
import { LEVEL_DOT, STAT_RANGES } from './statRanges';

const ROLES: readonly Role[] = ['QB', 'C', 'WR', 'RB', 'TE', 'CB', 'S', 'LB', 'R'];

interface Draft {
  athlete: Athlete;
  isNew: boolean;
}

interface StatNumberProps {
  testId: string;
  label: string;
  min: number;
  max: number;
  step: number;
  value: number;
  onValid: (v: number) => void;
}

/** Number input with a local text draft so the field can be cleared and retyped; commits only in-range values. */
function StatNumber({ testId, label, min, max, step, value, onValid }: StatNumberProps): JSX.Element {
  const [text, setText] = useState(String(value));
  const [prev, setPrev] = useState(value);
  if (prev !== value) {
    setPrev(value);
    if (Number(text) !== value) setText(String(value));
  }
  return (
    <input
      type="number"
      data-testid={testId}
      aria-label={label}
      min={min}
      max={max}
      step={step}
      value={text}
      onChange={(e) => {
        setText(e.target.value);
        const v = Number(e.target.value);
        if (e.target.value.trim() !== '' && v >= min && v <= max) onValid(v);
      }}
      onBlur={() => setText(String(value))}
      className="w-20 rounded-md border border-slate-300 bg-white px-2 py-1 dark:border-slate-600 dark:bg-slate-800"
    />
  );
}

export function AthletesTab(): JSX.Element {
  const athletes = useAthletes();
  const settings = useSettings();
  const presets = settings?.presets ?? DEFAULT_PRESETS;
  const [draft, setDraft] = useState<Draft | null>(null);
  const [toDelete, setToDelete] = useState<Athlete | null>(null);
  const [toDeleteLineups, setToDeleteLineups] = useState(0);

  const startNew = (): void => {
    const now = Date.now();
    setDraft({
      isNew: true,
      athlete: {
        id: nanoid(),
        schemaVersion: SCHEMA_VERSION,
        name: '',
        preset: 'avg',
        stats: { ...presets.avg },
        positions: [],
        createdAt: now,
        updatedAt: now,
      },
    });
  };

  const patch = (p: Partial<Athlete>): void =>
    setDraft((d) => (d ? { ...d, athlete: { ...d.athlete, ...p } } : d));

  const setPreset = (p: Preset | 'custom'): void => {
    if (p === 'custom') patch({ preset: 'custom' });
    else patch({ preset: p, stats: { ...presets[p] } });
  };

  const setStat = (key: keyof Stats, v: number): void => {
    if (!Number.isFinite(v)) return;
    setDraft((d) =>
      d ? { ...d, athlete: { ...d.athlete, preset: 'custom', stats: { ...d.athlete.stats, [key]: v } } } : d,
    );
  };

  const togglePos = (role: Role): void => {
    if (!draft) return;
    const has = draft.athlete.positions.includes(role);
    patch({
      positions: has ? draft.athlete.positions.filter((r) => r !== role) : [...draft.athlete.positions, role],
    });
  };

  const nameOk = draft ? draft.athlete.name.trim() !== '' : false;

  const save = async (): Promise<void> => {
    if (!draft || !nameOk) return;
    const a = draft.athlete;
    const notes = a.notes?.trim() ? a.notes : undefined;
    const rec: Athlete = { ...a, name: a.name.trim(), updatedAt: Date.now() };
    if (notes === undefined) delete rec.notes;
    await athletesRepo.put(rec);
    setDraft(null);
  };

  const askDelete = async (a: Athlete): Promise<void> => {
    const lineups = await lineupsRepo.list();
    setToDeleteLineups(lineups.filter((l) => l.slots.some((s) => s.athleteId === a.id)).length);
    setToDelete(a);
  };

  const confirmDelete = async (): Promise<void> => {
    if (!toDelete) return;
    const id = toDelete.id;
    const now = Date.now();
    const changed = (await lineupsRepo.list())
      .filter((l) => l.slots.some((s) => s.athleteId === id))
      .map((l) => ({
        ...l,
        updatedAt: now,
        slots: l.slots.map((s) => {
          if (s.athleteId !== id) return s;
          const { athleteId: _removed, ...rest } = s;
          return rest;
        }),
      }));
    if (changed.length > 0) await lineupsRepo.bulkPut(changed);
    await athletesRepo.remove(id);
    if (draft?.athlete.id === id) setDraft(null);
    setToDelete(null);
  };

  return (
    <div className="flex flex-col gap-3" data-testid="athletes-tab">
      <div>
        <Button variant="primary" data-testid="athlete-new" onClick={startNew}>
          {t.roster.athletes.new}
        </Button>
      </div>

      {athletes && athletes.length === 0 ? (
        <p className="text-sm text-slate-600 dark:text-slate-300">{t.roster.athletes.empty}</p>
      ) : null}
      <ul className="flex flex-col gap-2">
        {(athletes ?? []).map((a) => {
          const level = classifyStats(a.stats, presets);
          return (
            <li key={a.id} className="flex items-center gap-2 rounded-md border p-2">
              <button
                type="button"
                data-testid={`athlete-row-${a.id}`}
                className="flex min-h-[44px] flex-1 items-center gap-2 text-left"
                onClick={() => setDraft({ isNew: false, athlete: { ...a, stats: { ...a.stats } } })}
              >
                <span
                  data-testid={`athlete-level-${a.id}`}
                  data-level={level}
                  title={t.roster.athletes.levelLabel(t.roster.athletes.presets[level])}
                  className={`inline-block h-3 w-3 rounded-full ${LEVEL_DOT[level]}`}
                />
                <span className="font-medium">{a.name}</span>
                <span className="text-sm text-slate-600 dark:text-slate-300">{a.positions.join(', ')}</span>
              </button>
              <Button
                variant="danger"
                data-testid={`athlete-delete-${a.id}`}
                onClick={() => void askDelete(a)}
              >
                {t.roster.common.delete}
              </Button>
            </li>
          );
        })}
      </ul>

      {draft ? (
        <form
          data-testid="athlete-editor"
          noValidate
          className="flex flex-col gap-3 rounded-md border p-3"
          onSubmit={(e) => {
            e.preventDefault();
            void save();
          }}
        >
          <h2 className="font-semibold">
            {draft.isNew ? t.roster.athletes.newTitle : t.roster.athletes.editTitle}
          </h2>
          <TextInput
            label={t.roster.athletes.name}
            data-testid="athlete-name"
            value={draft.athlete.name}
            onChange={(e) => patch({ name: e.target.value })}
          />
          {!nameOk ? (
            <p className="text-xs text-red-600" role="note">
              {t.roster.athletes.nameRequired}
            </p>
          ) : null}
          <fieldset className="flex flex-wrap gap-3">
            <legend className="text-sm font-medium">{t.roster.athletes.positions}</legend>
            {ROLES.map((r) => (
              <label key={r} className="flex min-h-[44px] items-center gap-1">
                <input
                  type="checkbox"
                  data-testid={`athlete-pos-${r}`}
                  checked={draft.athlete.positions.includes(r)}
                  onChange={() => togglePos(r)}
                />
                {r}
              </label>
            ))}
          </fieldset>
          <Select
            label={t.roster.athletes.preset}
            data-testid="athlete-preset"
            value={draft.athlete.preset}
            onChange={(e) => setPreset(e.target.value as Preset | 'custom')}
          >
            <option value="weak">{t.roster.athletes.presets.weak}</option>
            <option value="avg">{t.roster.athletes.presets.avg}</option>
            <option value="good">{t.roster.athletes.presets.good}</option>
            <option value="custom">{t.roster.athletes.presets.custom}</option>
          </Select>
          <div className="flex flex-col gap-1">
            <span className="text-sm font-medium">{t.roster.athletes.stats}</span>
            {STAT_KEYS.map((key) => {
              const r = STAT_RANGES[key];
              const step = r.max <= 1 ? 0.05 : 0.1;
              const label = t.roster.athletes.statNames[key];
              return (
                <div key={key} className="flex items-center gap-2 text-sm">
                  <span className="w-56 shrink-0">{label}</span>
                  <input
                    type="range"
                    aria-label={`${label} slider`}
                    min={r.min}
                    max={r.max}
                    step={step}
                    value={draft.athlete.stats[key]}
                    onChange={(e) => setStat(key, Number(e.target.value))}
                    className="flex-1"
                  />
                  <StatNumber
                    testId={`athlete-stat-${key}`}
                    label={label}
                    min={r.min}
                    max={r.max}
                    step={step}
                    value={draft.athlete.stats[key]}
                    onValid={(v) => setStat(key, v)}
                  />
                </div>
              );
            })}
          </div>
          <div className="flex flex-col gap-1">
            <label htmlFor="athlete-notes" className="text-sm font-medium">
              {t.roster.athletes.notes}
            </label>
            <textarea
              id="athlete-notes"
              data-testid="athlete-notes"
              rows={2}
              value={draft.athlete.notes ?? ''}
              onChange={(e) => patch({ notes: e.target.value })}
              className="rounded-md border border-slate-300 bg-white px-2 py-1.5 dark:border-slate-600 dark:bg-slate-800"
            />
          </div>
          <div className="flex gap-2">
            <Button variant="primary" type="submit" data-testid="athlete-save" disabled={!nameOk}>
              {t.roster.common.save}
            </Button>
            <Button type="button" data-testid="athlete-cancel" onClick={() => setDraft(null)}>
              {t.roster.common.cancel}
            </Button>
          </div>
        </form>
      ) : null}

      <Dialog
        open={toDelete !== null}
        onClose={() => setToDelete(null)}
        title={t.roster.athletes.deleteTitle}
      >
        <p>{toDelete ? t.roster.athletes.deleteConfirm(toDelete.name, toDeleteLineups) : null}</p>
        <div className="mt-3 flex justify-end gap-2">
          <Button onClick={() => setToDelete(null)}>{t.roster.common.cancel}</Button>
          <Button variant="danger" data-testid="athlete-delete-confirm" onClick={() => void confirmDelete()}>
            {t.roster.common.confirmDelete}
          </Button>
        </div>
      </Dialog>
    </div>
  );
}
