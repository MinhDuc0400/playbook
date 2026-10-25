/** Formation presets and new-play creation (FR-ED-01, FR-ED-02 default labels, FR-DEF-01 ghost). Pure. */
import { notImplemented } from './notImplemented';
import type { Format, ID, Play, Point, Role, Side } from './types';

export interface FormationPlayer {
  role: Role;
  label: string;
  start: Point;
}

export interface FormationPreset {
  id: string; // e.g. '5v5-off-trips'
  name: string; // formation name stored in Play.formation, e.g. 'Trips' (football term, English)
  side: Side;
  format: Format;
  players: FormationPlayer[];
}

/**
 * Built-in presets. 5v5 offense (QB + C + 3 eligible): '2x1', 'Trips', 'Bunch', 'Stack', 'Spread RB'
 * (QB, C, 2 WR, backfield RB). 5v5 defense (4 cover + 1 rusher at y = 7): 'Cover 1', 'Cover 2', 'Cover 3'.
 * 7v7 offense (QB, C, 5 eligible): '3x2', 'Trips 7v7'; 7v7 defense: 'Cover 2 7v7', 'Cover 3 7v7'.
 * 'custom' format reuses the 5v5 presets. Offense starts y ≤ 0, defense y ≥ 0, rushers at y ≥ 7.
 */
export const FORMATIONS: readonly FormationPreset[] = [];

export function formationsFor(side: Side, format: Format): FormationPreset[] {
  return notImplemented(`formationsFor ${side}${format}`);
}

export function getFormation(id: string): FormationPreset | undefined {
  return notImplemented(`getFormation ${id}`);
}

/**
 * Default ghost offense for the defense editor (FR-DEF-01): the 5v5/custom '2x1' preset, 7v7 '3x2'.
 */
export function defaultGhostFormation(format: Format): FormationPreset {
  return notImplemented(`defaultGhostFormation ${format}`);
}

/** Label pools per role, in assignment order (FR-ED-02). */
export const LABEL_POOLS: Readonly<Record<Role, readonly string[]>> = {
  QB: ['Q'],
  C: ['C'],
  WR: ['X', 'Z', 'Y', 'H', 'F', 'W'],
  RB: ['B', 'R'],
  TE: ['T', 'U'],
  CB: ['CB1', 'CB2', 'CB3', 'CB4'],
  S: ['FS', 'SS', 'S3'],
  LB: ['LB', 'LB2', 'LB3'],
  R: ['R1', 'R2'],
};

/** First label of the role's pool not used in `used`; when exhausted `${role}${n}` with the smallest free n ≥ 2. */
export function nextDefaultLabel(role: Role, used: readonly string[]): string {
  return notImplemented(`nextDefaultLabel ${role}${used.length}`);
}

/**
 * New play (FR-ED-01): blank (formationId null → no players) or from a preset (players copied, ids from
 * idGen, actions empty except offense QB gets qbDrop {depth 2, style 'shotgun'} and defense 'R' gets a
 * rush {path [{x:0,y:-5}], delay 0}). name '' , formation = preset name or '', strength computed for
 * offense (computeStrength) / 'right' for defense, alignTo 'ball' for defense, tags [], schemaVersion,
 * createdAt = updatedAt = now.
 */
export function createPlay(opts: {
  side: Side;
  format: Format;
  formationId: string | null;
  now: number;
  idGen: () => ID;
}): Play {
  return notImplemented(`createPlay ${String(opts)}`);
}
