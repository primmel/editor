// ─────────────────────────────────────────────────────────────────────
// M-API — the measurement API ingestion's proofs: paths resolve (dot,
// index, nested), bad fields skip (never crash), the empty path
// falls back to the variable's own key, and the fetch degrades
// honestly (HTTP errors, bad JSON, timeout) — the run keeps its
// last registers and the wall says so.
// ─────────────────────────────────────────────────────────────────────
import { describe, it, expect, vi, afterEach } from 'vitest';
import { pickPath, readingsFrom, fetchReadings, snapshotSources } from '../api-source';

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('pickPath', () => {
  it('reads top-level, dot, and index paths', () => {
    const doc = { area: 1.23, nest: { a: [{ v: 7 }] } };
    expect(pickPath(doc, 'area')).toBe(1.23);
    expect(pickPath(doc, 'nest.a[0].v')).toBe(7);
    expect(pickPath(doc, 'nest.a.0.v')).toBe(7);
  });

  it('coerces numeric strings, rejects non-numbers', () => {
    expect(pickPath({ t: '4.5' }, 't')).toBe(4.5);
    expect(pickPath({ t: 'hot' }, 't')).toBeUndefined();
    expect(pickPath({ t: null }, 't')).toBeUndefined();
    expect(pickPath({ t: { deep: 1 } }, 't')).toBeUndefined();
    expect(pickPath({}, 'missing')).toBeUndefined();
  });

  it('survives junk shapes', () => {
    expect(pickPath(null, 'a')).toBeUndefined();
    expect(pickPath(42, 'a')).toBeUndefined();
    expect(pickPath({ a: 1 }, '')).toBeUndefined();
  });
});

describe('readingsFrom', () => {
  it('empty path falls back to the variable name', () => {
    const r = readingsFrom({ area: 1.0, temp: 21.5 }, [
      { variable: 'area', path: '' },
      { variable: 'temp', path: 'temp' },
    ]);
    expect(r).toEqual({ area: 1.0, temp: 21.5 });
  });

  it('a missing field skips, the rest assign', () => {
    const r = readingsFrom({ area: 1.0 }, [
      { variable: 'area', path: '' },
      { variable: 'temp', path: 'temp' },
    ]);
    expect(r).toEqual({ area: 1.0 });
  });
});

describe('fetchReadings', () => {
  it('extracts readings from a 2xx JSON response', async () => {
    vi.stubGlobal('fetch', vi.fn(async () =>
      new Response(JSON.stringify({ area: 1.6, temp: 27 }), { status: 200 }),
    ));
    const out = await fetchReadings('/x', [{ variable: 'area', path: '' }]);
    expect(out).toEqual({ ok: true, readings: { area: 1.6 } });
  });

  it('reports HTTP errors as errors', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response('nope', { status: 500 })));
    const out = await fetchReadings('/x', [{ variable: 'area', path: '' }]);
    expect(out).toEqual({ ok: false, error: 'HTTP 500' });
  });

  it('reports bad JSON as errors', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response('<html>', { status: 200 })));
    const out = await fetchReadings('/x', []);
    expect(out.ok).toBe(false);
  });

  it('reports fetch failures (network, abort) as errors', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => { throw new Error('NetworkError'); }));
    const out = await fetchReadings('/x', []);
    expect(out.ok).toBe(false);
  });
});

describe('snapshotSources', () => {
  it('the snapshot IS the reading — at() ignores the clock', () => {
    const srcs = snapshotSources({ area: 1.6 }, { area: '' });
    expect(srcs).toHaveLength(1);
    expect(srcs[0].variable).toBe('area');
    expect(srcs[0].label).toBe('area ← area');
    expect(srcs[0].at(0)).toBe(1.6);
    expect(srcs[0].at(999)).toBe(1.6);
  });

  it('an explicit path shows in the label', () => {
    const srcs = snapshotSources({ area: 1.6 }, { area: 'readings.area' });
    expect(srcs[0].label).toBe('area ← readings.area');
  });
});
