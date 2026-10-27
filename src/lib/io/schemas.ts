/**
 * Zod schemas for import validation (FR-IO-02). Mirror src/domain/types.ts exactly.
 * Records with an older schemaVersion are migrated with migrateRecord (src/db/migrations.ts) BEFORE
 * these strict schemas run (see parseImport).
 */
import { z } from 'zod';
import type {
  Action,
  Athlete,
  ExportFile,
  FieldConfig,
  Install,
  Lineup,
  MatchRule,
  Matchup,
  Play,
  Point,
  ReceiverRef,
  Settings,
  Stats,
  TuningParams,
} from '@/domain/types';

const num = z.number();
const id = z.string().min(1);

export const PointSchema: z.ZodType<Point> = z.object({ x: num, y: num });

export const FormatSchema = z.enum(['5v5', '7v7', 'custom']);
const SideSchema = z.enum(['offense', 'defense']);
const PresetSchema = z.enum(['weak', 'avg', 'good']);
const RoleSchema = z.enum(['QB', 'C', 'WR', 'RB', 'TE', 'CB', 'S', 'LB', 'R']);
const StrengthSchema = z.enum(['left', 'right', 'balanced']);
const LeverageSchema = z.enum(['inside', 'outside', 'head-up']);

export const ReceiverRefSchema: z.ZodType<ReceiverRef> = z.union([
  z.object({
    kind: z.literal('number'),
    side: z.enum(['strong', 'weak']),
    number: z.union([z.literal(1), z.literal(2), z.literal(3)]),
  }),
  z.object({ kind: z.literal('role'), role: z.enum(['RB', 'QB', 'C']) }),
]);

const ZonePresetSchema = z.enum([
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
]);

export const ActionSchema: z.ZodType<Action> = z.discriminatedUnion('type', [
  z.object({ type: z.literal('motion'), path: z.array(PointSchema), duration: num }),
  z.object({
    type: z.literal('route'),
    path: z.array(PointSchema),
    smooth: z.array(z.boolean()).optional(),
    templateId: z.string().optional(),
    delay: num.optional(),
    endBehavior: z.enum(['stop', 'continue']),
  }),
  z.object({
    type: z.literal('option'),
    stem: z.array(PointSchema),
    vsMan: z.array(PointSchema),
    vsZone: z.array(PointSchema),
    decideAtStemEnd: z.literal(true),
  }),
  z.object({ type: z.literal('qbDrop'), depth: num, style: z.enum(['shotgun', 'under']) }),
  z.object({
    type: z.literal('man'),
    target: ReceiverRefSchema,
    technique: z.enum(['trail', 'cushion']),
    cushion: num.optional(),
  }),
  z.object({
    type: z.literal('zone'),
    zone: z.union([ZonePresetSchema, z.object({ polygon: z.array(PointSchema) })]),
    dropPoint: PointSchema,
  }),
  z.object({ type: z.literal('rush'), path: z.array(PointSchema), delay: num.optional() }),
  z.object({ type: z.literal('spy'), target: z.object({ kind: z.literal('role'), role: z.literal('QB') }) }),
]);

export const MatchRuleSchema: z.ZodType<MatchRule> = z.object({
  id,
  priority: num,
  when: z.object({
    receiver: ReceiverRefSchema,
    event: z.enum(['vertical', 'out', 'in', 'under', 'release', 'stop']),
    minDepth: num.optional(),
    beforeTime: num.optional(),
  }),
  then: z.union([
    z.object({ type: z.literal('man'), target: ReceiverRefSchema }),
    z.object({ type: z.literal('zone'), zone: ZonePresetSchema }),
    z.object({ type: z.literal('carry') }),
    z.object({ type: z.literal('passOff') }),
  ]),
});

const PlayerSlotSchema = z.object({
  id,
  role: RoleSchema,
  label: z.string(),
  start: PointSchema,
  leverage: LeverageSchema.optional(),
  actions: z.array(ActionSchema),
  matchRules: z.array(MatchRuleSchema).optional(),
});

const ReadPlanSchema = z.object({
  mode: z.enum(['progression', 'leftToRight', 'rightToLeft', 'strongToWeak', 'weakToStrong', 'best']),
  windows: z.record(z.object({ from: num, to: num })).optional(),
  minScore: z.record(num).optional(),
});

export const PlaySchema: z.ZodType<Play> = z.object({
  id,
  schemaVersion: num,
  name: z.string(),
  side: SideSchema,
  format: FormatSchema,
  formation: z.string(),
  strength: StrengthSchema,
  strengthOverridden: z.boolean().optional(),
  alignTo: z.enum(['ball', 'strength']).optional(),
  players: z.array(PlayerSlotSchema),
  progression: z.array(id).optional(),
  readPlan: ReadPlanSchema.optional(),
  tags: z.array(z.string()),
  notes: z.string().optional(),
  createdAt: num,
  updatedAt: num,
});

export const StatsSchema = z.object({
  speed: num,
  accel: num,
  cutLoss: num,
  reaction: num,
  iq: num,
  hands: num,
  ballSkills: num,
  release: num,
  accuracy: num,
  armRange: num,
  eyeDiscipline: num,
});

export const AthleteSchema: z.ZodType<Athlete> = z.object({
  id,
  schemaVersion: num,
  name: z.string(),
  preset: z.union([PresetSchema, z.literal('custom')]),
  stats: StatsSchema,
  positions: z.array(RoleSchema),
  notes: z.string().optional(),
  createdAt: num,
  updatedAt: num,
});

export const LineupSchema: z.ZodType<Lineup> = z.object({
  id,
  schemaVersion: num,
  name: z.string(),
  side: SideSchema,
  format: FormatSchema,
  slots: z.array(z.object({ label: z.string(), athleteId: id.optional(), preset: PresetSchema.optional() })),
  createdAt: num,
  updatedAt: num,
});

export const MatchupSchema: z.ZodType<Matchup> = z.object({
  id,
  schemaVersion: num,
  name: z.string().optional(),
  offensePlayId: id,
  offenseFlipped: z.boolean(),
  defensePlayId: id,
  defenseFlip: z.enum(['auto', 'none', 'flip']),
  offenseLineupId: id.optional(),
  defenseLineupId: id.optional(),
  overrides: z.array(
    z.object({
      side: SideSchema,
      label: z.string(),
      preset: PresetSchema.optional(),
      stats: StatsSchema.partial().optional(),
    }),
  ),
  anticipation: num,
  ballSpot: z.object({ x: num, yardLine: num }),
  seed: num,
  noise: z.boolean(),
  notes: z.string().optional(),
  createdAt: num,
  updatedAt: num,
});

export const InstallSchema: z.ZodType<Install> = z.object({
  id,
  schemaVersion: num,
  name: z.string(),
  description: z.string().optional(),
  items: z.array(z.object({ id, matchupId: id, order: num, coachNote: z.string().optional() })),
  createdAt: num,
  updatedAt: num,
});

const FieldConfigSchema: z.ZodType<FieldConfig> = z.object({
  format: FormatSchema,
  playersPerSide: num,
  width: num,
  length: num,
  endZoneDepth: num,
  lineToGain: z.array(num),
  noRunZones: z.array(z.object({ from: num, to: num })),
  rushLine: num,
  maxRushers: num,
  rusherGoesOnSnap: z.boolean(),
  qbCanCrossLOS: z.boolean(),
  centerEligible: z.boolean(),
  passClock: num,
  catchBeyondLOS: z.boolean(),
  contact: z.literal('none'),
});

const TuningSchema: z.ZodType<TuningParams> = z.object({
  simDt: num,
  maxTime: num,
  lookahead: num,
  tellWindow: num,
  leverageOffset: num,
  leverageReactionFactor: num,
  zoneBuffer: num,
  eyeDriftFactor: num,
  throwOpenThreshold: num,
  pressureRadius: num,
  sackRadius: num,
  ballSpeed: num,
  inaccuracyK: num,
  catchRadius: num,
  contestRadius: num,
  intShare: num,
  contestShareExponent: num,
  separationTight: num,
  separationOpen: num,
  wTag: num,
  wSim: num,
  wMis: num,
  suggestRuns: num,
  assumedDefenderSpeed: num,
  assumedDefenderReaction: num,
  readWindowLead: num,
  readWindowMin: num,
  scoreSepFull: num,
  scoreGainFull: num,
  wScoreSep: num,
  wScoreGain: num,
  wScoreRisk: num,
  laneRadius: num,
  scoreThrow: num,
});

export const SettingsSchema: z.ZodType<Settings> = z.object({
  key: z.literal('app'),
  schemaVersion: num,
  fields: z.object({ '5v5': FieldConfigSchema, '7v7': FieldConfigSchema, custom: FieldConfigSchema }),
  defaultFormat: FormatSchema,
  presets: z.object({ weak: StatsSchema, avg: StatsSchema, good: StatsSchema }),
  tuning: TuningSchema,
  routePriors: z.record(z.record(num)),
  ui: z.object({
    theme: z.enum(['light', 'dark', 'system']),
    snap: z.boolean(),
    showGrid: z.boolean(),
    advanced: z.boolean().optional(),
  }),
  lastExportAt: num.optional(),
});

export const ExportFileSchema: z.ZodType<ExportFile> = z.object({
  app: z.literal('flagbook'),
  schemaVersion: num,
  exportedAt: z.string(),
  data: z.object({
    plays: z.array(PlaySchema).optional(),
    athletes: z.array(AthleteSchema).optional(),
    lineups: z.array(LineupSchema).optional(),
    matchups: z.array(MatchupSchema).optional(),
    installs: z.array(InstallSchema).optional(),
    settings: SettingsSchema.optional(),
  }),
});

/** Compile-time check that StatsSchema matches Stats. */
export const _statsCheck: z.ZodType<Stats> = StatsSchema;
