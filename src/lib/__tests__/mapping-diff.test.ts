// ─────────────────────────────────────────────────────────────────────
// G3 — the mapping diff's proofs: retained pairs, broken pairs (the
// target vanished), the same-name retarget SUGGESTION, and the
// computed coverage delta between the editions.
// ─────────────────────────────────────────────────────────────────────
import { describe, it, expect } from 'vitest';
import { load, type Standard } from '@primmel/primmel';
import { mappingDiff } from '../mapping-diff';

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

map_profile ref-a {
  mapping {
    p_conduct -> ref-a#pa_test
  }
}
`;

const OLD_REF = `root RefA2021

version "v1.0.0-dev1"

metadata {
  title "Ref A (2021)"
  schema "Primmel 0.1"
  namespace "ref-a"
}

process pa_test {
  name "Conduct tests"
  modality shall
}
`;

const NEW_REF = `root RefA2025

version "v1.0.0-dev1"

metadata {
  title "Ref A (2025)"
  schema "Primmel 0.1"
  namespace "ref-a"
}

process pb_test {
  name "Conduct tests"
  modality shall
}
`;

const IMP_NEW = `root Root

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

map_profile ref-a {
  mapping {
    p_conduct -> ref-a#pb_test
  }
}
`;

function imp(): Standard {
  return load(IMP) as unknown as Standard;
}

function impNew(): Standard {
  return load(IMP_NEW) as unknown as Standard;
}

describe('the mapping diff (G3)', () => {
  it('marks the vanished target broken and suggests the same-name retarget', () => {
    const d = mappingDiff(imp(), load(OLD_REF) as unknown as Standard, load(NEW_REF) as unknown as Standard, 'ref-a');
    expect(d.pairs).toHaveLength(1);
    expect(d.pairs[0]!.status).toBe('broken');
    expect(d.pairs[0]!.suggestedTarget).toBe('pb_test');
  });

  it('marks the pair retained when the target survives the update', () => {
    const d = mappingDiff(impNew(), load(NEW_REF) as unknown as Standard, load(NEW_REF) as unknown as Standard, 'ref-a');
    expect(d.pairs[0]!.status).toBe('retained');
    expect(d.pairs[0]!.suggestedTarget).toBeUndefined();
  });

  it('computes the coverage delta between the editions', () => {
    const d = mappingDiff(imp(), load(OLD_REF) as unknown as Standard, load(NEW_REF) as unknown as Standard, 'ref-a');
    expect(d.coverage.before.full).toBe(1);
    expect(d.coverage.after.full).toBe(0);
    expect(d.coverage.after.none).toBe(1);
  });
});
