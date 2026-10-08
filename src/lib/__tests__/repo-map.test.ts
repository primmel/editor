// ─────────────────────────────────────────────────────────────────────
// G2 — the repo map's proofs: every registered reference appears,
// mapped or not; profiles whose reference is closed still count; the
// counts are the pair count and the mapped-over-mappable coverage.
// ─────────────────────────────────────────────────────────────────────
import { describe, it, expect } from 'vitest';
import { load, type Standard } from '@primmel/primmel';
import { repoMap } from '../repo-map';

const IMP = `root Root

version "v1.0.0-dev1"

metadata {
  title "IMP"
  schema "Primmel 0.1"
  namespace "imp"
}

process p_conduct {
  name "Conduct tests"
  modality shall
}

process p_review {
  name "Review evidence"
  modality shall
}

map_profile ref-a {
  mapping {
    p_conduct -> ref-a#pa_conduct
  }
}

map_profile ref-closed {
  mapping {
    p_review -> ref-closed#pr_review
  }
}
`;

function imp(): Standard {
  return load(IMP) as unknown as Standard;
}

describe('the repo map (G2)', () => {
  it('inventories registered references, mapped or not', () => {
    const rows = repoMap(imp(), ['ref-a', 'ref-b']);
    const ns = rows.map((r) => r.namespace);
    expect(ns).toContain('ref-a');
    expect(ns).toContain('ref-b');
    const b = rows.find((r) => r.namespace === 'ref-b')!;
    expect(b.pairs).toBe(0);
    expect(b.mappedSources).toBe(0);
  });

  it('counts profiles whose reference is closed', () => {
    const rows = repoMap(imp(), ['ref-a']);
    const closed = rows.find((r) => r.namespace === 'ref-closed')!;
    expect(closed.pairs).toBe(1);
    expect(closed.mappedSources).toBe(1);
  });

  it('reports pair count and coverage per namespace', () => {
    const rows = repoMap(imp(), ['ref-a']);
    const a = rows.find((r) => r.namespace === 'ref-a')!;
    expect(a.pairs).toBe(1);
    expect(a.mappedSources).toBe(1);
    expect(a.mappableSources).toBeGreaterThanOrEqual(2);
  });
});
