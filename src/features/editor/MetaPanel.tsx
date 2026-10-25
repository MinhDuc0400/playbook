/** Play metadata (FR-ED-05): formation, tags with autocomplete (SRS §10.2 conventions), notes. */
import { useId, useState } from 'react';
import { useAllTags } from '@/db/hooks';
import type { Side } from '@/domain/types';
import { fieldClasses } from '@/components/ui/TextInput';
import { t } from '@/i18n/vi';
import { setMeta } from '@/features/editor/ops';
import { useEditorStore } from '@/store/editorStore';

/** Conventional tags offered while typing (SRS §10.2). */
export const CONVENTION_TAGS: Record<Side, readonly string[]> = {
  defense: ['cov:cover-0', 'cov:cover-1', 'cov:cover-2', 'cov:cover-3', 'cov:man', 'cov:zone', 'blitz'],
  offense: [
    'beats:cover-0',
    'beats:cover-1',
    'beats:cover-2',
    'beats:cover-3',
    'beats:man',
    'beats:zone',
    'concept:flood',
    'concept:mesh',
    'concept:smash',
    'quick',
  ],
};

const MAX_SUGGESTIONS = 8;
const labelClass = 'text-sm font-medium text-slate-700 dark:text-slate-200';

export function MetaPanel(): JSX.Element | null {
  const play = useEditorStore((s) => s.play);
  const apply = useEditorStore((s) => s.apply);
  const allTags = useAllTags();
  const [draft, setDraft] = useState('');
  const [focused, setFocused] = useState(false);
  const listId = useId();

  if (!play) return null;

  const addTag = (raw: string): void => {
    const tag = raw.trim().toLowerCase();
    setDraft('');
    if (tag === '' || play.tags.includes(tag)) return;
    apply('add-tag', setMeta({ tags: [...play.tags, tag] }));
  };

  const prefix = draft.trim().toLowerCase();
  const pool = new Set<string>([...(allTags ?? []), ...CONVENTION_TAGS[play.side]]);
  const suggestions = Array.from(pool)
    .filter((tag) => !play.tags.includes(tag) && tag.toLowerCase().startsWith(prefix))
    .sort()
    .slice(0, MAX_SUGGESTIONS);
  const showList = focused && suggestions.length > 0;

  return (
    <section
      aria-label={t.editor.meta.title}
      data-testid="meta-panel"
      className="flex flex-col gap-3 border-b border-slate-200 p-3 dark:border-slate-700"
    >
      <h2 className="text-sm font-semibold">{t.editor.meta.title}</h2>
      <div className="flex flex-col gap-1">
        <label htmlFor="play-formation" className={labelClass}>
          {t.editor.meta.formation}
        </label>
        <input
          id="play-formation"
          data-testid="play-formation"
          className={fieldClasses}
          value={play.formation}
          onChange={(e) => apply('formation', setMeta({ formation: e.target.value }))}
        />
      </div>
      <div className="flex flex-col gap-1">
        <label htmlFor="play-tags-input" className={labelClass}>
          {t.editor.meta.tags}
        </label>
        <ul className="flex flex-wrap gap-1" data-testid="play-tags">
          {play.tags.map((tag) => (
            <li
              key={tag}
              data-testid={`tag-${tag}`}
              className="flex items-center gap-1 rounded-full bg-blue-100 px-2 py-0.5 text-xs text-blue-900 dark:bg-blue-900 dark:text-blue-100"
            >
              {tag}
              <button
                type="button"
                data-testid={`tag-remove-${tag}`}
                aria-label={t.editor.meta.removeTag.replace('{tag}', tag)}
                className="rounded-full px-1 hover:bg-blue-200 dark:hover:bg-blue-800"
                onClick={() => apply('remove-tag', setMeta({ tags: play.tags.filter((x) => x !== tag) }))}
              >
                ×
              </button>
            </li>
          ))}
        </ul>
        <div className="relative">
          <input
            id="play-tags-input"
            data-testid="play-tags-input"
            role="combobox"
            aria-expanded={showList}
            aria-controls={listId}
            aria-autocomplete="list"
            autoComplete="off"
            placeholder={t.editor.meta.tagsInput}
            className={fieldClasses}
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onFocus={() => setFocused(true)}
            onBlur={() => setFocused(false)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                addTag(draft);
              }
            }}
          />
          <ul
            id={listId}
            role="listbox"
            aria-label={t.editor.meta.suggestions}
            hidden={!showList}
            className="absolute z-10 mt-1 max-h-48 w-full overflow-auto rounded-md border border-slate-300 bg-white shadow dark:border-slate-600 dark:bg-slate-800"
          >
            {showList
              ? suggestions.map((tag) => (
                  <li
                    key={tag}
                    role="option"
                    aria-selected={false}
                    data-testid={`tag-option-${tag}`}
                    className="cursor-pointer px-2 py-1 text-sm hover:bg-slate-100 dark:hover:bg-slate-700"
                    // Keep focus in the input so blur does not close the list before the click lands.
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => addTag(tag)}
                  >
                    {tag}
                  </li>
                ))
              : null}
          </ul>
        </div>
        <span className="text-xs text-slate-500 dark:text-slate-400">{t.editor.meta.tagsHint}</span>
      </div>
      <div className="flex flex-col gap-1">
        <label htmlFor="play-notes" className={labelClass}>
          {t.editor.meta.notes}
        </label>
        <textarea
          id="play-notes"
          data-testid="play-notes"
          rows={3}
          className={fieldClasses}
          value={play.notes ?? ''}
          onChange={(e) => apply('notes', setMeta({ notes: e.target.value }))}
        />
      </div>
    </section>
  );
}
