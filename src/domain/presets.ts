/** Default stat presets Kém / TB / Hay (SRS §7.1). */
import type { Preset, Stats } from './types';

export const DEFAULT_PRESETS: Readonly<Record<Preset, Stats>> = {
  weak: {
    speed: 6,
    accel: 1.2,
    cutLoss: 0.5,
    reaction: 0.5,
    iq: 0.3,
    release: 0.6,
    accuracy: 0.6,
    armRange: 20,
    eyeDiscipline: 0.2,
    hands: 0.6,
    ballSkills: 0.2,
  },
  avg: {
    speed: 7,
    accel: 0.9,
    cutLoss: 0.35,
    reaction: 0.35,
    iq: 0.5,
    release: 0.45,
    accuracy: 0.75,
    armRange: 30,
    eyeDiscipline: 0.5,
    hands: 0.75,
    ballSkills: 0.35,
  },
  good: {
    speed: 8,
    accel: 0.6,
    cutLoss: 0.2,
    reaction: 0.2,
    iq: 0.8,
    release: 0.3,
    accuracy: 0.9,
    armRange: 40,
    eyeDiscipline: 0.85,
    hands: 0.9,
    ballSkills: 0.55,
  },
};

export const PRESET_IDS: readonly Preset[] = ['weak', 'avg', 'good'];
