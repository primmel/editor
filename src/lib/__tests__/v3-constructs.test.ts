// ─────────────────────────────────────────────────────────────────────
// TODO.editor wave 03 — the v3 construct surfaces. Each slice pins its
// construct kind's command path: the tree create (mint + defaults), the
// inspector's facet patches, exact undo/redo, and the kernel round trip
// (the dumped text reparses strict and validates clean — the wave gate:
// author every construct kind, no hand-edits).
// ─────────────────────────────────────────────────────────────────────

import { describe, it, expect } from 'vitest';
import { dump, load, validate } from '@primmel/primmel';
import {
  createConstruct,
  deleteConstruct,
  mintId,
  updateConstruct,
  type Command,
} from '../commands';
import {
  newBehavior,
  newCalculation,
  newCapability,
  newConditionSet,
  newConstraint,
  newStateMachine,
  newSubject,
  newTable,
  newTerm,
  newTestPointSet,
  newTestSequence,
  newVerdict,
} from '../factory';
import { complianceSurface } from '../compliance';

/** A model with the construct collections this suite exercises. */
const BASE = `term load-cell {
  label "load cell"
  definition "measuring transducer that will produce an output in response to an applied load"
  section "3.1"
  source "urn:oiml:pub:r:60-1:2021#clause-3.1.3"
  language "en"
  form_type "fullForm"
  part_of_speech "noun"
}

term widget {
  label "widget"
  definition "a measurable thing"
  language "en"
}
`;

/** Apply + revert a command against a fresh parse, returning both states. */
function run(text: string, ...commands: Command[]) {
  const ast = load(text, { strict: true });
  for (const c of commands) c.apply(ast);
  return ast;
}

describe('W3 terms — the terminology surface', () => {
  it('the mint scans the v3 collections (a term id never collides)', () => {
    const ast = load(BASE, { strict: true });
    ast.terms.push(newTerm('Term1'));
    // The canvas-era mint scanned only the MMEL-era lists — Term1 would
    // have re-minted. The wave-03 mint scans every construct collection.
    expect(mintId(ast, 'Term')).toBe('Term2');
  });

  it('creates a term with the parse-default facets; the dump round-trips', () => {
    const ast = run(BASE, createConstruct(a => a.terms, newTerm('durability'), 'create term'));
    const term = ast.terms.find(t => t.id === 'durability');
    expect(term).toBeDefined();
    expect(term?.label).toBe('');
    const text = dump(ast);
    expect(text).toContain('term durability {');
    // Empty optional facets never serialize as empty markers.
    expect(text).not.toContain('section ""');
    const reloaded = load(text, { strict: true });
    expect(reloaded.terms.map(t => t.id)).toContain('durability');
    expect(validate(reloaded)).toEqual([]);
  });

  it('patches the scalar facets; an emptied optional facet drops out of the dump', () => {
    const ast = run(
      BASE,
      updateConstruct(a => a.terms, 'load-cell', { label: 'load cell (edited)' }),
      updateConstruct(a => a.terms, 'widget', { section: '3.2', note: 'a note' }),
    );
    const text = dump(ast);
    expect(text).toContain('label "load cell (edited)"');
    expect(text).toContain('section "3.2"');
    expect(text).toContain('note "a note"');
    const cleared = run(
      text,
      updateConstruct(a => a.terms, 'widget', { section: '' }),
    );
    expect(dump(cleared)).not.toContain('section ""');
    expect(validate(cleared)).toEqual([]);
  });

  it('patches the vocab register link and the designation lists', () => {
    const ast = run(
      BASE,
      updateConstruct(a => a.terms, 'widget', {
        vocabRef: { register: 'viml-2022', clause: '5.15' },
        alt: ['gadget'],
        seeAlso: ['load-cell'],
      }),
    );
    const text = dump(ast);
    expect(text).toContain('vocab_ref { register viml-2022 clause "5.15" }');
    expect(text).toContain('alt { gadget }');
    expect(load(text, { strict: true }).terms.find(t => t.id === 'widget')?.vocabRef?.clause).toBe('5.15');
  });

  it('undo is exact: the create reverts, the patch restores', () => {
    const ast = load(BASE, { strict: true });
    const create = createConstruct(a => a.terms, newTerm('durability'));
    const patch = updateConstruct(a => a.terms, 'widget', { label: 'edited' });
    create.apply(ast);
    patch.apply(ast);
    expect(ast.terms).toHaveLength(3);
    patch.revert(ast);
    expect(ast.terms.find(t => t.id === 'widget')?.label).toBe('widget');
    create.revert(ast);
    expect(ast.terms).toHaveLength(2);
    // Byte-clean: the AST re-dumps to the same text as the untouched base.
    expect(dump(ast)).toBe(dump(load(BASE, { strict: true })));
  });

  it('deletes a term by id; the removal reverts to the exact slot', () => {
    const del = deleteConstruct(a => a.terms, 'widget');
    const ast = run(BASE, del);
    expect(ast.terms.map(t => t.id)).toEqual(['load-cell']);
    del.revert(ast);
    expect(ast.terms.map(t => t.id)).toEqual(['load-cell', 'widget']);
  });

  it('the overlay marker is parse-visible (the inspector shows it read-only)', () => {
    const ast = load('term t1 {\n  overlay true\n  label "t"\n  definition "d"\n}\n', { strict: true });
    expect(ast.terms[0]?.overlay).toBe(true);
    // The documented kernel dump gap: dumpTerm does not emit the marker
    // (term-overlay.test.ts) — the inspector therefore never edits it.
    expect(dump(ast)).not.toContain('overlay true');
  });
});

describe('W3 constraints — the domain-constraint surface', () => {
  const CONSTRAINTS = `constraint dead_load_max_geometry {
  stereotype inv
  name "Dead-load maximum geometry"
  check "ocl{model.parameters.d_max >= 0.9 * model.parameters.e_max and model.parameters.d_max <= model.parameters.e_max}"
  violation_meaning "the test setup does not realize the measuring range the type evaluation claims"
  on_violation invalid
  ref derives-from "urn:oiml:pub:r:60-1:2021#clause-3.6"
}
`;

  it('creates a constraint with the parse defaults; the dump round-trips', () => {
    const ast = run(CONSTRAINTS, createConstruct(a => a.constraints, newConstraint('c_new')));
    const c = ast.constraints.find(x => x.id === 'c_new');
    expect(c?.stereotype).toBe('inv');
    expect(c?.onViolation).toBe('invalid');
    const text = dump(ast);
    expect(text).toContain('constraint c_new {');
    const reloaded = load(text, { strict: true });
    expect(reloaded.constraints.map(x => x.id)).toContain('c_new');
    expect(validate(reloaded)).toEqual([]);
  });

  it('patches the check and the violation facets; undo restores them', () => {
    const patch = updateConstruct(a => a.constraints, 'dead_load_max_geometry', {
      check: 'ocl{model.parameters.d_max <= model.parameters.e_max}',
      onViolation: 'indeterminate',
    });
    const ast = run(CONSTRAINTS, patch);
    const text = dump(ast);
    expect(text).toContain('on_violation indeterminate');
    expect(text).toContain('ocl{model.parameters.d_max <= model.parameters.e_max}');
    expect(validate(ast)).toEqual([]);
    patch.revert(ast);
    expect(ast.constraints[0]?.onViolation).toBe('invalid');
    expect(dump(ast)).toBe(dump(load(CONSTRAINTS, { strict: true })));
  });

  it('the source patch keeps the sourceRefs alias intact (the serializer walks sourceRefs)', () => {
    const ast = load(CONSTRAINTS, { strict: true });
    const c = ast.constraints[0]!;
    const source = { doc: c.source?.doc ?? '', clause: '3.7' };
    updateConstruct(a => a.constraints, 'dead_load_max_geometry', { source, sourceRefs: [source] }).apply(ast);
    const text = dump(ast);
    expect(text).toContain('source { doc "urn:oiml:pub:r:60-1:2021" clause "3.7" }');
    expect(load(text, { strict: true }).constraints[0]?.source?.clause).toBe('3.7');
  });

  it('deletes a constraint; the removal reverts to the exact slot', () => {
    const two = CONSTRAINTS + '\nconstraint second {\n  stereotype inv\n  name "Second"\n  check "ocl{true}"\n  violation_meaning "void"\n  on_violation invalid\n}\n';
    const del = deleteConstruct(a => a.constraints, 'dead_load_max_geometry');
    const ast = run(two, del);
    expect(ast.constraints.map(c => c.id)).toEqual(['second']);
    del.revert(ast);
    expect(ast.constraints.map(c => c.id)).toEqual(['dead_load_max_geometry', 'second']);
  });
});

describe('W3 calculations — the calculation surface', () => {
  const CALCS = `calculation vMin {
  name "vMin"
  identifier /calc/v-min
  category metrological
  description "Computes verification interval v_min per R 60-1, 3.5.11"
  inputs {
    d_max : number { unit "g" description "Maximum test load D_max" }
    n_lc : integer { description "Number of verification intervals" }
  }
  output : number { unit "g" name "v_min" description "Minimum verification interval" }
  expression "ocl{(d_max - d_min) / n_lc}"
  ref derives-from "urn:oiml:pub:r:60-1:2021#clause-3.5.11"
}
`;

  it('creates a calculation with the parse defaults; the dump round-trips', () => {
    const ast = run(CALCS, createConstruct(a => a.calculations, newCalculation('c_new')));
    const c = ast.calculations.find(x => x.id === 'c_new');
    expect(c?.output.type).toBe('number');
    const text = dump(ast);
    expect(text).toContain('calculation c_new {');
    const reloaded = load(text, { strict: true });
    expect(reloaded.calculations.map(x => x.id)).toContain('c_new');
    expect(validate(reloaded)).toEqual([]);
  });

  it('patches inputs/output/expression as whole-facet replacements; undo restores', () => {
    const inputs = [
      { name: 'd_max', type: 'number', unit: 'kg', description: 'Maximum test load', defaultValue: '', hasDefault: false },
      { name: 'accuracy_class', type: 'enum', unit: '1', description: 'Accuracy class', defaultValue: '', hasDefault: false, enumValues: ['A', 'B', 'C', 'D'] },
    ];
    const patch = updateConstruct(a => a.calculations, 'vMin', {
      inputs,
      output: { type: 'number', unit: 'v', name: 'v_min', description: 'in verification units' },
      expression: 'ocl{lookupMPE(d_max, accuracy_class)}',
      ruleType: 'table_lookup',
    });
    const ast = run(CALCS, patch);
    const text = dump(ast);
    expect(text).toContain('d_max : number { unit "kg" description "Maximum test load" }');
    expect(text).toContain('accuracy_class : enum { unit "1" description "Accuracy class" enum_values { A B C D } }');
    expect(text).toContain('type table_lookup');
    expect(text).toContain('ocl{lookupMPE(d_max, accuracy_class)}');
    const reloaded = load(text, { strict: true });
    expect(reloaded.calculations[0]?.inputs.map(i => i.name)).toEqual(['d_max', 'accuracy_class']);
    expect(validate(reloaded)).toEqual([]);
    patch.revert(ast);
    expect(ast.calculations[0]?.inputs.map(i => i.name)).toEqual(['d_max', 'n_lc']);
    expect(dump(ast)).toBe(dump(load(CALCS, { strict: true })));
  });

  it('the lookup declaration and the source fold survive the edit path', () => {
    const ast = run(
      CALCS,
      updateConstruct(a => a.calculations, 'vMin', { lookup: { key: 'accuracy_class', variable: 'mpe_tiers', multiplier: 'p_lc' } }),
      updateConstruct(a => a.calculations, 'vMin', (() => {
        const sourceRef = { doc: 'urn:oiml:pub:r:60-1:2021', clause: '3.5.12' };
        return { sourceRef, sourceRefs: [sourceRef] };
      })()),
    );
    const text = dump(ast);
    expect(text).toContain('lookup { key accuracy_class variable mpe_tiers multiplier p_lc }');
    // The calculation dump folds provenance to the derives-from ref form
    // (dumpSourceRefAsRef) — the clause rides inside the URN.
    expect(text).toContain('ref derives-from "urn:oiml:pub:r:60-1:2021#clause-3.5.12"');
    const reloaded = load(text, { strict: true });
    expect(reloaded.calculations[0]?.lookup?.variable).toBe('mpe_tiers');
    expect(reloaded.calculations[0]?.sourceRef?.clause).toBe('3.5.12');
  });

  it('pins the kernel gap: a bare NUMERIC input default mangles on parse', () => {
    // Kernel 1.8.0 parse: `default 500` lands as "0" (the tokenizer
    // strips the digits); quoted/string defaults survive. The fix is
    // upstream (primmel-ts) — when it lands this test flips and the
    // inspector hint comes off.
    const ast = load('calculation c {\n  name "c"\n  description "d"\n  inputs {\n    x : number { unit "v" default 500 }\n  }\n  output : number { unit "v" }\n  expression "ocl{x}"\n}\n', { strict: true });
    expect(ast.calculations[0]?.inputs[0]?.hasDefault).toBe(true);
    expect(ast.calculations[0]?.inputs[0]?.defaultValue).toBe('0');
    const quoted = load('calculation c {\n  name "c"\n  description "d"\n  inputs {\n    x : number { unit "v" default "500" }\n  }\n  output : number { unit "v" }\n  expression "ocl{x}"\n}\n', { strict: true });
    expect(quoted.calculations[0]?.inputs[0]?.defaultValue).toBe('500');
  });
});

describe('W3 tables — the lookup-table surface', () => {
  const TABLES = `table mpe_tiers {
  description "MPE tier breakpoints per accuracy class (R 60-1, Table 4)"
  columns {
    accuracy_class: string
    load_min: number "v"
    load_max: number "v"
    limit_factor: number
  }
  data {
    "A" 0 50000 0.5
    "B" 0 5000 0.5
  }
}
`;

  it('creates a table with the parse defaults; the dump round-trips', () => {
    const ast = run(TABLES, createConstruct(a => a.tables, newTable('t_new')));
    expect(ast.tables.map(t => t.id)).toContain('t_new');
    const text = dump(ast);
    const reloaded = load(text, { strict: true });
    expect(reloaded.tables.map(t => t.id)).toContain('t_new');
    expect(validate(reloaded)).toEqual([]);
  });

  it('edits cells, adds a row, and adds a column (the grid stays rectangular)', () => {
    const ast = load(TABLES, { strict: true });
    const table = ast.tables[0]!;
    // Cell edit — whole-array replacement.
    updateConstruct(a => a.tables, 'mpe_tiers', {
      data: table.data.map((r, ri) => ri === 0 ? r.map((c, ci) => ci === 3 ? '0.6' : c) : r),
    }).apply(ast);
    // Row add.
    updateConstruct(a => a.tables, 'mpe_tiers', { data: [...ast.tables[0]!.data, ['C', '0', '500', '0.5']] }).apply(ast);
    // Column add — the columnDef plus one cell per row.
    updateConstruct(a => a.tables, 'mpe_tiers', {
      columnDefs: [...(ast.tables[0]!.columnDefs ?? []), { name: 'note', type: 'string', unit: '' }],
      data: ast.tables[0]!.data.map(r => [...r, '']),
    }).apply(ast);
    const text = dump(ast);
    expect(text).toContain('"A" "0" "50000" "0.6" ""');
    expect(text).toContain('"C" "0" "500" "0.5" ""');
    expect(text).toContain('note: string');
    const reloaded = load(text, { strict: true });
    expect(reloaded.tables[0]?.data).toHaveLength(3);
    expect(reloaded.tables[0]?.columnDefs).toHaveLength(5);
    expect(validate(reloaded)).toEqual([]);
  });

  it('removes a column with its cells; undo restores both facets', () => {
    const patch = updateConstruct(a => a.tables, 'mpe_tiers', {
      columnDefs: (load(TABLES, { strict: true }).tables[0]!.columnDefs ?? []).filter(c => c.name !== 'load_max'),
      data: load(TABLES, { strict: true }).tables[0]!.data.map(r => r.filter((_, i) => i !== 2)),
    });
    const ast = run(TABLES, patch);
    expect(ast.tables[0]?.columnDefs?.map(c => c.name)).toEqual(['accuracy_class', 'load_min', 'limit_factor']);
    expect(ast.tables[0]?.data[0]).toEqual(['A', '0', '0.5']);
    patch.revert(ast);
    expect(ast.tables[0]?.columnDefs).toHaveLength(4);
    expect(ast.tables[0]?.data[0]).toEqual(['A', '0', '50000', '0.5']);
    expect(dump(ast)).toBe(dump(load(TABLES, { strict: true })));
  });
});

describe('W3 state machines — the machine surface', () => {
  const MACHINE = `state_machine LoadCellOperational {
  kind operational
  initial off
  states {
    off
    warming
    ready
  }
  transition off -> warming action power_on
  transition warming -> ready action warm_up_complete {
    guard "elapsed since power_on >= warm_up_time"
  }
  transition [warming, ready] -> off action power_off
}
`;

  it('creates a machine keyed on entityName; the dump round-trips', () => {
    const ast = run(MACHINE, createConstruct(a => a.stateMachines, newStateMachine('Workflow')));
    expect(ast.stateMachines.map(s => s.entityName)).toContain('Workflow');
    const reloaded = load(dump(ast), { strict: true });
    expect(reloaded.stateMachines.map(s => s.entityName)).toContain('Workflow');
    expect(validate(reloaded)).toEqual([]);
  });

  it('the multi-source transition form expands on parse and re-groups on dump', () => {
    const ast = load(MACHINE, { strict: true });
    // [warming, ready] -> off power_off arrives as TWO entries.
    const offs = ast.stateMachines[0]!.transitions.filter(t => t.actionName === 'power_off');
    expect(offs.map(t => t.from)).toEqual(['warming', 'ready']);
    const text = dump(ast);
    expect(text).toContain('transition [warming, ready] -> off action power_off');
  });

  it('a state rename re-points the initial marker and every transition endpoint', () => {
    const ast = load(MACHINE, { strict: true });
    const m = ast.stateMachines[0]!;
    updateConstruct(a => a.stateMachines, 'LoadCellOperational', {
      states: m.states.map(s => s.name === 'off' ? { name: 'powered_down' } : s),
      initialState: 'powered_down',
      transitions: m.transitions.map(t => ({
        ...t,
        from: t.from === 'off' ? 'powered_down' : t.from,
        to: t.to === 'off' ? 'powered_down' : t.to,
      })),
    }).apply(ast);
    const text = dump(ast);
    expect(text).toContain('initial powered_down');
    expect(text).toContain('transition powered_down -> warming action power_on');
    expect(text).toContain('transition [warming, ready] -> powered_down action power_off');
    expect(validate(ast)).toEqual([]);
  });

  it('removing a state drops its transitions; undo restores the whole machine', () => {
    const ast = load(MACHINE, { strict: true });
    const m = ast.stateMachines[0]!;
    const cmd = updateConstruct(a => a.stateMachines, 'LoadCellOperational', {
      states: m.states.filter(s => s.name !== 'ready'),
      transitions: m.transitions.filter(t => t.from !== 'ready' && t.to !== 'ready'),
    });
    cmd.apply(ast);
    const text = dump(ast);
    expect(text).not.toContain('ready');
    cmd.revert(ast);
    expect(dump(ast)).toBe(dump(load(MACHINE, { strict: true })));
  });

  it('deletes a machine by entityName; the removal reverts to the exact slot', () => {
    const del = deleteConstruct(a => a.stateMachines, 'LoadCellOperational');
    const ast = run(MACHINE, del);
    expect(ast.stateMachines).toHaveLength(0);
    del.revert(ast);
    expect(ast.stateMachines.map(s => s.entityName)).toEqual(['LoadCellOperational']);
  });
});

describe('W3 test sequences — the required-ordering surface', () => {
  const SEQ = `test_sequence mdlo-creep-dr {
  name "MDLO → Creep → DR sequence"
  description "The three performance tests must run in this order on the same sample"
  step 1 {
    test "/conf/metrological-tests/mdlo"
    role baseline
  }
  step 2 {
    test "/conf/metrological-tests/creep"
    role follow_up
    depends_on 1
  }
  sample_applicability all
  source { doc "urn:oiml:pub:r:60-2:2021" clause "2.10" }
}
`;

  it('creates a sequence with the parse defaults; the dump round-trips', () => {
    const ast = run(SEQ, createConstruct(a => a.testSequences, newTestSequence('seq_new')));
    expect(ast.testSequences.map(s => s.id)).toContain('seq_new');
    const reloaded = load(dump(ast), { strict: true });
    expect(reloaded.testSequences.map(s => s.id)).toContain('seq_new');
    expect(validate(reloaded)).toEqual([]);
  });

  it('edits the steps (test XOR phase, role, depends_on); undo restores', () => {
    const patch = updateConstruct(a => a.testSequences, 'mdlo-creep-dr', {
      steps: [
        { order: 1, test: '/conf/metrological-tests/mdlo', phase: '', role: 'baseline', dependsOn: null },
        { order: 2, test: '/conf/metrological-tests/creep', phase: '', role: 'follow_up', dependsOn: 1 },
        { order: 3, test: '', phase: 'temperature-cycling', role: '', dependsOn: null },
      ],
    });
    const ast = run(SEQ, patch);
    const text = dump(ast);
    expect(text).toContain('step 3 { phase "temperature-cycling" }');
    const reloaded = load(text, { strict: true });
    expect(reloaded.testSequences[0]?.steps).toHaveLength(3);
    expect(reloaded.testSequences[0]?.steps[2]?.phase).toBe('temperature-cycling');
    expect(validate(reloaded)).toEqual([]);
    patch.revert(ast);
    expect(ast.testSequences[0]?.steps).toHaveLength(2);
    expect(dump(ast)).toBe(dump(load(SEQ, { strict: true })));
  });

  it('the source list edits as repeated source blocks (sourceRefs is the carrier)', () => {
    const ast = run(SEQ, updateConstruct(a => a.testSequences, 'mdlo-creep-dr', {
      sourceRefs: [
        { doc: 'urn:oiml:pub:r:60-2:2021', clause: '2.10' },
        { doc: 'urn:oiml:pub:r:60-2:2021', clause: '2.11.1' },
      ],
    }));
    const text = dump(ast);
    expect(text).toContain('ref derives-from "urn:oiml:pub:r:60-2:2021#clause-2.10"');
    expect(text).toContain('ref derives-from "urn:oiml:pub:r:60-2:2021#clause-2.11.1"');
    expect(load(text, { strict: true }).testSequences[0]?.sourceRefs).toHaveLength(2);
  });
});

describe('W3 test point sets — the shared test-point surface', () => {
  const TPS = `test_point_set span-points {
  description "Points within the measuring range for error determination"
  ref derives-from "urn:oiml:pub:r:144-2:2013#clause-1.2"
  cardinality {
    linear { min_points 3 rule "min +10 %, mid ±10 %, max −10 % of the measuring range" }
    nonlinear { min_points 5 rule "uniformly distributed" }
  }
  repetitions_per_point 3
  points {
    point min-10pct { fraction 0.1 anchor range_min offset "+10 % of range" }
    point max-10pct { fraction 0.9 anchor range_max offset "−10 % of range" }
  }
}
`;

  it('creates a point set with the parse defaults; the dump round-trips', () => {
    const ast = run(TPS, createConstruct(a => a.testPointSets, newTestPointSet('tps_new')));
    expect(ast.testPointSets.map(t => t.id)).toContain('tps_new');
    const reloaded = load(dump(ast), { strict: true });
    expect(reloaded.testPointSets.map(t => t.id)).toContain('tps_new');
    expect(validate(reloaded)).toEqual([]);
  });

  it('edits cardinality, repetitions, and points; undo restores', () => {
    const patch = updateConstruct(a => a.testPointSets, 'span-points', {
      repetitionsPerPoint: 5,
      cardinality: { linear: { minPoints: 4, rule: 'evenly spaced' } },
      points: [{ id: 'mid', fraction: 0.5, anchor: 'range_mid', offset: '±10 %' }],
    });
    const ast = run(TPS, patch);
    const text = dump(ast);
    expect(text).toContain('repetitions_per_point 5');
    expect(text).toContain('linear { min_points 4 rule "evenly spaced" }');
    expect(text).toContain('point mid { fraction 0.5 anchor range_mid offset "±10 %" }');
    const reloaded = load(text, { strict: true });
    expect(reloaded.testPointSets[0]?.points).toHaveLength(1);
    expect(reloaded.testPointSets[0]?.cardinality['nonlinear']).toBeUndefined();
    expect(validate(reloaded)).toEqual([]);
    patch.revert(ast);
    expect(ast.testPointSets[0]?.points).toHaveLength(2);
    expect(dump(ast)).toBe(dump(load(TPS, { strict: true })));
  });
});

describe('W3 subjects — the IS/HAS/DOES anatomy surface', () => {
  const SUBJECT = `subject LC500 {
  extends LoadCell
  is {
    metadata {
      name "LC-500 load cell model"
    }
    provenance {
      manufacturer "ACME Weighing GmbH"
    }
    design_parameters {
      e_max : "500 kg"
    }
    designed_conditions {
      reference ref_conditions
    }
    promises {
      mpe_within {
        target error_hold
        level symbolic C6
        conditions "over the rated range"
        statement "Holds accuracy class C6 across the rated range."
        verified_by { oiml-r60#/req/class-c/mpe }
      }
    }
  }
  has {
    attributes {
      serial_number : string declared
    }
    dimensions {
      accuracy_class in { C }
    }
    characteristics {
      error_hold e = ocl{self.indication - self.ref_load}
    }
    state lc_operational
  }
  does {
    behavior creep
  }
}
`;

  it('creates a subject with the parse-default anatomy; the dump round-trips', () => {
    const ast = run(SUBJECT, createConstruct(a => a.subjects, newSubject('S2')));
    expect(ast.subjects.map(s => s.id)).toContain('S2');
    const text = dump(ast);
    expect(text).toContain('subject S2 {');
    const reloaded = load(text, { strict: true });
    expect(reloaded.subjects.map(s => s.id)).toContain('S2');
    expect(validate(reloaded)).toEqual([]);
  });

  it('edits the anatomy facets as whole-block replacements (is/has/does)', () => {
    const ast = load(SUBJECT, { strict: true });
    const s = ast.subjects[0]!;
    const patch = updateConstruct(a => a.subjects, 'LC500', {
      is: {
        ...s.is,
        designParameters: { e_max: '600 kg', v_min: '0.02 kg' },
        promises: [...s.is.promises, { id: 'creep_c6', target: 'creep', level: null, conditions: '', statement: 'Creep stays within the envelope.', verifiedBy: ['req-x'], source: null }],
      },
      has: {
        ...s.has,
        attributes: { serial_number: 'string declared', firmware_version: 'string declared' },
        dimensions: { accuracy_class: ['C', 'D'] },
      },
      does: { behaviors: ['creep', 'self_test'] },
    });
    patch.apply(ast);
    const text = dump(ast);
    expect(text).toContain('v_min : "0.02 kg"');
    expect(text).toContain('accuracy_class in { C, D }');
    expect(text).toContain('behavior self_test');
    expect(text).toContain('creep_c6 {');
    expect(text).toContain('statement "Creep stays within the envelope."');
    const reloaded = load(text, { strict: true });
    expect(reloaded.subjects[0]?.has.dimensions['accuracy_class']).toEqual(['C', 'D']);
    expect(reloaded.subjects[0]?.is.promises).toHaveLength(2);
    expect(validate(reloaded)).toEqual([]);
    patch.revert(ast);
    expect(dump(ast)).toBe(dump(load(SUBJECT, { strict: true })));
  });

  it('the promise level edits across all three kinds', () => {
    const ast = load(SUBJECT, { strict: true });
    const s = ast.subjects[0]!;
    updateConstruct(a => a.subjects, 'LC500', {
      is: {
        ...s.is,
        promises: [
          { id: 'p_qty', target: 't', level: { kind: 'quantity', quantity: { value: 500, unit: 'kg' } }, conditions: '', statement: 'q', verifiedBy: [], source: null },
          { id: 'p_rng', target: 't', level: { kind: 'range', min: -10, max: 40, unit: 'degC' }, conditions: '', statement: 'r', verifiedBy: [], source: null },
          { id: 'p_sym', target: 't', level: { kind: 'symbolic', symbolic: 'C6' }, conditions: '', statement: 's', verifiedBy: [], source: null },
        ],
      },
    }).apply(ast);
    const text = dump(ast);
    // The level spellings (MN 113): quantity is the bare block, range and
    // symbolic carry the keyword.
    expect(text).toContain('level { value 500 unit "kg" }');
    expect(text).toContain('level range { min -10 max 40 unit "degC" }');
    expect(text).toContain('level symbolic C6');
    const reloaded = load(text, { strict: true });
    const levels = reloaded.subjects[0]!.is.promises.map(p => p.level?.kind);
    expect(levels).toEqual(['quantity', 'range', 'symbolic']);
  });

  it('the shorthand characteristic round-trips and edits', () => {
    const ast = load(SUBJECT, { strict: true });
    const s = ast.subjects[0]!;
    expect(s.has.characteristics['error_hold']?.symbol).toBe('e');
    updateConstruct(a => a.subjects, 'LC500', {
      has: {
        ...s.has,
        characteristics: {
          ...s.has.characteristics,
          creep: { symbol: 'c_c', derivation: 'ocl{i2 - i1}', behavior: 'creep', quantityKind: 'mass', unit: 'g' },
        },
      },
    }).apply(ast);
    const text = dump(ast);
    expect(text).toContain('error_hold e = ocl{self.indication - self.ref_load}');
    expect(text).toContain('creep {');
    expect(text).toContain('symbol "c_c"');
    expect(load(text, { strict: true }).subjects[0]?.has.characteristics['creep']?.unit).toBe('g');
  });

  it('deletes a subject; the removal reverts to the exact slot', () => {
    const two = SUBJECT + '\nsubject Other {\n}\n';
    const del = deleteConstruct(a => a.subjects, 'LC500');
    const ast = run(two, del);
    expect(ast.subjects.map(s => s.id)).toEqual(['Other']);
    del.revert(ast);
    expect(ast.subjects.map(s => s.id)).toEqual(['LC500', 'Other']);
  });
});

describe('W3 the compliance surface — the provision-era bridge (audit G6)', () => {
  it('reads provisions on legacy models (the unchanged path)', () => {
    const ast = load('provision p1 {\n  modality SHALL\n}\nprovision p2 {\n  modality MAY\n}\n', { strict: true });
    const s = complianceSurface(ast);
    expect(s.kind).toBe('provisions');
    expect(s.label).toBe('provisions');
    expect(s.rows.map(r => [r.id, r.modality])).toEqual([['p1', 'SHALL'], ['p2', 'MAY']]);
    expect(s.modalities).toEqual(['all', 'SHALL', 'SHOULD', 'MAY']);
  });

  it('reads the REAL requirements on v3 packages (0 provisions, 180 requirements)', () => {
    const ast = load('requirement r1 {\n  name "First"\n  statement "s"\n  obligation shall\n}\nrequirement r2 {\n  name "Second"\n  statement "s"\n  obligation may\n}\n', { strict: true });
    const s = complianceSurface(ast);
    expect(s.kind).toBe('requirements');
    expect(s.label).toBe('requirements');
    expect(s.rows).toHaveLength(2);
    expect(s.rows[0]).toEqual({ id: 'r1', modality: 'shall', detail: 'First' });
    expect(s.modalities).toEqual(['all', 'shall', 'may']);
  });

  it('an empty model reads as provisions with zero rows (the honest zero)', () => {
    const s = complianceSurface(load('', { strict: true }));
    expect(s.kind).toBe('provisions');
    expect(s.rows).toEqual([]);
  });
});

describe('W3 behaviors, capabilities, condition sets, verdicts — the subject-chain companions', () => {
  const CHAIN = `behavior creep {
  kind temporal
  stimulus force
  response "Change in load cell output with time under constant load (R 60-1, 3.4.4)."
}

capability gas-analytical-system {
  label "Gas Analytical System"
  description "Base capability — all gas analytical systems have this."
  has_parameters { measurand_components mpe }
  satisfies_requirements { /req/metrological/mpe-intrinsic }
  verified_by_tests { /conf/performance-tests/error-determination }
}

condition_set ref-conditions {
  role reference
  subject GasAnalyticalSystem
  entries {
    temperature { value "20" unit "degC" tolerance "5" note "Reference temperature" }
  }
  ref derives-from "urn:oiml:pub:r:144-1:2013#clause-8"
}

verdict creep {
  symbol "C_C"
  behavior creep
  quantity { kind verification_interval unit "v" }
  derive "ocl{abs(c_c)}"
  inputs { c_c }
  ref derives-from "urn:oiml:pub:r:60-3:2021#clause-2.1.5"
}
`;

  it('creates each kind with the parse defaults; the dump round-trips', () => {
    const ast = run(
      CHAIN,
      createConstruct(a => a.behaviors, newBehavior('b_new')),
      createConstruct(a => a.capabilities, newCapability('c_new')),
      createConstruct(a => a.conditionSets, newConditionSet('cs_new')),
      createConstruct(a => a.verdicts, newVerdict('v_new')),
    );
    const reloaded = load(dump(ast), { strict: true });
    expect(reloaded.behaviors.map(b => b.id)).toContain('b_new');
    expect(reloaded.capabilities.map(c => c.id)).toContain('c_new');
    expect(reloaded.conditionSets.map(c => c.id)).toContain('cs_new');
    expect(reloaded.verdicts.map(v => v.id)).toContain('v_new');
    expect(validate(reloaded)).toEqual([]);
  });

  it('the behavior facets edit and undo exactly', () => {
    const patch = updateConstruct(a => a.behaviors, 'creep', {
      response: 'Output change under constant load (edited).',
      verifiedBy: ['/conf/metrological-tests/creep'],
    });
    const ast = run(CHAIN, patch);
    const text = dump(ast);
    expect(text).toContain('response "Output change under constant load (edited)."');
    expect(text).toContain('verified_by { /conf/metrological-tests/creep }');
    patch.revert(ast);
    expect(dump(ast)).toBe(dump(load(CHAIN, { strict: true })));
  });

  it('the capability chains edit as lists', () => {
    const ast = run(CHAIN, updateConstruct(a => a.capabilities, 'gas-analytical-system', {
      requires: ['base-cap'],
      hasParameters: ['measurand_components', 'mpe', 'response_time'],
    }));
    const text = dump(ast);
    expect(text).toContain('requires { base-cap }');
    expect(text).toContain('has_parameters { measurand_components mpe response_time }');
    expect(validate(load(text, { strict: true }))).toEqual([]);
  });

  it('the condition set entries edit keyed on quantity kind (source ↔ sources alias)', () => {
    const ast = load(CHAIN, { strict: true });
    const cs = ast.conditionSets[0]!;
    expect(cs.source?.clause).toBe('8');
    expect(cs.sources?.[0]).toEqual(cs.source);
    updateConstruct(a => a.conditionSets, 'ref-conditions', {
      entries: [...cs.entries, { quantityKind: 'power_voltage', value: 'nominal', unit: 'V', tolerance: '2 %' }],
    }).apply(ast);
    const text = dump(ast);
    expect(text).toContain('power_voltage { value nominal unit "V" tolerance "2 %" }');
    expect(load(text, { strict: true }).conditionSets[0]?.entries).toHaveLength(2);
  });

  it('the verdict derivation, inputs, and quantity kind edit and round-trip', () => {
    const patch = updateConstruct(a => a.verdicts, 'creep', {
      derive: 'ocl{abs(c_c) / e_max}',
      inputs: ['c_c', 'e_max'],
      seriesReduction: 'max',
    });
    const ast = run(CHAIN, patch);
    const text = dump(ast);
    expect(text).toContain('derive "ocl{abs(c_c) / e_max}"');
    expect(text).toContain('inputs { c_c e_max }');
    const reloaded = load(text, { strict: true });
    expect(reloaded.verdicts[0]?.seriesReduction).toBe('max');
    expect(validate(reloaded)).toEqual([]);
    patch.revert(ast);
    expect(dump(ast)).toBe(dump(load(CHAIN, { strict: true })));
  });
});
