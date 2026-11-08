import { beforeEach, describe, expect, it } from 'vitest';
import { createDefaultSettings } from '@/domain/defaults';
import { buildRoute, isRouteTemplateId } from '@/domain/routeTree';
import { SCHEMA_VERSION, type Play, type RouteAction } from '@/domain/types';
import { installsRepo, matchupsRepo, playsRepo, settingsRepo } from '../repos';
import { resetDb } from '../schema';
import { SEED_IDS, createSamplePlays } from '../seed/samplePlays';
import { BANGKOK_IDS, createBangkokContent } from '../seed/bangkok';
import { ensureSeeded } from '../seed/seed';
import { createDefaultFields } from '@/domain/field';
import { validatePlay } from '@/domain/validate';

const NOW = 1_800_000_000_000;

function byId(plays: Play[], id: string): Play {
  const p = plays.find((x) => x.id === id);
  if (!p) throw new Error(`missing ${id}`);
  return p;
}

describe('createSamplePlays (FR-DAT-05)', () => {
  const plays = createSamplePlays(NOW);

  it('has 6 plays with the SEED_IDS ids, 3 offense and 3 defense, all 5v5', () => {
    expect(plays.map((p) => p.id).sort()).toEqual(Object.values(SEED_IDS).sort());
    expect(plays.filter((p) => p.side === 'offense')).toHaveLength(3);
    expect(plays.filter((p) => p.side === 'defense')).toHaveLength(3);
    for (const p of plays) {
      expect(p.format).toBe('5v5');
      expect(p.schemaVersion).toBe(SCHEMA_VERSION);
      expect(p.createdAt).toBe(NOW);
      expect(p.updatedAt).toBe(NOW);
      expect(p.players).toHaveLength(5);
    }
  });

  it('offense has one QB and one C, starts at y <= 0; defense has one rusher, starts at y >= 0', () => {
    for (const p of plays.filter((x) => x.side === 'offense')) {
      expect(p.players.filter((s) => s.role === 'QB')).toHaveLength(1);
      expect(p.players.filter((s) => s.role === 'C')).toHaveLength(1);
      for (const s of p.players) expect(s.start.y).toBeLessThanOrEqual(0);
    }
    for (const p of plays.filter((x) => x.side === 'defense')) {
      expect(p.players.filter((s) => s.role === 'R')).toHaveLength(1);
      for (const s of p.players) expect(s.start.y).toBeGreaterThanOrEqual(0);
    }
  });

  it('rusher starts on the rush line and goes on the snap (delay 0)', () => {
    for (const p of plays.filter((x) => x.side === 'defense')) {
      const r = p.players.find((s) => s.role === 'R');
      expect(r?.start.y).toBeGreaterThanOrEqual(7);
      expect(r?.actions).toEqual([{ type: 'rush', path: [{ x: 0, y: -5 }], delay: 0 }]);
      expect(r?.leverage).toBeUndefined();
    }
  });

  it('slot ids are unique, match `${playId}-${label}`, and progression ids exist', () => {
    for (const p of plays) {
      const ids = p.players.map((s) => s.id);
      expect(new Set(ids).size).toBe(ids.length);
      for (const s of p.players) expect(s.id).toBe(`${p.id}-${s.label.toLowerCase()}`);
      for (const id of p.progression ?? []) expect(ids).toContain(id);
      if (p.side === 'offense') expect(p.progression).toHaveLength(4);
      else expect(p.progression).toBeUndefined();
    }
  });

  it('matchRules are omitted', () => {
    for (const p of plays) for (const s of p.players) expect(s.matchRules).toBeUndefined();
  });

  it('every route comes from buildRoute and stays near the field (D-08)', () => {
    for (const p of plays.filter((x) => x.side === 'offense')) {
      for (const s of p.players) {
        for (const a of s.actions) {
          if (a.type !== 'route') continue;
          expect(a.templateId).toBeDefined();
          expect(isRouteTemplateId(a.templateId ?? '')).toBe(true);
          expect(a.path[0]).toBeDefined();
          for (const pt of a.path) {
            expect(Math.abs(pt.x)).toBeLessThanOrEqual(16.5);
            expect(pt.y).toBeLessThanOrEqual(40);
          }
        }
      }
    }
  });

  function route(play: Play, label: string): RouteAction {
    const a = play.players.find((s) => s.label === label)?.actions[0];
    if (!a || a.type !== 'route') throw new Error(`no route for ${label}`);
    return a;
  }

  it('Trips Flood geometry (D-16)', () => {
    const p = byId(plays, SEED_IDS.flood);
    expect(p.name).toBe('Trips Flood');
    expect(p.formation).toBe('Trips');
    expect(p.strength).toBe('right');
    expect(p.tags).toEqual(['beats:cover-3', 'concept:flood']);
    expect(p.players.map((s) => s.label)).toEqual(['Q', 'C', 'Z', 'Y', 'H']);
    expect(p.progression).toEqual(['Y', 'H', 'Z', 'C'].map((l) => `${p.id}-${l.toLowerCase()}`));
    expect(p.players[0]?.actions).toEqual([{ type: 'qbDrop', depth: 2, style: 'shotgun' }]);
    expect(p.players[0]?.start).toEqual({ x: 0, y: -5 });
    expect(p.players[1]?.start).toEqual({ x: 0, y: -0.5 });
    expect(route(p, 'Z')).toEqual(buildRoute('go', { x: 12, y: -1 }, { depth: 15 }));
    expect(route(p, 'Y')).toEqual(buildRoute('out', { x: 8, y: -1 }, { depth: 10 }));
    expect(route(p, 'H')).toEqual(buildRoute('flat', { x: 4.5, y: -1 }, { depth: 1 }));
    const c = buildRoute('drag', { x: 0, y: -0.5 }, { depth: 2, outward: 1 });
    expect(route(p, 'C')).toEqual(c);
    expect(c.path[c.path.length - 1]?.x).toBeLessThan(0); // drags left
  });

  it('Mesh geometry (D-16)', () => {
    const p = byId(plays, SEED_IDS.mesh);
    expect(p.formation).toBe('2x1');
    expect(p.strength).toBe('left');
    expect(p.tags).toEqual(['beats:cover-1', 'beats:man', 'concept:mesh', 'quick']);
    expect(p.players.map((s) => s.label)).toEqual(['Q', 'C', 'X', 'Y', 'Z']);
    expect(p.progression).toEqual(['Y', 'Z', 'C', 'X'].map((l) => `${p.id}-${l.toLowerCase()}`));
    expect(route(p, 'X')).toEqual(buildRoute('go', { x: -12, y: -1 }, { depth: 15 }));
    const y = route(p, 'Y');
    expect(y).toEqual(buildRoute('drag', { x: -6, y: -1 }, { depth: 2 }));
    expect(y.path[y.path.length - 1]?.x).toBeGreaterThan(-6); // runs right
    const z = route(p, 'Z');
    expect(z).toEqual(buildRoute('drag', { x: 12, y: -1 }, { depth: 4 }));
    expect(z.path[z.path.length - 1]?.x).toBeLessThan(12); // runs left
    expect(route(p, 'C')).toEqual(buildRoute('hitch', { x: 0, y: -0.5 }, { depth: 5, outward: -1 }));
  });

  it('Smash geometry (D-16)', () => {
    const p = byId(plays, SEED_IDS.smash);
    expect(p.strength).toBe('right');
    expect(p.tags).toEqual(['beats:cover-2', 'concept:smash']);
    expect(p.players.map((s) => s.label)).toEqual(['Q', 'C', 'Z', 'Y', 'X']);
    expect(p.progression).toEqual(['Y', 'Z', 'X', 'C'].map((l) => `${p.id}-${l.toLowerCase()}`));
    expect(route(p, 'Z')).toEqual(buildRoute('hitch', { x: 12, y: -1 }, { depth: 5 }));
    expect(route(p, 'Y')).toEqual(buildRoute('corner', { x: 7, y: -1 }, { depth: 10 }));
    expect(route(p, 'X')).toEqual(buildRoute('slant', { x: -12, y: -1 }, { depth: 3 }));
    expect(route(p, 'C')).toEqual(buildRoute('flat', { x: 0, y: -0.5 }, { depth: 1, outward: -1 }));
  });

  it('Cover 1 / 2 / 3 specs (D-16)', () => {
    const c1 = byId(plays, SEED_IDS.cover1);
    expect(c1.alignTo).toBe('strength');
    expect(c1.tags).toEqual(['cov:cover-1', 'cov:man']);
    expect(c1.players.map((s) => s.label)).toEqual(['CB1', 'CB2', 'LB', 'FS', 'R1']);
    expect(c1.players[0]?.actions[0]).toEqual({
      type: 'man',
      target: { kind: 'number', side: 'strong', number: 1 },
      technique: 'cushion',
      cushion: 4,
    });
    expect(c1.players[1]?.actions[0]).toMatchObject({ target: { side: 'weak', number: 1 } });
    expect(c1.players[2]?.actions[0]).toEqual({
      type: 'man',
      target: { kind: 'number', side: 'strong', number: 2 },
      technique: 'trail',
    });
    expect(c1.players[3]?.actions[0]).toEqual({
      type: 'zone',
      zone: 'deep-middle',
      dropPoint: { x: 0, y: 14 },
    });

    const c2 = byId(plays, SEED_IDS.cover2);
    expect(c2.alignTo).toBe('ball');
    expect(c2.tags).toEqual(['cov:cover-2', 'cov:zone']);
    expect(c2.players.map((s) => s.label)).toEqual(['CB1', 'CB2', 'S1', 'S2', 'R1']);
    expect(c2.players[0]?.leverage).toBe('outside');
    expect(c2.players[2]?.actions[0]).toEqual({
      type: 'zone',
      zone: 'deep-half-R',
      dropPoint: { x: 7, y: 16 },
    });
    expect(c2.players[3]?.start).toEqual({ x: -7, y: 12 });

    const c3 = byId(plays, SEED_IDS.cover3);
    expect(c3.alignTo).toBe('ball');
    expect(c3.tags).toEqual(['cov:cover-3', 'cov:zone']);
    expect(c3.players.map((s) => s.label)).toEqual(['CB1', 'CB2', 'FS', 'LB', 'R1']);
    expect(c3.players[2]?.actions[0]).toEqual({
      type: 'zone',
      zone: 'deep-third-M',
      dropPoint: { x: 0, y: 16 },
    });
    expect(c3.players[3]?.actions[0]).toEqual({
      type: 'zone',
      zone: 'hook-M',
      dropPoint: { x: 0, y: 6 },
    });
  });
});

describe('ensureSeeded (FR-DAT-05, FR-DAT-04)', () => {
  beforeEach(async () => {
    await resetDb();
  });

  it('seeds default settings and 6 plays into an empty DB', async () => {
    expect(await ensureSeeded(NOW)).toEqual({ seeded: true });
    expect(await settingsRepo.get()).toEqual({ ...createDefaultSettings(), seedVersion: 3 });
    const plays = await playsRepo.list();
    expect(plays).toHaveLength(9);
    expect(plays.map((p) => p.id)).toEqual(expect.arrayContaining(Object.values(SEED_IDS)));
    expect(plays.every((p) => p.updatedAt === NOW)).toBe(true);
  });

  it('is idempotent: a second call writes nothing', async () => {
    await ensureSeeded(NOW);
    expect(await ensureSeeded(NOW + 5000)).toEqual({ seeded: false });
    const plays = await playsRepo.list();
    expect(plays).toHaveLength(9);
    expect(plays.every((p) => p.updatedAt === NOW)).toBe(true);
  });

  it('does not re-add samples when settings exist but plays were deleted', async () => {
    await settingsRepo.put({ ...createDefaultSettings(), seedVersion: 2 });
    expect(await ensureSeeded(NOW)).toEqual({ seeded: false });
    expect(await playsRepo.count()).toBe(0);
  });

  it('does not overwrite existing settings', async () => {
    const custom = { ...createDefaultSettings(), defaultFormat: '7v7' as const };
    await settingsRepo.put(custom);
    await ensureSeeded(NOW);
    expect((await settingsRepo.get())?.defaultFormat).toBe('7v7');
  });
});

const FIELD5 = createDefaultFields()['5v5'];
const RUSH = 'Zone: Bunch Killer (Bangkok) Rush';
const SPY = 'Zone: Bunch Killer (Bangkok) No Rush Spy';

describe('Bunch Killer (Bangkok) content (D-42)', () => {
  const c = createBangkokContent(NOW, FIELD5);

  it('has the Bunch Tight offense and both defenses with the exact names', () => {
    expect(c.plays.map((p) => p.id)).toEqual([BANGKOK_IDS.bunchTight, BANGKOK_IDS.rush, BANGKOK_IDS.spy]);
    expect(c.plays.map((p) => p.name)).toEqual(['Bunch Tight', RUSH, SPY]);
    const bunch = c.plays[0]!;
    expect(bunch.players.map((s) => [s.label, s.start])).toEqual([
      ['Q', { x: 0, y: -5 }],
      ['X', { x: -3, y: -1 }],
      ['C', { x: 0, y: -0.5 }],
      ['Y', { x: 3, y: -1 }],
      ['Z', { x: 6, y: -1 }],
    ]);
  });

  it('area-match roles and starts follow the diagram', () => {
    for (const d of [c.plays[1]!, c.plays[2]!]) {
      const roles = Object.fromEntries(d.players.map((s) => [s.label, s.areaMatch?.role ?? null]));
      expect(roles).toEqual({ CB2: 'corner', LB: 'inside', S: 'inside', CB1: 'corner', R: null });
      expect(d.players.find((s) => s.label === 'CB1')?.start).toEqual({ x: 9, y: 3.5 });
    }
    const rush = c.plays[1]!.players.find((s) => s.label === 'R')!;
    expect(rush.start).toEqual({ x: -7, y: 7 });
    expect(rush.actions).toEqual([{ type: 'rush', path: [{ x: 0, y: -5 }], delay: 0 }]);
    const spy = c.plays[2]!.players.find((s) => s.label === 'R')!;
    expect(spy.start).toEqual({ x: 0.5, y: 7 });
    expect(spy.actions[0]?.type).toBe('zone');
  });

  it('the Spy zone runs from just past the LOS to the back of the end zone (ball on the 5)', () => {
    const spy = c.plays[2]!.players.find((s) => s.label === 'R')!;
    const zone = spy.actions[0];
    if (zone?.type !== 'zone' || typeof zone.zone === 'string') throw new Error('no polygon zone');
    const ys = zone.zone.polygon.map((p) => p.y);
    expect(Math.min(...ys)).toBe(1.5);
    expect(Math.max(...ys)).toBe(5 + FIELD5.endZoneDepth);
    expect(zone.zone.polygon.map((p) => p.x)).toEqual([-6, 7, 7, -6]);
  });

  it('seeded defense and offense plays have no validate warnings', () => {
    for (const p of c.plays) expect(validatePlay(p, FIELD5)).toEqual([]);
  });

  it('the install lists the 4 red-zone matchups in order, ball on the 5', () => {
    expect(c.install.id).toBe(BANGKOK_IDS.install);
    expect(c.install.name).toBe('Red Zone – Bunch Killer (Bangkok)');
    expect(c.install.items.map((i) => [i.matchupId, i.order])).toEqual(
      BANGKOK_IDS.matchups.map((id, i) => [id, i]),
    );
    expect(c.matchups.map((m) => [m.defensePlayId, m.offensePlayId])).toEqual([
      [BANGKOK_IDS.rush, BANGKOK_IDS.bunchTight],
      [BANGKOK_IDS.spy, BANGKOK_IDS.bunchTight],
      [BANGKOK_IDS.rush, SEED_IDS.flood],
      [BANGKOK_IDS.spy, SEED_IDS.flood],
    ]);
    for (const m of c.matchups) expect(m.ballSpot).toEqual({ x: 0, yardLine: 45 });
  });
});

describe('seed v2 (D-42)', () => {
  beforeEach(async () => {
    await resetDb();
  });

  it('a fresh seed writes the Bangkok content and seedVersion 3', async () => {
    await ensureSeeded(NOW);
    expect((await settingsRepo.get())?.seedVersion).toBe(3);
    expect(await playsRepo.get(BANGKOK_IDS.rush)).toBeDefined();
    expect((await installsRepo.get(BANGKOK_IDS.install))?.items).toHaveLength(4);
    for (const id of BANGKOK_IDS.matchups) expect(await matchupsRepo.get(id)).toBeDefined();
  });

  it('a v1 database (no seedVersion) gets the v2 content once', async () => {
    const v1 = createDefaultSettings();
    await settingsRepo.put(v1);
    for (const p of createSamplePlays(NOW)) await playsRepo.put(p);
    expect(await ensureSeeded(NOW)).toEqual({ seeded: false });
    expect(await playsRepo.count()).toBe(9);
    expect(await installsRepo.get(BANGKOK_IDS.install)).toBeDefined();
    expect((await settingsRepo.get())?.seedVersion).toBe(3);
  });

  it('does not overwrite or re-add after v2', async () => {
    const v1 = createDefaultSettings();
    await settingsRepo.put(v1);
    await ensureSeeded(NOW);
    const rush = (await playsRepo.get(BANGKOK_IDS.rush))!;
    await playsRepo.put({ ...rush, name: 'My Bangkok' });
    await playsRepo.remove(BANGKOK_IDS.spy);
    await ensureSeeded(NOW + 1);
    expect((await playsRepo.get(BANGKOK_IDS.rush))?.name).toBe('My Bangkok');
    expect(await playsRepo.get(BANGKOK_IDS.spy)).toBeUndefined();
  });

  it('a v1 database keeps a user record that already uses a v2 id', async () => {
    const v1 = createDefaultSettings();
    await settingsRepo.put(v1);
    const mine = { ...createBangkokContent(NOW, FIELD5).plays[1]!, name: 'Mine' };
    await playsRepo.put(mine);
    await ensureSeeded(NOW);
    expect((await playsRepo.get(BANGKOK_IDS.rush))?.name).toBe('Mine');
  });

  it('a v1 database without Trips Flood skips the matchups that need it', async () => {
    await settingsRepo.put(createDefaultSettings());
    await ensureSeeded(NOW);
    const install = (await installsRepo.get(BANGKOK_IDS.install))!;
    expect(install.items.map((i) => i.matchupId)).toEqual(BANGKOK_IDS.matchups.slice(0, 2));
    expect(await matchupsRepo.get(BANGKOK_IDS.matchups[2])).toBeUndefined();
  });

  it('a v1 record missing field configs still gets the v2 content (normalized)', async () => {
    const v1 = createDefaultSettings() as unknown as Record<string, unknown>;
    delete v1.fields;
    await settingsRepo.put(v1 as unknown as ReturnType<typeof createDefaultSettings>);
    for (const p of createSamplePlays(NOW)) await playsRepo.put(p);
    await ensureSeeded(NOW);
    expect((await matchupsRepo.get(BANGKOK_IDS.matchups[0]))?.ballSpot).toEqual({ x: 0, yardLine: 45 });
  });
});

/** The Spy play as seed v2 wrote it: R's zone stopped 10 yd past the LOS. */
function spyV2(): Play {
  const spy = createBangkokContent(NOW, FIELD5).plays[2]!;
  return {
    ...spy,
    players: spy.players.map((s) =>
      s.label !== 'R'
        ? s
        : {
            ...s,
            actions: [
              {
                type: 'zone',
                zone: {
                  polygon: [
                    { x: -6, y: 1.5 },
                    { x: 7, y: 1.5 },
                    { x: 7, y: 10 },
                    { x: -6, y: 10 },
                  ],
                },
                dropPoint: { x: 0.5, y: 5 },
              },
            ],
          },
    ),
  };
}

const spyR = async (): Promise<Play['players'][number] | undefined> =>
  (await playsRepo.get(BANGKOK_IDS.spy))?.players.find((s) => s.label === 'R');

describe('seed v3: deeper Spy zone (D-44)', () => {
  beforeEach(async () => {
    await resetDb();
  });

  it('a v2 database with the untouched Spy play gets the zone to the back of the end zone', async () => {
    await settingsRepo.put({ ...createDefaultSettings(), seedVersion: 2 });
    await playsRepo.put(spyV2());
    await ensureSeeded(NOW + 1);
    const fresh = createBangkokContent(NOW, FIELD5).plays[2]!.players.find((s) => s.label === 'R')!;
    expect((await spyR())?.actions).toEqual(fresh.actions);
    expect((await settingsRepo.get())?.seedVersion).toBe(3);
  });

  it('keeps a Spy zone the user edited, and the rest of the play', async () => {
    await settingsRepo.put({ ...createDefaultSettings(), seedVersion: 2 });
    const mine = spyV2();
    const r = mine.players.find((s) => s.label === 'R')!;
    const edited: Play = {
      ...mine,
      name: 'My Spy',
      players: mine.players.map((s) =>
        s === r ? { ...s, actions: [{ type: 'zone', zone: 'hook-M', dropPoint: { x: 0, y: 6 } }] } : s,
      ),
    };
    await playsRepo.put(edited);
    await ensureSeeded(NOW + 1);
    expect((await spyR())?.actions).toEqual([{ type: 'zone', zone: 'hook-M', dropPoint: { x: 0, y: 6 } }]);
    expect((await playsRepo.get(BANGKOK_IDS.spy))?.name).toBe('My Spy');
  });

  it('a renamed Spy play with the old zone still gets the deeper zone and keeps its name', async () => {
    await settingsRepo.put({ ...createDefaultSettings(), seedVersion: 2 });
    await playsRepo.put({ ...spyV2(), name: 'My Spy' });
    await ensureSeeded(NOW + 1);
    const ys = (await spyR())?.actions[0];
    if (ys?.type !== 'zone' || typeof ys.zone === 'string') throw new Error('no polygon zone');
    expect(Math.max(...ys.zone.polygon.map((p) => p.y))).toBe(15);
    expect((await playsRepo.get(BANGKOK_IDS.spy))?.name).toBe('My Spy');
  });

  it('a deleted Spy play is not re-added', async () => {
    await settingsRepo.put({ ...createDefaultSettings(), seedVersion: 2 });
    await ensureSeeded(NOW + 1);
    expect(await playsRepo.get(BANGKOK_IDS.spy)).toBeUndefined();
    expect((await settingsRepo.get())?.seedVersion).toBe(3);
  });
});
