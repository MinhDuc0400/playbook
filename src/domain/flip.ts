/** Left/right flip of a play (SRS §6.4, FR-FLP-01). Pure. */
import { mirrorX } from './geometry';
import type { Action, MatchRule, PlayerSlot, Play, Point, Strength, ZonePresetId } from './types';

const mirrorPoints = (pts: Point[]): Point[] => pts.map(mirrorX);

/**
 * Mirror a play across x = 0:
 * - `start`, every `path`, `polygon`, `dropPoint`, `stem`, `vsMan`, `vsZone`: x → −x (never produce −0)
 * - `strength`: left ↔ right, balanced unchanged
 * - zone presets: `-L` ↔ `-R`, `-M` (and 'deep-middle') unchanged
 * - `leverage`, `ReceiverRef`, `label`, `templateId`, matchRules, ids, timestamps, everything else: unchanged
 * Returns a new object; the input is not mutated. flipPlay(flipPlay(p)) deep-equals p.
 */
export function flipPlay(play: Play): Play {
  return {
    ...play,
    strength: flipStrength(play.strength),
    players: play.players.map(flipSlot),
  };
}

function flipSlot(slot: PlayerSlot): PlayerSlot {
  const out: PlayerSlot = {
    ...slot,
    start: mirrorX(slot.start),
    actions: slot.actions.map(flipAction),
  };
  if (slot.matchRules) out.matchRules = slot.matchRules.map(flipMatchRule);
  return out;
}

function flipMatchRule(rule: MatchRule): MatchRule {
  if (rule.then.type !== 'zone') return { ...rule };
  return { ...rule, then: { ...rule.then, zone: flipZonePreset(rule.then.zone) } };
}

export function flipAction(a: Action): Action {
  switch (a.type) {
    case 'motion':
    case 'route':
    case 'rush':
      return { ...a, path: mirrorPoints(a.path) };
    case 'option':
      return {
        ...a,
        stem: mirrorPoints(a.stem),
        vsMan: mirrorPoints(a.vsMan),
        vsZone: mirrorPoints(a.vsZone),
      };
    case 'zone':
      return {
        ...a,
        zone:
          typeof a.zone === 'string'
            ? flipZonePreset(a.zone)
            : { ...a.zone, polygon: mirrorPoints(a.zone.polygon) },
        dropPoint: mirrorX(a.dropPoint),
      };
    case 'qbDrop':
    case 'man':
    case 'spy':
      return { ...a };
  }
}

export function flipZonePreset(id: ZonePresetId): ZonePresetId {
  switch (id) {
    case 'deep-half-L':
      return 'deep-half-R';
    case 'deep-half-R':
      return 'deep-half-L';
    case 'deep-third-L':
      return 'deep-third-R';
    case 'deep-third-R':
      return 'deep-third-L';
    case 'flat-L':
      return 'flat-R';
    case 'flat-R':
      return 'flat-L';
    case 'hook-L':
      return 'hook-R';
    case 'hook-R':
      return 'hook-L';
    case 'curl-flat-L':
      return 'curl-flat-R';
    case 'curl-flat-R':
      return 'curl-flat-L';
    case 'deep-third-M':
    case 'hook-M':
    case 'deep-middle':
      return id;
  }
}

export function flipStrength(s: Strength): Strength {
  if (s === 'left') return 'right';
  if (s === 'right') return 'left';
  return s;
}
