/** simulate() — the pass-play simulation (SRS §8.1, FR-ENG-01..07, D-10, D-11, D-15). Pure. */
import { distance } from '@/domain/geometry';
import { resolveReceiverRef } from '@/domain/numbering';
import { outwardSign } from '@/domain/routeTree';
import type {
  BallState,
  DefenderDebug,
  Frame,
  FramePlayer,
  ID,
  Outcome,
  Play,
  PlayerSlot,
  Point,
  QbDropAction,
  SimEvent,
  SimInput,
  SimResult,
} from '@/domain/types';
import {
  createAnticipation,
  createTellState,
  type AnticipationModel,
  type TellState,
  priorKeyFor,
} from './anticipation';
import { applyThrowError, ballPosAt, launchBall } from './ball';
import { frameAt } from './frames';
import { clampToSidelines, separateTeammates, stepMovement } from './movement';
import { createManDefender } from './agents/manDefender';
import { createQbAgent, type QbAgent } from './agents/qb';
import { createReceiverAgent } from './agents/receiver';
import type { DefenderAgent } from './agents/common';
import { createRuleDefender } from './agents/ruleDefender';
import { createRusherAgent } from './agents/rusher';
import { createZoneDefender } from './agents/zoneDefender';
import { computeMetrics } from './metrics';
import { resolveArrival } from './outcome';
import { buildPerception, type Roster, type Viewer } from './perception';
import { prepareSim } from './prepare';
import { previewOffense } from './preview';
import type { ReceiverInfo } from './readModel';
import { forkRng } from './rng';
import type { Agent, AgentIntent, AgentState, Kinematic, MoveLimits, Perception, Rng } from './types';
import { createHistory, pushSnapshot, type PlayerSnapshot, type Snapshot } from './world';

/** Simulation keeps running this long after the outcome so the animation shows the ball land. */
export const POST_OUTCOME_TIME = 0.5;

const FRAME_RATE = 30;
const TIME_EPS = 1e-9;
/** Time constant (s) of the seen-speed average a deceleration tell is measured against. */
const TELL_EMA_TAU = 0.2;
const STAND: AgentIntent = { heading: { x: 0, y: 0 }, speed: 0, state: 'idle' };

interface Entity {
  id: ID;
  slot: PlayerSlot;
  agent: Agent;
  rng: Rng;
  state: AgentState;
  kin: Kinematic;
  limits: MoveLimits;
  viewer: Viewer;
  isRusher: boolean;
  frameState: string;
  intent: AgentIntent;
  /** Deceleration-tell memory per target (defenders, anticipation > 0). */
  tells?: Map<ID, { state: TellState; ema: number | null }>;
  tellRng?: Rng;
  /** Coverage agent with debug accessors (man / zone defenders). */
  coverage?: DefenderAgent;
  /** Last perception built for this entity (debug output only). */
  lastP?: Perception;
}

type Pending = { targetId: ID; aim: Point; tRelease: number } | { targetId: null; tRelease: number };

function standStill(id: ID): Agent {
  return { id, step: () => STAND };
}

/**
 * Loop at tuning.simDt from t = 0 to tuning.maxTime (or outcome + POST_OUTCOME_TIME):
 * 1. prepareSim(input); create one agent per slot (QB → createQbAgent with plannedPos from
 *    previewOffense(offense) frames; receivers; defenders by binding; 'none' → stand still) and one
 *    forkRng(seed, 'agent:' + id) per agent. Event 'snap' at 0.
 * 2. Each tick: every agent gets buildPerception(history, roster, viewer{reaction, focus from its last
 *    intent}, t) and returns an intent (agents never see the world).
 * 3. Movement: stepMovement + clampToSidelines; non-rusher defenders y ≥ 0 while the ball is held
 *    (§8.6); QB y ≤ 0 (qbCanCrossLOS false); separateTeammates per side (D-10).
 * 4. QB throw intent → 'throwStart' event, qb.throwStarted = true, release timer = stats.release; when
 *    it elapses: landing = applyThrowError(...), launchBall → 'throw' event, isBallTarget for the target.
 *    throwaway intent → outcome { kind: 'throwaway', t + release } (event 'throwaway').
 * 5. Sack: ball held (incl. during the release motion) and any rusher within sackRadius of the QB →
 *    outcome sack (event 'sack'). Timeout: t ≥ passClock and ball not out → outcome timeout.
 * 6. Ball arrival (t ≥ tLand): nearest receiver within catchRadius, nearest defender within contestRadius,
 *    resolveArrival with forkRng(seed, 'catch') → complete (yards = landing.y) / incomplete / deflected /
 *    intercepted; events 'catch' | 'drop' | 'incomplete' | 'deflect' | 'int'. Ball → dead.
 * 7. Record a snapshot every tick (history) and a Frame every 1/30 s (t = k/30); then computeMetrics.
 * NFR-PERF-02: 5v5 6 s < 20 ms — avoid per-tick allocations of large arrays; history snapshots are
 * required but keep them flat.
 */
export function simulate(input: SimInput, opts: { debug?: boolean } = {}): SimResult {
  const debugOn = opts.debug === true;
  const { tuning, seed } = input;
  const dt = tuning.simDt;
  const prepared = prepareSim(input);
  const { info, bindings, stats, plans, options, motions, snapStart, numbering } = prepared;
  const field = input.field;
  // Pre-snap motion: the clock starts at t = −preTicks × dt; t = 0 is exactly the snap tick.
  const preTicks = Math.round(prepared.motionDuration / dt);
  const tStart = 0 - preTicks * dt;
  const events: SimEvent[] = [];
  for (const slot of input.offense.players) {
    const m = motions[slot.id];
    if (m) events.push({ t: tStart, type: 'motion', playerId: slot.id, data: { duration: m.duration } });
  }
  events.push({ t: 0, type: 'snap' });

  const qbSlot =
    prepared.qbId === null ? undefined : input.offense.players.find((s) => s.id === prepared.qbId);
  const qbId = qbSlot?.id ?? null;

  // QB's knowledge of its own team's plan (offense-only kinematic run).
  const preview = previewOffense({
    play: input.offense as Play,
    field,
    ballSpot: input.ballSpot,
    tuning,
    stats,
    duration: tuning.maxTime,
  });
  const plannedPos = (id: ID, t: number): Point | undefined => {
    const f = frameAt(preview.frames, t);
    const p = f?.players[id];
    return p ? { x: p.pos.x, y: p.pos.y } : undefined;
  };

  // §8.7 anticipation: receivers as the defense can read them at the snap; the oracle (a > 0.5 only)
  // is the offense-only preview run, handed in as a function so agents never see the opponent's play.
  const strongSide = numbering.strongSide;
  // QB read model inputs (D-22): first break per receiver (option stem end counts) and the drop end.
  const breakTimes: Record<ID, number> = {};
  for (const ev of preview.events) {
    if ((ev.type !== 'break' && ev.type !== 'optionChoice') || ev.playerId === undefined) continue;
    if (ev.t < 0) continue;
    const prev = breakTimes[ev.playerId];
    if (prev === undefined || ev.t < prev) breakTimes[ev.playerId] = ev.t;
  }
  const dropOf = qbSlot?.actions.find((a): a is QbDropAction => a.type === 'qbDrop') ?? null;
  let dropEnd = 0;
  if (qbSlot && dropOf) {
    const target = { x: qbSlot.start.x, y: Math.min(0, qbSlot.start.y - dropOf.depth) };
    // Preview frames keep the 'drop' label after arrival, so detect arrival by position.
    const arrived = preview.frames.find((f) => {
      const q = f.players[qbSlot.id];
      return f.t > 0 && q !== undefined && distance(q.pos, target) < 0.1;
    });
    dropEnd = arrived?.t ?? tuning.maxTime;
  }
  const anticipation: AnticipationModel = createAnticipation({
    a: input.anticipation,
    priors: input.routePriors,
    receivers: input.offense.players
      .filter((s) => s.id !== qbId)
      .map((s) => {
        const ref = numbering.refs[s.id];
        const at = snapStart[s.id] as Point;
        const outward = outwardSign(at, strongSide);
        return {
          id: s.id,
          start: { x: at.x, y: at.y },
          outward,
          key: priorKeyFor(
            ref && ref.kind === 'number' ? ref.number : null,
            numbering.rbId === s.id,
            outward === 1 ? info.maxX - at.x : at.x - info.minX,
          ),
          side: at.x >= 0 ? ('right' as const) : ('left' as const),
        };
      }),
    oracle:
      input.anticipation > 0.5
        ? (id, t) => {
            const p = frameAt(preview.frames, t)?.players[id];
            return p ? { x: p.pos.x, y: p.pos.y } : undefined;
          }
        : null,
  });

  // ---- entities (slot order: offense then defense) ----
  const entities: Entity[] = [];
  const makeEntity = (slot: PlayerSlot, side: 'offense' | 'defense', agent: Agent): Entity => {
    const s = stats[slot.id] as AgentState['stats'];
    const kin: Kinematic = { pos: { x: slot.start.x, y: slot.start.y }, vel: { x: 0, y: 0 } };
    const e: Entity = {
      id: slot.id,
      slot,
      agent,
      rng: forkRng(seed, 'agent:' + slot.id),
      kin,
      state: {
        id: slot.id,
        side,
        role: slot.role,
        label: slot.label,
        stats: s,
        t: 0,
        hasBall: slot.id === qbId,
        isBallTarget: false,
        pos: kin.pos,
        vel: kin.vel,
      },
      limits: { speed: s.speed, accel: s.accel, cutLoss: s.cutLoss },
      viewer: { id: slot.id, reaction: s.reaction },
      isRusher: bindings[slot.id]?.kind === 'rush',
      frameState: 'idle',
      intent: STAND,
    };
    entities.push(e);
    return e;
  };

  let qbAgent: QbAgent | undefined;
  for (const slot of input.offense.players) {
    if (slot.id === qbId) {
      const receivers: ReceiverInfo[] = input.offense.players
        .filter((s) => s.id !== qbId)
        .map((s) => {
          const at = snapStart[s.id] as Point;
          const brk = breakTimes[s.id];
          return { id: s.id, pos: { x: at.x, y: at.y }, ...(brk !== undefined ? { breakTime: brk } : {}) };
        });
      qbAgent = createQbAgent({
        plan: {
          id: slot.id,
          start: { x: slot.start.x, y: slot.start.y },
          drop: dropOf,
          progression: [...(input.offense.progression ?? [])],
          ...(input.offense.readPlan ? { readPlan: input.offense.readPlan } : {}),
          receivers,
          strongSide,
          dropEnd,
          plannedPos,
        },
        info,
      });
      makeEntity(slot, 'offense', qbAgent);
    } else {
      makeEntity(
        slot,
        'offense',
        createReceiverAgent({
          id: slot.id,
          plan: plans[slot.id] ?? null,
          info,
          motion: motions[slot.id] ?? null,
          option: options[slot.id] ?? null,
        }),
      );
    }
  }
  for (const slot of input.defense.players) {
    const b = bindings[slot.id];
    let agent: Agent;
    let coverage: DefenderAgent | undefined;
    const rules = slot.matchRules ?? [];
    if ((b?.kind === 'man' || b?.kind === 'zone') && rules.length > 0) {
      coverage = createRuleDefender({
        id: slot.id,
        initial: b,
        rules,
        leverage: slot.leverage,
        info,
        anticipation,
        resolveRef: (ref) => resolveReceiverRef(ref, numbering),
        strongSign: numbering.strongSide === 'right' ? 1 : -1,
      });
      agent = coverage;
    } else if (b?.kind === 'man') {
      agent = coverage = createManDefender({
        id: slot.id,
        targetId: b.targetId,
        technique: b.technique,
        cushion: b.cushion,
        leverage: slot.leverage,
        info,
        anticipation,
      });
    } else if (b?.kind === 'zone') {
      agent = coverage = createZoneDefender({
        id: slot.id,
        polygon: b.polygon,
        dropPoint: b.dropPoint,
        deep: b.deep,
        info,
        anticipation,
      });
    } else if (b?.kind === 'rush') {
      agent = createRusherAgent({
        id: slot.id,
        start: { x: slot.start.x, y: slot.start.y },
        path: b.path,
        delay: b.delay,
        info,
      });
    } else {
      agent = standStill(slot.id);
    }
    const de = makeEntity(slot, 'defense', agent);
    if (coverage) de.coverage = coverage;
    if (anticipation.readingEnabled && b && (b.kind === 'man' || b.kind === 'zone')) {
      const tells = new Map<ID, { state: TellState; ema: number | null }>();
      de.tells = tells;
      de.tellRng = forkRng(seed, 'tell:' + slot.id);
      de.viewer.delayFactor = (targetId) => tells.get(targetId)?.state.factor ?? 1;
    }
  }

  const roster: Roster = { players: {} };
  for (const e of entities) {
    const num = numbering.refs[e.id];
    roster.players[e.id] = {
      side: e.state.side,
      role: e.slot.role,
      ...(e.state.side === 'offense' && num ? { number: num } : {}),
    };
  }

  const qb = entities.find((e) => e.id === qbId);
  const rushers = entities.filter((e) => e.isRusher);
  const offenseEntities = entities.filter((e) => e.state.side === 'offense');
  const defenseEntities = entities.filter((e) => e.state.side === 'defense');
  const receiverEntities = offenseEntities.filter((e) => e.id !== qbId);

  // ---- mutable world ----
  let ball: BallState = qb
    ? { state: 'held', pos: qb.kin.pos, carrierId: qb.id }
    : { state: 'held', pos: { x: 0, y: 0 } };
  let throwStarted = false;
  let eyeTarget: ID | undefined;
  let qbDebug: Frame['qb'];
  const debugFrames: Record<ID, DefenderDebug>[] = [];
  let pending: Pending | null = null;
  let outcome: Outcome | null = null;
  let tThrow: number | undefined;
  const throwRng = forkRng(seed, 'throw');
  const catchRng = forkRng(seed, 'catch');
  const losClamp = !field.qbCanCrossLOS;

  const snapshotAt = (t: number): Snapshot => {
    const players: Record<ID, PlayerSnapshot> = {};
    for (const e of entities) players[e.id] = e.kin;
    let b: BallState;
    if (ball.state === 'held') {
      b = qb ? { state: 'held', pos: qb.kin.pos, carrierId: qb.id } : ball;
    } else if (ball.state === 'inAir') {
      b = { ...ball, pos: ballPosAt(ball, t) };
    } else b = ball;
    const snap: Snapshot = { t, players, ball: b, qb: { id: qbId, throwStarted } };
    if (eyeTarget !== undefined) snap.qb.eyeTarget = eyeTarget;
    return snap;
  };

  const history = createHistory(snapshotAt(tStart));

  const frames: Frame[] = [];
  const pushFrame = (t: number): void => {
    const players: Record<ID, FramePlayer> = {};
    for (const e of entities) {
      players[e.id] = {
        pos: { x: e.kin.pos.x, y: e.kin.pos.y },
        vel: { x: e.kin.vel.x, y: e.kin.vel.y },
        state: e.frameState,
      };
    }
    let fb: BallState;
    if (ball.state === 'held') {
      fb = { state: 'held', pos: qb ? { x: qb.kin.pos.x, y: qb.kin.pos.y } : { x: 0, y: 0 } };
      if (qb) fb.carrierId = qb.id;
    } else if (ball.state === 'inAir') {
      fb = { ...ball, pos: ballPosAt(ball, t) };
    } else {
      fb = { ...ball, pos: ball.landing ? { ...ball.landing } : { x: ball.pos.x, y: ball.pos.y } };
    }
    const frame: Frame = { t, players, ball: fb };
    if (eyeTarget !== undefined) frame.eyeTarget = eyeTarget;
    if (qbDebug !== undefined) frame.qb = qbDebug;
    frames.push(frame);
    if (debugOn) {
      const defs: Record<ID, DefenderDebug> = {};
      for (const e of defenseEntities) {
        const seen: Record<ID, Point> = {};
        for (const o of e.lastP?.others ?? []) {
          if (o.side === 'offense') seen[o.id] = { x: o.pos.x, y: o.pos.y };
        }
        const d: DefenderDebug = { seen };
        const aim = e.coverage?.lastAim;
        if (aim) d.aim = { x: aim.x, y: aim.y };
        const tid = e.coverage?.targetId;
        if (tid) d.targetId = tid;
        defs[e.id] = d;
      }
      debugFrames.push(defs);
    }
  };

  const constrain = (e: Entity, k: Kinematic, ballHeld: boolean): Kinematic => {
    let out = clampToSidelines(k, info.minX, info.maxX);
    const px = out.pos.x;
    let py = out.pos.y;
    const vx = out.vel.x;
    let vy = out.vel.y;
    let changed = false;
    if (py > info.maxY) {
      py = info.maxY;
      vy = Math.min(vy, 0);
      changed = true;
    } else if (py < info.minY) {
      py = info.minY;
      vy = Math.max(vy, 0);
      changed = true;
    }
    if (e.id === qbId && losClamp && py > 0) {
      py = 0;
      vy = Math.min(vy, 0);
      changed = true;
    }
    if (ballHeld && e.state.side === 'defense' && !e.isRusher && py < 0) {
      py = 0;
      vy = Math.max(vy, 0);
      changed = true;
    }
    if (changed) out = { pos: { x: px, y: py }, vel: { x: vx, y: vy } };
    return out;
  };

  const finish = (o: Outcome, landing?: Point): void => {
    outcome = o;
    ball = {
      state: 'dead',
      pos: landing ? { ...landing } : qb ? { x: qb.kin.pos.x, y: qb.kin.pos.y } : { x: 0, y: 0 },
    };
    if (landing) ball.landing = { ...landing };
  };

  let nextFrame = 0;
  for (let tick = 0; ; tick++) {
    const t = (tick - preTicks) * dt;
    const preSnap = t < -TIME_EPS;

    // ---- 2. agents decide ----
    let eyeNext = eyeTarget;
    let throwIntent: AgentIntent | null = null;
    for (const e of entities) {
      e.state.t = t;
      // Pre-snap only offense receivers act (motion); the QB and the defense stand.
      if (preSnap && (e.state.side === 'defense' || e === qb)) {
        e.frameState = 'idle';
        e.intent = STAND;
        continue;
      }
      const p = buildPerception(history, roster, e.viewer, t, tuning.leverageReactionFactor);
      if (debugOn) e.lastP = p;
      const intent = e.agent.step(e.state, p, dt, e.rng);
      if (e.tells && e.tellRng) {
        for (const o of p.others) {
          if (o.side !== 'offense' || o.id === qbId) continue;
          let tell = e.tells.get(o.id);
          if (!tell) {
            tell = { state: createTellState(), ema: null };
            e.tells.set(o.id, tell);
          }
          const speed = Math.hypot(o.vel.x, o.vel.y);
          anticipation.tellFactor(tell.state, o, tell.ema, e.state.stats.iq, e.tellRng);
          tell.ema = tell.ema === null ? speed : tell.ema + (speed - tell.ema) * (dt / (dt + TELL_EMA_TAU));
        }
      }
      e.frameState = intent.state ?? 'idle';
      if (intent.focus) e.viewer.focus = intent.focus;
      if (intent.events) {
        for (const ev of intent.events) {
          events.push({ ...ev, t, playerId: ev.playerId ?? e.id });
        }
      }
      if (e === qb) {
        if (intent.eyeTarget !== undefined) eyeNext = intent.eyeTarget;
        if (intent.qbDebug !== undefined) qbDebug = intent.qbDebug;
        if (intent.throw || intent.throwaway) throwIntent = intent;
      }
      e.intent = intent;
    }
    eyeTarget = eyeNext;
    if (tick === 0) {
      const k0 = 0 - Math.floor(preTicks * dt * FRAME_RATE + TIME_EPS);
      pushFrame(k0 / FRAME_RATE);
      nextFrame = k0 + 1;
    }

    // ---- 4a. QB decision ----
    if (qb && throwIntent && pending === null && ball.state === 'held' && outcome === null) {
      const ti = throwIntent as AgentIntent;
      const release = qb.state.stats.release;
      if (ti.throw) {
        pending = { targetId: ti.throw.targetId, aim: ti.throw.aim, tRelease: t + release };
        events.push({ t, type: 'throwStart', playerId: qb.id, targetId: ti.throw.targetId });
      } else {
        pending = { targetId: null, tRelease: t + release };
      }
      throwStarted = true;
    }

    // ---- 3. movement ----
    const heldNow = ball.state === 'held';
    for (const e of entities) {
      e.kin = constrain(e, stepMovement(e.kin, e.intent, e.limits, dt), heldNow);
    }
    for (const group of [offenseEntities, defenseEntities]) {
      const positions: Record<ID, Point> = {};
      for (const e of group) positions[e.id] = e.kin.pos;
      const apart = separateTeammates(positions);
      for (const e of group) {
        const np = apart[e.id] as Point;
        if (np.x !== e.kin.pos.x || np.y !== e.kin.pos.y) {
          e.kin = constrain(e, { pos: np, vel: e.kin.vel }, heldNow);
        }
      }
    }
    for (const e of entities) {
      e.state.pos = e.kin.pos;
      e.state.vel = e.kin.vel;
    }
    const time = (tick + 1 - preTicks) * dt;

    // ---- 4b. release ----
    if (qb && pending !== null && ball.state === 'held' && time >= pending.tRelease - TIME_EPS) {
      if (pending.targetId !== null) {
        const from = { x: qb.kin.pos.x, y: qb.kin.pos.y };
        const landing = applyThrowError(from, pending.aim, qb.state.stats.accuracy, tuning, throwRng);
        ball = launchBall(from, landing, time, pending.targetId, tuning);
        tThrow = time;
        qb.state.hasBall = false;
        const target = entities.find((e) => e.id === pending?.targetId);
        if (target) target.state.isBallTarget = true;
        events.push({ t: time, type: 'throw', playerId: qb.id, targetId: pending.targetId });
      } else {
        events.push({ t: time, type: 'throwaway', playerId: qb.id });
        qb.state.hasBall = false;
        finish({ kind: 'throwaway', t: time });
      }
      pending = null;
    }

    // ---- 5. sack / timeout ----
    if (outcome === null && ball.state === 'held') {
      if (qb) {
        for (const r of rushers) {
          if (distance(r.kin.pos, qb.kin.pos) <= tuning.sackRadius) {
            events.push({ t: time, type: 'sack', playerId: r.id, targetId: qb.id });
            qb.state.hasBall = false;
            finish({ kind: 'sack', t: time });
            break;
          }
        }
      }
      if (outcome === null && pending === null && time >= field.passClock - TIME_EPS) {
        events.push({ t: time, type: 'timeout' });
        finish({ kind: 'timeout', t: time });
      }
    }

    // ---- 6. arrival ----
    if (outcome === null && ball.state === 'inAir' && time >= (ball.tLand ?? 0) - TIME_EPS) {
      const landing = ball.landing as Point;
      const targetId = ball.targetId as ID;
      let rec: { id: ID; dist: number; hands: number } | null = null;
      for (const e of receiverEntities) {
        const d = distance(e.kin.pos, landing);
        if (d <= tuning.catchRadius && (rec === null || d < rec.dist)) {
          rec = { id: e.id, dist: d, hands: e.state.stats.hands };
        }
      }
      let def: { id: ID; dist: number; ballSkills: number } | null = null;
      for (const e of defenseEntities) {
        const d = distance(e.kin.pos, landing);
        if (d <= tuning.contestRadius && (def === null || d < def.dist)) {
          def = { id: e.id, dist: d, ballSkills: e.state.stats.ballSkills };
        }
      }
      const res = resolveArrival({ receiver: rec, defender: def }, tuning, catchRng);
      if (res === 'complete' && rec) {
        events.push({ t: time, type: 'catch', playerId: rec.id, targetId });
        finish({ kind: 'complete', targetId: rec.id, yards: landing.y, t: time }, landing);
      } else if (res === 'intercepted' && def) {
        events.push({ t: time, type: 'int', playerId: def.id, targetId });
        finish({ kind: 'intercepted', targetId, t: time }, landing);
      } else if (res === 'deflected' && def) {
        events.push({ t: time, type: 'deflect', playerId: def.id, targetId });
        finish({ kind: 'deflected', targetId, t: time }, landing);
      } else {
        events.push(
          rec
            ? { t: time, type: 'drop', playerId: rec.id, targetId }
            : { t: time, type: 'incomplete', targetId },
        );
        finish({ kind: 'incomplete', targetId, t: time }, landing);
      }
    }

    // ---- 7. history + frames ----
    const timeOut = time >= tuning.maxTime - TIME_EPS;
    if (outcome === null && timeOut) {
      if (ball.state === 'inAir') {
        const targetId = ball.targetId as ID;
        events.push({ t: time, type: 'incomplete', targetId });
        finish({ kind: 'incomplete', targetId, t: time }, ball.landing);
      } else {
        events.push({ t: time, type: 'timeout' });
        finish({ kind: 'timeout', t: time });
      }
    }
    pushSnapshot(history, snapshotAt(time));
    while (nextFrame / FRAME_RATE <= time + TIME_EPS) {
      pushFrame(nextFrame / FRAME_RATE);
      nextFrame += 1;
    }
    if (timeOut) break;
    if (outcome !== null && time >= (outcome as Outcome).t + POST_OUTCOME_TIME - TIME_EPS) break;
  }

  const metrics = computeMetrics(
    frames,
    receiverEntities.map((e) => e.id),
    defenseEntities.map((e) => e.id),
    tThrow,
    tuning.separationOpen,
  );

  const dec = qbAgent?.decision;
  metrics.reads = {
    mode: input.offense.readPlan?.mode ?? 'progression',
    windows: qbAgent?.windows ?? [],
    decision: dec ?? { kind: 'none', t: outcome === null ? 0 : (outcome as Outcome).t, readIndex: null },
  };

  const result: SimResult = {
    frames,
    events,
    outcome: outcome as unknown as Outcome,
    metrics,
    warnings: [...prepared.warnings],
  };
  if (debugOn) result.debug = { defenders: debugFrames };
  return result;
}
