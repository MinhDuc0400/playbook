/** Playbook filtering/sorting (FR-PB-02, NFR-PERF-04: 500 plays < 100 ms). Pure. */
import type { Format, Play, Side } from '@/domain/types';

export interface PlayFilter {
  side?: Side;
  format?: Format;
  formation?: string; // exact match
  tag?: string; // exact tag
  q?: string; // case/diacritic-insensitive substring of name
  sort: 'updated' | 'name'; // updated = newest first; name = vi locale ascending
}

/** Lower-case + strip Vietnamese diacritics (NFD + remove combining marks, đ → d). */
export function normalizeText(s: string): string {
  return s.normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/đ/gi, 'd').toLowerCase();
}

const nameCollator = new Intl.Collator('vi');

export function filterPlays(plays: readonly Play[], f: PlayFilter): Play[] {
  const q = f.q ? normalizeText(f.q.trim()) : '';
  const out = plays.filter(
    (p) =>
      (f.side === undefined || p.side === f.side) &&
      (f.format === undefined || p.format === f.format) &&
      (f.formation === undefined || p.formation === f.formation) &&
      (f.tag === undefined || p.tags.includes(f.tag)) &&
      (q === '' || normalizeText(p.name).includes(q)),
  );
  if (f.sort === 'name') out.sort((a, b) => nameCollator.compare(a.name, b.name));
  else out.sort((a, b) => b.updatedAt - a.updatedAt);
  return out;
}

/** Distinct formations / tags for the filter dropdowns, sorted. */
export function facets(plays: readonly Play[]): { formations: string[]; tags: string[] } {
  const formations = new Set<string>();
  const tags = new Set<string>();
  for (const p of plays) {
    formations.add(p.formation);
    for (const tag of p.tags) tags.add(tag);
  }
  return {
    formations: [...formations].sort((a, b) => nameCollator.compare(a, b)),
    tags: [...tags].sort((a, b) => nameCollator.compare(a, b)),
  };
}
