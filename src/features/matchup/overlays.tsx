/**
 * Matchup overlays (FR-MU-05, FR-MU-06). Each one reads the toggles from useMatchupStore and only draws
 * what the engine returned (frames / metrics); nothing here computes a player position.
 */
import { useMemo } from 'react';
import { RoutePath } from '@/components/field/RoutePath';
import { ZoneShape } from '@/components/field/ZoneShape';
import { useFieldContext } from '@/components/field/FieldContext';
import { toScreen } from '@/components/field/viewport';
import { alignedPlayers, numberReceivers, resolveReceiverRef } from '@/domain/numbering';
import type { Frame, ManAction, Point, RouteAction, SimResult, ZoneAction } from '@/domain/types';
import { zoneKind, zonePolygon } from '@/domain/zones';
import { frameAt } from '@/engine/frames';
import { useMatchupStore } from '@/store/matchupStore';
import type { BuiltSim } from './buildSimInput';

export interface OverlayProps {
  built: BuiltSim;
  result: SimResult;
  t: number;
  hideDefenseOverlays?: boolean;
}

const TRAIL_STEP = 3;

export function PlannedRoutesOverlay({ built }: OverlayProps): JSX.Element | null {
  const on = useMatchupStore((s) => s.overlays.plannedRoutes);
  if (!on) return null;
  return (
    <g data-testid="overlay-plannedRoutes" opacity={0.45} pointerEvents="none">
      {built.offense.players.map((slot) => {
        const route = slot.actions.find((a): a is RouteAction => a.type === 'route');
        if (!route || route.path.length === 0) return null;
        return (
          <RoutePath
            key={slot.id}
            from={slot.start}
            path={route.path}
            smooth={route.smooth}
            variant="route"
            testId={`overlay-route-${slot.label}`}
          />
        );
      })}
    </g>
  );
}

export function TrailsOverlay({ built, result, t }: OverlayProps): JSX.Element | null {
  const on = useMatchupStore((s) => s.overlays.trails);
  if (!on) return null;
  const upto = result.frames.filter((f) => f.t <= t);
  return (
    <g data-testid="overlay-trails" pointerEvents="none">
      {[...built.offense.players, ...built.defense.players].map((slot) => {
        const pts: Point[] = [];
        upto.forEach((f: Frame, i) => {
          const p = f.players[slot.id]?.pos;
          if (p && (i % TRAIL_STEP === 0 || i === upto.length - 1)) pts.push(p);
        });
        const [first, ...rest] = pts;
        if (!first || rest.length === 0) return null;
        return (
          <RoutePath
            key={slot.id}
            from={first}
            path={rest}
            variant="trail"
            testId={`overlay-trail-${slot.label}`}
          />
        );
      })}
    </g>
  );
}

export function ZonesOverlay({ built, hideDefenseOverlays }: OverlayProps): JSX.Element | null {
  const on = useMatchupStore((s) => s.overlays.zones);
  const { field } = useFieldContext();
  if (!on || hideDefenseOverlays) return null;
  return (
    <g data-testid="overlay-zones" pointerEvents="none">
      {built.defense.players.map((slot) => {
        const zone = slot.actions.find((a): a is ZoneAction => a.type === 'zone');
        if (!zone) return null;
        return (
          <ZoneShape
            key={slot.id}
            polygon={zonePolygon(zone.zone, field)}
            kind={zoneKind(zone.zone)}
            dropPoint={zone.dropPoint}
            testId={`overlay-zone-${slot.label}`}
          />
        );
      })}
    </g>
  );
}

export function ManLinesOverlay({ built, result, t, hideDefenseOverlays }: OverlayProps): JSX.Element | null {
  const on = useMatchupStore((s) => s.overlays.manLines);
  const numbering = useMemo(() => numberReceivers(alignedPlayers(built.offense)), [built.offense]);
  if (!on || hideDefenseOverlays) return null;
  const frame = frameAt(result.frames, t);
  if (!frame) return null;
  return (
    <g data-testid="overlay-manLines" pointerEvents="none">
      {built.defense.players.map((slot) => {
        const man = slot.actions.find((a): a is ManAction => a.type === 'man');
        if (!man) return null;
        const targetId = resolveReceiverRef(man.target, numbering);
        const from = frame.players[slot.id]?.pos;
        const to = targetId ? frame.players[targetId]?.pos : undefined;
        if (!from || !to) return null;
        return (
          <RoutePath
            key={slot.id}
            from={from}
            path={[to]}
            variant="man"
            testId={`overlay-man-${slot.label}`}
          />
        );
      })}
    </g>
  );
}

export function BallPathOverlay({ result, t }: OverlayProps): JSX.Element | null {
  const on = useMatchupStore((s) => s.overlays.ballPath);
  const throwFrame = useMemo(
    () => result.frames.find((f) => f.ball.state === 'inAir' && f.ball.from && f.ball.landing),
    [result.frames],
  );
  if (!on || !throwFrame) return null;
  const { from, landing, tThrow } = throwFrame.ball;
  if (!from || !landing || t < (tThrow ?? throwFrame.t)) return null;
  return <RoutePath from={from} path={[landing]} variant="ball" testId="overlay-ball" />;
}

/** Separation colour class by thresholds (FR-MU-06): red < tight, amber ≤ open, green above. */
export function separationClass(d: number, tight: number, open: number): string {
  if (d < tight) return 'fill-red-600';
  if (d <= open) return 'fill-amber-500';
  return 'fill-green-600';
}

function sepAt(series: { t: number; d: number }[] | undefined, t: number): number | undefined {
  if (!series) return undefined;
  let found: number | undefined;
  for (const e of series) {
    if (e.t > t) break;
    found = e.d;
  }
  return found;
}

export function SeparationOverlay({ built, result, t }: OverlayProps): JSX.Element | null {
  const on = useMatchupStore((s) => s.overlays.separation);
  const { viewport } = useFieldContext();
  if (!on) return null;
  const frame = frameAt(result.frames, t);
  if (!frame) return null;
  const { separationTight, separationOpen } = built.input.tuning;
  return (
    <g data-testid="overlay-separation" pointerEvents="none">
      {built.offense.players
        .filter((s) => s.role !== 'QB')
        .map((slot) => {
          const pos = frame.players[slot.id]?.pos;
          const d = sepAt(result.metrics.separation[slot.id], t);
          if (!pos || d === undefined) return null;
          const c = toScreen(pos, viewport);
          return (
            <text
              key={slot.id}
              data-testid={`sep-${slot.label}`}
              x={c.x}
              y={c.y + 26}
              textAnchor="middle"
              fontSize={12}
              fontWeight={700}
              className={separationClass(d, separationTight, separationOpen)}
              stroke="white"
              strokeWidth={0.5}
              paintOrder="stroke"
            >
              {d.toFixed(1)}
            </text>
          );
        })}
    </g>
  );
}

export function MatchupOverlays(props: OverlayProps): JSX.Element {
  return (
    <>
      <ZonesOverlay {...props} />
      <PlannedRoutesOverlay {...props} />
      <TrailsOverlay {...props} />
      <ManLinesOverlay {...props} />
      <BallPathOverlay {...props} />
      <SeparationOverlay {...props} />
    </>
  );
}
