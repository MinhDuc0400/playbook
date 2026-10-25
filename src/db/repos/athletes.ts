import type { Athlete } from '@/domain/types';
import { getDb } from '../schema';
import { createRepo, type Repo } from './base';

export type AthletesRepo = Repo<Athlete>;

export const athletesRepo: AthletesRepo = createRepo<Athlete>(() => getDb().athletes);
