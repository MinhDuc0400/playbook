import { afterEach, describe, expect, it, vi } from 'vitest';
import { classifyDbError, onDbError, reportDbError, withDbErrors, type DbErrorInfo } from '../errors';

function named(name: string, message = 'x'): Error {
  const e = new Error(message);
  e.name = name;
  return e;
}

describe('classifyDbError (NFR-REL-02)', () => {
  it('QuotaExceededError → quota, also nested in inner/cause', () => {
    expect(classifyDbError(named('QuotaExceededError'))).toBe('quota');
    expect(classifyDbError(Object.assign(named('AbortError'), { inner: named('QuotaExceededError') }))).toBe(
      'quota',
    );
    expect(classifyDbError(Object.assign(named('AbortError'), { cause: named('QuotaExceededError') }))).toBe(
      'quota',
    );
  });

  it.each(['OpenFailedError', 'DatabaseClosedError', 'InvalidStateError', 'VersionError'])(
    '%s → blocked',
    (name) => {
      expect(classifyDbError(named(name))).toBe('blocked');
    },
  );

  it('message containing "blocked" → blocked', () => {
    expect(classifyDbError(named('Error', 'Database is Blocked by another tab'))).toBe('blocked');
  });

  it('anything else → unknown', () => {
    expect(classifyDbError(new Error('boom'))).toBe('unknown');
    expect(classifyDbError('str')).toBe('unknown');
    expect(classifyDbError(null)).toBe('unknown');
    expect(classifyDbError(undefined)).toBe('unknown');
  });

  it('survives cyclic cause chains', () => {
    const a = named('Error') as Error & { cause?: unknown };
    a.cause = a;
    expect(classifyDbError(a)).toBe('unknown');
  });
});

describe('reportDbError / onDbError', () => {
  const unsubs: (() => void)[] = [];
  afterEach(() => {
    unsubs.splice(0).forEach((u) => u());
    vi.useRealTimers();
  });

  it('returns info and notifies every listener', () => {
    vi.useFakeTimers();
    vi.setSystemTime(12345);
    const a = vi.fn();
    const b = vi.fn();
    unsubs.push(onDbError(a), onDbError(b));
    const info = reportDbError(named('QuotaExceededError', 'disk full'));
    expect(info).toEqual({ kind: 'quota', message: 'disk full', at: 12345 });
    expect(a).toHaveBeenCalledWith(info);
    expect(b).toHaveBeenCalledWith(info);
  });

  it('unsubscribe stops notifications; a throwing listener does not block others', () => {
    const bad = vi.fn(() => {
      throw new Error('listener bug');
    });
    const good = vi.fn();
    const off = onDbError(good);
    unsubs.push(onDbError(bad));
    reportDbError(new Error('one'));
    expect(good).toHaveBeenCalledTimes(1);
    off();
    reportDbError(new Error('two'));
    expect(good).toHaveBeenCalledTimes(1);
  });

  it('stringifies non-Error values', () => {
    expect(reportDbError('plain').message).toBe('plain');
  });
});

describe('withDbErrors', () => {
  it('passes the result through without reporting', async () => {
    const seen: DbErrorInfo[] = [];
    const off = onDbError((i) => seen.push(i));
    await expect(withDbErrors(async () => 42)).resolves.toBe(42);
    off();
    expect(seen).toHaveLength(0);
  });

  it('reports then rethrows the same error', async () => {
    const seen: DbErrorInfo[] = [];
    const off = onDbError((i) => seen.push(i));
    const err = named('QuotaExceededError', 'full');
    await expect(
      withDbErrors(async () => {
        throw err;
      }),
    ).rejects.toBe(err);
    off();
    expect(seen).toHaveLength(1);
    expect(seen[0]?.kind).toBe('quota');
  });
});
