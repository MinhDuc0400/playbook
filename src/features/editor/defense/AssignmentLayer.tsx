/**
 * Defense assignments drawn under the tokens (§12.2, FR-DEF-02..04): translucent zones, dashed man lines to
 * the resolved ghost receiver, bold rush arrows, plus the polygon being drawn by the zone tool.
 * Renders nothing for offense plays.
 */
import { useMemo } from 'react';
import { useFieldContext } from '@/components/field/FieldContext';
import { RoutePath } from '@/components/field/RoutePath';
import { ZoneShape } from '@/components/field/ZoneShape';
import { toScreen } from '@/components/field/viewport';
import { numberReceivers, resolveReceiverRef, type AlignedPlayer } from '@/domain/numbering';
import type { ManAction, Play, PlayerSlot, RushAction, ZoneAction } from '@/domain/types';
import { zoneKind, zonePolygon } from '@/domain/zones';
import { useEditorStore } from '@/store/editorStore';
import { ghostNumbering, ghostPlayers } from './ghost';

const EMPTY: string[] = [];

function findAction<T extends 'man' | 'zone' | 'rush'>(
  slot: PlayerSlot,
  type: T,
): Extract<ManAction | ZoneAction | RushAction, { type: T }> | undefined {
  return slot.actions.find((a) => a.type === type) as
    Extract<ManAction | ZoneAction | RushAction, { type: T }> | undefined;
}

/** Dashed outline of the zone polygon being drawn: clicked points → cursor. */
function ZoneDraftView(): JSX.Element | null {
  const { viewport } = useFieldContext();
  const draft = useEditorStore((s) => (s.draft?.kind === 'polygon' ? s.draft : null));
  if (!draft) return null;
  const pts = [...draft.points, ...(draft.cursor ? [draft.cursor] : [])].map((p) => toScreen(p, viewport));
  if (pts.length === 0) return null;
  const clicked = pts.slice(0, draft.points.length);
  return (
    <g data-testid="zone-draft" pointerEvents="none" className="text-slate-700 dark:text-slate-200">
      <polyline
        data-part="outline"
        points={pts.map((p) => `${p.x},${p.y}`).join(' ')}
        fill="none"
        stroke="currentColor"
        strokeWidth={2}
        strokeDasharray="6 4"
        strokeLinejoin="round"
      />
      {clicked.map((p, i) => (
        <circle key={i} cx={p.x} cy={p.y} r={4} className="fill-white stroke-current" strokeWidth={2} />
      ))}
    </g>
  );
}

export interface AssignmentLayerProps {
  /** Freestyle passive layer: draw this (defense) play instead of the store's, read-only. */
  play?: Play;
  /** Live offense the man lines point at (replaces the ghost formation). */
  targets?: readonly AlignedPlayer[];
}

export function AssignmentLayer({ play: playProp, targets }: AssignmentLayerProps = {}): JSX.Element | null {
  const { field } = useFieldContext();
  const storePlay = useEditorStore((s) => s.play);
  const play = playProp ?? storePlay;
  const passive = playProp !== undefined;
  const selection = useEditorStore((s) => (passive ? EMPTY : s.selection));
  const storeTool = useEditorStore((s) => s.tool);
  const tool = passive ? 'select' : storeTool;
  const ghostFormationId = useEditorStore((s) => s.ghostFormationId);
  const format = play?.format;
  const isDefense = play?.side === 'defense';

  const ghost = useMemo(() => {
    if (!format || !isDefense) return null;
    const list = targets ?? ghostPlayers(format, ghostFormationId);
    return {
      numbering: targets ? numberReceivers(targets) : ghostNumbering(format, ghostFormationId),
      positions: new Map(list.map((g) => [g.id, g.pos])),
    };
  }, [format, isDefense, ghostFormationId, targets]);

  if (!play || !isDefense || !ghost) return null;
  const selected = new Set(selection);

  const zones: JSX.Element[] = [];
  const lines: JSX.Element[] = [];
  for (const slot of play.players) {
    const isSel = selected.has(slot.id);
    const zone = findAction(slot, 'zone');
    if (zone) {
      zones.push(
        <ZoneShape
          key={`zone-${slot.id}`}
          polygon={zonePolygon(zone.zone, field)}
          kind={zoneKind(zone.zone)}
          dropPoint={zone.dropPoint}
          slotId={slot.id}
          showDropHandle={isSel || tool === 'zone'}
          testId={`zone-${slot.label}`}
        />,
      );
    }
    const man = findAction(slot, 'man');
    if (man) {
      const targetId = resolveReceiverRef(man.target, ghost.numbering);
      const target = targetId ? ghost.positions.get(targetId) : undefined;
      if (target) {
        lines.push(
          <RoutePath
            key={`man-${slot.id}`}
            variant="man"
            from={slot.start}
            path={[target]}
            testId={`man-${slot.label}`}
          />,
        );
      }
    }
    const rush = findAction(slot, 'rush');
    if (rush) {
      lines.push(
        <RoutePath
          key={`rush-${slot.id}`}
          variant="rush"
          from={slot.start}
          path={rush.path}
          slotId={slot.id}
          showHandles={isSel && tool === 'rush'}
          testId={`rush-${slot.label}`}
        />,
      );
    }
  }

  return (
    <g data-testid="assignment-layer">
      {zones}
      {lines}
      {!passive && <ZoneDraftView />}
    </g>
  );
}
