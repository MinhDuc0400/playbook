/**
 * Random defense (FR-RD-01..04): pick a random same-format defense (optionally filtered by tag), hide its
 * name and the zone/man overlays while hidden, let the user guess a coverage from the cov:* tags, reveal on
 * "Hiện" or at the end of the animation, show right/wrong and a session counter.
 */
import { useEffect, useMemo, useRef, useState } from 'react';
import { Button, Select } from '@/components/ui';
import { usePlays } from '@/db/hooks';
import type { Play } from '@/domain/types';
import { t } from '@/i18n/vi';

export interface RandomDefenseProps {
  offense: Play;
  /** Called with the chosen defense play id; the page swaps the matchup's defense. */
  onPick(defensePlayId: string): void;
  /** Current defense of the matchup (to know what to reveal). */
  defense: Play | null;
  hidden: boolean;
  onHiddenChange(hidden: boolean): void;
  /** True once the animation reached its end (auto reveal). */
  ended: boolean;
}

const GUESS_TAGS = ['cov:cover-0', 'cov:cover-1', 'cov:cover-2', 'cov:cover-3', 'cov:man', 'cov:zone'];

interface Verdict {
  guess: string | null;
  correct: boolean;
  answer: string[];
}

export function RandomDefense({
  offense,
  onPick,
  defense,
  hidden,
  onHiddenChange,
  ended,
}: RandomDefenseProps): JSX.Element {
  const plays = usePlays();
  const [filter, setFilter] = useState('');
  const [guess, setGuess] = useState<string | null>(null);
  const [verdict, setVerdict] = useState<Verdict | null>(null);
  const [score, setScore] = useState({ right: 0, total: 0 });
  // Auto reveal only counts once `ended` was seen false after the pick (stale "ended" of the old run).
  const armed = useRef(false);

  const pool = useMemo(
    () => (plays ?? []).filter((p) => p.side === 'defense' && p.format === offense.format),
    [plays, offense.format],
  );
  const filterTags = useMemo(
    () => [...new Set(pool.flatMap((p) => p.tags.filter((x) => x.startsWith('cov:'))))].sort(),
    [pool],
  );
  const candidates = useMemo(
    () => pool.filter((p) => filter === '' || p.tags.includes(filter)),
    [pool, filter],
  );

  const reveal = (): void => {
    if (!hidden) return;
    const answer = (defense?.tags ?? []).filter((x) => x.startsWith('cov:'));
    const correct = guess !== null && (defense?.tags ?? []).includes(guess);
    if (guess !== null) setScore((s) => ({ right: s.right + (correct ? 1 : 0), total: s.total + 1 }));
    setVerdict({ guess, correct, answer });
    onHiddenChange(false);
  };

  useEffect(() => {
    if (!ended) armed.current = true;
    else if (hidden && armed.current) reveal();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ended, hidden]);

  const pick = (): void => {
    const others = candidates.filter((p) => p.id !== defense?.id);
    const list = others.length > 0 ? others : candidates;
    if (list.length === 0) return;
    const chosen = list[Math.min(list.length - 1, Math.floor(Math.random() * list.length))]!;
    armed.current = false;
    setGuess(null);
    setVerdict(null);
    onPick(chosen.id);
    onHiddenChange(true);
  };

  return (
    <section data-testid="random-defense" className="flex flex-col gap-2 rounded border p-2 text-sm">
      <h3 className="font-medium">{t.randomDef.title}</h3>
      <Select
        label={t.randomDef.tagFilter}
        data-testid="rd-tag"
        value={filter}
        onChange={(e) => setFilter(e.target.value)}
      >
        <option value="">{t.randomDef.tagAll}</option>
        {filterTags.map((tag) => (
          <option key={tag} value={tag}>
            {t.randomDef.tags[tag] ?? tag}
          </option>
        ))}
      </Select>
      <Button data-testid="rd-random" onClick={pick} disabled={candidates.length === 0}>
        {t.randomDef.random}
      </Button>
      {candidates.length === 0 && <p>{t.randomDef.none}</p>}
      {hidden && (
        <>
          <p data-testid="rd-name">{t.randomDef.hiddenName}</p>
          <div role="group" aria-label={t.randomDef.guessPrompt} className="flex flex-wrap gap-1">
            {GUESS_TAGS.map((tag) => (
              <Button
                key={tag}
                size="sm"
                data-testid={`rd-guess-${tag}`}
                aria-pressed={guess === tag}
                variant={guess === tag ? 'primary' : 'secondary'}
                onClick={() => setGuess(tag)}
              >
                {t.randomDef.tags[tag] ?? tag}
              </Button>
            ))}
          </div>
          <Button data-testid="rd-reveal" onClick={reveal}>
            {t.randomDef.reveal}
          </Button>
        </>
      )}
      {!hidden && verdict && defense && (
        <>
          <p data-testid="rd-name">{defense.name}</p>
          {verdict.guess !== null && (
            <p data-testid="rd-result">
              {verdict.correct
                ? t.randomDef.correct
                : `${t.randomDef.wrong}: ${verdict.answer.map((x) => t.randomDef.tags[x] ?? x).join(', ')}`}
            </p>
          )}
        </>
      )}
      {score.total > 0 && (
        <p data-testid="rd-score">
          {t.randomDef.score}: {score.right} / {score.total}
        </p>
      )}
    </section>
  );
}
