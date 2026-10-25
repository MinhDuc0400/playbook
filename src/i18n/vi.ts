/**
 * Single entry point for all UI strings (NFR-UX-04, D-06). Lead-owned.
 * Each feature owns its namespace file in ./vi/. Components import `t` from here only.
 */
import { common } from './vi/common';
import { defense } from './vi/defense';
import { editor } from './vi/editor';
import { field } from './vi/field';
import { offense } from './vi/offense';
import { playback } from './vi/playback';
import { tools } from './vi/tools';

export const vi = { common, field, editor, offense, defense, playback, tools } as const;
export const t = vi;
export type Strings = typeof vi;
