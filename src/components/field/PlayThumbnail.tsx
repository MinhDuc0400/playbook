/**
 * Static SVG thumbnail of a play (FR-PB-01): positions + routes/assignments, no interaction, no zoom.
 * Fits the rect x ∈ sidelines, y ∈ [−8, 20] into width × height via fitViewport and renders FieldSvg
 * (no badge) + PlayerTokens + RoutePaths (offense routes; defense: zones, man lines to the default ghost,
 * rush arrows). `flipped` draws flipPlay(play) (FR-FLP-05 later).
 */
import { memo, useMemo } from 'react';
import { DEFAULT_BALL_SPOT, sidelineBounds } from '@/domain/field';
import { flipPlay } from '@/domain/flip';
import { resolveReceiverRef } from '@/domain/numbering';
import type { FieldConfig, ManAction, Play, PlayerSlot, RushAction, ZoneAction } from '@/domain/types';
import { zoneKind, zonePolygon } from '@/domain/zones';
import { ghostNumbering, ghostPlayers } from '@/features/editor/defense/ghost';
import { FieldSvg } from './FieldSvg';
import { PlayerToken } from './PlayerToken';
import { RoutePath } from './RoutePath';
import { fitViewport } from './viewport';
import { ZoneShape } from './ZoneShape';

export interface PlayThumbnailProps {
  play: Play;
  field: FieldConfig;
  width?: number; // px, default 240
  height?: number; // px, default 160
  flipped?: boolean;
  className?: string;
}

const MIN_Y = -8;
const MAX_Y = 20;
const PADDING = 6;

function findAction<T extends 'man' | 'zone' | 'rush'>(
  slot: PlayerSlot,
  type: T,
): Extract<ManAction | ZoneAction | RushAction, { type: T }> | undefined {
  return slot.actions.find((a) => a.type === type) as
    Extract<ManAction | ZoneAction | RushAction, { type: T }> | undefined;
}

function PlayThumbnailImpl({
  play,
  field,
  width = 240,
  height = 160,
  flipped = false,
  className,
}: PlayThumbnailProps): JSX.Element {
  const shown = useMemo(() => (flipped ? flipPlay(play) : play), [play, flipped]);
  const viewport = useMemo(() => {
    const { minX, maxX } = sidelineBounds(field, DEFAULT_BALL_SPOT);
    return fitViewport(width, height, { minX, maxX, minY: MIN_Y, maxY: MAX_Y }, PADDING);
  }, [field, width, height]);
  const isDefense = shown.side === 'defense';
  const ghost = useMemo(
    () =>
      isDefense
        ? {
            numbering: ghostNumbering(shown.format, null),
            positions: new Map(ghostPlayers(shown.format, null).map((g) => [g.id, g.pos])),
          }
        : null,
    [isDefense, shown.format],
  );

  const zones: JSX.Element[] = [];
  const paths: JSX.Element[] = [];
  for (const slot of shown.players) {
    if (!isDefense) {
      for (const [i, a] of slot.actions.entries()) {
        if (a.type === 'route') {
          paths.push(
            <RoutePath
              key={`r-${slot.id}-${i}`}
              variant="route"
              from={slot.start}
              path={a.path}
              smooth={a.smooth}
            />,
          );
        } else if (a.type === 'option') {
          paths.push(<RoutePath key={`o-${slot.id}-${i}`} variant="route" from={slot.start} path={a.stem} />);
        }
      }
      continue;
    }
    const zone = findAction(slot, 'zone');
    if (zone) {
      zones.push(
        <ZoneShape
          key={`z-${slot.id}`}
          polygon={zonePolygon(zone.zone, field)}
          kind={zoneKind(zone.zone)}
          dropPoint={zone.dropPoint}
        />,
      );
    }
    const man = findAction(slot, 'man');
    if (man && ghost) {
      const targetId = resolveReceiverRef(man.target, ghost.numbering);
      const target = targetId ? ghost.positions.get(targetId) : undefined;
      if (target) {
        paths.push(<RoutePath key={`m-${slot.id}`} variant="man" from={slot.start} path={[target]} />);
      }
    }
    const rush = findAction(slot, 'rush');
    if (rush) {
      paths.push(<RoutePath key={`u-${slot.id}`} variant="rush" from={slot.start} path={rush.path} />);
    }
  }

  return (
    <div
      className={className}
      style={{ pointerEvents: 'none', width, height }}
      data-testid={`play-thumb-${play.id}`}
      aria-hidden="true"
    >
      <FieldSvg field={field} ballSpot={DEFAULT_BALL_SPOT} viewport={viewport}>
        {zones}
        {paths}
        {shown.players.map((p) => (
          <PlayerToken
            key={p.id}
            id={p.id}
            side={shown.side}
            label={p.label}
            pos={p.start}
            leverage={p.leverage}
            rusher={p.actions.some((a) => a.type === 'rush')}
          />
        ))}
      </FieldSvg>
    </div>
  );
}

export const PlayThumbnail = memo(PlayThumbnailImpl);
