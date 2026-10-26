import { createDefaultSettings, normalizeSettings } from '@/domain/defaults';
import type { Settings } from '@/domain/types';
import { withDbErrors } from '../errors';
import { getDb } from '../schema';

export interface SettingsRepo {
  get(): Promise<Settings | undefined>;
  /** Stored settings, or createDefaultSettings() (not written). */
  getOrDefault(): Promise<Settings>;
  put(s: Settings): Promise<void>;
  /** Shallow-merge patch into stored (or default) settings, write, return result. */
  update(patch: Partial<Omit<Settings, 'key'>>): Promise<Settings>;
}

const KEY = 'app';

export const settingsRepo: SettingsRepo = {
  get: () =>
    withDbErrors(async () => {
      const s = await getDb().settings.get(KEY);
      return s ? normalizeSettings(s) : undefined;
    }),
  getOrDefault: () =>
    withDbErrors(async () => {
      const s = await getDb().settings.get(KEY);
      return s ? normalizeSettings(s) : createDefaultSettings();
    }),
  put: (s) =>
    withDbErrors(async () => {
      const db = getDb();
      await db.transaction('rw', db.settings, () => db.settings.put(s));
    }),
  update: (patch) =>
    withDbErrors(async () => {
      const db = getDb();
      return db.transaction('rw', db.settings, async () => {
        const stored = await db.settings.get(KEY);
        const current = stored ? normalizeSettings(stored) : createDefaultSettings();
        const next: Settings = { ...current, ...patch, key: KEY };
        await db.settings.put(next);
        return next;
      });
    }),
};
