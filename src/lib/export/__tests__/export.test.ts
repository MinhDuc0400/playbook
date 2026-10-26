import { beforeEach, describe, expect, it, vi } from 'vitest';
import { makeAthlete, makeInstall, makeLineup, makeMatchup, makePlay } from '@/db/__tests__/fixtures';
import { athletesRepo, installsRepo, lineupsRepo, matchupsRepo, playsRepo } from '@/db/repos';
import { resetDb } from '@/db/schema';
import { parseImport } from '@/lib/io/importData';

const pdf = vi.hoisted(() => ({
  addPage: vi.fn(),
  addImage: vi.fn(),
  text: vi.fn(),
  save: vi.fn(),
}));
vi.mock('html-to-image', () => ({ toPng: vi.fn(async () => 'data:image/png;base64,AAAA') }));
vi.mock('jspdf', () => ({
  jsPDF: class {
    internal = { pageSize: { getWidth: () => 297 } };
    addPage = pdf.addPage;
    addImage = pdf.addImage;
    text = pdf.text;
    setFontSize = vi.fn();
    splitTextToSize = (s: string) => [s];
    output = vi.fn(() => new Blob(['x']));
  },
}));

import { toPng } from 'html-to-image';
import { exportInstallPdf } from '../pdf';
import { exportNodeToPng } from '../png';
import { exportInstallBundle, exportPlays } from '../selective';

beforeEach(async () => {
  await resetDb();
  vi.clearAllMocks();
  URL.createObjectURL = vi.fn(() => 'blob:x');
  URL.revokeObjectURL = vi.fn();
});

async function seed(): Promise<void> {
  for (const id of ['p1', 'p2', 'p3', 'p4']) await playsRepo.put(makePlay(id));
  await athletesRepo.put(makeAthlete('a1'));
  await athletesRepo.put(makeAthlete('a2'));
  await lineupsRepo.put(makeLineup('l1', { slots: [{ label: 'X', athleteId: 'a1' }] }));
  await matchupsRepo.put(makeMatchup('m1', 'p1', 'p2', { offenseLineupId: 'l1' }));
  await matchupsRepo.put(makeMatchup('m2', 'p1', 'p2'));
  await matchupsRepo.put(makeMatchup('m3', 'p3', 'p4'));
  await installsRepo.put(makeInstall('i1', ['m1', 'm2']));
}

describe('FR-IO-06 selective export', () => {
  it('exportPlays includes only chosen plays and parses back', async () => {
    await seed();
    const file = await exportPlays(['p1', 'p3']);
    expect(file.data.plays?.map((p) => p.id).sort()).toEqual(['p1', 'p3']);
    expect(file.data.settings).toBeUndefined();
    expect(parseImport(JSON.stringify(file)).ok).toBe(true);
  });

  it('exportInstallBundle includes install, matchups, plays, lineups, athletes', async () => {
    await seed();
    const file = await exportInstallBundle('i1');
    expect(file.data.installs?.map((i) => i.id)).toEqual(['i1']);
    expect(file.data.matchups?.map((m) => m.id).sort()).toEqual(['m1', 'm2']);
    expect(file.data.plays?.map((p) => p.id).sort()).toEqual(['p1', 'p2']);
    expect(file.data.lineups?.map((l) => l.id)).toEqual(['l1']);
    expect(file.data.athletes?.map((a) => a.id)).toEqual(['a1']);
    expect(parseImport(JSON.stringify(file)).ok).toBe(true);
  });
});

describe('FR-IO-07 PNG', () => {
  it('calls toPng and downloads', async () => {
    const click = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {});
    const node = document.createElement('div');
    await exportNodeToPng(node, 'Smash.png');
    expect(toPng).toHaveBeenCalledWith(node, expect.anything());
    expect(click).toHaveBeenCalledTimes(1);
  });
});

describe('FR-IN-06 PDF', () => {
  it('one page per item, image per item, includes coach note', async () => {
    await seed();
    const inst = (await installsRepo.get('i1'))!;
    await installsRepo.put({
      ...inst,
      items: inst.items.map((it, i) => ({ ...it, coachNote: `note ${i}` })),
    });
    vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {});
    await exportInstallPdf('i1');
    expect(pdf.addPage).toHaveBeenCalledTimes(1);
    expect(pdf.addImage).toHaveBeenCalledTimes(2);
    const texts = pdf.text.mock.calls.map((c) => JSON.stringify(c[0]));
    expect(texts.some((s) => s.includes('note 0'))).toBe(true);
    expect(texts.some((s) => s.includes('note 1'))).toBe(true);
  });
});
