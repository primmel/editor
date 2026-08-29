// ─────────────────────────────────────────────────────────────────────
// TODO.editor wave 03, window 2 — the remaining v3 construct surfaces.
// Same pin as v3-constructs.test.ts: each kind's command path (the tree
// create with the parse-default factory, the inspector's facet patches,
// exact undo/redo) plus the kernel round trip — the dumped text reparses
// strict and validates clean (the wave gate: author every construct
// kind, no hand-edits). Kernel dump/parse gaps are pinned, never worked
// around (the fixes are upstream, primmel-ts).
// ─────────────────────────────────────────────────────────────────────

import { describe, it, expect } from 'vitest';
import { dump, load, validate } from '@primmel/primmel';
import {
  createConstruct,
  deleteConstruct,
  updateConstruct,
  type Command,
} from '../commands';
import {
  newAttributeDefinition,
  newConformanceClass,
  newDual,
  newInstrument,
  newQuantityRegister,
  newReferenceMaterial,
  newSymbol,
} from '../factory';

/** Apply commands against a fresh strict parse, returning the state. */
function run(text: string, ...commands: Command[]) {
  const ast = load(text, { strict: true });
  for (const c of commands) c.apply(ast);
  return ast;
}

describe('W3.2 symbols — the symbol surface', () => {
  const SYMBOLS = `symbol e {
  name "e"
  definition "Indication error"
  type number
  unit "kg"
  kind formula
  quantity_kind mass
  origin derived
  legacy_id "3.2.1"
  attribute error
  calculation calc_error
  formula {
    display "e = I - m"
    expression "ocl{I - m}"
    inputs { I m }
  }
  note "first note"
  source { doc "urn:oiml:pub:r:60-1:2021" clause "3.2.1" }
}

symbol m {
  name "m"
  definition "Applied load"
  type number
}
`;

  it('creates a symbol with the parse defaults; the dump round-trips', () => {
    const ast = run(SYMBOLS, createConstruct(a => a.symbols, newSymbol('s_new')));
    const s = ast.symbols.find(x => x.id === 's_new');
    expect(s?.type).toBe('number');
    expect(s?.unit).toBe('1'); // the parse's dimensionless default
    const text = dump(ast);
    expect(text).toContain('symbol s_new {');
    expect(text).not.toContain('unit "1"'); // the dimensionless default never serializes
    const reloaded = load(text, { strict: true });
    expect(reloaded.symbols.map(x => x.id)).toContain('s_new');
    expect(validate(reloaded)).toEqual([]);
  });

  it('patches the scalar facets and the formula; undo restores', () => {
    const patch = updateConstruct(a => a.symbols, 'm', {
      name: 'm (edited)',
      unit: 'kg',
      kind: 'attribute',
      formula: { display: 'm', expression: 'ocl{m}', inputs: ['m'] },
      notes: ['a note'],
    });
    const ast = run(SYMBOLS, patch);
    const text = dump(ast);
    expect(text).toContain('name "m (edited)"');
    expect(text).toContain('unit "kg"');
    expect(text).toContain('formula { display "m" expression "ocl{m}" inputs { m } }');
    expect(text).toContain('note "a note"');
    const reloaded = load(text, { strict: true });
    expect(reloaded.symbols.find(s => s.id === 'm')?.formula?.inputs).toEqual(['m']);
    expect(validate(reloaded)).toEqual([]);
    patch.revert(ast);
    expect(dump(ast)).toBe(dump(load(SYMBOLS, { strict: true })));
  });

  it('patches the sourceRef (doc + clause); the dump emits the source block', () => {
    const ast = run(SYMBOLS, updateConstruct(a => a.symbols, 'm', {
      sourceRef: { doc: 'urn:oiml:pub:r:60-1:2021', clause: '3.5.2' },
    }));
    const text = dump(ast);
    expect(text).toContain('source { doc "urn:oiml:pub:r:60-1:2021" clause "3.5.2" }');
    expect(load(text, { strict: true }).symbols.find(s => s.id === 'm')?.sourceRef?.clause).toBe('3.5.2');
  });

  it('the values list edits; a SINGLE value round-trips', () => {
    const patch = updateConstruct(a => a.symbols, 'm', { values: ['C'] });
    const ast = run(SYMBOLS, patch);
    const text = dump(ast);
    expect(text).toContain('values C');
    expect(load(text, { strict: true }).symbols.find(s => s.id === 'm')?.values).toEqual(['C']);
    patch.revert(ast);
    expect(dump(ast)).toBe(dump(load(SYMBOLS, { strict: true })));
  });

  it('pins the kernel gap: dumpSymbol emits the values list BARE — 2+ values do not reparse', () => {
    // Kernel 1.8.0: the parser reads `values { A B }` (a block) but the
    // dump emits `values A B` (bare), and the reparse reads ONE value
    // then loses the token walk. The fix is upstream (primmel-ts) —
    // when it lands this test flips and the inspector hint comes off.
    const ast = run(SYMBOLS, updateConstruct(a => a.symbols, 'm', { values: ['A', 'B'] }));
    const text = dump(ast);
    expect(text).toContain('values A B');
    expect(() => load(text, { strict: true })).toThrow();
  });

  it('deletes a symbol; the removal reverts to the exact slot', () => {
    const del = deleteConstruct(a => a.symbols, 'e');
    const ast = run(SYMBOLS, del);
    expect(ast.symbols.map(s => s.id)).toEqual(['m']);
    del.revert(ast);
    expect(ast.symbols.map(s => s.id)).toEqual(['e', 'm']);
  });
});

describe('W3.2 attribute definitions — the INV-2 schema surface', () => {
  const ATTRS = `attribute_definition e_max {
  symbol "E_max"
  name "Maximum capacity"
  definition "Upper limit of the measuring range"
  quantity_kind mass
  unit "kg"
  value_type number
  origin declared
  scope model
  category metrological
  is_dimension false
  irdi "0112/2///62720#UAD001"
  ref derives-from "urn:oiml:pub:r:60-1:2021#clause-3.5.3"
}

attribute_definition accuracy_class {
  name "Accuracy class"
  definition "The classification"
  scope family
}
`;

  it('creates an attribute definition with the parse defaults; the dump round-trips', () => {
    const ast = run(ATTRS, createConstruct(a => a.attributeDefinitions, newAttributeDefinition('a_new')));
    const a = ast.attributeDefinitions.find(x => x.id === 'a_new');
    expect(a?.isDimension).toBe(null);
    const text = dump(ast);
    expect(text).toContain('attribute_definition a_new {');
    const reloaded = load(text, { strict: true });
    expect(reloaded.attributeDefinitions.map(x => x.id)).toContain('a_new');
    expect(validate(reloaded)).toEqual([]);
  });

  it('patches the facets (incl. the tri-state is_dimension); undo restores', () => {
    const patch = updateConstruct(a => a.attributeDefinitions, 'accuracy_class', {
      scope: 'family',
      category: 'classification',
      isDimension: true,
      enumRef: 'accuracy-classes',
      derived: 'ocl{self.class}',
    });
    const ast = run(ATTRS, patch);
    const text = dump(ast);
    expect(text).toContain('category classification');
    expect(text).toContain('is_dimension true');
    expect(text).toContain('enum accuracy-classes');
    expect(text).toContain('derived "ocl{self.class}"');
    const reloaded = load(text, { strict: true });
    expect(reloaded.attributeDefinitions.find(a => a.id === 'accuracy_class')?.isDimension).toBe(true);
    expect(validate(reloaded)).toEqual([]);
    patch.revert(ast);
    expect(ast.attributeDefinitions.find(a => a.id === 'accuracy_class')?.isDimension).toBe(null);
    expect(dump(ast)).toBe(dump(load(ATTRS, { strict: true })));
  });

  it('the source patch keeps the sourceRefs alias (the dump folds to ref derives-from)', () => {
    const ast = load(ATTRS, { strict: true });
    const a = ast.attributeDefinitions[0]!;
    expect(a.source?.clause).toBe('3.5.3');
    const source = { doc: a.source!.doc, clause: '3.5.4' };
    updateConstruct(a => a.attributeDefinitions, 'e_max', { source, sourceRefs: [source] }).apply(ast);
    const text = dump(ast);
    expect(text).toContain('ref derives-from "urn:oiml:pub:r:60-1:2021#clause-3.5.4"');
    expect(load(text, { strict: true }).attributeDefinitions[0]?.source?.clause).toBe('3.5.4');
  });

  it('pins the kernel gaps: note, enum_values and ref cites parse but never dump', () => {
    // Kernel 1.8.0: parseAttributeDefinition reads note / enum_values /
    // `ref cites` (→ referenceIds); dumpAttributeDefinition emits none of
    // them. An edit through the save path would silently strip them (the
    // wave-00 overlay regression's shape) — the inspector shows all three
    // read-only. The fix is upstream (primmel-ts); when it lands this
    // test flips and the read-only markers come off.
    const ast = load(`attribute_definition a {
  name "A"
  definition "d"
  note "a note"
  enum_values { X Y }
  ref cites "urn:oiml:pub:r:60-1:2021#clause-3.1"
}\n`, { strict: true });
    const a = ast.attributeDefinitions[0]!;
    expect(a.note).toBe('a note');
    expect(a.enumValues).toEqual(['X', 'Y']);
    expect(a.referenceIds).toEqual(['urn:oiml:pub:r:60-1:2021#clause-3.1']);
    const text = dump(ast);
    expect(text).not.toContain('note "a note"');
    expect(text).not.toContain('enum_values');
    expect(text).not.toContain('cites');
    const reloaded = load(text, { strict: true });
    expect(reloaded.attributeDefinitions[0]?.note).toBeUndefined();
    expect(reloaded.attributeDefinitions[0]?.referenceIds).toEqual([]);
  });

  it('deletes an attribute definition; the removal reverts to the exact slot', () => {
    const del = deleteConstruct(a => a.attributeDefinitions, 'e_max');
    const ast = run(ATTRS, del);
    expect(ast.attributeDefinitions.map(a => a.id)).toEqual(['accuracy_class']);
    del.revert(ast);
    expect(ast.attributeDefinitions.map(a => a.id)).toEqual(['e_max', 'accuracy_class']);
  });
});

describe('W3.2 quantity registers — the unit/kind registry surface', () => {
  const QR = `quantity_register si {
  kind mass {
    dimensions { M 1 }
    si_unit "kg"
    description "Mass"
  }
  unit kg {
    symbol "kg"
    label "kilogram"
    kind mass
    definition "SI base unit of mass"
  }
  unit g {
    symbol "g"
    kind mass
    factor 0.001
  }
}
`;

  it('creates a register with the parse defaults; the dump round-trips', () => {
    const ast = run(QR, createConstruct(a => a.quantityRegisters, newQuantityRegister('q_new')));
    expect(ast.quantityRegisters.map(q => q.id)).toContain('q_new');
    const reloaded = load(dump(ast), { strict: true });
    expect(reloaded.quantityRegisters.map(q => q.id)).toContain('q_new');
    expect(validate(reloaded)).toEqual([]);
  });

  it('edits kinds (with the dimension vector) and units; the compact factor/offset dump', () => {
    const patch = updateConstruct(a => a.quantityRegisters, 'si', {
      kinds: [
        { id: 'mass', dimensions: { M: 1 }, siUnit: 'kg', description: 'Mass' },
        { id: 'temperature', dimensions: { 'Θ': 1 }, siUnit: 'K', description: 'Thermodynamic temperature' },
      ],
      units: [
        { id: 'kg', symbol: 'kg', label: 'kilogram', kind: 'mass', factorToSI: 1, offsetToSI: 0, definition: 'SI base unit of mass' },
        { id: 'g', symbol: 'g', label: 'gram', kind: 'mass', factorToSI: 0.001, offsetToSI: 0, definition: '' },
        { id: 'degC', symbol: '°C', label: 'degree Celsius', kind: 'temperature', factorToSI: 1, offsetToSI: 273.15, definition: '' },
      ],
    });
    const ast = run(QR, patch);
    const text = dump(ast);
    expect(text).toContain('kind temperature { dimensions { Θ 1 } si_unit "K" description "Thermodynamic temperature" }');
    expect(text).toContain('unit g { symbol "g" label "gram" kind mass factor 0.001 }');
    expect(text).toContain('unit degC { symbol "°C" label "degree Celsius" kind temperature offset 273.15 }');
    // factor 1 / offset 0 never serialize (the compact form).
    expect(text).toContain('unit kg { symbol "kg" label "kilogram" kind mass definition "SI base unit of mass" }');
    const reloaded = load(text, { strict: true });
    expect(reloaded.quantityRegisters[0]?.kinds).toHaveLength(2);
    expect(reloaded.quantityRegisters[0]?.units.find(u => u.id === 'degC')?.offsetToSI).toBe(273.15);
    expect(validate(reloaded)).toEqual([]);
    patch.revert(ast);
    expect(dump(ast)).toBe(dump(load(QR, { strict: true })));
  });

  it('removes a unit; undo restores it at the exact slot', () => {
    const patch = updateConstruct(a => a.quantityRegisters, 'si', {
      units: load(QR, { strict: true }).quantityRegisters[0]!.units.filter(u => u.id !== 'g'),
    });
    const ast = run(QR, patch);
    expect(ast.quantityRegisters[0]?.units.map(u => u.id)).toEqual(['kg']);
    patch.revert(ast);
    expect(ast.quantityRegisters[0]?.units.map(u => u.id)).toEqual(['kg', 'g']);
    expect(dump(ast)).toBe(dump(load(QR, { strict: true })));
  });

  it('deletes a register; the removal reverts to the exact slot', () => {
    const two = QR + '\nquantity_register imperial {\n}\n';
    const del = deleteConstruct(a => a.quantityRegisters, 'si');
    const ast = run(two, del);
    expect(ast.quantityRegisters.map(q => q.id)).toEqual(['imperial']);
    del.revert(ast);
    expect(ast.quantityRegisters.map(q => q.id)).toEqual(['si', 'imperial']);
  });
});

describe('W3.2 duals — the IS↔HAS duality surface', () => {
  const DUALS = `dual d_e_max {
  attribute e_max
  designed { value 500 unit "kg" tolerance "0" }
  exhibited { value 499.9 unit "kg" uncertainty "0.1" }
}

dual d_v_min {
  attribute v_min
  designed { value 0.02 unit "kg" }
}
`;

  it('creates a dual with the parse defaults; the dump round-trips', () => {
    const ast = run(DUALS, createConstruct(a => a.duals, newDual('d_new')));
    expect(ast.duals.map(d => d.id)).toContain('d_new');
    const reloaded = load(dump(ast), { strict: true });
    expect(reloaded.duals.map(d => d.id)).toContain('d_new');
    expect(validate(reloaded)).toEqual([]);
  });

  it('edits the roles (value coercion, unit, the spread facet); undo restores', () => {
    const patch = updateConstruct(a => a.duals, 'd_v_min', {
      designed: { value: 0.05, unit: 'kg', tolerance: '0.001' },
      exhibited: { value: 0.049, unit: 'kg', uncertainty: '0.002' },
    });
    const ast = run(DUALS, patch);
    const text = dump(ast);
    expect(text).toContain('designed { value 0.05 unit "kg" tolerance "0.001" }');
    expect(text).toContain('exhibited { value 0.049 unit "kg" uncertainty "0.002" }');
    const reloaded = load(text, { strict: true });
    expect(reloaded.duals.find(d => d.id === 'd_v_min')?.exhibited?.value).toBe(0.049);
    expect(validate(reloaded)).toEqual([]);
    patch.revert(ast);
    expect(dump(ast)).toBe(dump(load(DUALS, { strict: true })));
  });

  it('drops a role when the other stays (C34); the quantity-kind override round-trips', () => {
    const ast = run(DUALS, updateConstruct(a => a.duals, 'd_e_max', {
      exhibited: { value: 499.9, unit: 'kg', quantityKind: 'mass', uncertainty: '0.1' },
      designed: undefined,
    }));
    const text = dump(ast);
    const eMaxBlock = text.split('dual d_v_min')[0]!;
    expect(eMaxBlock).not.toContain('designed');
    expect(eMaxBlock).toContain('exhibited { value 499.9 unit "kg" kind mass uncertainty "0.1" }');
    expect(load(text, { strict: true }).duals.find(d => d.id === 'd_e_max')?.designed).toBeUndefined();
  });

  it('deletes a dual; the removal reverts to the exact slot', () => {
    const del = deleteConstruct(a => a.duals, 'd_e_max');
    const ast = run(DUALS, del);
    expect(ast.duals.map(d => d.id)).toEqual(['d_v_min']);
    del.revert(ast);
    expect(ast.duals.map(d => d.id)).toEqual(['d_e_max', 'd_v_min']);
  });
});

describe('W3.2 reference materials — the certified-material surface', () => {
  const RMS = `reference_material cgm-200 {
  kind certified_gas_mixture
  name "CGM 200"
  definition "Certified gas mixture for analyzer verification"
  source { doc "urn:oiml:pub:r:144-1:2013" clause "5.2" }
  identity_fields {
    field composition { description "Component(s) and nominal concentrations" }
    field certified_value { description "The certified concentration" unit "mol/mol" type mole_fraction required true }
  }
  constraints {
    constraint purity_band {
      description "The purity band"
      rule "ocl{purity >= 0.999}"
      evidence { purity: purity_certificate }
      override { rule "ocl{purity >= 0.99}" by issuing_authority evidence override_approved }
      on_violation invalidate
      source { doc "urn:oiml:pub:r:144-1:2013" clause "5.2.1" }
    }
  }
}

reference_material rsm-1 {
  kind reference_speed_meter
  name "RSM 1"
}
`;

  it('creates a material with the parse defaults; the dump round-trips', () => {
    const ast = run(RMS, createConstruct(a => a.referenceMaterials, newReferenceMaterial('rm_new')));
    const rm = ast.referenceMaterials.find(r => r.id === 'rm_new');
    expect(rm?.identityFields).toEqual([]);
    expect(rm?.constraints).toEqual([]);
    const text = dump(ast);
    expect(text).toContain('reference_material rm_new {');
    const reloaded = load(text, { strict: true });
    expect(reloaded.referenceMaterials.map(r => r.id)).toContain('rm_new');
    expect(validate(reloaded)).toEqual([]);
  });

  it('edits the identity fields (the required flag, unit, type); undo restores', () => {
    const patch = updateConstruct(a => a.referenceMaterials, 'rsm-1', {
      identityFields: [{ name: 'reference_speed', description: 'The reference speed', unit: 'km/h', type: 'speed', required: true }],
    });
    const ast = run(RMS, patch);
    const text = dump(ast);
    expect(text).toContain('field reference_speed { description "The reference speed" unit "km/h" type speed required true }');
    const reloaded = load(text, { strict: true });
    expect(reloaded.referenceMaterials.find(r => r.id === 'rsm-1')?.identityFields[0]?.required).toBe(true);
    expect(validate(reloaded)).toEqual([]);
    patch.revert(ast);
    expect(dump(ast)).toBe(dump(load(RMS, { strict: true })));
  });

  it('edits a constraint with its override and evidence bindings', () => {
    const ast = load(RMS, { strict: true });
    const c = ast.referenceMaterials[0]!.constraints[0]!;
    expect(c.override?.by).toBe('issuing_authority');
    const patch = updateConstruct(a => a.referenceMaterials, 'cgm-200', {
      constraints: [{
        ...c,
        rule: 'ocl{purity >= 0.9995}',
        evidence: { purity: 'purity_certificate', lab: 'lab_report' },
        override: { rule: 'ocl{purity >= 0.995}', by: 'issuing_authority', evidence: 'override_approved' },
      }],
    });
    patch.apply(ast);
    const text = dump(ast);
    expect(text).toContain('rule "ocl{purity >= 0.9995}"');
    expect(text).toContain('evidence { purity: purity_certificate lab: lab_report }');
    expect(text).toContain('override { rule "ocl{purity >= 0.995}" by issuing_authority evidence override_approved }');
    const reloaded = load(text, { strict: true });
    expect(reloaded.referenceMaterials[0]?.constraints[0]?.override?.rule).toBe('ocl{purity >= 0.995}');
    expect(validate(reloaded)).toEqual([]);
    patch.revert(ast);
    expect(dump(ast)).toBe(dump(load(RMS, { strict: true })));
  });

  it('the source patch keeps the sourceRefs alias (the dump folds to ref derives-from)', () => {
    const ast = load(RMS, { strict: true });
    const source = { doc: 'urn:oiml:pub:r:144-1:2013', clause: '5.3' };
    updateConstruct(a => a.referenceMaterials, 'cgm-200', { source, sourceRefs: [source] }).apply(ast);
    const text = dump(ast);
    expect(text).toContain('ref derives-from "urn:oiml:pub:r:144-1:2013#clause-5.3"');
    expect(load(text, { strict: true }).referenceMaterials[0]?.source?.clause).toBe('5.3');
  });

  it('deletes a material; the removal reverts to the exact slot', () => {
    const del = deleteConstruct(a => a.referenceMaterials, 'cgm-200');
    const ast = run(RMS, del);
    expect(ast.referenceMaterials.map(r => r.id)).toEqual(['rsm-1']);
    del.revert(ast);
    expect(ast.referenceMaterials.map(r => r.id)).toEqual(['cgm-200', 'rsm-1']);
  });
});

describe('W3.2 instruments — the subject-TYPE surface', () => {
  const INSTRUMENT = `instrument LoadCell {
  extends MeasuringInstrument
  measurand_kind force
  definition "A load cell family"
  variant DigitalLoadCell {
    name "Digital load cell"
    definition "d"
  }
  dimension accuracy_class {
    label "Accuracy class"
    scope family
    cardinality single
    values {
      C { label "Class C" description "d" }
      D { label "Class D" implies { C } }
    }
  }
  family {
    metamodel_class MeasuringInstrumentModelFamily
    definition "The family definition"
  }
  family_criteria {
    "criterion one"
  }
  family_defaults {
    dimensions { accuracy_class }
    parameters { e_max }
  }
  model_group {
    definition "the inner family"
    group_by accuracy_class
    identical_characteristics { creep }
    identical_attributes { e_max }
  }
  source { doc "urn:oiml:pub:r:60-1:2021" clause "2.1" }
}

instrument Other {
  definition "d"
}
`;

  it('creates an instrument with the parse defaults; the dump round-trips', () => {
    const ast = run(INSTRUMENT, createConstruct(a => a.instruments, newInstrument('NewInstrument')));
    const i = ast.instruments.find(x => x.id === 'NewInstrument');
    expect(i?.variants).toEqual([]);
    expect(i?.modelGroup).toBe(null);
    const text = dump(ast);
    expect(text).toContain('instrument NewInstrument {');
    const reloaded = load(text, { strict: true });
    expect(reloaded.instruments.map(x => x.id)).toContain('NewInstrument');
    expect(validate(reloaded)).toEqual([]);
  });

  it('edits variants, dimensions + values, the family block and the model group; undo restores', () => {
    const patch = updateConstruct(a => a.instruments, 'Other', {
      variants: [{ id: 'AnalogVariant', name: 'Analog', definition: 'd' }],
      dimensions: [{
        id: 'installation', label: 'Installation', scope: 'model', cardinality: 'set',
        labelSeparator: '', description: '', source: null,
        values: [{ id: 'fixed', label: 'Fixed', description: '', payload: {}, implies: [] }],
      }],
      familyMetamodelClass: 'MeasuringInstrumentModelFamily',
      familyDefinition: 'f',
      familyCriteria: ['c1', 'c2'],
      familyDefaultDimensions: ['installation'],
      familyDefaultParameters: ['e_max'],
      modelGroup: { definition: 'mg', identicalCharacteristics: ['creep'], identicalAttributes: ['e_max'], groupBy: 'installation' },
    });
    const ast = run(INSTRUMENT, patch);
    const text = dump(ast);
    expect(text).toContain('variant AnalogVariant { name "Analog" definition "d" }');
    expect(text).toContain('dimension installation {');
    expect(text).toContain('cardinality set');
    expect(text).toContain('fixed { label "Fixed" }');
    expect(text).toContain('family {');
    expect(text).toContain('family_criteria {');
    expect(text).toContain('group_by installation');
    const reloaded = load(text, { strict: true });
    const other = reloaded.instruments.find(x => x.id === 'Other');
    expect(other?.dimensions[0]?.values.map(v => v.id)).toEqual(['fixed']);
    expect(other?.modelGroup?.groupBy).toBe('installation');
    expect(validate(reloaded)).toEqual([]);
    patch.revert(ast);
    expect(dump(ast)).toBe(dump(load(INSTRUMENT, { strict: true })));
  });

  it('the implies closure and a rename of the initial state survive the round trip', () => {
    const ast = load(INSTRUMENT, { strict: true });
    expect(ast.instruments[0]?.dimensions[0]?.values[1]?.implies).toEqual(['C']);
    const text = dump(ast);
    expect(text).toContain('D { label "Class D" implies { C } }');
    expect(load(text, { strict: true }).instruments[0]?.dimensions[0]?.values[1]?.implies).toEqual(['C']);
  });

  it('the source patch keeps the sourceRefs alias (the dump folds to ref derives-from)', () => {
    const ast = load(INSTRUMENT, { strict: true });
    const source = { doc: 'urn:oiml:pub:r:60-1:2021', clause: '2.2' };
    updateConstruct(a => a.instruments, 'LoadCell', { source, sourceRefs: [source] }).apply(ast);
    const text = dump(ast);
    expect(text).toContain('ref derives-from "urn:oiml:pub:r:60-1:2021#clause-2.2"');
    expect(load(text, { strict: true }).instruments[0]?.source?.clause).toBe('2.2');
  });

  it('deletes an instrument; the removal reverts to the exact slot', () => {
    const del = deleteConstruct(a => a.instruments, 'LoadCell');
    const ast = run(INSTRUMENT, del);
    expect(ast.instruments.map(i => i.id)).toEqual(['Other']);
    del.revert(ast);
    expect(ast.instruments.map(i => i.id)).toEqual(['LoadCell', 'Other']);
  });
});

describe('W3.2 conformance classes — the test-scope surface', () => {
  const CCS = `conformance_class /conf/metrological {
  title "Metrological tests"
  name "Metrological"
  target /req/metrological
  subject "LoadCell"
  description "d"
  applicability {
    accuracy_class: [C, D] match any
  }
  guidance "g"
  test_subject {
    kind: "load cell"
  }
  dependencies { /conf/other }
}
`;

  it('creates a conformance class with the parse defaults; the dump round-trips', () => {
    const ast = run(CCS, createConstruct(a => a.conformanceClasses, newConformanceClass('/conf/new')));
    const c = ast.conformanceClasses.find(x => x.id === '/conf/new');
    expect(c?.applicability).toEqual([]);
    const text = dump(ast);
    expect(text).toContain('conformance_class /conf/new {');
    const reloaded = load(text, { strict: true });
    expect(reloaded.conformanceClasses.map(x => x.id)).toContain('/conf/new');
    expect(validate(reloaded)).toEqual([]);
  });

  it('edits the applicability entries (values + match mode); undo restores', () => {
    const patch = updateConstruct(a => a.conformanceClasses, '/conf/metrological', {
      applicability: [
        { dimension: 'accuracy_class', values: ['C'], mapping: null, match: 'all' as const },
        { dimension: 'installation', values: ['fixed', 'portable'], mapping: null, match: null },
      ],
    });
    const ast = run(CCS, patch);
    const text = dump(ast);
    expect(text).toContain('accuracy_class: [C] match all');
    expect(text).toContain('installation: [fixed, portable]');
    const reloaded = load(text, { strict: true });
    expect(reloaded.conformanceClasses[0]?.applicability).toHaveLength(2);
    expect(reloaded.conformanceClasses[0]?.applicability[0]?.match).toBe('all');
    expect(validate(reloaded)).toEqual([]);
    patch.revert(ast);
    expect(dump(ast)).toBe(dump(load(CCS, { strict: true })));
  });

  it('edits the scalar facets and the test-subject pairs', () => {
    const ast = run(CCS, updateConstruct(a => a.conformanceClasses, '/conf/metrological', {
      guidance: 'edited guidance',
      dependencies: ['/conf/other', '/conf/second'],
      testSubject: { kind: 'load cell', mounting: 'rigid' },
    }));
    const text = dump(ast);
    expect(text).toContain('guidance "edited guidance"');
    expect(text).toContain('dependencies { /conf/other /conf/second }');
    expect(text).toContain('kind: "load cell"');
    expect(text).toContain('mounting: "rigid"');
    expect(validate(load(text, { strict: true }))).toEqual([]);
  });

  it('deletes a conformance class; the removal reverts to the exact slot', () => {
    const two = CCS + '\nconformance_class /conf/second {\n  name "Second"\n  target /req/other\n}\n';
    const del = deleteConstruct(a => a.conformanceClasses, '/conf/metrological');
    const ast = run(two, del);
    expect(ast.conformanceClasses.map(c => c.id)).toEqual(['/conf/second']);
    del.revert(ast);
    expect(ast.conformanceClasses.map(c => c.id)).toEqual(['/conf/metrological', '/conf/second']);
  });
});
