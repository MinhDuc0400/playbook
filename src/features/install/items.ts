/** Pure helpers for Install items (FR-IN-02, FR-IN-03). Every helper returns a new Install with orders 0..n-1. */
import type { ID, Install, InstallItem } from '@/domain/types';

export function sortedItems(install: Install): InstallItem[] {
  return [...install.items].sort((a, b) => a.order - b.order);
}

function repack(install: Install, items: InstallItem[]): Install {
  return { ...install, items: items.map((it, i) => ({ ...it, order: i })) };
}

/** Append one item per matchup id, in order. */
export function addItems(install: Install, matchupIds: ID[], idGen: () => ID): Install {
  const added = matchupIds.map((matchupId) => ({ id: idGen(), matchupId, order: 0 }));
  return repack(install, [...sortedItems(install), ...added]);
}

export function removeItem(install: Install, itemId: ID): Install {
  return repack(
    install,
    sortedItems(install).filter((it) => it.id !== itemId),
  );
}

/** Move an item to a target index (clamped). Unknown id returns a re-packed copy. */
export function moveItem(install: Install, itemId: ID, toIndex: number): Install {
  const items = sortedItems(install);
  const from = items.findIndex((it) => it.id === itemId);
  if (from < 0) return repack(install, items);
  const [item] = items.splice(from, 1);
  const to = Math.max(0, Math.min(items.length, toIndex));
  items.splice(to, 0, item!);
  return repack(install, items);
}

export function setNote(install: Install, itemId: ID, coachNote: string): Install {
  return repack(
    install,
    sortedItems(install).map((it) => (it.id === itemId ? { ...it, coachNote } : it)),
  );
}
