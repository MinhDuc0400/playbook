/**
 * Matchup overlays (FR-MU-05, FR-MU-06). Each one reads the toggles from useMatchupStore and only draws
 * what the engine returned (frames / metrics); nothing here computes a player position.
 */
import { useMemo } from 'react';
import { RoutePath } from '@/components/field/RoutePath';
import { ZoneShape } from '@/components/field/ZoneShape';
import { useFieldContext } from '@/components/field/FieldContext';
import { toScreen, yardsToPx } from '@/components/field/viewport';
import { alignedPlayers, numberReceivers, resolveReceiverRef } from '@/domain/numbering';
import type { Frame, ManAction, Point, RouteAction, SimResult, ZoneAction } from '@/domain/types';
import { zoneKind, zonePolygon } from '@/domain/zones';
import { frameAt } from '@/engine/frames';
import { useMatchupStore } from '@/store/matchupStore';
import type { BuiltSim } from './buildSimInput';
import type { QbKey } from './useQbMode';

export interface OverlayProps {
  built: BuiltSim;
  result: SimResult;
  t: number;
  hideDefenseOverlays?: boolean;
  /** D-23: QB mode before the throw hides the separation numbers. */
  hideReadInfo?: boolean;
  /** D-23: key badges next to receivers. */
  qbKeys?: readonly QbKey[];
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

export function SeparationOverlay({ built, result, t, hideReadInfo }: OverlayProps): JSX.Element | null {
  const on = useMatchupStore((s) => s.overlays.separation);
  const { viewport } = useFieldContext();
  if (!on || hideReadInfo) return null;
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

/** FR-MU-12: dashed line QB → the player the QB is looking at (frame.eyeTarget). */
export function QbEyesOverlay({ built, result, t }: OverlayProps): JSX.Element | null {
  const on = useMatchupStore((s) => s.overlays.qbEyes);
  const { viewport } = useFieldContext();
  if (!on) return null;
  const frame = frameAt(result.frames, t);
  const qb = built.offense.players.find((p) => p.role === 'QB');
  if (!frame || !qb || !frame.eyeTarget) return null;
  const from = frame.players[qb.id]?.pos;
  const to = frame.players[frame.eyeTarget]?.pos;
  if (!from || !to) return null;
  const a = toScreen(from, viewport);
  const b = toScreen(to, viewport);
  return (
    <g data-testid="overlay-qbEyes" pointerEvents="none">
      <line
        data-testid="qb-eye-line"
        x1={a.x}
        y1={a.y}
        x2={b.x}
        y2={b.y}
        stroke="#0891b2"
        strokeWidth={1.5}
        strokeDasharray="5 4"
      />
    </g>
  );
}

/** FR-MU-11: what the selected defender "sees" (delayed ghosts) and where it aims. Debug data only. */
export function PerceptionOverlay({ built, result, t }: OverlayProps): JSX.Element | null {
  const on = useMatchupStore((s) => s.overlays.perception);
  const defId = useMatchupStore((s) => s.debugDefenderId);
  const { viewport } = useFieldContext();
  if (!on || !defId || !result.debug) return null;
  const frame = frameAt(result.frames, t);
  if (!frame) return null;
  const dbg = result.debug.defenders[result.frames.indexOf(frame)]?.[defId];
  if (!dbg) return null;
  const defPos = frame.players[defId]?.pos;
  const aim = dbg.aim ? toScreen(dbg.aim, viewport) : null;
  const from = defPos ? toScreen(defPos, viewport) : null;
  const r = Math.max(6, yardsToPx(0.8, viewport));
  return (
    <g data-testid="overlay-perception" pointerEvents="none">
      {built.offense.players.map((slot) => {
        const seen = dbg.seen[slot.id];
        if (!seen) return null;
        const c = toScreen(seen, viewport);
        return (
          <g key={slot.id} data-testid={`perceived-${slot.label}`} opacity={0.4}>
            <circle cx={c.x} cy={c.y} r={r} className="fill-slate-400 stroke-slate-700" strokeWidth={1.5} />
            <text x={c.x} y={c.y + 4} textAnchor="middle" fontSize={11} className="fill-slate-900">
              {slot.label}
            </text>
          </g>
        );
      })}
      {aim && from && (
        <line
          data-testid="perceived-aim-line"
          x1={from.x}
          y1={from.y}
          x2={aim.x}
          y2={aim.y}
          stroke="#7c3aed"
          strokeWidth={1}
        />
      )}
      {aim && (
        <g data-testid="perceived-aim" stroke="#7c3aed" strokeWidth={2}>
          <line x1={aim.x - 7} y1={aim.y} x2={aim.x + 7} y2={aim.y} />
          <line x1={aim.x} y1={aim.y - 7} x2={aim.x} y2={aim.y + 7} />
          <circle cx={aim.x} cy={aim.y} r={5} fill="none" />
        </g>
      )}
    </g>
  );
}

/** D-23: key badge (Q W E R T) next to each receiver; positions from the frame only. */
export function QbKeyBadges({ result, t, qbKeys }: OverlayProps): JSX.Element | null {
  const { viewport } = useFieldContext();
  if (!qbKeys || qbKeys.length === 0) return null;
  const frame = frameAt(result.frames, t);
  if (!frame) return null;
  return (
    <g data-testid="overlay-qbKeys" pointerEvents="none">
      {qbKeys.map((k) => {
        const pos = frame.players[k.id]?.pos;
        if (!pos) return null;
        const c = toScreen(pos, viewport);
        return (
          <g key={k.key} data-testid={`qb-key-${k.label}`}>
            <rect x={c.x + 8} y={c.y - 24} width={18} height={18} rx={3} fill="#111827" stroke="white" />
            <text
              x={c.x + 17}
              y={c.y - 15}
              textAnchor="middle"
              dominantBaseline="central"
              fontSize={12}
              fontWeight={700}
              fill="white"
            >
              {k.key}
            </text>
          </g>
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
      <QbEyesOverlay {...props} />
      <PerceptionOverlay {...props} />
      <QbKeyBadges {...props} />
    </>
  );
}
