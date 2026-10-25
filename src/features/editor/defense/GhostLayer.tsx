/**
 * Faded ghost offense formation drawn under a defense play (FR-DEF-01). Each numbered receiver gets a
 * badge (S1..S3 / W1..W3) so man assignments read as strong #n / weak #n (FR-DEF-02). While the man tool
 * is active every ghost receiver also gets a transparent hit circle the canvas resolves to a ghost target.
 */
import { useMemo } from 'react';
import { useFieldContext } from '@/components/field/FieldContext';
import { PlayerToken } from '@/components/field/PlayerToken';
import { toScreen, yardsToPx } from '@/components/field/viewport';
import { refForPlayer } from '@/domain/numbering';
import { useEditorStore } from '@/store/editorStore';
import { ghostNumbering, ghostPlayers } from './ghost';

const HIT_RADIUS_YD = 1;
const TOKEN_RADIUS_YD = 0.9;

export function GhostLayer(): JSX.Element | null {
  const { viewport } = useFieldContext();
  const format = useEditorStore((s) => (s.play?.side === 'defense' ? s.play.format : null));
  const ghostFormationId = useEditorStore((s) => s.ghostFormationId);
  const manTool = useEditorStore((s) => s.tool === 'man');
  const picking = useEditorStore((s) => s.draft?.kind === 'man');
  const formation = useMemo(() => {
    if (!format) return null;
    const players = ghostPlayers(format, ghostFormationId);
    const numbering = ghostNumbering(format, ghostFormationId);
    return { players, numbering };
  }, [format, ghostFormationId]);

  if (!format || !formation) return null;
  const { players, numbering } = formation;
  const badgeFont = Math.min(14, Math.max(8, yardsToPx(0.8, viewport)));
  const tokenR = Math.min(22, Math.max(6, yardsToPx(TOKEN_RADIUS_YD, viewport)));

  return (
    <g data-testid="ghost-layer">
      {players.map((p) => {
        const label = p.id.slice('ghost-'.length);
        return <PlayerToken key={p.id} id={p.id} side="offense" label={label} pos={p.pos} ghost />;
      })}

      {players.map((p) => {
        const ref = numbering.refs[p.id];
        if (!ref || ref.kind !== 'number') return null;
        const label = p.id.slice('ghost-'.length);
        const c = toScreen(p.pos, viewport);
        return (
          <text
            key={p.id}
            data-testid={`ghost-number-${label}`}
            x={c.x + tokenR + 3}
            y={c.y - tokenR * 0.6}
            fontSize={badgeFont}
            fontWeight={700}
            className="fill-slate-600 dark:fill-slate-300"
            pointerEvents="none"
          >
            {`${ref.side === 'strong' ? 'S' : 'W'}${ref.number}`}
          </text>
        );
      })}

      {manTool &&
        players.map((p) => {
          if (!refForPlayer(p.id, numbering, players)) return null;
          const c = toScreen(p.pos, viewport);
          return (
            <circle
              key={p.id}
              data-kind="ghost"
              data-ghost-id={p.id}
              data-testid={`ghost-hit-${p.id.slice('ghost-'.length)}`}
              cx={c.x}
              cy={c.y}
              r={yardsToPx(HIT_RADIUS_YD, viewport)}
              fill="transparent"
              stroke={picking ? 'currentColor' : 'none'}
              strokeWidth={1.5}
              strokeDasharray="4 3"
              className="cursor-pointer text-amber-500"
              pointerEvents="all"
            />
          );
        })}
    </g>
  );
}
