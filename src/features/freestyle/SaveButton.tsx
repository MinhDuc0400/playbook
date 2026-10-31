/** "Lưu thành play" (FR-FS-10): 2 plays + 1 matchup, then open the matchup. */
import { nanoid } from 'nanoid';
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { matchupsRepo, playsRepo } from '@/db/repos';
import type { Play } from '@/domain/types';
import { createMatchup } from '@/features/matchup/buildSimInput';
import { t } from '@/i18n/vi';
import { useEditorStore } from '@/store/editorStore';
import { pickTrialPlays } from './useFreestyleTrial';

const pad = (n: number): string => String(n).padStart(2, '0');

/** 'Freestyle dd/MM HH:mm'. */
export function freestyleName(now: number): string {
  const d = new Date(now);
  return `${t.freestyle.boardName} ${pad(d.getDate())}/${pad(d.getMonth() + 1)} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function fresh(src: Play, name: string, now: number): Play {
  const tags = src.tags.includes('freestyle') ? src.tags : [...src.tags, 'freestyle'];
  return { ...structuredClone(src), id: nanoid(), name, tags, createdAt: now, updatedAt: now };
}

export function SaveButton({ btnClass }: { btnClass: string }): JSX.Element {
  const play = useEditorStore((s) => s.play);
  const companion = useEditorStore((s) => s.companion);
  const navigate = useNavigate();
  const [busy, setBusy] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { offense, defense } = pickTrialPlays(play, companion);
  const ok = (offense?.players.length ?? 0) > 0 && (defense?.players.length ?? 0) > 0;

  const save = async (): Promise<void> => {
    const cur = pickTrialPlays(useEditorStore.getState().play, useEditorStore.getState().companion);
    if (busy || !cur.offense || !cur.defense) return;
    setBusy(true);
    setError(null);
    setSaved(false);
    try {
      const now = Date.now();
      const base = freestyleName(now);
      const o = fresh(cur.offense, `${base} · ${t.freestyle.sideOffense}`, now);
      const d = fresh(cur.defense, `${base} · ${t.freestyle.sideDefense}`, now);
      await playsRepo.put(o);
      await playsRepo.put(d);
      const m = createMatchup({ offensePlayId: o.id, defensePlayId: d.id, now, idGen: nanoid, seed: 1 });
      await matchupsRepo.put(m);
      setSaved(true);
      navigate(`/matchup/${m.id}`);
    } catch {
      setError(t.freestyle.saveError);
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <button
        type="button"
        data-testid="fs-save"
        className={btnClass}
        disabled={!ok || busy}
        title={ok ? t.freestyle.saveTitle : t.freestyle.saveDisabled}
        onClick={() => void save()}
      >
        {t.freestyle.save}
      </button>
      {saved && (
        <span data-testid="fs-saved" role="status" className="text-sm text-green-700 dark:text-green-400">
          {t.freestyle.saved}
        </span>
      )}
      {error !== null && (
        <span data-testid="fs-save-error" role="alert" className="text-sm text-red-700 dark:text-red-400">
          {error}
        </span>
      )}
    </>
  );
}
