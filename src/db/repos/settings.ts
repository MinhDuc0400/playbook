import { notImplemented } from '@/domain/notImplemented';
import type { Settings } from '@/domain/types';

export interface SettingsRepo {
  get(): Promise<Settings | undefined>;
  /** Stored settings, or createDefaultSettings() (not written). */
  getOrDefault(): Promise<Settings>;
  put(s: Settings): Promise<void>;
  /** Shallow-merge patch into stored (or default) settings, write, return result. */
  update(patch: Partial<Omit<Settings, 'key'>>): Promise<Settings>;
}

export const settingsRepo: SettingsRepo = new Proxy({} as SettingsRepo, {
  get: (_t, key) => notImplemented(`settingsRepo.${String(key)}`),
});
