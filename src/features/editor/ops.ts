/**
 * Pure play-editing recipes (D-14). Each takes a Play and returns a new Play (or the same object when
 * nothing changes). Used through `editorStore.apply(label, recipe)`. Never mutate the input.
 */
import { notImplemented } from '@/domain/notImplemented';
import type { RouteTemplateId } from '@/domain/routeTree';
import type { ID, Play, Point, QbDropAction, Role, RouteAction, Strength } from '@/domain/types';

export type Recipe = (play: Play) => Play;

/** False when play already has `maxPlayers` players. */
export function canAddPlayer(play: Play, maxPlayers: number): boolean {
  return notImplemented(`canAddPlayer ${play.id}${maxPlayers}`);
}

/**
 * Add a player at pos with the next default label for its role (nextDefaultLabel). Offense QB gets a
 * qbDrop {depth 2, shotgun}; defense 'R' gets a rush to (0,-5) with delay 0. No-op at maxPlayers.
 * Recomputes strength (unless strengthOverridden).
 */
export function addPlayer(role: Role, pos: Point, maxPlayers: number, idGen: () => ID): Recipe {
  return notImplemented(`addPlayer ${role}${pos.x}${maxPlayers}${String(idGen)}`);
}

/**
 * Move a player's start. Offense: its route/option/motion points translate by the same delta (shape kept).
 * Defense: actions unchanged. Recomputes strength (unless strengthOverridden).
 */
export function movePlayer(slotId: ID, pos: Point): Recipe {
  return notImplemented(`movePlayer ${slotId}${pos.x}`);
}

/** Remove players; also drops them from progression. Recomputes strength. */
export function removePlayers(slotIds: readonly ID[]): Recipe {
  return notImplemented(`removePlayers ${slotIds.length}`);
}

/** Copy a player (Ctrl+D) offset +1 yd in x with a new id and the next default label. No-op at max. */
export function duplicatePlayer(slotId: ID, maxPlayers: number, idGen: () => ID): Recipe {
  return notImplemented(`duplicatePlayer ${slotId}${maxPlayers}${String(idGen)}`);
}

export function setLabel(slotId: ID, label: string): Recipe {
  return notImplemented(`setLabel ${slotId}${label}`);
}

/** The slot's first 'route' action, if any. */
export function getRoute(play: Play, slotId: ID): RouteAction | undefined {
  return notImplemented(`getRoute ${play.id}${slotId}`);
}

/** Replace the slot's route (first 'route' or 'option' action) with `route`; null removes it. */
export function setRoute(slotId: ID, route: RouteAction | null): Recipe {
  return notImplemented(`setRoute ${slotId}${String(route)}`);
}

export function moveRoutePoint(slotId: ID, index: number, pos: Point): Recipe {
  return notImplemented(`moveRoutePoint ${slotId}${index}${pos.x}`);
}

/** Insert pos at `index` in the path (0 = first point after the start). smooth[] stays aligned (new = false). */
export function insertRoutePoint(slotId: ID, index: number, pos: Point): Recipe {
  return notImplemented(`insertRoutePoint ${slotId}${index}${pos.x}`);
}

/** Delete a point; an empty path removes the route. templateId is cleared on any manual point edit. */
export function deleteRoutePoint(slotId: ID, index: number): Recipe {
  return notImplemented(`deleteRoutePoint ${slotId}${index}`);
}

export function toggleRoutePointSmooth(slotId: ID, index: number): Recipe {
  return notImplemented(`toggleRoutePointSmooth ${slotId}${index}`);
}

export function setRouteEndBehavior(slotId: ID, endBehavior: 'stop' | 'continue'): Recipe {
  return notImplemented(`setRouteEndBehavior ${slotId}${endBehavior}`);
}

/**
 * FR-OFF-03: replace the slot's route with buildRoute(templateId, start, { depth, outward }) where
 * outward = outwardSign(start, strong side of the play: play.strength left → 'left', else 'right').
 */
export function applyRouteTemplate(slotId: ID, templateId: RouteTemplateId, depth?: number): Recipe {
  return notImplemented(`applyRouteTemplate ${slotId}${templateId}${String(depth)}`);
}

/** Set (or add) the QB drop action. */
export function setQbDrop(slotId: ID, depth: number, style: QbDropAction['style']): Recipe {
  return notImplemented(`setQbDrop ${slotId}${depth}${style}`);
}

/** FR-OFF-04 click order: append slotId to progression, or remove it if already present. QB is ignored. */
export function toggleProgression(slotId: ID): Recipe {
  return notImplemented(`toggleProgression ${slotId}`);
}

export function clearProgression(): Recipe {
  return notImplemented('clearProgression');
}

/**
 * FR-OFF-05: 'auto' → strengthOverridden = false and strength = computeStrength(alignment);
 * otherwise strength = value and strengthOverridden = true. Offense only (defense: sets strength as is).
 */
export function setStrength(value: Strength | 'auto'): Recipe {
  return notImplemented(`setStrength ${value}`);
}

/** Recompute offense strength from alignment unless strengthOverridden. */
export function refreshStrength(): Recipe {
  return notImplemented('refreshStrength');
}

export function setMeta(patch: Partial<Pick<Play, 'name' | 'formation' | 'tags' | 'notes'>>): Recipe {
  return notImplemented(`setMeta ${String(patch)}`);
}

/** FR-FLP-02: flipPlay. */
export function flip(): Recipe {
  return notImplemented('flip');
}
