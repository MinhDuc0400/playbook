import { notImplemented } from '@/domain/notImplemented';
import type { Athlete } from '@/domain/types';
import type { Repo } from './base';

export type AthletesRepo = Repo<Athlete>;

export const athletesRepo: AthletesRepo = new Proxy({} as AthletesRepo, {
  get: (_t, key) => notImplemented(`athletesRepo.${String(key)}`),
});
