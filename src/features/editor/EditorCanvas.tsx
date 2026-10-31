/**
 * Editor field canvas (FR-ED-02/03, FR-OFF-01/02). Renders FieldStage + players, routes, draft and (defense)
 * GhostLayer/AssignmentLayer; turns pointer events into FieldPointerEvents for the active tool; handles
 * Enter/Esc/Delete/Backspace by forwarding to the active tool's onKeyDown.
 */
import { nanoid } from 'nanoid';
import { memo, useCallback, useEffect, useMemo, useRef } from 'react';
import { useFieldContext } from '@/components/field/FieldContext';
import { FieldStage } from '@/components/field/FieldStage';
import { PlayerToken } from '@/components/field/PlayerToken';
import { RoutePath } from '@/components/field/RoutePath';
import { toField, toScreen, yardsToPx, type Viewport } from '@/components/field/viewport';
import type {
  BallSpot,
  FieldConfig,
  ID,
  MotionAction,
  OptionRouteAction,
  Play,
  PlayerSlot,
  Point,
  RouteAction,
  Side,
  Role,
} from '@/domain/types';
import { alignedPlayers, numberReceivers, refForPlayer } from '@/domain/numbering';
import { useEditorStore } from '@/store/editorStore';
import { AssignmentLayer } from './defense/AssignmentLayer';
import { GhostLayer } from './defense/GhostLayer';
import { routeStart } from './ops';
import { snapPoint } from './snap';
import { TOOLS } from './tools';
import { readOptionDraft } from './tools/optionTool';
import type { FieldPointerEvent, HitTarget, ToolContext } from './tools/types';

export interface EditorCanvasProps {
  field: FieldConfig;
  ballSpot: BallSpot;
  /** Settings.ui.snap (FR-ED-03); Alt still disables snapping when true. */
  snap: boolean;
  showGrid?: boolean;
  /** Freestyle tray hooks (FR-FS-04): a role dropped on / clicked onto the field. */
  onPlace?: (role: Role, point: Point) => void;
  pendingRole?: Role | null;
}

/** dataTransfer type carrying a Role string from the Freestyle tray. */
export const ROLE_DRAG_TYPE = 'application/x-flagbook-role';

const DOUBLE_CLICK_MS = 400;
const DOUBLE_CLICK_PX = 6;

function isTypingTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  const tag = target.tagName;
  return tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || target.isContentEditable;
}

/** Resolve what the pointer hit from the data-* attributes rendered by PlayerToken / RoutePath. */
function hitTest(target: EventTarget | null): HitTarget {
  if (!(target instanceof Element)) return { kind: 'field' };
  const el = target.closest('[data-kind]');
  if (!el) return { kind: 'field' };
  const slotId = el.closest('[data-slot-id]')?.getAttribute('data-slot-id') ?? undefined;
  const index = Number(el.getAttribute('data-index'));
  switch (el.getAttribute('data-kind')) {
    case 'player':
      if (!slotId) return { kind: 'field' };
      return el.getAttribute('data-live') === 'true'
        ? { kind: 'offenseToken', slotId }
        : { kind: 'player', slotId };
    case 'ghost': {
      const ghostId = el.getAttribute('data-ghost-id');
      return ghostId ? { kind: 'ghost', ghostId } : { kind: 'field' };
    }
    case 'routePoint':
      return slotId && Number.isInteger(index) ? { kind: 'routePoint', slotId, index } : { kind: 'field' };
    case 'routeSegment':
      return slotId && Number.isInteger(index) ? { kind: 'routeSegment', slotId, index } : { kind: 'field' };
    case 'dropPoint':
      return slotId ? { kind: 'dropPoint', slotId } : { kind: 'field' };
    default:
      return { kind: 'field' };
  }
}

/** Publishes the current viewport to a ref so event handlers outside the SVG can convert coordinates. */
function ViewportProbe({ target }: { target: { current: Viewport | null } }): null {
  target.current = useFieldContext().viewport;
  return null;
}

interface RouteViewProps {
  slotId: ID;
  label: string;
  start: PlayerSlot['start'];
  route: RouteAction;
  primary: boolean;
  selected: boolean;
}

const RouteView = memo(function RouteView({
  slotId,
  label,
  start,
  route,
  primary,
  selected,
}: RouteViewProps) {
  return (
    <RoutePath
      from={start}
      path={route.path}
      smooth={route.smooth}
      variant="route"
      primary={primary}
      showHandles={selected}
      slotId={slotId}
      testId={`route-${label}`}
    />
  );
});

interface TokenViewProps {
  slot: PlayerSlot;
  side: Side;
  selected: boolean;
  progressionIndex: number | undefined;
}

const TokenView = memo(function TokenView({ slot, side, selected, progressionIndex }: TokenViewProps) {
  return (
    <PlayerToken
      id={slot.id}
      side={side}
      label={slot.label}
      pos={slot.start}
      selected={selected}
      progressionIndex={progressionIndex}
      rusher={slot.actions.some((a) => a.type === 'rush')}
      leverage={slot.leverage}
      insideSign={slot.start.x > 0 ? -1 : 1}
    />
  );
});

/** Dashed preview of the route being drawn: start → clicked points → cursor. */
function RouteDraftLayer(): JSX.Element | null {
  const { viewport } = useFieldContext();
  const draft = useEditorStore((s) => (s.draft?.kind === 'route' ? s.draft : null));
  const start = useEditorStore((s) => (draft && s.play ? routeStart(s.play, draft.slotId) : undefined));
  if (!draft || !start) return null;
  const pts = [start, ...draft.points, ...(draft.cursor ? [draft.cursor] : [])].map((p) =>
    toScreen(p, viewport),
  );
  return (
    <g data-testid="route-draft" pointerEvents="none" className="text-blue-700 dark:text-blue-300">
      <polyline
        points={pts.map((p) => `${p.x},${p.y}`).join(' ')}
        fill="none"
        stroke="currentColor"
        strokeWidth={2}
        strokeDasharray="6 4"
        strokeLinejoin="round"
      />
      {pts.slice(1, draft.points.length + 1).map((p, i) => (
        <circle key={i} cx={p.x} cy={p.y} r={4} className="fill-white stroke-current" strokeWidth={2} />
      ))}
    </g>
  );
}

/** Motion (zigzag, from the start) and route / option (from the motion end) of one slot. */
const ActionViews = memo(function ActionViews({
  slot,
  primary,
  selected,
}: {
  slot: PlayerSlot;
  primary: boolean;
  selected: boolean;
}) {
  const motion = slot.actions.find((a): a is MotionAction => a.type === 'motion');
  const route = slot.actions.find((a): a is RouteAction => a.type === 'route');
  const option = slot.actions.find((a): a is OptionRouteAction => a.type === 'option');
  const from = motion?.path[motion.path.length - 1] ?? slot.start;
  const stemEnd = option?.stem[option.stem.length - 1] ?? from;
  return (
    <>
      {motion && (
        <RoutePath
          from={slot.start}
          path={motion.path}
          variant="motion"
          slotId={slot.id}
          testId={`motion-${slot.label}`}
        />
      )}
      {route && (
        <RouteView
          slotId={slot.id}
          label={slot.label}
          start={from}
          route={route}
          primary={primary}
          selected={selected}
        />
      )}
      {option && (
        <>
          <RoutePath
            from={from}
            path={option.stem}
            variant="route"
            slotId={slot.id}
            testId={`option-stem-${slot.label}`}
          />
          <RoutePath
            from={stemEnd}
            path={option.vsMan}
            variant="option-man"
            slotId={slot.id}
            testId={`option-man-${slot.label}`}
          />
          <RoutePath
            from={stemEnd}
            path={option.vsZone}
            variant="option-zone"
            slotId={slot.id}
            testId={`option-zone-${slot.label}`}
          />
        </>
      )}
    </>
  );
});

function DashedLine({ pts, testId }: { pts: Point[]; testId?: string }): JSX.Element {
  const { viewport } = useFieldContext();
  const sp = pts.map((p) => toScreen(p, viewport));
  return (
    <g data-testid={testId}>
      <polyline
        points={sp.map((p) => `${p.x},${p.y}`).join(' ')}
        fill="none"
        stroke="currentColor"
        strokeWidth={2}
        strokeDasharray="6 4"
        strokeLinejoin="round"
      />
      {sp.slice(1).map((p, i) => (
        <circle key={i} cx={p.x} cy={p.y} r={4} className="fill-white stroke-current" strokeWidth={2} />
      ))}
    </g>
  );
}

/** Dashed preview of the motion / option route being drawn (generic drafts). */
function MotionOptionDraftLayer(): JSX.Element | null {
  const draft = useEditorStore((s) => (s.draft?.kind === 'generic' ? s.draft : null));
  const play = useEditorStore((s) => s.play);
  if (!draft || !play) return null;
  const motion = draft.data['tool'] === 'motion';
  const option = readOptionDraft(draft);
  if (!motion && !option) return null;
  const slotId = (draft.data['slotId'] as ID | undefined) ?? '';
  const slot = play.players.find((p) => p.id === slotId);
  if (!slot) return null;
  const cursor = (draft.data['cursor'] as Point | null | undefined) ?? null;
  const points = (draft.data['points'] as Point[] | undefined) ?? [];
  if (motion) {
    return (
      <g pointerEvents="none" className="text-amber-600 dark:text-amber-400">
        <DashedLine testId="motion-draft" pts={[slot.start, ...points, ...(cursor ? [cursor] : [])]} />
      </g>
    );
  }
  if (!option) return null;
  const base = routeStart(play, slotId);
  const stemEnd = option.stem[option.stem.length - 1] ?? base;
  const from = option.phase === 'stem' ? base : stemEnd;
  return (
    <g pointerEvents="none" className="text-purple-700 dark:text-purple-300">
      {option.phase !== 'stem' && <DashedLine pts={[base, ...option.stem]} />}
      {option.phase === 'vsZone' && <DashedLine pts={[stemEnd, ...option.vsMan]} />}
      <DashedLine testId="option-draft" pts={[from, ...points, ...(cursor ? [cursor] : [])]} />
    </g>
  );
}

const NO_SELECTION: ID[] = [];

function SlotLayers({ play: playProp }: { play?: Play } = {}): JSX.Element | null {
  const storePlay = useEditorStore((s) => s.play);
  const storeSelection = useEditorStore((s) => s.selection);
  const play = playProp ?? storePlay;
  if (!play) return null;
  const selected = new Set(playProp ? NO_SELECTION : storeSelection);
  const primaryId = play.progression?.[0];
  return (
    <>
      {play.players.map((slot) => (
        <ActionViews
          key={slot.id}
          slot={slot}
          primary={primaryId === slot.id}
          selected={selected.has(slot.id)}
        />
      ))}
      {play.players.map((slot) => {
        const order = play.progression?.indexOf(slot.id) ?? -1;
        return (
          <TokenView
            key={slot.id}
            slot={slot}
            side={play.side}
            selected={selected.has(slot.id)}
            progressionIndex={order >= 0 ? order + 1 : undefined}
          />
        );
      })}
    </>
  );
}

/** Read-only companion play (Freestyle): faded, never hit-tested (FR-FS-02). */
function PassiveLayer({ companion, active }: { companion: Play; active: Play | null }): JSX.Element {
  const targets = useMemo(
    () => (active && active.side === 'offense' ? alignedPlayers(active) : undefined),
    [active],
  );
  return (
    <g opacity={0.45} pointerEvents="none" data-testid="passive-layer">
      {companion.side === 'defense' && <AssignmentLayer play={companion} targets={targets} />}
      <SlotLayers play={companion} />
    </g>
  );
}

/** Man tool over the live offense: transparent hit circles on the companion's receivers (FR-FS-04). */
function LiveOffenseHitLayer({ offense }: { offense: Play }): JSX.Element {
  const { viewport } = useFieldContext();
  const picking = useEditorStore((s) => s.draft?.kind === 'man');
  const players = useMemo(() => alignedPlayers(offense), [offense]);
  const numbering = useMemo(() => numberReceivers(players), [players]);
  return (
    <g data-testid="live-offense-hit-layer">
      {offense.players.map((slot) => {
        if (!refForPlayer(slot.id, numbering, players)) return null;
        const c = toScreen(slot.start, viewport);
        return (
          <circle
            key={slot.id}
            data-kind="player"
            data-side="offense"
            data-live="true"
            data-slot-id={slot.id}
            data-testid={`live-hit-${slot.label}`}
            cx={c.x}
            cy={c.y}
            r={yardsToPx(1, viewport)}
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

function MinimapDots(): JSX.Element | null {
  const { viewport } = useFieldContext();
  const play = useEditorStore((s) => s.play);
  if (!play) return null;
  return (
    <>
      {play.players.map((slot) => {
        const c = toScreen(slot.start, viewport);
        return (
          <circle
            key={slot.id}
            data-testid={`mm-${slot.id}`}
            cx={c.x}
            cy={c.y}
            r={2.5}
            className={play.side === 'offense' ? 'fill-blue-600' : 'fill-red-600'}
            pointerEvents="none"
          />
        );
      })}
    </>
  );
}

export function EditorCanvas({
  field,
  ballSpot,
  snap,
  showGrid,
  onPlace,
  pendingRole,
}: EditorCanvasProps): JSX.Element {
  const side = useEditorStore((s) => s.play?.side);
  const play = useEditorStore((s) => s.play);
  const companion = useEditorStore((s) => s.companion);
  const liveOffense = side === 'defense' && companion?.side === 'offense' ? companion : null;
  const liveAligned = useMemo(() => (liveOffense ? alignedPlayers(liveOffense) : undefined), [liveOffense]);
  const tool = useEditorStore((s) => s.tool);
  const viewportRef = useRef<Viewport | null>(null);
  const spaceRef = useRef(false);
  const clickRef = useRef<{ t: number; x: number; y: number; n: number } | null>(null);
  // Pointer capture retargets the later click/dblclick to the svg, so remember what the press hit.
  const downHitRef = useRef<HitTarget | null>(null);

  const ctx = useMemo<ToolContext>(
    () => ({
      getState: useEditorStore.getState,
      field,
      ballSpot,
      maxPlayers: field.playersPerSide,
      idGen: () => nanoid(),
    }),
    [field, ballSpot],
  );
  const ctxRef = useRef(ctx);
  ctxRef.current = ctx;

  // Switching tools (or unmounting) deactivates the previous one, which clears its draft.
  useEffect(
    () => () => {
      TOOLS[tool]?.onDeactivate?.(ctxRef.current);
    },
    [tool],
  );

  // Space held = pan mode: tools ignore pointer input (FieldStage handles the pan itself).
  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (e.code === 'Space' && !isTypingTarget(e.target)) spaceRef.current = true;
    };
    const up = (e: KeyboardEvent) => {
      if (e.code === 'Space') spaceRef.current = false;
    };
    const blur = () => {
      spaceRef.current = false;
    };
    window.addEventListener('keydown', down);
    window.addEventListener('keyup', up);
    window.addEventListener('blur', blur);
    return () => {
      window.removeEventListener('keydown', down);
      window.removeEventListener('keyup', up);
      window.removeEventListener('blur', blur);
    };
  }, []);

  // Enter / Escape / Delete / Backspace go to the active tool.
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (isTypingTarget(e.target)) return;
      if (e.key !== 'Enter' && e.key !== 'Escape' && e.key !== 'Delete' && e.key !== 'Backspace') return;
      const active = TOOLS[useEditorStore.getState().tool];
      if (active?.onKeyDown?.(e, ctxRef.current)) e.preventDefault();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, []);

  const toolEvent = useCallback(
    (
      e: React.MouseEvent<SVGSVGElement>,
      detail: number,
      target: EventTarget | null,
    ): FieldPointerEvent | null => {
      const vp = viewportRef.current;
      if (!vp) return null;
      const r = e.currentTarget.getBoundingClientRect();
      const raw = toField({ x: e.clientX - r.left, y: e.clientY - r.top }, vp);
      return {
        point: snapPoint(raw, { snap, alt: e.altKey }),
        raw,
        target: hitTest(target),
        shiftKey: e.shiftKey,
        altKey: e.altKey,
        ctrlKey: e.ctrlKey || e.metaKey,
        button: e.button,
        detail,
      };
    },
    [snap],
  );

  const activeTool = () => TOOLS[useEditorStore.getState().tool];

  const onPointerDown = (e: React.PointerEvent<SVGSVGElement>) => {
    if (spaceRef.current || e.isPrimary === false) return;
    const now = e.timeStamp || Date.now();
    const prev = clickRef.current;
    const n =
      prev &&
      now - prev.t <= DOUBLE_CLICK_MS &&
      Math.hypot(e.clientX - prev.x, e.clientY - prev.y) <= DOUBLE_CLICK_PX
        ? prev.n + 1
        : 1;
    clickRef.current = { t: now, x: e.clientX, y: e.clientY, n };
    const fe = toolEvent(e, n, e.target);
    if (!fe) return;
    if (pendingRole && onPlace && fe.target.kind === 'field' && e.button === 0) {
      onPlace(pendingRole, fe.point);
      return;
    }
    downHitRef.current = fe.target;
    try {
      e.currentTarget.setPointerCapture?.(e.pointerId);
    } catch {
      // capture is best-effort
    }
    activeTool()?.onPointerDown?.(fe, ctx);
  };

  const onPointerMove = (e: React.PointerEvent<SVGSVGElement>) => {
    if (spaceRef.current || e.isPrimary === false) return;
    const fe = toolEvent(e, 0, e.target);
    if (fe) activeTool()?.onPointerMove?.(fe, ctx);
  };

  const onPointerUp = (e: React.PointerEvent<SVGSVGElement>) => {
    if (e.isPrimary === false) return;
    try {
      if (e.currentTarget.hasPointerCapture?.(e.pointerId))
        e.currentTarget.releasePointerCapture(e.pointerId);
    } catch {
      // capture is best-effort
    }
    const fe = toolEvent(e, clickRef.current?.n ?? 1, e.target);
    if (fe) activeTool()?.onPointerUp?.(fe, ctx);
  };

  const onDoubleClick = (e: React.MouseEvent<SVGSVGElement>) => {
    if (spaceRef.current) return;
    const fe = toolEvent(e, e.detail || 2, e.target);
    if (!fe) return;
    const hit = hitTest(e.target);
    activeTool()?.onDoubleClick?.(
      hit.kind === 'field' && downHitRef.current ? { ...fe, target: downHitRef.current } : fe,
      ctx,
    );
  };

  const hasRoleDrag = (e: React.DragEvent): boolean => e.dataTransfer.types.includes(ROLE_DRAG_TYPE);
  const onDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    if (!onPlace || !hasRoleDrag(e)) return;
    e.preventDefault();
    e.dataTransfer.dropEffect = 'copy';
  };
  const onDrop = (e: React.DragEvent<HTMLDivElement>) => {
    const role = e.dataTransfer.getData(ROLE_DRAG_TYPE);
    const vp = viewportRef.current;
    if (!onPlace || !role || !vp) return;
    e.preventDefault();
    const svg = e.currentTarget.querySelector('svg') ?? e.currentTarget;
    const r = svg.getBoundingClientRect();
    const raw = toField({ x: e.clientX - r.left, y: e.clientY - r.top }, vp);
    onPlace(role as Role, snapPoint(raw, { snap, alt: e.altKey }));
  };

  return (
    <div
      data-testid="editor-canvas"
      className="h-full w-full"
      style={{ cursor: pendingRole ? 'copy' : TOOLS[tool]?.cursor }}
      onDragOver={onDragOver}
      onDrop={onDrop}
    >
      <FieldStage
        field={field}
        ballSpot={ballSpot}
        showGrid={showGrid}
        minimapContent={() => <MinimapDots />}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onDoubleClick={onDoubleClick}
      >
        <ViewportProbe target={viewportRef} />
        {companion && <PassiveLayer companion={companion} active={play} />}
        {side === 'defense' && (
          <>
            {!liveOffense && <GhostLayer />}
            <AssignmentLayer targets={liveOffense ? liveAligned : undefined} />
          </>
        )}
        <SlotLayers />
        {liveOffense && tool === 'man' && <LiveOffenseHitLayer offense={liveOffense} />}
        <RouteDraftLayer />
        <MotionOptionDraftLayer />
      </FieldStage>
    </div>
  );
}
