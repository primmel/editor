// ─────────────────────────────────────────────────────────────────────
// G15 — the edition-crossed profiles' proofs, against the REAL 13485
// fixture: both editions load, the namespaces match, and the deltas
// are measured (carried / added / dropped — the migration the fixture
// records). Plus synthetic shapes for the edge classes.
// ─────────────────────────────────────────────────────────────────────
import { describe, it, expect } from 'vitest';
import { existsSync, readFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';
import { loadPrm } from '@primmel/primmel';
import { editionNamespaces, editionProfileDiff } from '../edition-map-diff';

const DIR = join(homedir(), 'src/mn/mmel-models/13485 (for diff)');
// The fixture lives in the corpus checkout — the spec proves against
// it when present and skips (the runtime-spec pattern) on machines
// without it; the synthetic classes below always run.
const fixtureAvailable = existsSync(join(DIR, '2016.json'));
const itf = fixtureAvailable ? it : it.skip;

function edition(file: string) {
  return loadPrm(readFileSync(join(DIR, file), 'utf8'));
}

describe('the edition-crossed profiles (G15 — the 13485 fixture)', () => {
  itf('both editions load and share their doc namespaces', () => {
    const a = edition('2016.json');
    const b = edition('2021.json');
    const ns = editionNamespaces(a, b);
    expect(ns).toContain('EU90/385/EECAnnex2-doc');
    expect(ns.length).toBeGreaterThanOrEqual(5);
  });

  itf('measures the pair deltas across the editions', () => {
    const deltas = editionProfileDiff(edition('2016.json'), edition('2021.json'));
    expect(deltas.length).toBeGreaterThanOrEqual(5);
    // The fixture's own story: pairs carried AND movement exist
    const totalCarried = deltas.reduce((n, d) => n + d.carried.length, 0);
    const totalMoved = deltas.reduce((n, d) => n + d.added.length + d.dropped.length, 0);
    expect(totalCarried).toBeGreaterThan(0);
    expect(totalMoved).toBeGreaterThan(0);
  });

  it('the synthetic classes: carried, added, dropped', () => {
    const a = loadPrm(JSON.stringify({
      '@context': 'x', '@type': 'Primmel_MAP', id: '',
      mapSet: { ns: { id: 'ns', mappings: { s1: { t1: {} }, s2: { t2: {} } }, coverage: {} } },
    }));
    const b = loadPrm(JSON.stringify({
      '@context': 'x', '@type': 'Primmel_MAP', id: '',
      mapSet: { ns: { id: 'ns', mappings: { s1: { t1: {} }, s3: { t3: {} } }, coverage: {} } },
    }));
    const [d] = editionProfileDiff(a, b);
    expect(d!.carried).toEqual([{ source: 's1', target: 't1' }]);
    expect(d!.added).toEqual([{ source: 's3', target: 't3' }]);
    expect(d!.dropped).toEqual([{ source: 's2', target: 't2' }]);
  });
});
