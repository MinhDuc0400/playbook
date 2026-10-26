/**
 * Field for a matchup (FR-MU-05/06, FR-ATH-02): FieldStage + per-frame PlayerTokens (positions only from
 * frameAt(result.frames, t)), overlays (overlays.tsx), separation labels, click to select a player.
 */
import { FieldStage } from '@/components/field/FieldStage';
import { useFieldContext } from '@/components/field/FieldContext';
import { PlayerToken } from '@/components/field/PlayerToken';
import { toScreen, yardsToPx } from '@/components/field/viewport';
import type { BallSpot, FieldConfig, PlayerSlot, Point, Preset, Side, SimResult } from '@/domain/types';
import { frameAt } from '@/engine/frames';
import { useMatchupStore } from '@/store/matchupStore';
import type { BuiltSim } from './buildSimInput';
import { MatchupOverlays } from './overlays';
import type { QbKey } from './useQbMode';

export interface MatchupFieldProps {
  built: BuiltSim;
  result: SimResult;
  t: number;
  field: FieldConfig;
  ballSpot: BallSpot;
  /** Ring level per slot id (FR-ATH-02). */
  levels: Record<string, Preset | 'custom'>;
  /** Random defense (phase 6) hides zones/man lines. */
  hideDefenseOverlays?: boolean;
  theme?: 'normal' | 'contrast';
  /** D-23 QB mode: hide separation numbers until the throw. */
  hideReadInfo?: boolean;
  /** D-23 QB mode: key badges on receivers. */
  qbKeys?: readonly QbKey[];
  /** D-23 QB mode: clicking an offense receiver throws to it. */
  onQbPick?: (id: string) => void;
}

type FieldContentProps = Omit<MatchupFieldProps, 'field' | 'ballSpot' | 'theme'>;

function Ball({ pos }: { pos: Point }): JSX.Element {
  const { viewport } = useFieldContext();
  const c = toScreen(pos, viewport);
  return (
    <circle
      data-testid="ball"
      cx={c.x}
      cy={c.y}
      r={Math.max(3, yardsToPx(0.35, viewport))}
      className="fill-amber-700 stroke-white"
      strokeWidth={1}
      pointerEvents="none"
    />
  );
}

function MinimapDots({
  built,
  result,
  t,
}: Pick<MatchupFieldProps, 'built' | 'result' | 't'>): JSX.Element | null {
  const { viewport } = useFieldContext();
  const frame = frameAt(result.frames, t);
  if (!frame) return null;
  const dot = (slot: PlayerSlot, side: Side) => {
    const pos = frame.players[slot.id]?.pos;
    if (!pos) return null;
    const c = toScreen(pos, viewport);
    return (
      <circle
        key={`${side}-${slot.id}`}
        data-testid={`mm-${side}-${slot.id}`}
        cx={c.x}
        cy={c.y}
        r={2.5}
        className={side === 'offense' ? 'fill-blue-600' : 'fill-red-600'}
        pointerEvents="none"
      />
    );
  };
  const c = toScreen(frame.ball.pos, viewport);
  return (
    <>
      {built.defense.players.map((s) => dot(s, 'defense'))}
      {built.offense.players.map((s) => dot(s, 'offense'))}
      <circle
        data-testid="mm-ball"
        cx={c.x}
        cy={c.y}
        r={1.8}
        className="fill-amber-700"
        pointerEvents="none"
      />
    </>
  );
}

function FieldContent({
  built,
  result,
  t,
  levels,
  hideDefenseOverlays,
  hideReadInfo,
  qbKeys,
  onQbPick,
}: FieldContentProps): JSX.Element | null {
  const selected = useMatchupStore((s) => s.selected);
  const frame = frameAt(result.frames, t);
  if (!frame) return null;

  const token = (slot: PlayerSlot, side: Side): JSX.Element | null => {
    const pos = frame.players[slot.id]?.pos;
    if (!pos) return null;
    const isDefense = side === 'defense';
    return (
      <PlayerToken
        key={`${side}-${slot.id}`}
        id={slot.id}
        side={side}
        label={slot.label}
        pos={pos}
        level={levels[slot.id]}
        selected={selected?.side === side && selected.slotId === slot.id}
        rusher={isDefense && slot.actions.some((a) => a.type === 'rush')}
        leverage={isDefense ? slot.leverage : undefined}
        insideSign={slot.start.x > 0 ? -1 : 1}
        onPointerDown={(e) => {
          e.stopPropagation();
          if (side === 'offense' && onQbPick && qbKeys?.some((k) => k.id === slot.id)) onQbPick(slot.id);
          useMatchupStore.getState().select({ side, slotId: slot.id, label: slot.label });
        }}
      />
    );
  };

  const qb = built.offense.players.find((p) => p.role === 'QB');
  const ballPos =
    frame.ball.state === 'held' ? ((qb && frame.players[qb.id]?.pos) ?? frame.ball.pos) : frame.ball.pos;

  return (
    <>
      <MatchupOverlays
        built={built}
        result={result}
        t={t}
        hideDefenseOverlays={hideDefenseOverlays}
        hideReadInfo={hideReadInfo}
        qbKeys={qbKeys}
      />
      {built.defense.players.map((s) => token(s, 'defense'))}
      {built.offense.players.map((s) => token(s, 'offense'))}
      <Ball pos={ballPos} />
    </>
  );
}

export function MatchupField({ field, ballSpot, theme, ...rest }: MatchupFieldProps): JSX.Element {
  return (
    <div data-testid="matchup-field" className="h-full w-full">
      <FieldStage
        field={field}
        ballSpot={ballSpot}
        theme={theme}
        minimapContent={() => <MinimapDots built={rest.built} result={rest.result} t={rest.t} />}
      >
        <FieldContent {...rest} />
      </FieldStage>
    </div>
  );
}
