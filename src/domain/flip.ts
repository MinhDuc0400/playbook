/** Left/right flip of a play (SRS §6.4, FR-FLP-01). Pure. */
import { notImplemented } from './notImplemented';
import type { Action, Play, Strength, ZonePresetId } from './types';

/**
 * Mirror a play across x = 0:
 * - `start`, every `path`, `polygon`, `dropPoint`, `stem`, `vsMan`, `vsZone`: x → −x (never produce −0)
 * - `strength`: left ↔ right, balanced unchanged
 * - zone presets: `-L` ↔ `-R`, `-M` (and 'deep-middle') unchanged
 * - `leverage`, `ReceiverRef`, `label`, `templateId`, matchRules, ids, timestamps, everything else: unchanged
 * Returns a new object; the input is not mutated. flipPlay(flipPlay(p)) deep-equals p.
 */
export function flipPlay(play: Play): Play {
  return notImplemented(`flipPlay ${play.id}`);
}

export function flipAction(a: Action): Action {
  return notImplemented(`flipAction ${a.type}`);
}

export function flipZonePreset(id: ZonePresetId): ZonePresetId {
  return notImplemented(`flipZonePreset ${id}`);
}

export function flipStrength(s: Strength): Strength {
  return notImplemented(`flipStrength ${s}`);
}
