/** Tag tier of Suggest (SRS §10.2, FR-SG-01). Pure. */
import { notImplemented } from '@/domain/notImplemented';
import type { Play } from '@/domain/types';

/** Coverage names a defense advertises: 'cov:cover-2' → 'cover-2', 'cov:man' → 'man'; 'blitz' → 'blitz'. */
export function coverageTags(defense: Play): string[] {
  return notImplemented(`coverageTags ${defense.id}`);
}

/** What an offense claims to beat: 'beats:cover-2' → 'cover-2', 'beats:man' → 'man'. */
export function beatsTags(offense: Play): string[] {
  return notImplemented(`beatsTags ${offense.id}`);
}

/** 1 when any beatsTags(offense) ∈ coverageTags(defense), else 0 (§10.3 tagMatch). */
export function tagMatch(offense: Play, defense: Play): 0 | 1 {
  return notImplemented(`tagMatch ${offense.id}${defense.id}`);
}
