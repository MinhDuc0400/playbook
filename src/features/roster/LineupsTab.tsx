/** Roster → Lineups: list, create from formation, slot editor (FR-ATH-05). */
import { nanoid } from 'nanoid';
import { useState } from 'react';
import { Button, Dialog, Select, TextInput } from '@/components/ui';
import { useAthletes, useLineups } from '@/db/hooks';
import { lineupsRepo } from '@/db/repos';
import { formationsFor } from '@/domain/formations';
import { SCHEMA_VERSION } from '@/domain/types';
import type { Format, Lineup, LineupSlot, Side } from '@/domain/types';
import { t } from '@/i18n/vi';

const SIDES: readonly Side[] = ['offense', 'defense'];
const FORMATS: readonly Format[] = ['5v5', '7v7', 'custom'];
const PRESET_OPTS = ['weak', 'avg', 'good'] as const;

function assignValue(s: LineupSlot): string {
  if (s.athleteId !== undefined) return `a:${s.athleteId}`;
  return `p:${s.preset ?? 'avg'}`;
}

export function LineupsTab(): JSX.Element {
  const lineups = useLineups();
  const athletes = useAthletes();
  const [name, setName] = useState('');
  const [side, setSide] = useState<Side>('offense');
  const [format, setFormat] = useState<Format>('5v5');
  const [formationId, setFormationId] = useState('');
  const [draft, setDraft] = useState<Lineup | null>(null);
  const [toDelete, setToDelete] = useState<Lineup | null>(null);

  const formations = formationsFor(side, format);
  const chosenFormation = formations.find((f) => f.id === formationId) ?? formations[0];

  const create = (): void => {
    const now = Date.now();
    setDraft({
      id: nanoid(),
      schemaVersion: SCHEMA_VERSION,
      name: name.trim(),
      side,
      format,
      slots: (chosenFormation?.players ?? []).map((p) => ({ label: p.label, preset: 'avg' as const })),
      createdAt: now,
      updatedAt: now,
    });
    setName('');
  };

  const patchSlot = (i: number, p: Partial<LineupSlot>): void =>
    setDraft((d) => (d ? { ...d, slots: d.slots.map((s, idx) => (idx === i ? { ...s, ...p } : s)) } : d));

  const assign = (i: number, value: string): void =>
    setDraft((d) => {
      if (!d) return d;
      const slots = d.slots.map((s, idx) => {
        if (idx !== i) return s;
        const next: LineupSlot = { label: s.label };
        if (value.startsWith('a:')) next.athleteId = value.slice(2);
        else next.preset = value.slice(2) as (typeof PRESET_OPTS)[number];
        return next;
      });
      return { ...d, slots };
    });

  const labels = draft?.slots.map((s) => s.label.trim()) ?? [];
  const labelsOk = labels.every((l, i) => l !== '' && labels.indexOf(l) === i);
  const nameOk = draft ? draft.name.trim() !== '' : false;

  const save = async (): Promise<void> => {
    if (!draft || !nameOk || !labelsOk) return;
    await lineupsRepo.put({
      ...draft,
      name: draft.name.trim(),
      slots: draft.slots.map((s) => ({ ...s, label: s.label.trim() })),
      updatedAt: Date.now(),
    });
    setDraft(null);
  };

  const athleteList = athletes ?? [];

  return (
    <div className="flex flex-col gap-3" data-testid="lineups-tab">
      <div className="grid gap-2 rounded-md border p-3 sm:grid-cols-2">
        <TextInput
          label={t.roster.lineups.name}
          data-testid="lineup-new-name"
          value={name}
          onChange={(e) => setName(e.target.value)}
        />
        <Select
          label={t.roster.lineups.side}
          data-testid="lineup-new-side"
          value={side}
          onChange={(e) => setSide(e.target.value as Side)}
        >
          {SIDES.map((s) => (
            <option key={s} value={s}>
              {t.roster.lineups.sides[s]}
            </option>
          ))}
        </Select>
        <Select
          label={t.roster.lineups.format}
          data-testid="lineup-new-format"
          value={format}
          onChange={(e) => setFormat(e.target.value as Format)}
        >
          {FORMATS.map((f) => (
            <option key={f} value={f}>
              {t.roster.lineups.formats[f]}
            </option>
          ))}
        </Select>
        <Select
          label={t.roster.lineups.formation}
          data-testid="lineup-new-formation"
          value={chosenFormation?.id ?? ''}
          onChange={(e) => setFormationId(e.target.value)}
        >
          {formations.map((f) => (
            <option key={f.id} value={f.id}>
              {f.name}
            </option>
          ))}
        </Select>
        <div>
          <Button
            variant="primary"
            data-testid="lineup-create"
            onClick={create}
            disabled={name.trim() === ''}
          >
            {t.roster.lineups.create}
          </Button>
        </div>
      </div>

      {lineups && lineups.length === 0 ? (
        <p className="text-sm text-slate-600 dark:text-slate-300">{t.roster.lineups.empty}</p>
      ) : null}
      <ul className="flex flex-col gap-2">
        {(lineups ?? []).map((l) => (
          <li key={l.id} className="flex items-center gap-2 rounded-md border p-2">
            <button
              type="button"
              data-testid={`lineup-row-${l.id}`}
              className="flex min-h-[44px] flex-1 flex-col justify-center text-left"
              onClick={() => setDraft({ ...l, slots: l.slots.map((s) => ({ ...s })) })}
            >
              <span className="font-medium">{l.name}</span>
              <span className="text-sm text-slate-600 dark:text-slate-300">
                {t.roster.lineups.summary(t.roster.lineups.sides[l.side], l.format, l.slots.length)}
              </span>
            </button>
            <Button variant="danger" data-testid={`lineup-delete-${l.id}`} onClick={() => setToDelete(l)}>
              {t.roster.common.delete}
            </Button>
          </li>
        ))}
      </ul>

      {draft ? (
        <form
          data-testid="lineup-editor"
          className="flex flex-col gap-3 rounded-md border p-3"
          onSubmit={(e) => {
            e.preventDefault();
            void save();
          }}
        >
          <h2 className="font-semibold">{t.roster.lineups.editTitle}</h2>
          <TextInput
            label={t.roster.lineups.name}
            data-testid="lineup-name"
            value={draft.name}
            onChange={(e) => setDraft({ ...draft, name: e.target.value })}
          />
          {!nameOk ? (
            <p className="text-xs text-red-600" role="note">
              {t.roster.lineups.nameRequired}
            </p>
          ) : null}
          <div className="flex flex-col gap-2">
            <span className="text-sm font-medium">{t.roster.lineups.slots}</span>
            {draft.slots.map((s, i) => (
              <div key={i} data-testid={`lineup-slot-${s.label}`} className="flex flex-wrap items-end gap-2">
                <TextInput
                  label={t.roster.lineups.slotLabel}
                  data-testid={`lineup-label-${i}`}
                  value={s.label}
                  onChange={(e) => patchSlot(i, { label: e.target.value })}
                />
                <Select
                  label={t.roster.lineups.assign}
                  data-testid={`lineup-assign-${s.label}`}
                  value={assignValue(s)}
                  onChange={(e) => assign(i, e.target.value)}
                >
                  {PRESET_OPTS.map((p) => (
                    <option key={p} value={`p:${p}`}>
                      {t.roster.lineups.presetOption(t.roster.athletes.presets[p])}
                    </option>
                  ))}
                  {athleteList.map((a) => (
                    <option key={a.id} value={`a:${a.id}`}>
                      {a.name}
                    </option>
                  ))}
                  {s.athleteId !== undefined && !athleteList.some((a) => a.id === s.athleteId) ? (
                    <option value={`a:${s.athleteId}`}>{s.athleteId}</option>
                  ) : null}
                </Select>
                <Button
                  type="button"
                  data-testid={`lineup-remove-${i}`}
                  onClick={() => setDraft({ ...draft, slots: draft.slots.filter((_, idx) => idx !== i) })}
                >
                  {t.roster.lineups.removeSlot}
                </Button>
              </div>
            ))}
            {!labelsOk ? (
              <p className="text-xs text-red-600" role="note">
                {t.roster.lineups.labelInvalid}
              </p>
            ) : null}
            <div>
              <Button
                type="button"
                data-testid="lineup-add-slot"
                onClick={() =>
                  setDraft({
                    ...draft,
                    slots: [...draft.slots, { label: `P${draft.slots.length + 1}`, preset: 'avg' }],
                  })
                }
              >
                {t.roster.lineups.addSlot}
              </Button>
            </div>
          </div>
          <div className="flex gap-2">
            <Button variant="primary" type="submit" data-testid="lineup-save" disabled={!nameOk || !labelsOk}>
              {t.roster.common.save}
            </Button>
            <Button type="button" data-testid="lineup-cancel" onClick={() => setDraft(null)}>
              {t.roster.common.cancel}
            </Button>
          </div>
        </form>
      ) : null}

      <Dialog open={toDelete !== null} onClose={() => setToDelete(null)} title={t.roster.lineups.deleteTitle}>
        <p>{toDelete ? t.roster.lineups.deleteConfirm(toDelete.name) : null}</p>
        <div className="mt-3 flex justify-end gap-2">
          <Button onClick={() => setToDelete(null)}>{t.roster.common.cancel}</Button>
          <Button
            variant="danger"
            data-testid="lineup-delete-confirm"
            onClick={() => {
              if (toDelete) {
                void lineupsRepo.remove(toDelete.id);
                if (draft?.id === toDelete.id) setDraft(null);
              }
              setToDelete(null);
            }}
          >
            {t.roster.common.confirmDelete}
          </Button>
        </div>
      </Dialog>
    </div>
  );
}
