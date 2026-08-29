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
  newCalculation,
  newConstraint,
  newStateMachine,
  newTable,
  newTerm,
} from '../factory';

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
