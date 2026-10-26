/**
 * "Chạy thử" (FR-OFF-06): replaces the editor canvas while store.previewing. Runs previewOffense once per
 * play change, renders its own FieldStage with PlayerTokens at frameAt(frames, t), planned routes faded,
 * and a Timeline (autoPlay). A close button calls onClose.
 */
import { useEffect, useMemo } from 'react';
import { FieldStage } from '@/components/field/FieldStage';
import { PlayerToken } from '@/components/field/PlayerToken';
import { RoutePath } from '@/components/field/RoutePath';
import { Timeline, type TimelineMarker } from '@/components/field/Timeline';
import { usePlayback } from '@/components/field/usePlayback';
import { Button } from '@/components/ui';
import type { BallSpot, FieldConfig, TuningParams } from '@/domain/types';
import { previewOffense } from '@/engine/preview';
import { frameAt } from '@/engine/frames';
import { t } from '@/i18n/vi';
import { useEditorStore } from '@/store/editorStore';

export interface PreviewOverlayProps {
  field: FieldConfig;
  ballSpot: BallSpot;
  tuning: TuningParams;
  onClose(): void;
}

const ROUTE_OPACITY = 0.35;

/** Space and Enter-like keys on these elements keep their native behaviour. */
function ownsSpaceKey(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  const tag = target.tagName;
  return (
    tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || tag === 'BUTTON' || target.isContentEditable
  );
}

export function PreviewOverlay({
  field,
  ballSpot,
  tuning,
  onClose,
}: PreviewOverlayProps): JSX.Element | null {
  const play = useEditorStore((s) => s.play);
  const offensePlay = play && play.side === 'offense' ? play : null;

  const result = useMemo(
    () => (offensePlay ? previewOffense({ play: offensePlay, field, ballSpot, tuning }) : null),
    [offensePlay, field, ballSpot, tuning],
  );
  const duration = result?.duration ?? 0;
  const minT = result && result.frames.length > 0 ? result.frames[0]!.t : 0;
  const playback = usePlayback({ duration, minT, autoPlay: true });

  const { toggle } = playback;
  useEffect(() => {
    const onKey = (e: KeyboardEvent): void => {
      if (e.code !== 'Space' && e.key !== ' ') return;
      if (ownsSpaceKey(e.target)) return;
      e.preventDefault();
      toggle();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [toggle]);

  if (!offensePlay || !result) return null;

  const frame = frameAt(result.frames, playback.t);
  const markers: TimelineMarker[] = result.events.map((e) => ({ t: e.t, type: e.type }));

  return (
    <div
      data-testid="preview-overlay"
      role="region"
      aria-label={t.offense.preview.title}
      className="flex h-full w-full flex-col gap-2"
    >
      <div className="flex items-center justify-between gap-2">
        <h2 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
          {t.offense.preview.title}
        </h2>
        <Button size="sm" data-testid="btn-preview-close" onClick={onClose}>
          {t.offense.preview.close}
        </Button>
      </div>
      <div className="min-h-0 flex-1" aria-label={t.offense.preview.stage}>
        <FieldStage field={field} ballSpot={ballSpot}>
          <g data-testid="preview-routes" opacity={ROUTE_OPACITY}>
            {offensePlay.players.map((slot) => {
              const route = slot.actions.find((a) => a.type === 'route');
              if (route?.type !== 'route') return null;
              return (
                <RoutePath
                  key={slot.id}
                  from={slot.start}
                  path={route.path}
                  smooth={route.smooth}
                  variant="route"
                />
              );
            })}
          </g>
          {offensePlay.players.map((slot) => (
            <PlayerToken
              key={slot.id}
              id={slot.id}
              side="offense"
              label={slot.label}
              pos={frame?.players[slot.id]?.pos ?? slot.start}
            />
          ))}
        </FieldStage>
      </div>
      <Timeline playback={playback} duration={duration} minT={minT} markers={markers} />
    </div>
  );
}
