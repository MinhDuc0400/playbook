/**
 * Single entry point for all UI strings (NFR-UX-04, D-06). Lead-owned.
 * Each feature owns its namespace file in ./vi/. Components import `t` from here only.
 */
import { common } from './vi/common';
import { defense } from './vi/defense';
import { editor } from './vi/editor';
import { field } from './vi/field';
import { install } from './vi/install';
import { playbook } from './vi/playbook';
import { playbookActions } from './vi/playbookActions';
import { present } from './vi/present';
import { settings } from './vi/settings';
import { matchup } from './vi/matchup';
import { matchupField } from './vi/matchupField';
import { result } from './vi/result';
import { exportx } from './vi/exportx';
import { randomDef } from './vi/randomDef';
import { roster } from './vi/roster';
import { suggest } from './vi/suggest';
import { rules } from './vi/rules';
import { tuning } from './vi/tuning';
import { offense } from './vi/offense';
import { playback } from './vi/playback';
import { tools } from './vi/tools';
import { openWindows } from './vi/openWindows';
import { freestyle } from './vi/freestyle';

export const vi = {
  common,
  field,
  editor,
  offense,
  defense,
  playback,
  tools,
  openWindows,
  matchup,
  matchupField,
  result,
  playbook,
  playbookActions,
  install,
  present,
  settings,
  rules,
  tuning,
  suggest,
  roster,
  randomDef,
  exportx,
  freestyle,
} as const;
export const t = vi;
export type Strings = typeof vi;
