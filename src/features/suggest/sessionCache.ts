import { createSuggestCache } from '@/suggest/cache';

/** Session cache for sim aggregates (FR-SG-06), shared across mounts of the Suggest page. */
export const suggestSessionCache = createSuggestCache();
