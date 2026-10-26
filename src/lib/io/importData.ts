/** Import (FR-IO-02, FR-IO-03). */
import type { Table } from 'dexie';
import { nanoid } from 'nanoid';
import { migrateRecord, type TableName } from '@/db/migrations';
import { withDbErrors } from '@/db/errors';
import { getDb } from '@/db/schema';
import { normalizeSettings } from '@/domain/defaults';
import { SCHEMA_VERSION, type ExportFile, type ID, type Settings } from '@/domain/types';
import { ExportFileSchema } from './schemas';

export type ImportMode = 'merge' | 'replace';
/** merge: same id → keep newer updatedAt ('newer') or import as a copy with a new id ('copy'). */
export type MergeStrategy = 'newer' | 'copy';

export interface TableReport {
  added: number;
  updated: number;
  skipped: number;
}
export interface ImportReport {
  plays: TableReport;
  athletes: TableReport;
  lineups: TableReport;
  matchups: TableReport;
  installs: TableReport;
  settings: TableReport;
}

export type ParseResult = { ok: true; file: ExportFile } | { ok: false; errors: string[] };

const MAX_ERRORS = 20;
const RECORD_TABLES = ['plays', 'athletes', 'lineups', 'matchups', 'installs'] as const;
type RecordTable = (typeof RECORD_TABLES)[number];

function isObject(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

function errMessage(e: unknown): string {
  return e instanceof Error ? e.message : String(e);
}

/** JSON.parse + migrate (migrateRecord) + zod validation. Never throws. */
export function parseImport(text: string): ParseResult {
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch (e) {
    return { ok: false, errors: [`JSON: ${errMessage(e)}`] };
  }
  if (!isObject(raw)) return { ok: false, errors: ['File: not a JSON object'] };
  if (raw.app !== 'flagbook') return { ok: false, errors: ['app: expected "flagbook"'] };
  const fileVersion = raw.schemaVersion;
  if (typeof fileVersion !== 'number' || !Number.isInteger(fileVersion) || fileVersion < 0) {
    return { ok: false, errors: ['schemaVersion: expected a non-negative integer'] };
  }
  if (fileVersion > SCHEMA_VERSION) {
    return {
      ok: false,
      errors: [`schemaVersion ${fileVersion}: file from a newer app version (current ${SCHEMA_VERSION})`],
    };
  }
  if (!isObject(raw.data)) return { ok: false, errors: ['data: expected an object'] };

  const errors: string[] = [];
  const data: Record<string, unknown> = {};
  const migrate = (table: TableName, rec: unknown, path: string): unknown => {
    const own = isObject(rec) && typeof rec.schemaVersion === 'number' ? rec.schemaVersion : fileVersion;
    try {
      return migrateRecord(table, rec, own);
    } catch (e) {
      errors.push(`${path}: ${errMessage(e)}`);
      return rec;
    }
  };
  for (const table of RECORD_TABLES) {
    const list = raw.data[table];
    if (list === undefined) continue;
    if (!Array.isArray(list)) {
      errors.push(`data.${table}: expected an array`);
      continue;
    }
    data[table] = list.map((rec, i) => migrate(table, rec, `data.${table}[${i}]`));
  }
  if (raw.data.settings !== undefined) {
    const migrated = migrate('settings', raw.data.settings, 'data.settings');
    // Files from older app versions lack newer tuning/preset keys: fill them with defaults (D-22).
    data.settings = isObject(migrated) ? normalizeSettings(migrated as unknown as Settings) : migrated;
  }
  if (errors.length > 0) return { ok: false, errors: errors.slice(0, MAX_ERRORS) };

  const parsed = ExportFileSchema.safeParse({
    app: raw.app,
    schemaVersion: SCHEMA_VERSION,
    exportedAt: raw.exportedAt,
    data,
  });
  if (!parsed.success) {
    const msgs = parsed.error.issues.map((issue) => {
      const path = issue.path
        .map((p, i) => (typeof p === 'number' ? `[${p}]` : i === 0 ? p : `.${p}`))
        .join('');
      return `${path || 'file'}: ${issue.message}`;
    });
    return { ok: false, errors: msgs.slice(0, MAX_ERRORS) };
  }
  return { ok: true, file: parsed.data };
}

const emptyReport = (): TableReport => ({ added: 0, updated: 0, skipped: 0 });

interface Rec {
  id: ID;
  updatedAt: number;
}

/** Merge one table by the 'newer' rule. */
async function mergeNewer<T extends Rec>(table: Table<T, ID>, incoming: T[]): Promise<TableReport> {
  const report = emptyReport();
  const existing = await table.bulkGet(incoming.map((r) => r.id));
  const toAdd: T[] = [];
  const toPut: T[] = [];
  incoming.forEach((rec, i) => {
    const stored = existing[i];
    if (!stored) toAdd.push(rec);
    else if (rec.updatedAt > stored.updatedAt) toPut.push(rec);
    else report.skipped++;
  });
  if (toAdd.length) await table.bulkAdd(toAdd);
  if (toPut.length) await table.bulkPut(toPut);
  report.added = toAdd.length;
  report.updated = toPut.length;
  return report;
}

async function remapIds(table: Table<Rec, ID>, incoming: Rec[]): Promise<Map<ID, ID>> {
  const existing = await table.bulkGet(incoming.map((r) => r.id));
  const map = new Map<ID, ID>();
  incoming.forEach((rec, i) => {
    if (existing[i]) map.set(rec.id, nanoid());
  });
  return map;
}

/**
 * Write a parsed file in ONE rw transaction over all tables (nothing written on failure).
 * replace: clear every table first, then add all. merge: per record by id (see MergeStrategy); copies get
 * new ids and references (matchup play ids, install matchup ids) are remapped within the file.
 */
export async function importData(
  file: ExportFile,
  mode: ImportMode,
  strategy: MergeStrategy = 'newer',
): Promise<ImportReport> {
  return withDbErrors(async () => {
    const db = getDb();
    const d = file.data;
    const report: ImportReport = {
      plays: emptyReport(),
      athletes: emptyReport(),
      lineups: emptyReport(),
      matchups: emptyReport(),
      installs: emptyReport(),
      settings: emptyReport(),
    };
    const tables = [db.plays, db.athletes, db.lineups, db.matchups, db.installs, db.settings];

    await db.transaction('rw', tables, async () => {
      const tbl: Record<RecordTable, Table<Rec, ID>> = {
        plays: db.plays as unknown as Table<Rec, ID>,
        athletes: db.athletes as unknown as Table<Rec, ID>,
        lineups: db.lineups as unknown as Table<Rec, ID>,
        matchups: db.matchups as unknown as Table<Rec, ID>,
        installs: db.installs as unknown as Table<Rec, ID>,
      };

      if (mode === 'replace') {
        for (const name of RECORD_TABLES) {
          await tbl[name].clear();
          const recs = (d[name] ?? []) as Rec[];
          if (recs.length) await tbl[name].bulkAdd(recs);
          report[name].added = recs.length;
        }
      } else if (strategy === 'newer') {
        for (const name of RECORD_TABLES) {
          report[name] = await mergeNewer(tbl[name], (d[name] ?? []) as Rec[]);
        }
      } else {
        await mergeCopy(tbl, file, report);
      }

      if (d.settings) {
        const stored = await db.settings.get('app');
        if (!stored) report.settings.added = 1;
        else if (JSON.stringify(stored) !== JSON.stringify(d.settings)) report.settings.updated = 1;
        else report.settings.skipped = 1;
        if (report.settings.added || report.settings.updated) await db.settings.put(d.settings);
      }
    });
    return report;
  });
}

/** Merge with strategy 'copy': conflicting ids get fresh ids; references inside the file are remapped. */
async function mergeCopy(
  tbl: Record<RecordTable, Table<Rec, ID>>,
  file: ExportFile,
  report: ImportReport,
): Promise<void> {
  const d = file.data;
  const plays = d.plays ?? [];
  const athletes = d.athletes ?? [];
  const lineups = d.lineups ?? [];
  const matchups = d.matchups ?? [];
  const installs = d.installs ?? [];

  const playMap = await remapIds(tbl.plays, plays);
  const athleteMap = await remapIds(tbl.athletes, athletes);
  const lineupMap = await remapIds(tbl.lineups, lineups);
  const matchupMap = await remapIds(tbl.matchups, matchups);
  const installMap = await remapIds(tbl.installs, installs);
  const re = (map: Map<ID, ID>, v: ID): ID => map.get(v) ?? v;
  const reOpt = (map: Map<ID, ID>, v: ID | undefined): ID | undefined =>
    v === undefined ? undefined : re(map, v);

  const outPlays = plays.map((p) => ({ ...p, id: re(playMap, p.id) }));
  const outAthletes = athletes.map((a) => ({ ...a, id: re(athleteMap, a.id) }));
  const outLineups = lineups.map((l) => ({
    ...l,
    id: re(lineupMap, l.id),
    slots: l.slots.map((s) =>
      s.athleteId === undefined ? s : { ...s, athleteId: re(athleteMap, s.athleteId) },
    ),
  }));
  const outMatchups = matchups.map((m) => {
    const out = {
      ...m,
      id: re(matchupMap, m.id),
      offensePlayId: re(playMap, m.offensePlayId),
      defensePlayId: re(playMap, m.defensePlayId),
    };
    const off = reOpt(lineupMap, m.offenseLineupId);
    const def = reOpt(lineupMap, m.defenseLineupId);
    if (off !== undefined) out.offenseLineupId = off;
    if (def !== undefined) out.defenseLineupId = def;
    return out;
  });
  const outInstalls = installs.map((i) => ({
    ...i,
    id: re(installMap, i.id),
    items: i.items.map((it) => ({ ...it, matchupId: re(matchupMap, it.matchupId) })),
  }));

  const groups: [RecordTable, Rec[]][] = [
    ['plays', outPlays],
    ['athletes', outAthletes],
    ['lineups', outLineups],
    ['matchups', outMatchups],
    ['installs', outInstalls],
  ];
  for (const [name, recs] of groups) {
    if (recs.length) await tbl[name].bulkAdd(recs);
    report[name].added = recs.length;
  }
}
