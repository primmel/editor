// ─────────────────────────────────────────────────────────────────────
// G1 — the discovery bridge's proofs: the registry chain (imp → refA →
// refB) yields the transitive proposal for the active namespace;
// chains that end elsewhere are filtered out; a ref with no outbound
// mappings proposes nothing.
// ─────────────────────────────────────────────────────────────────────
import { describe, it, expect } from 'vitest';
import { load, type Standard } from '@primmel/primmel';
import { transitiveProposals } from '../automap-transitive';

const IMP = `root Imp

version "v1.0.0-dev1"

metadata {
  title "IMP"
  schema "Primmel 0.1"
  namespace "imp"
}

process pa {
  name "Do the thing"
  modality shall
}

map_profile refA {
  mapping {
    pa -> refA#a_test
  }
}
`;

const REF_A = `root RefA

version "v1.0.0-dev1"

metadata {
  title "Ref A"
  schema "Primmel 0.1"
  namespace "refA"
}

process a_test {
  name "The thing, tested"
  modality shall
}

map_profile refB {
  mapping {
    a_test -> refB#b_test
  }
}
`;

const REF_B = `root RefB

version "v1.0.0-dev1"

metadata {
  title "Ref B"
  schema "Primmel 0.1"
  namespace "refB"
}

process b_test {
  name "The thing, upstream"
  modality shall
}
`;

function loadStd(t: string): Standard {
  return load(t) as unknown as Standard;
}

describe('the transitive discovery bridge (G1)', () => {
  it('proposes the far end of the chain for the active namespace', () => {
    const refs = { refA: loadStd(REF_A), refB: loadStd(REF_B) };
    const out = transitiveProposals(loadStd(IMP), refs, 'refB');
    expect(out).toHaveLength(1);
    expect(out[0]!.source).toBe('pa');
    expect(out[0]!.target).toBe('refB#b_test');
    expect(out[0]!.kind).toBe('transitive');
    expect(out[0]!.via.length).toBeGreaterThan(0);
  });

  it('filters proposals that target another namespace', () => {
    const refs = { refA: loadStd(REF_A), refB: loadStd(REF_B) };
    const out = transitiveProposals(loadStd(IMP), refs, 'refA');
    expect(out).toHaveLength(0);
  });

  it('proposes nothing when the registry has no chains', () => {
    const out = transitiveProposals(loadStd(IMP), { refB: loadStd(REF_B) }, 'refB');
    expect(out).toHaveLength(0);
  });
});
