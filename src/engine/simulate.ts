/** simulate() — the pass-play simulation (SRS §8.1, FR-ENG-01..07, D-10, D-11, D-15). Pure. */
import { notImplemented } from '@/domain/notImplemented';
import type { SimInput, SimResult } from '@/domain/types';

/** Simulation keeps running this long after the outcome so the animation shows the ball land. */
export const POST_OUTCOME_TIME = 0.5;

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
export function simulate(input: SimInput): SimResult {
  return notImplemented(`simulate ${input.seed}`);
}
