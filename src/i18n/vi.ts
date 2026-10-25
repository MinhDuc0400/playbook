/**
 * Single entry point for all UI strings (NFR-UX-04, D-06). Lead-owned.
 * Each feature owns its namespace file in ./vi/. Components import `t` from here only.
 */
import { common } from './vi/common';
import { field } from './vi/field';

export const vi = { common, field } as const;
export const t = vi;
export type Strings = typeof vi;
