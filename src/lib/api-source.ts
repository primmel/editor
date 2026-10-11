// ─────────────────────────────────────────────────────────────────────
// The measurement API source (the parity register's M-API primitive —
// the legacy extension's dynamic measurements via API): the twin
// points at an HTTP endpoint returning JSON; the mapped fields stream
// into the registers as the tick's readings; the MODEL's own
// semantics (deriveComputed, the alert edges) do everything after.
// The fetch is the only impurity, quarantined here.
// ─────────────────────────────────────────────────────────────────────

import type { StreamSource } from './twin';

/** One ingestion mapping: the measured variable the reading feeds,
 *  and the JSON path it is read from. An EMPTY path means the
 *  top-level key named after the variable — the common shape
 *  `{ "area": 1.23 }`. */
export interface ApiMapping {
  variable: string;
  path: string;
}

/** The runtime boundary — a fetched JSON leaf narrows here (the
 *  endpoint's value domain is unknown: number or numeric string). */
function leafNumber(cur: unknown): number | undefined {
  if (typeof cur === 'number') return Number.isFinite(cur) ? cur : undefined;
  if (typeof cur === 'string') {
    const n = Number(cur);
    return Number.isFinite(n) ? n : undefined;
  }
  return undefined;
}

/** Read `path` out of a fetched JSON document: dot segments and
 *  `[n]` indexes (`readings.area`, `items[0].v`). A finite number
 *  returns; anything else (missing, string, null, NaN) is
 *  undefined — a bad field is a skipped reading, never a crash. */
export function pickPath(json: unknown, path: string): number | undefined {
  const segs = path.replace(/\[(\d+)\]/g, '.$1').split('.').filter((s) => s !== '');
  let cur: unknown = json;
  for (const seg of segs) {
    if (cur === null || typeof cur !== 'object') return undefined;
    cur = (cur as Record<string, unknown>)[seg];
  }
  return leafNumber(cur);
}

/** The readings one response yields: every mapping whose path
 *  resolves to a finite number assigns; the rest are absent (the
 *  measured contract — only what actually streamed is ground truth
 *  this tick). */
export function readingsFrom(json: unknown, mappings: ApiMapping[]): Record<string, number> {
  const out: Record<string, number> = {};
  for (const m of mappings) {
    const v = pickPath(json, m.path.trim() !== '' ? m.path : m.variable);
    if (v !== undefined) out[m.variable] = v;
  }
  return out;
}

export type FetchOutcome =
  | { ok: true; readings: Record<string, number> }
  | { ok: false; error: string };

/** Fetch the endpoint and extract the readings. A failure (network,
 *  non-2xx, bad JSON, timeout) reports as an error string — the run
 *  keeps its last registers and says so on the wall. */
export async function fetchReadings(
  url: string,
  mappings: ApiMapping[],
  timeoutMs = 4000,
): Promise<FetchOutcome> {
  const abort = new AbortController();
  const timer = setTimeout(() => abort.abort(), timeoutMs);
  try {
    const res = await fetch(url, { signal: abort.signal, headers: { accept: 'application/json' } });
    if (!res.ok) return { ok: false, error: `HTTP ${res.status}` };
    const json: unknown = await res.json();
    return { ok: true, readings: readingsFrom(json, mappings) };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  } finally {
    clearTimeout(timer);
  }
}

/** A fetched snapshot as the tick's sources: each reading becomes a
 *  source whose value is the number the endpoint sent (the snapshot
 *  IS the reading — it does not depend on the clock). */
export function snapshotSources(
  readings: Record<string, number>,
  paths: Record<string, string> = {},
): StreamSource[] {
  return Object.entries(readings).map(([variable, value]) => ({
    variable,
    label: `${variable} ← ${paths[variable]?.trim() !== '' && paths[variable] !== undefined ? paths[variable] : variable}`,
    at: () => value,
  }));
}
