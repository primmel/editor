// ─────────────────────────────────────────────────────────────────────
// TODO.editor/07 — the mapper core's proofs:
//   - pairs with meta land in the IMP model's map_profile, serialized
//     exactly as the mapping grammar expects;
//   - multi-target: one IMP → two REF targets (the list shape holds);
//   - the party lists (mapped/unmapped) are right after each edit,
//     and undo reverts.
// ─────────────────────────────────────────────────────────────────────

import { describe, it, expect } from 'vitest';
import { dump, load, type Standard } from '@primmel/primmel';
import {
  createMappingPair, deleteMappingPair, updateMappingMeta,
} from '../commands';
import {
  mappedSourceIds, mappedTargetIds, mappableIds, pairsOf,
  profileFor, sourcesTargeting, splitTargetRef, targetRef,
  unmappedSources, unmappedTargets,
} from '../mapper';

const IMP = `root Root

version "v1.0.0-dev1"

metadata {
  title "IMP"
  schema "Primmel 0.1"
  namespace "AcmeOps"
}

role r1 { name "Operator" }

start_event Start { }

process Produce {
  name "Produce"
  actor r1
}

process Inspect {
  name "Inspect"
  actor r1
}

process Ship {
  name "Ship"
  actor r1
}

canvas Root {
  elements {
    Start { x 0 y 0 }
    Produce { x 0 y 100 }
    Inspect { x 0 y 200 }
    Ship { x 0 y 300 }
  }
  process_flow {
    E1 { from Start to Produce }
  }
}`;

const REF = `root Root

version "v1.0.0-dev1"

metadata {
  title "REF"
  schema "Primmel 0.1"
  namespace "QMS"
}

role q1 { name "Auditor" }

start_event Start { }

process MakeGood {
  name "Make good product"
  actor q1
}

process CheckGood {
  name "Check it is good"
  actor q1
}

process DeliverGood {
  name "Deliver it"
  actor q1
}

canvas Root {
  elements {
    Start { x 0 y 0 }
    MakeGood { x 0 y 100 }
    CheckGood { x 0 y 200 }
    DeliverGood { x 0 y 300 }
  }
  process_flow {
    E1 { from Start to MakeGood }
  }
}`;

function impAst(): Standard {
  return load(IMP);
}

describe('07 — pair CRUD over the v3 profile', () => {
  it('three pairs with meta serialize exactly as the grammar expects', () => {
    const ast = impAst();
    const ns = 'QMS';
    createMappingPair(ns, 'Produce', targetRef(ns, 'MakeGood'), {
      description: 'our Produce runs the same steps',
      justification: 'clause 4.1 equivalence',
      coverage: 'full',
    }).apply(ast);
    createMappingPair(ns, 'Inspect', targetRef(ns, 'CheckGood'), {
      description: 'two-stage inspection',
      justification: '',
    }).apply(ast);
    createMappingPair(ns, 'Ship', targetRef(ns, 'DeliverGood'), {}).apply(ast);

    const text = dump(ast);
    expect(text).toContain('map_profile QMS {');
    expect(text).toContain(
      'Produce -> QMS#MakeGood { description "our Produce runs the same steps" justification "clause 4.1 equivalence" coverage full }',
    );
    expect(text).toContain('Inspect -> QMS#CheckGood { description "two-stage inspection" }');
    expect(text).toContain('Ship -> QMS#DeliverGood\n');

    // The round trip parses the pairs back identically.
    const reparsed = load(text);
    const profile = profileFor(reparsed, ns)!;
    expect(pairsOf(profile, 'Produce')[0]).toMatchObject({
      target: 'QMS#MakeGood',
      description: 'our Produce runs the same steps',
      justification: 'clause 4.1 equivalence',
      coverage: 'full',
    });
  });

  it('multi-target: one IMP → two REF targets (the list shape holds)', () => {
    const ast = impAst();
    const ns = 'QMS';
    createMappingPair(ns, 'Inspect', targetRef(ns, 'CheckGood'), {}).apply(ast);
    createMappingPair(ns, 'Inspect', targetRef(ns, 'MakeGood'), {
      description: 'inspection also covers making',
    }).apply(ast);

    const profile = profileFor(ast, ns)!;
    expect(pairsOf(profile, 'Inspect').map(p => p.target)).toEqual([
      'QMS#CheckGood', 'QMS#MakeGood',
    ]);
    // …and the reverse lookup sees both REF partners.
    expect(sourcesTargeting(profile, 'CheckGood')).toEqual(['Inspect']);
    expect(sourcesTargeting(profile, 'MakeGood')).toEqual(['Inspect']);
    // One REF target receiving several sources works too.
    createMappingPair(ns, 'Produce', targetRef(ns, 'MakeGood'), {}).apply(ast);
    expect(sourcesTargeting(profile, 'MakeGood')).toEqual(['Inspect', 'Produce']);

    const reparsed = load(dump(ast));
    expect(pairsOf(profileFor(reparsed, ns), 'Inspect')).toHaveLength(2);
  });

  it('the party lists track every edit; undo reverts', () => {
    const ast = impAst();
    const ref = load(REF);
    const ns = 'QMS';

    // Everything unmapped at the start (no profile yet).
    expect(profileFor(ast, ns)).toBeNull();
    expect(unmappedTargets(ref, null)).toEqual(mappableIds(ref));
    expect(unmappedSources(ast, null)).toEqual(mappableIds(ast));

    const cmd = createMappingPair(ns, 'Produce', targetRef(ns, 'MakeGood'), {});
    cmd.apply(ast);
    const profile = profileFor(ast, ns)!;
    expect(mappedSourceIds(profile)).toEqual(new Set(['Produce']));
    expect(mappedTargetIds(profile)).toEqual(new Set(['MakeGood']));
    expect(unmappedSources(ast, profile)).not.toContain('Produce');
    expect(unmappedTargets(ref, profile)).not.toContain('MakeGood');
    expect(unmappedTargets(ref, profile)).toContain('CheckGood');

    // Edit the meta, then delete — the lists track both.
    updateMappingMeta(ns, 'Produce', targetRef(ns, 'MakeGood'), { coverage: 'partial' }).apply(ast);
    expect(pairsOf(profile, 'Produce')[0]!.coverage).toBe('partial');
    deleteMappingPair(ns, 'Produce', targetRef(ns, 'MakeGood')).apply(ast);
    expect(mappedSourceIds(profile)).toEqual(new Set());
    expect(unmappedSources(ast, profile)).toContain('Produce');

    // Undo the create itself — the source list is whole again.
    cmd.revert(ast);
    expect(unmappedSources(ast, profileFor(ast, ns))).toEqual(mappableIds(ast));
  });

  it('targetRef / splitTargetRef round-trip; malformed refs refuse', () => {
    expect(targetRef('QMS', 'MakeGood')).toBe('QMS#MakeGood');
    expect(splitTargetRef('QMS#MakeGood')).toEqual({ namespace: 'QMS', id: 'MakeGood' });
    expect(splitTargetRef('nohash')).toBeNull();
    expect(splitTargetRef('#orphan')).toBeNull();
  });
});
