/** Settings → Sân: per-format FieldConfig editor (FR-TUN-02, SRS §4.2). */
import { useEffect, useState } from 'react';
import { Button, Select } from '@/components/ui';
import { settingsRepo } from '@/db/repos';
import { useSettings } from '@/db/hooks';
import { createDefaultFields } from '@/domain/field';
import type { FieldConfig, Format } from '@/domain/types';
import { t } from '@/i18n/vi';
import { useDraft } from './useDebouncedNumber';

const FORMATS: Format[] = ['5v5', '7v7', 'custom'];

type NumKey =
  'playersPerSide' | 'width' | 'length' | 'endZoneDepth' | 'rushLine' | 'maxRushers' | 'passClock';
type BoolKey = 'rusherGoesOnSnap' | 'qbCanCrossLOS' | 'centerEligible' | 'catchBeyondLOS';

const NUM_KEYS: { name: NumKey; min: number; max: number; int: boolean }[] = [
  { name: 'playersPerSide', min: 3, max: 11, int: true },
  { name: 'width', min: 10, max: 60, int: false },
  { name: 'length', min: 20, max: 110, int: false },
  { name: 'endZoneDepth', min: 0, max: 20, int: false },
  { name: 'rushLine', min: 0, max: 20, int: false },
  { name: 'maxRushers', min: 0, max: 6, int: true },
  { name: 'passClock', min: 1, max: 15, int: false },
];
const BOOL_KEYS: BoolKey[] = ['rusherGoesOnSnap', 'qbCanCrossLOS', 'centerEligible', 'catchBeyondLOS'];

async function patchField(format: Format, patch: Partial<FieldConfig>): Promise<void> {
  const cur = await settingsRepo.getOrDefault();
  await settingsRepo.update({ fields: { ...cur.fields, [format]: { ...cur.fields[format], ...patch } } });
}

function NumField(props: {
  format: Format;
  name: NumKey;
  min: number;
  max: number;
  int: boolean;
  value: number;
}): JSX.Element {
  const { format, name, min, max, int, value } = props;
  const { draft, set, revert } = useDraft(value, (v) => {
    if (v >= min && v <= max && (!int || Number.isInteger(v))) void patchField(format, { [name]: v });
  });
  return (
    <label className="flex flex-col gap-1 text-sm font-medium">
      {t.tuning.field.keys[name]}
      <input
        type="number"
        data-testid={`field-${name}`}
        min={min}
        max={max}
        step={int ? 1 : 0.5}
        value={draft}
        onChange={(e) => set(e.target.value, true)}
        onBlur={revert}
        className="w-28 rounded-md border border-slate-300 bg-white px-2 py-1 dark:border-slate-600 dark:bg-slate-800"
      />
    </label>
  );
}

function LineToGain({ format, value }: { format: Format; value: number[] }): JSX.Element {
  const [text, setText] = useState(value.join(', '));
  useEffect(() => setText(value.join(', ')), [value]);
  return (
    <label className="flex flex-col gap-1 text-sm font-medium">
      {t.tuning.field.lineToGain}
      <input
        type="text"
        data-testid="field-lineToGain"
        value={text}
        onChange={(e) => {
          setText(e.target.value);
          const parts = e.target.value.split(',').map((s) => s.trim());
          const nums = parts.map(Number);
          if (parts.every((s) => s !== '') && nums.every((n) => Number.isFinite(n) && n > 0)) {
            void patchField(format, { lineToGain: nums });
          }
        }}
        onBlur={() => setText(value.join(', '))}
        className="w-48 rounded-md border border-slate-300 bg-white px-2 py-1 dark:border-slate-600 dark:bg-slate-800"
      />
    </label>
  );
}

export function FieldSection(): JSX.Element {
  const settings = useSettings();
  const [format, setFormat] = useState<Format>('5v5');
  const fields = settings?.fields ?? createDefaultFields();
  const cfg = fields[format];
  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap gap-4">
        <Select
          label={t.tuning.field.format}
          data-testid="field-format"
          value={format}
          onChange={(e) => setFormat(e.target.value as Format)}
        >
          {FORMATS.map((f) => (
            <option key={f} value={f}>
              {t.tuning.field.formats[f]}
            </option>
          ))}
        </Select>
        <Select
          label={t.tuning.field.defaultFormat}
          data-testid="field-default-format"
          value={settings?.defaultFormat ?? '5v5'}
          onChange={(e) => void settingsRepo.update({ defaultFormat: e.target.value as Format })}
        >
          {FORMATS.map((f) => (
            <option key={f} value={f}>
              {t.tuning.field.formats[f]}
            </option>
          ))}
        </Select>
      </div>
      <div className="flex flex-wrap gap-4">
        {NUM_KEYS.map((k) => (
          <NumField key={`${format}-${k.name}`} format={format} {...k} value={cfg[k.name]} />
        ))}
        <LineToGain key={format} format={format} value={cfg.lineToGain} />
      </div>
      <div className="flex flex-col gap-1">
        {BOOL_KEYS.map((k) => (
          <label key={k} className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              data-testid={`field-${k}`}
              checked={cfg[k]}
              onChange={(e) => void patchField(format, { [k]: e.target.checked })}
            />
            {t.tuning.field.keys[k]}
          </label>
        ))}
      </div>
      <div>
        <Button
          data-testid="field-reset"
          onClick={() => void patchField(format, createDefaultFields()[format])}
        >
          {t.tuning.field.reset}
        </Button>
      </div>
    </div>
  );
}
