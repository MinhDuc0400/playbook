/** Formation presets and new-play creation (FR-ED-01, FR-ED-02 default labels, FR-DEF-01 ghost). Pure. */
import { alignedPlayers, computeStrength } from './numbering';
import { SCHEMA_VERSION } from './types';
import type { Action, Format, ID, Play, PlayerSlot, Point, Role, Side } from './types';

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

const pt = (x: number, y: number): Point => ({ x, y });

/** Offense core: QB at (0,-5), C on the ball at (0,-0.5), then the given players. */
function offense(
  id: string,
  name: string,
  format: Format,
  rest: readonly FormationPlayer[],
): FormationPreset {
  return {
    id,
    name,
    side: 'offense',
    format,
    players: [
      { role: 'QB', label: 'Q', start: pt(0, -5) },
      { role: 'C', label: 'C', start: pt(0, -0.5) },
      ...rest,
    ],
  };
}

/** Defense: the given cover players, then the rusher R1 at (0,7). */
function defense(
  id: string,
  name: string,
  format: Format,
  cover: readonly FormationPlayer[],
): FormationPreset {
  return {
    id,
    name,
    side: 'defense',
    format,
    players: [...cover, { role: 'R', label: 'R1', start: pt(0, 7) }],
  };
}

const wr = (label: string, x: number, y = -1): FormationPlayer => ({ role: 'WR', label, start: pt(x, y) });
const rb = (label: string, x: number, y: number): FormationPlayer => ({ role: 'RB', label, start: pt(x, y) });
const d = (role: Role, label: string, x: number, y: number): FormationPlayer => ({
  role,
  label,
  start: pt(x, y),
});

/**
 * Built-in presets. 5v5 offense (QB + C + 3 eligible): '2x1', 'Trips', 'Bunch', 'Stack', 'Spread RB'
 * (QB, C, 2 WR, backfield RB). 5v5 defense (4 cover + 1 rusher at y = 7): 'Cover 1', 'Cover 2', 'Cover 3'.
 * 7v7 offense (QB, C, 5 eligible): '3x2', 'Trips 7v7'; 7v7 defense: 'Cover 2 7v7', 'Cover 3 7v7'.
 * 'custom' format reuses the 5v5 presets. Offense starts y ≤ 0, defense y ≥ 0, rushers at y ≥ 7.
 */
export const FORMATIONS: readonly FormationPreset[] = [
  offense('5v5-off-2x1', '2x1', '5v5', [wr('X', -12), wr('Y', 7), wr('Z', 12)]),
  offense('5v5-off-trips', 'Trips', '5v5', [wr('Z', 12), wr('Y', 8), wr('H', 4.5)]),
  offense('5v5-off-bunch', 'Bunch', '5v5', [wr('Y', 6, -1), wr('Z', 7.5, -1), wr('H', 6.75, -2.5)]),
  offense('5v5-off-stack', 'Stack', '5v5', [wr('X', -10, -1), wr('Z', 10, -1), wr('Y', 10, -3)]),
  offense('5v5-off-spread-rb', 'Spread RB', '5v5', [wr('X', -12), wr('Z', 12), rb('B', -1.5, -5)]),
  defense('5v5-def-cover-1', 'Cover 1', '5v5', [
    d('CB', 'CB1', 11, 5),
    d('CB', 'CB2', -11, 5),
    d('LB', 'LB', 5, 4),
    d('S', 'FS', 0, 12),
  ]),
  defense('5v5-def-cover-2', 'Cover 2', '5v5', [
    d('CB', 'CB1', 12, 4),
    d('CB', 'CB2', -12, 4),
    d('S', 'S1', 7, 12),
    d('S', 'S2', -7, 12),
  ]),
  defense('5v5-def-cover-3', 'Cover 3', '5v5', [
    d('CB', 'CB1', 12, 6),
    d('CB', 'CB2', -12, 6),
    d('S', 'FS', 0, 11),
    d('LB', 'LB', -3, 5),
  ]),
  offense('7v7-off-3x2', '3x2', '7v7', [wr('X', -17), wr('H', -9), wr('Z', 17), wr('Y', 11), wr('F', 5)]),
  offense('7v7-off-trips', 'Trips 7v7', '7v7', [
    wr('X', -17),
    rb('B', -1.5, -5),
    wr('Z', 17),
    wr('Y', 12),
    wr('H', 7),
  ]),
  defense('7v7-def-cover-2', 'Cover 2 7v7', '7v7', [
    d('CB', 'CB1', 16, 4),
    d('CB', 'CB2', -16, 4),
    d('S', 'S1', 9, 12),
    d('S', 'S2', -9, 12),
    d('LB', 'LB', 4, 5),
    d('LB', 'LB2', -4, 5),
  ]),
  defense('7v7-def-cover-3', 'Cover 3 7v7', '7v7', [
    d('CB', 'CB1', 16, 6),
    d('CB', 'CB2', -16, 6),
    d('S', 'FS', 0, 12),
    d('LB', 'LB', 5, 5),
    d('LB', 'LB2', -5, 5),
    d('S', 'SS', 9, 8),
  ]),
];

/** Presets of a side for a format; 'custom' returns the 5v5 presets. */
export function formationsFor(side: Side, format: Format): FormationPreset[] {
  const f: Format = format === 'custom' ? '5v5' : format;
  return FORMATIONS.filter((p) => p.side === side && p.format === f);
}

export function getFormation(id: string): FormationPreset | undefined {
  return FORMATIONS.find((p) => p.id === id);
}

/**
 * Default ghost offense for the defense editor (FR-DEF-01): the 5v5/custom '2x1' preset, 7v7 '3x2'.
 */
export function defaultGhostFormation(format: Format): FormationPreset {
  const id = format === '7v7' ? '7v7-off-3x2' : '5v5-off-2x1';
  const preset = getFormation(id);
  if (!preset) throw new Error(`missing default ghost formation ${id}`);
  return preset;
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
  const taken = new Set(used);
  const free = LABEL_POOLS[role].find((l) => !taken.has(l));
  if (free !== undefined) return free;
  let n = 2;
  while (taken.has(`${role}${n}`)) n += 1;
  return `${role}${n}`;
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
  const { side, format, formationId, now, idGen } = opts;
  const preset = formationId === null ? undefined : getFormation(formationId);
  if (formationId !== null && (!preset || preset.side !== side)) {
    throw new Error(`unknown ${side} formation: ${formationId}`);
  }
  const id = idGen();
  const players: PlayerSlot[] = (preset?.players ?? []).map((fp) => {
    const actions: Action[] = [];
    if (side === 'offense' && fp.role === 'QB') actions.push({ type: 'qbDrop', depth: 2, style: 'shotgun' });
    if (side === 'defense' && fp.role === 'R') actions.push({ type: 'rush', path: [pt(0, -5)], delay: 0 });
    return { id: idGen(), role: fp.role, label: fp.label, start: { ...fp.start }, actions };
  });
  const play: Play = {
    id,
    schemaVersion: SCHEMA_VERSION,
    name: '',
    side,
    format,
    formation: preset?.name ?? '',
    strength: 'right',
    players,
    tags: [],
    createdAt: now,
    updatedAt: now,
  };
  if (side === 'offense') {
    play.strength = computeStrength(alignedPlayers(play));
    if (preset) play.progression = [];
  } else {
    play.alignTo = 'ball';
  }
  return play;
}
