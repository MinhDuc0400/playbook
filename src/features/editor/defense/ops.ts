/**
 * Pure defense editing recipes (FR-DEF-02..06, D-14). Same rules as ../ops.ts: return a new Play, or the
 * same object when nothing changes; never mutate; never touch updatedAt.
 * A defender has at most one coverage action (man | zone | spy) OR a rush action.
 */
import { notImplemented } from '@/domain/notImplemented';
import type {
  FieldConfig,
  ID,
  Leverage,
  ManAction,
  Point,
  ReceiverRef,
  Strength,
  ZoneAction,
} from '@/domain/types';
import type { Recipe } from '../ops';

/** Default QB spot a rush path aims at. */
export const DEFAULT_QB_SPOT: Point = { x: 0, y: -5 };

/**
 * FR-DEF-02: replace the slot's coverage/rush with `{type:'man', target, technique, cushion?}`
 * (technique default 'trail'; cushion default 5 when technique is 'cushion'). A slot with role 'R'
 * becomes role 'LB'.
 */
export function setMan(
  slotId: ID,
  target: ReceiverRef,
  technique?: ManAction['technique'],
  cushion?: number,
): Recipe {
  return notImplemented(`setMan ${slotId}${target.kind}${String(technique)}${String(cushion)}`);
}

/** Change technique/cushion of an existing man action (no-op without one). */
export function setManTechnique(slotId: ID, technique: ManAction['technique'], cushion?: number): Recipe {
  return notImplemented(`setManTechnique ${slotId}${technique}${String(cushion)}`);
}

/**
 * FR-DEF-03: replace coverage/rush with a zone. dropPoint defaults to the preset's (zonePreset) or the
 * polygon centroid. Role 'R' becomes 'LB'.
 */
export function setZone(slotId: ID, zone: ZoneAction['zone'], field: FieldConfig, dropPoint?: Point): Recipe {
  return notImplemented(`setZone ${slotId}${String(zone)}${field.width}${String(dropPoint)}`);
}

/** Move the zone drop point (FR-DEF-03 "Kéo drop point"). */
export function setDropPoint(slotId: ID, p: Point): Recipe {
  return notImplemented(`setDropPoint ${slotId}${p.x}`);
}

/**
 * FR-DEF-04: make the slot a designated rusher: role 'R', leverage removed, actions = [rush with
 * path [qbSpot ?? DEFAULT_QB_SPOT], delay 0]. Allowed beyond maxRushers (validate warns).
 */
export function setRush(slotId: ID, qbSpot?: Point): Recipe {
  return notImplemented(`setRush ${slotId}${String(qbSpot)}`);
}

/** Replace the rush path (editable, FR-DEF-04). */
export function setRushPath(slotId: ID, path: Point[]): Recipe {
  return notImplemented(`setRushPath ${slotId}${path.length}`);
}

/** Remove the slot's coverage or rush action; role 'R' becomes 'LB'. */
export function clearAssignment(slotId: ID): Recipe {
  return notImplemented(`clearAssignment ${slotId}`);
}

/** FR-DEF-05. undefined removes it. */
export function setLeverage(slotId: ID, leverage: Leverage | undefined): Recipe {
  return notImplemented(`setLeverage ${slotId}${String(leverage)}`);
}

/** FR-DEF-06. */
export function setAlignTo(alignTo: 'ball' | 'strength'): Recipe {
  return notImplemented(`setAlignTo ${alignTo}`);
}

/** FR-DEF-01: Play.strength = strength of the ghost at design time. */
export function setDesignStrength(strength: Strength): Recipe {
  return notImplemented(`setDesignStrength ${strength}`);
}
