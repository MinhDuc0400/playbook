/** Offense-only animation for "Chạy thử" (FR-OFF-06, D-13). Pure, deterministic. */
import { notImplemented } from '@/domain/notImplemented';
import type { BallSpot, FieldConfig, Frame, ID, Play, SimEvent, Stats, TuningParams } from '@/domain/types';

export interface PreviewInput {
  play: Play; // offense
  field: FieldConfig;
  ballSpot: BallSpot;
  tuning: TuningParams;
  /** By slot id; missing slots use DEFAULT_PRESETS.avg. */
  stats?: Record<ID, Stats>;
  /** Seconds after the snap to simulate (default 4). */
  duration?: number;
}

export interface PreviewResult {
  frames: Frame[]; // 30 fps, t from 0 to duration inclusive
  events: SimEvent[]; // 'snap' at 0, 'break' per sharp break reached (playerId)
  duration: number;
}

/**
 * Step at tuning.simDt with stepMovement + clampToSidelines; record a frame every 1/30 s.
 * QB (first QbDropAction): backpedals straight to y = start.y − depth at 0.7 × speed, then stands; ball held
 * by QB (ball.state 'held', pos = QB pos, carrierId). Receivers follow their first RouteAction via
 * followRoute (state 'route'); slots without a route stand ('idle'). Frame player state strings:
 * 'drop' | 'route' | 'idle'. Teammates pushed apart with separateTeammates.
 */
export function previewOffense(input: PreviewInput): PreviewResult {
  return notImplemented(`previewOffense ${input.play.id}`);
}
