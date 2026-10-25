import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/db/seed/seed', () => ({ ensureSeeded: vi.fn() }));
vi.mock('@/db/errors', () => ({ reportDbError: vi.fn() }));

import { reportDbError } from '@/db/errors';
import { ensureSeeded } from '@/db/seed/seed';
import { bootstrap } from '../bootstrap';

const seedMock = vi.mocked(ensureSeeded);
const reportMock = vi.mocked(reportDbError);

function setStorage(storage: unknown): void {
  Object.defineProperty(navigator, 'storage', { value: storage, configurable: true });
}

describe('FR-DAT-05 / FR-IO-04 bootstrap', () => {
  const original = Object.getOwnPropertyDescriptor(navigator, 'storage');

  beforeEach(() => {
    vi.clearAllMocks();
    seedMock.mockResolvedValue({ seeded: true });
  });
  afterEach(() => {
    if (original) Object.defineProperty(navigator, 'storage', original);
    else Reflect.deleteProperty(navigator, 'storage');
  });

  it('seeds and requests persistence when not yet persisted', async () => {
    const persisted = vi.fn().mockResolvedValue(false);
    const persist = vi.fn().mockResolvedValue(true);
    setStorage({ persisted, persist });
    const res = await bootstrap();
    expect(seedMock).toHaveBeenCalledTimes(1);
    expect(persist).toHaveBeenCalledTimes(1);
    expect(res).toEqual({ seeded: true, persisted: true });
  });

  it('does not call persist() when already persisted', async () => {
    const persist = vi.fn();
    setStorage({ persisted: vi.fn().mockResolvedValue(true), persist });
    const res = await bootstrap();
    expect(persist).not.toHaveBeenCalled();
    expect(res.persisted).toBe(true);
  });

  it('reports persisted=false when the browser denies persist()', async () => {
    setStorage({ persisted: vi.fn().mockResolvedValue(false), persist: vi.fn().mockResolvedValue(false) });
    expect((await bootstrap()).persisted).toBe(false);
  });

  it('returns persisted null when the storage API is missing', async () => {
    setStorage(undefined);
    const res = await bootstrap();
    expect(res).toEqual({ seeded: true, persisted: null });
  });

  it('returns seeded=false when ensureSeeded reports it did nothing', async () => {
    seedMock.mockResolvedValue({ seeded: false });
    setStorage(undefined);
    expect((await bootstrap()).seeded).toBe(false);
  });

  it('reports errors instead of throwing', async () => {
    const err = new Error('IndexedDB blocked');
    seedMock.mockRejectedValue(err);
    setStorage({ persisted: vi.fn(), persist: vi.fn() });
    const res = await bootstrap();
    expect(reportMock).toHaveBeenCalledWith(err);
    expect(res.seeded).toBe(false);
  });
});
