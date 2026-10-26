/**
 * Flagbook domain types (SRS §4.2, §5, §8.1, §11).
 * All coordinates are yards: x right, y downfield, origin = ball on the LOS (NFR-ARC-05).
 * Time is seconds, t = 0 is the snap, motion has t < 0.
 * Lead-owned contract file (D-05). Do not change without a DECISIONS.md entry.
 */

// ---------- §5.1 basic types ----------

export type ID = string; // nanoid
export type Point = { x: number; y: number }; // yard
export type Side = 'offense' | 'defense';
export type Format = '5v5' | '7v7' | 'custom';
export type Preset = 'weak' | 'avg' | 'good'; // Kém / TB / Hay
export type OffenseRole = 'QB' | 'C' | 'WR' | 'RB' | 'TE';
export type DefenseRole = 'CB' | 'S' | 'LB' | 'R'; // R = rusher
export type Role = OffenseRole | DefenseRole;
export type LateralSide = 'left' | 'right';
export type Strength = 'left' | 'right' | 'balanced';
export type Leverage = 'inside' | 'outside' | 'head-up';

/** Receiver reference by number, never by left/right position (§5.1). */
export type ReceiverRef =
  { kind: 'number'; side: 'strong' | 'weak'; number: 1 | 2 | 3 } | { kind: 'role'; role: 'RB' | 'QB' | 'C' };

/** Record schema version written on every record (FR-DAT-01, D-07). */
export const SCHEMA_VERSION = 1;

// ---------- §4.2 field ----------

export interface FieldConfig {
  format: Format;
  playersPerSide: number;
  width: number; // yd
  length: number; // yd between the goal lines, end zones excluded
  endZoneDepth: number; // yd
  lineToGain: number[]; // yd from own goal line, e.g. [25] = midfield
  noRunZones: { from: number; to: number }[]; // yard-line ranges (from own goal line), pass only
  rushLine: number; // yd from LOS, rushers start at or beyond this
  maxRushers: number;
  rusherGoesOnSnap: boolean;
  qbCanCrossLOS: boolean;
  centerEligible: boolean;
  passClock: number; // s from snap until the ball must be out
  catchBeyondLOS: boolean;
  contact: 'none';
}

/** Ball placement of a matchup. x = offset from field centre (hash), yardLine = yd from own goal line. */
export interface BallSpot {
  x: number;
  yardLine: number;
}

// ---------- §5.2 play ----------

export interface Play {
  id: ID;
  schemaVersion: number;
  name: string;
  side: Side;
  format: Format;
  formation: string; // "Trips", "Cover 3" (no Left/Right)
  strength: Strength; // offense: computed, may be overridden; defense: ghost strength at design time
  /** Offense: true when the user overrode the computed strength (FR-OFF-05, D-17). */
  strengthOverridden?: boolean;
  alignTo?: 'ball' | 'strength'; // defense only
  players: PlayerSlot[];
  progression?: ID[]; // offense: QB read order (slot ids)
  /** Offense: how the QB reads (D-22). Missing = { mode: 'progression' } with auto windows. */
  readPlan?: ReadPlan;
  tags: string[];
  notes?: string;
  createdAt: number;
  updatedAt: number;
}

export interface PlayerSlot {
  id: ID; // unique within the play
  role: Role;
  label: string; // "X", "Z", "Y", "H", "C", "Q", "CB1", "FS"… matches Lineup slots
  start: Point;
  leverage?: Leverage; // defense
  actions: Action[]; // in time order
  matchRules?: MatchRule[]; // defense
}

/** D-22: QB read customisation. */
export type ReadMode =
  'progression' | 'leftToRight' | 'rightToLeft' | 'strongToWeak' | 'weakToStrong' | 'best';

export interface ReadWindowSpec {
  from: number; // s after the snap
  to: number;
}

export interface ReadPlan {
  mode: ReadMode;
  /** Manual read window per receiver slot id; missing = auto (from the route's first break). */
  windows?: Record<ID, ReadWindowSpec>;
  /** Minimum read score (0..100) to throw on that receiver; missing = tuning.scoreThrow. */
  minScore?: Record<ID, number>;
}

// ---------- §5.3 actions ----------

export type Action =
  | MotionAction
  | RouteAction
  | OptionRouteAction
  | QbDropAction // offense
  | ManAction
  | ZoneAction
  | RushAction
  | SpyAction; // defense

/** Pre-snap motion. `path` excludes the start point (D-08). */
export interface MotionAction {
  type: 'motion';
  path: Point[];
  duration: number; // s
}

/** Route. `path` = absolute break points after the current position, start excluded (D-08). */
export interface RouteAction {
  type: 'route';
  path: Point[];
  smooth?: boolean[]; // per break point: false = sharp cut, true = rounded
  templateId?: string; // "slant", "out"… when created from the route tree
  delay?: number; // s after the snap
  endBehavior: 'stop' | 'continue'; // end of path: stop (hitch, curl) or keep running the last heading
}

/** Option route: shared stem, then a branch chosen vs man / vs zone at the stem end. */
export interface OptionRouteAction {
  type: 'option';
  stem: Point[];
  vsMan: Point[];
  vsZone: Point[];
  decideAtStemEnd: true;
}

export interface QbDropAction {
  type: 'qbDrop';
  depth: number; // yd
  style: 'shotgun' | 'under';
}

export interface ManAction {
  type: 'man';
  target: ReceiverRef;
  technique: 'trail' | 'cushion';
  cushion?: number; // yd
}

export interface ZoneAction {
  type: 'zone';
  zone: ZonePresetId | { polygon: Point[] }; // ball-relative
  dropPoint: Point;
}

export type ZonePresetId =
  | 'deep-half-L'
  | 'deep-half-R'
  | 'deep-third-L'
  | 'deep-third-M'
  | 'deep-third-R'
  | 'deep-middle'
  | 'flat-L'
  | 'flat-R'
  | 'hook-L'
  | 'hook-R'
  | 'hook-M'
  | 'curl-flat-L'
  | 'curl-flat-R';

export const ZONE_PRESET_IDS: readonly ZonePresetId[] = [
  'deep-half-L',
  'deep-half-R',
  'deep-third-L',
  'deep-third-M',
  'deep-third-R',
  'deep-middle',
  'flat-L',
  'flat-R',
  'hook-L',
  'hook-R',
  'hook-M',
  'curl-flat-L',
  'curl-flat-R',
];

/** NFL FLAG: delay must be 0. */
export interface RushAction {
  type: 'rush';
  path: Point[];
  delay?: number;
}

export interface SpyAction {
  type: 'spy';
  target: { kind: 'role'; role: 'QB' };
}

// ---------- §5.4 pattern match rules ----------

export type MatchEvent = 'vertical' | 'out' | 'in' | 'under' | 'release' | 'stop';

export interface MatchRule {
  id: ID;
  priority: number; // lower runs first
  when: {
    receiver: ReceiverRef;
    event: MatchEvent;
    minDepth?: number; // yd from LOS
    beforeTime?: number; // s
  };
  then:
    | { type: 'man'; target: ReceiverRef }
    | { type: 'zone'; zone: ZonePresetId }
    | { type: 'carry' }
    | { type: 'passOff' };
}

// ---------- §5.5 athletes, lineups ----------

export interface Stats {
  speed: number; // yd/s max
  accel: number; // s from 0 to max speed
  cutLoss: number; // 0..1, fraction of speed lost on a 180° cut
  reaction: number; // s perception delay
  iq: number; // 0..1
  hands: number; // 0..1
  ballSkills: number; // 0..1
  release: number; // QB: s from decision to ball out
  accuracy: number; // QB: 0..1
  armRange: number; // QB: yd max throw
  eyeDiscipline: number; // QB: 0..1, 0 = stares the target down
}

export const STAT_KEYS: readonly (keyof Stats)[] = [
  'speed',
  'accel',
  'cutLoss',
  'reaction',
  'iq',
  'hands',
  'ballSkills',
  'release',
  'accuracy',
  'armRange',
  'eyeDiscipline',
];

export interface Athlete {
  id: ID;
  schemaVersion: number;
  name: string;
  preset: Preset | 'custom';
  stats: Stats;
  positions: Role[];
  notes?: string;
  createdAt: number;
  updatedAt: number;
}

export interface LineupSlot {
  label: string;
  athleteId?: ID;
  preset?: Preset;
}

export interface Lineup {
  id: ID;
  schemaVersion: number;
  name: string;
  side: Side;
  format: Format;
  slots: LineupSlot[]; // matched by PlayerSlot.label
  createdAt: number;
  updatedAt: number;
}

// ---------- §5.6 matchup, install, settings ----------

export interface StatOverride {
  side: Side;
  label: string;
  preset?: Preset;
  stats?: Partial<Stats>;
}

export interface Matchup {
  id: ID;
  schemaVersion: number;
  name?: string;
  offensePlayId: ID;
  offenseFlipped: boolean;
  defensePlayId: ID;
  defenseFlip: 'auto' | 'none' | 'flip';
  offenseLineupId?: ID;
  defenseLineupId?: ID;
  overrides: StatOverride[];
  anticipation: number; // 0..1, default 0.5
  ballSpot: BallSpot;
  seed: number;
  noise: boolean; // ±10 % stat jitter
  notes?: string;
  createdAt: number;
  updatedAt: number;
}

export interface InstallItem {
  id: ID;
  matchupId: ID;
  order: number;
  coachNote?: string;
}

export interface Install {
  id: ID;
  schemaVersion: number;
  name: string;
  description?: string;
  items: InstallItem[];
  createdAt: number;
  updatedAt: number;
}

export type ThemePref = 'light' | 'dark' | 'system';

export interface Settings {
  key: 'app';
  schemaVersion: number;
  fields: Record<Format, FieldConfig>;
  defaultFormat: Format;
  presets: Record<Preset, Stats>;
  tuning: TuningParams;
  routePriors: RoutePriorTable;
  ui: { theme: ThemePref; snap: boolean; showGrid: boolean };
  lastExportAt?: number; // ms epoch, FR-IO-05
}

// ---------- §11.2 tuning ----------

export interface TuningParams {
  simDt: number; // s, 1/60
  maxTime: number; // s, 9
  lookahead: number; // s, 0.3
  tellWindow: number; // s, 0.25
  leverageOffset: number; // yd, 1
  leverageReactionFactor: number; // 0.3
  zoneBuffer: number; // yd, 2
  eyeDriftFactor: number; // 0.3
  throwOpenThreshold: number; // yd, 1.5
  pressureRadius: number; // yd, 2
  sackRadius: number; // yd, 1
  ballSpeed: number; // yd/s, 18
  inaccuracyK: number; // 0.05
  catchRadius: number; // yd, 1
  contestRadius: number; // yd, 1
  intShare: number; // 0.4
  contestShareExponent: number; // 1
  separationTight: number; // yd, 1
  separationOpen: number; // yd, 2.5
  wTag: number; // 0.2
  wSim: number; // 0.7
  wMis: number; // 0.1
  suggestRuns: number; // 30
  // D-22 QB read model
  assumedDefenderSpeed: number; // yd/s the QB assumes a defender closes on the ball after reacting, 7
  assumedDefenderReaction: number; // s before a defender breaks on the throw (QB's assumption), 0.3
  readWindowLead: number; // s an auto read window opens before the receiver's first break, 0.3
  readWindowMin: number; // s minimum auto read window length, 0.45
  scoreSepFull: number; // yd of predicted separation worth full openness, 4
  scoreGainFull: number; // yd of catch depth worth full gain, 15
  wScoreSep: number; // 0.6
  wScoreGain: number; // 0.25
  wScoreRisk: number; // 0.15
  laneRadius: number; // yd around the ball path counted as INT risk, 1.5
  scoreThrow: number; // default minimum read score (0..100) to throw, 55
}

/** §8.7: alignment key (e.g. 'n1-wide', 'n1-tight', 'n2-slot') → templateId → prior probability. */
export type RoutePriorTable = Record<string, Record<string, number>>;

// ---------- §8.1 simulation API ----------

/** Seeded RNG: returns a float in [0, 1). */
export type Rng = () => number;

export interface SimInput {
  offense: Play; // flips already applied
  defense: Play;
  offenseStats: Record<ID, Stats>; // by slot id, before noise
  defenseStats: Record<ID, Stats>;
  field: FieldConfig;
  ballSpot: BallSpot;
  anticipation: number;
  seed: number;
  noise: boolean;
  tuning: TuningParams;
  routePriors: RoutePriorTable;
}

export interface BallState {
  state: 'held' | 'inAir' | 'dead';
  pos: Point;
  carrierId?: ID; // held: who has it
  from?: Point; // inAir: release point
  landing?: Point; // inAir: aimed landing point (after error)
  tThrow?: number; // s, ball left the hand
  tLand?: number; // s, expected arrival
  targetId?: ID; // inAir: intended receiver
}

export interface FramePlayer {
  pos: Point;
  vel: Point;
  state: string; // 'route' | 'drop' | 'man' | 'zone' | 'rush' | 'ball' | 'idle' | …
}

export interface Frame {
  t: number;
  players: Record<ID, FramePlayer>;
  ball: BallState;
  /** QB eye target at this frame (FR-MU-12 overlay). */
  eyeTarget?: ID;
  /** QB read state at this frame (D-22): receiver being read and every receiver's read score 0..100. */
  qb?: { readId?: ID; scores: Record<ID, number> };
}

/** Per-frame debug view of one defender (FR-MU-11): what it "sees" (delayed) and where it aims. */
export interface DefenderDebug {
  /** Perceived positions of offense players at this frame (delayed by reaction). */
  seen: Record<ID, Point>;
  /** Current aim point, when the agent has one. */
  aim?: Point;
  /** Current man target (after match-rule switches), if any. */
  targetId?: ID;
}

/** Optional debug data, aligned with `frames` (same index). */
export interface SimDebug {
  defenders: Record<ID, DefenderDebug>[];
}

export type SimEventType =
  | 'motion'
  | 'snap'
  | 'break'
  | 'read'
  | 'pressure'
  | 'ruleFired'
  | 'optionChoice'
  | 'throwStart'
  | 'throw'
  | 'catch'
  | 'drop'
  | 'deflect'
  | 'int'
  | 'incomplete'
  | 'sack'
  | 'throwaway'
  | 'timeout';

export interface SimEvent {
  t: number;
  type: SimEventType;
  playerId?: ID;
  targetId?: ID;
  data?: Record<string, number | string | boolean>;
}

export type Outcome =
  | { kind: 'complete'; targetId: ID; yards: number; t: number }
  | { kind: 'incomplete' | 'deflected' | 'intercepted'; targetId: ID; t: number }
  | { kind: 'sack' | 'throwaway' | 'timeout'; t: number };

export type OutcomeKind = Outcome['kind'];

export interface SimMetrics {
  separation: Record<ID, { t: number; d: number }[]>; // per receiver over time (frame rate)
  separationAtThrow?: Record<ID, number>;
  timeToThrow?: number;
  openWindows: Record<ID, [number, number][]>; // intervals with separation ≥ separationOpen
  /** D-22: the QB's read windows and how the decision was made. */
  reads?: ReadMetrics;
}

export interface ReadWindow {
  id: ID; // receiver slot id
  index: number; // 0 = first read
  from: number;
  to: number;
  auto: boolean;
}

export interface ReadMetrics {
  mode: ReadMode;
  windows: ReadWindow[];
  decision: {
    kind: 'read' | 'checkdown' | 'forced' | 'throwaway' | 'none';
    t: number;
    targetId?: ID;
    score?: number;
    /** Index in `windows` for kind 'read', else null. */
    readIndex: number | null;
  };
}

export interface SimResult {
  frames: Frame[]; // 30 fps
  events: SimEvent[];
  outcome: Outcome;
  metrics: SimMetrics;
  warnings: string[];
  /** Present only when simulate() was called with { debug: true }. */
  debug?: SimDebug;
}

export interface AggregateResult {
  runs: number;
  outcomes: Record<OutcomeKind, number>; // counts
  pComplete: number;
  pSack: number;
  pInt: number;
  avgYards: number; // per attempt, non-completions count 0
  avgYardsPerCompletion: number;
  avgTimeToThrow: number | null;
  /** fraction of runs in which each receiver was targeted */
  targetDistribution: Record<ID, number>;
  perTarget: Record<ID, { throws: number; completes: number; avgSepAtThrow: number }>;
  avgSeparationAtThrow: Record<ID, number>;
  /** D-22: fraction of runs per decision: '1', '2', … (read index + 1), 'checkdown', 'forced', 'throwaway', 'none'. */
  readDistribution?: Record<string, number>;
}

// ---------- §7.2 stats resolution context ----------

export interface DbSnapshot {
  settings: Settings;
  lineups: Record<ID, Lineup>;
  athletes: Record<ID, Athlete>;
}

// ---------- §11.1 export file ----------

export interface ExportFile {
  app: 'flagbook';
  schemaVersion: number;
  exportedAt: string; // ISO
  data: {
    plays?: Play[];
    athletes?: Athlete[];
    lineups?: Lineup[];
    matchups?: Matchup[];
    installs?: Install[];
    settings?: Settings;
  };
}
