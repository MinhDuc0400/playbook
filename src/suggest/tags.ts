/** Tag tier of Suggest (SRS §10.2, FR-SG-01). Pure. */
import type { Play } from '@/domain/types';

function stripPrefix(play: Play, prefix: string): string[] {
  return play.tags.filter((t) => t.startsWith(prefix)).map((t) => t.slice(prefix.length));
}

/** Coverage names a defense advertises: 'cov:cover-2' → 'cover-2', 'cov:man' → 'man'; 'blitz' → 'blitz'. */
export function coverageTags(defense: Play): string[] {
  const out = stripPrefix(defense, 'cov:');
  if (defense.tags.includes('blitz')) out.push('blitz');
  return out;
}

/** What an offense claims to beat: 'beats:cover-2' → 'cover-2', 'beats:man' → 'man'. */
export function beatsTags(offense: Play): string[] {
  return stripPrefix(offense, 'beats:');
}

/** 1 when any beatsTags(offense) ∈ coverageTags(defense), else 0 (§10.3 tagMatch). */
export function tagMatch(offense: Play, defense: Play): 0 | 1 {
  const covs = coverageTags(defense);
  return beatsTags(offense).some((b) => covs.includes(b)) ? 1 : 0;
}
