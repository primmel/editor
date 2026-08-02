// ─────────────────────────────────────────────────────────────────────
// TODO.editor/08 — the coverage overlay's proofs:
//   - the bridge's per-node levels are the kernel's computeCoverage
//     output, node for node (never a Studio-side recomputation);
//   - the conflict row fires on a deliberately wrong assertion (C23);
//   - the aggregation basis shows the calculus's rules (all-children /
//     gateway-minimum) per parent.
// ─────────────────────────────────────────────────────────────────────

import { describe, it, expect } from 'vitest';
import {
  collectMappings, computeCoverage, load,
  type Standard,
} from '@primmel/primmel';
import { coverageTooltip, coverageView } from '../coverage';
import { createMappingPair } from '../commands';

const REF = `root Root

version "v1.0.0-dev1"

metadata {
  title "REF"
  schema "Primmel 0.1"
  namespace "QMS"
}

role q1 { name "Auditor" }

process Parent {
  name "Parent"
  actor q1

  process Kid1 {
    name "Kid one"
    actor q1
  }

  process Kid2 {
    name "Kid two"
    actor q1
  }
}

process GateParent {
  name "Gateway parent"
  actor q1
  child_composition gateway

  process Opt1 {
    name "Option one"
    actor q1
  }

  process Opt2 {
    name "Option two"
    actor q1
  }
}

process Lonely {
  name "Lonely"
  actor q1
}

canvas Root {
  elements {
    Parent { x 0 y 0 }
    GateParent { x 0 y 100 }
    Lonely { x 0 y 200 }
  }
  process_flow {
  }
}`;

const IMP = `root Root

version "v1.0.0-dev1"

metadata {
  title "IMP"
  schema "Primmel 0.1"
  namespace "AcmeOps"
}

role r1 { name "Operator" }

process DoKid1 {
  name "Do kid one"
  actor r1
}

process DoOpt1 {
  name "Do opt one"
  actor r1
}

process Untouched {
  name "Untouched"
  actor r1
}

canvas Root {
  elements {
    DoKid1 { x 0 y 0 }
    DoOpt1 { x 0 y 100 }
    Untouched { x 0 y 200 }
  }
  process_flow {
  }
}`;

function fixture(): { imp: Standard; ref: Standard } {
  const imp = load(IMP);
  const ref = load(REF);
  createMappingPair('QMS', 'DoKid1', 'QMS#Kid1', { description: 'kid one done' }).apply(imp);
  createMappingPair('QMS', 'DoOpt1', 'QMS#Opt1', {}).apply(imp);
  return { imp, ref };
}

describe('08 — the bridge IS the kernel', () => {
  it('per-node levels match computeCoverage node-for-node', () => {
    const { imp, ref } = fixture();
    const view = coverageView(imp, ref, 'QMS');
    const report = computeCoverage(
      imp, ref, collectMappings(imp).filter(m => m.targetModel === 'QMS'), 'QMS',
    );
    for (const c of report.components) {
      expect(view.ref.get(c.id)?.computed, `component ${c.id}`).toBe(c.coverage);
    }
    // The calculus's own expectations, made explicit:
    expect(view.ref.get('Kid1')!.computed).toBe('full');       // directly mapped
    expect(view.ref.get('Kid2')!.computed).toBe('none');       // unmapped child
    expect(view.ref.get('Parent')!.computed).toBe('partial');  // all-composition, mixed
    expect(view.ref.get('Opt1')!.computed).toBe('full');
    expect(view.ref.get('GateParent')!.computed).toBe('minimal'); // gateway minimum
    expect(view.ref.get('Lonely')!.computed).toBe('none');
    // IMP side.
    expect(view.impMapped.get('DoKid1')).toBe(true);
    expect(view.impMapped.get('Untouched')).toBeUndefined(); // never a source
  });

  it('a deliberately wrong assertion conflicts (the C23 marker)', () => {
    const { imp, ref } = fixture();
    // Assert Lonely is fully covered — the calculus says none.
    const profile = imp.mapProfiles.find(p => p.namespace === 'QMS')!;
    profile.coverage = { Lonely: 'full' };

    const view = coverageView(imp, ref, 'QMS');
    const row = view.ref.get('Lonely')!;
    expect(row.computed).toBe('none');
    expect(row.asserted).toBe('full');
    expect(row.conflict).toBe(true);
    expect(coverageTooltip(row)).toContain('asserted full but computed none');

    // An HONEST assertion does not conflict.
    profile.coverage = { Kid1: 'full' };
    const view2 = coverageView(imp, ref, 'QMS');
    expect(view2.ref.get('Kid1')!.conflict).toBe(false);
  });

  it('the aggregation basis names the rule and the children', () => {
    const { imp, ref } = fixture();
    const view = coverageView(imp, ref, 'QMS');

    const parent = view.ref.get('Parent')!;
    expect(parent.composition).toBe('all');
    expect(parent.childLevels).toEqual([
      { id: 'Kid1', level: 'full' },
      { id: 'Kid2', level: 'none' },
    ]);
    expect(coverageTooltip(parent)).toContain('all children must be covered');

    const gate = view.ref.get('GateParent')!;
    expect(gate.composition).toBe('gateway');
    expect(coverageTooltip(gate)).toContain('at least one branch');

    // A leaf has no basis.
    expect(view.ref.get('Kid1')!.composition).toBeNull();
  });

  it('an all-covered parent aggregates to full', () => {
    const { imp, ref } = fixture();
    createMappingPair('QMS', 'Untouched', 'QMS#Kid2', {}).apply(imp);
    const view = coverageView(imp, ref, 'QMS');
    expect(view.ref.get('Kid2')!.computed).toBe('full');
    expect(view.ref.get('Parent')!.computed).toBe('full');
  });

  it('a renaming edit retints (the overlay tracks the command layer)', () => {
    const { imp, ref } = fixture();
    // Move DoOpt1's pair off Opt1 — the gateway parent drops to none.
    const profile = imp.mapProfiles.find(p => p.namespace === 'QMS')!;
    delete profile.mappings['DoOpt1'];
    const view = coverageView(imp, ref, 'QMS');
    expect(view.ref.get('Opt1')!.computed).toBe('none');
    expect(view.ref.get('GateParent')!.computed).toBe('none');
    expect(view.impMapped.get('DoOpt1')).toBeUndefined();
  });
});
