/** Playbook filtering/sorting (FR-PB-02, NFR-PERF-04: 500 plays < 100 ms). Pure. */
import { notImplemented } from '@/domain/notImplemented';
import type { Format, Play, Side } from '@/domain/types';

export interface PlayFilter {
  side?: Side;
  format?: Format;
  formation?: string; // exact match
  tag?: string; // exact tag
  q?: string; // case/diacritic-insensitive substring of name
  sort: 'updated' | 'name'; // updated = newest first; name = vi locale ascending
}

export function filterPlays(plays: readonly Play[], f: PlayFilter): Play[] {
  return notImplemented(`filterPlays ${plays.length}${String(f)}`);
}

/** Distinct formations / tags for the filter dropdowns, sorted. */
export function facets(plays: readonly Play[]): { formations: string[]; tags: string[] } {
  return notImplemented(`facets ${plays.length}`);
}

/** Lower-case + strip Vietnamese diacritics (NFD + remove combining marks, đ → d). */
export function normalizeText(s: string): string {
  return notImplemented(`normalizeText ${s}`);
}
