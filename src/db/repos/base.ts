/** Generic table repository (NFR-ARC-04: components use repositories, never Dexie). */
import type { Table } from 'dexie';
import { notImplemented } from '@/domain/notImplemented';
import type { ID } from '@/domain/types';

export interface Repo<T extends { id: ID }> {
  get(id: ID): Promise<T | undefined>;
  getMany(ids: ID[]): Promise<(T | undefined)[]>;
  list(): Promise<T[]>;
  /** Write as-is inside a rw transaction. Callers set updatedAt. */
  put(rec: T): Promise<void>;
  bulkPut(recs: T[]): Promise<void>;
  remove(id: ID): Promise<void>;
  count(): Promise<number>;
}

/** Build a Repo over a table getter (getter so tests can reset the DB). All ops go through withDbErrors. */
export function createRepo<T extends { id: ID }>(table: () => Table<T, ID>): Repo<T> {
  return notImplemented(`createRepo ${String(table)}`);
}
