import type { Stats } from '@/domain/types';

interface Range {
  min: number;
  max: number;
}
const UNIT: Range = { min: 0, max: 1 };

/** Allowed range per stat (same as the preset editor in Settings). */
export const STAT_RANGES: Record<keyof Stats, Range> = {
  speed: { min: 3, max: 12 },
  accel: { min: 0.2, max: 3 },
  cutLoss: UNIT,
  reaction: { min: 0.05, max: 1.5 },
  iq: UNIT,
  hands: UNIT,
  ballSkills: UNIT,
  release: { min: 0.1, max: 1.5 },
  accuracy: UNIT,
  armRange: { min: 5, max: 60 },
  eyeDiscipline: UNIT,
};

/** Level colour classes (FR-ATH-02): weak red, avg grey, good green, custom purple. */
export const LEVEL_DOT: Record<string, string> = {
  weak: 'bg-red-500',
  avg: 'bg-slate-400',
  good: 'bg-green-500',
  custom: 'bg-purple-500',
};
