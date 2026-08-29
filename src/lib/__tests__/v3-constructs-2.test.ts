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
  newActivityArchetype,
  newArtifactDefinition,
  newArtifactInstance,
  newAttributeDefinition,
  newCompetenceKind,
  newConformanceClass,
  newConnectorProfile,
  newDataspace,
  newDiscrepancyRecord,
  newDual,
  newFormulasUsed,
  newInstance,
  newInstrument,
  newInvariant,
  newMonitor,
  newPassport,
  newPolicy,
  newPredicate,
  newQuantityRegister,
  newReferenceMaterial,
  newSymbol,
  newTextContent,
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

describe('W3.2 instances + artifacts — the instance plane', () => {
  const PLANE = `subject LC500 {
}

instance smp-001 {
  of LC500
  level sample
  model mod-2t
  definition_versions { LC500 : "2021" }
  has {
    attributes { serial_number : "ABC-123" net_weight : 2.2 kg }
    test_context { d_min : 0 kg }
  }
}

artifact_definition evidence_file {
  name "Evidence file"
  description "One record per enforcement measurement"
  content_contract {
    fields {
      speed : speed "The measured speed"
      photo : media optional "Vehicle image"
    }
    structure "one record per measurement"
    media {
      photo { kinds { jpeg png } role "vehicle identification" }
    }
  }
  produced_when per_measurement
  retention "three months (secure)"
  source { doc "urn:oiml:pub:r:91-1:2024" clause "6.6" }
}

artifact_instance ai-1 {
  of evidence_file
  produced_at "2026-08-29T10:00:00Z"
  by smp-001
  content {
    speed : 87.5 km/h
  }
  links { run-1 }
}
`;

  it('creates the three kinds with the parse defaults; the dump round-trips', () => {
    const ast = run(
      PLANE,
      createConstruct(a => a.instances, newInstance('i_new')),
      createConstruct(a => a.artifactDefinitions, newArtifactDefinition('ad_new')),
      createConstruct(a => a.artifactInstances, newArtifactInstance('ai_new')),
    );
    const reloaded = load(dump(ast), { strict: true });
    expect(reloaded.instances.map(i => i.id)).toContain('i_new');
    expect(reloaded.artifactDefinitions.map(a => a.id)).toContain('ad_new');
    expect(reloaded.artifactInstances.map(a => a.id)).toContain('ai_new');
    expect(validate(reloaded)).toEqual([]);
  });

  it('edits the instance chain + the QuantityValue maps (the coercion, extra facets preserved)', () => {
    const ast = load(PLANE, { strict: true });
    const inst = ast.instances[0]!;
    const patch = updateConstruct(a => a.instances, 'smp-001', {
      level: 'sample',
      model: 'mod-4t',
      definitionVersions: { LC500: '2021', attributes: '1.0.0' },
      has: {
        ...inst.has,
        attributes: { serial_number: { value: 'ABC-123' }, net_weight: { value: 2.4, unit: 'kg' } },
        testContext: { d_min: { value: 0, unit: 'kg' }, d_max: { value: 2.2, unit: 't' } },
      },
    });
    patch.apply(ast);
    const text = dump(ast);
    expect(text).toContain('model mod-4t');
    // The dump emits the version values bare (unquoted tokens reparse as strings).
    expect(text).toContain('definition_versions { LC500 : 2021 attributes : 1.0.0 }');
    expect(text).toContain('net_weight : 2.4 kg');
    expect(text).toContain('d_max : 2.2 t');
    const reloaded = load(text, { strict: true });
    expect(reloaded.instances[0]?.has.testContext['d_max']?.value).toBe(2.2);
    expect(validate(reloaded)).toEqual([]);
    patch.revert(ast);
    expect(dump(ast)).toBe(dump(load(PLANE, { strict: true })));
  });

  it('edits the artifact definition: contract fields, media, produced_when (all three kinds)', () => {
    const ast = load(PLANE, { strict: true });
    const def = ast.artifactDefinitions[0]!;
    const patch = updateConstruct(a => a.artifactDefinitions, 'evidence_file', {
      contentContract: {
        ...def.contentContract,
        fields: [...def.contentContract.fields, { name: 'site', type: 'structure', optional: false, description: '' }],
        media: [{ field: 'photo', kinds: ['jpeg'], role: 'vehicle identification (front)' }],
      },
      producedWhen: { kind: 'on_event', event: 'fault_detected' },
    });
    patch.apply(ast);
    const text = dump(ast);
    expect(text).toContain('site : structure');
    expect(text).toContain('photo { kinds { jpeg } role "vehicle identification (front)" }');
    expect(text).toContain('produced_when on_event fault_detected');
    const reloaded = load(text, { strict: true });
    expect(reloaded.artifactDefinitions[0]?.producedWhen.event).toBe('fault_detected');
    expect(reloaded.artifactDefinitions[0]?.contentContract.fields).toHaveLength(3);
    expect(validate(reloaded)).toEqual([]);
    patch.revert(ast);
    expect(dump(ast)).toBe(dump(load(PLANE, { strict: true })));
  });

  it('the per_interval produced_when carries the duration', () => {
    const ast = run(PLANE, updateConstruct(a => a.artifactDefinitions, 'evidence_file', {
      producedWhen: { kind: 'per_interval', interval: 'P1D' },
    }));
    const text = dump(ast);
    expect(text).toContain('produced_when per_interval P1D');
    expect(load(text, { strict: true }).artifactDefinitions[0]?.producedWhen.interval).toBe('P1D');
  });

  it('edits the artifact instance (of/by/content/links); undo restores', () => {
    const patch = updateConstruct(a => a.artifactInstances, 'ai-1', {
      producedAt: '2026-08-29T11:00:00Z',
      content: { speed: { value: 88.1, unit: 'km/h' }, direction: { value: 'northbound' } },
      links: ['run-1', 'run-2'],
    });
    const ast = run(PLANE, patch);
    const text = dump(ast);
    expect(text).toContain('produced_at 2026-08-29T11:00:00Z');
    expect(text).toContain('content { speed : 88.1 km/h direction : northbound }');
    expect(text).toContain('links { run-1 run-2 }');
    const reloaded = load(text, { strict: true });
    expect(reloaded.artifactInstances[0]?.content['direction']?.value).toBe('northbound');
    expect(validate(reloaded)).toEqual([]);
    patch.revert(ast);
    expect(dump(ast)).toBe(dump(load(PLANE, { strict: true })));
  });

  it('deletes each kind; the removals revert to the exact slots', () => {
    const delI = deleteConstruct(a => a.instances, 'smp-001');
    const delD = deleteConstruct(a => a.artifactDefinitions, 'evidence_file');
    const delAi = deleteConstruct(a => a.artifactInstances, 'ai-1');
    const ast = run(PLANE, delI, delD, delAi);
    expect(ast.instances).toHaveLength(0);
    expect(ast.artifactDefinitions).toHaveLength(0);
    expect(ast.artifactInstances).toHaveLength(0);
    delAi.revert(ast);
    delD.revert(ast);
    delI.revert(ast);
    expect(dump(ast)).toBe(dump(load(PLANE, { strict: true })));
  });
});

describe('W3.2 the twin family — connector profiles, monitors, passports', () => {
  const TWIN = `connector_profile rest_https {
  protocol "REST/JSON"
  description "Query/subscribe over HTTPS"
}

monitor fleet_watch {
  over { LoadCellModel }
  triggers {
    every 1h
    on signal artifact_arrived
    on change state
  }
  evaluate {
    requirements applicable_to(this.classification)
    promises all
  }
  emit {
    evidence -> workspace
    verdicts -> verdict_log
  }
  escalate {
    on fail { flag_certificate open_service_case }
    on invalid { notify admin }
  }
}

passport lc500_passport {
  upi { pattern upi:acme:lc500 level model }
  carrier { kind qr payload "https://passport.acme.example/p.json" }
  public { identity composition }
  authority { live_compliance_status }
}
`;

  it('creates the three kinds with the parse defaults; the dump round-trips', () => {
    const ast = run(
      TWIN,
      createConstruct(a => a.connectorProfiles, newConnectorProfile('cp_new')),
      createConstruct(a => a.monitors, newMonitor('m_new')),
      createConstruct(a => a.passports, newPassport('p_new')),
    );
    const reloaded = load(dump(ast), { strict: true });
    expect(reloaded.connectorProfiles.map(c => c.id)).toContain('cp_new');
    expect(reloaded.monitors.map(m => m.id)).toContain('m_new');
    expect(reloaded.passports.map(p => p.id)).toContain('p_new');
    expect(validate(reloaded)).toEqual([]);
  });

  it('edits the monitor triggers (the one-field-per-kind discipline); undo restores', () => {
    const ast = load(TWIN, { strict: true });
    const m = ast.monitors[0]!;
    const patch = updateConstruct(a => a.monitors, 'fleet_watch', {
      triggers: [
        { kind: 'timer', every: '30min', signal: '', aspect: '' },
        { kind: 'change', every: '', signal: '', aspect: 'parameters.e_max' },
      ],
    });
    patch.apply(ast);
    const text = dump(ast);
    expect(text).toContain('every 30min');
    expect(text).toContain('on change parameters.e_max');
    expect(text).not.toContain('artifact_arrived');
    const reloaded = load(text, { strict: true });
    expect(reloaded.monitors[0]?.triggers).toHaveLength(2);
    expect(validate(reloaded)).toEqual([]);
    patch.revert(ast);
    expect(dump(ast)).toBe(dump(load(TWIN, { strict: true })));
  });

  it('the evaluate selectors edit across all three kinds (all / applicable_to / refs block)', () => {
    const ast = load(TWIN, { strict: true });
    const m = ast.monitors[0]!;
    updateConstruct(a => a.monitors, 'fleet_watch', {
      evaluate: {
        requirements: { kind: 'refs', expression: '', refs: ['/req/metrological/mpe'] },
        promises: { kind: 'applicable_to', expression: 'this.classification', refs: [] },
      },
    }).apply(ast);
    const text = dump(ast);
    expect(text).toContain('requirements { /req/metrological/mpe }');
    expect(text).toContain('promises applicable_to(this.classification)');
    const reloaded = load(text, { strict: true });
    expect(reloaded.monitors[0]?.evaluate.requirements.refs).toEqual(['/req/metrological/mpe']);
    expect(reloaded.monitors[0]?.evaluate.promises.kind).toBe('applicable_to');
    expect(validate(reloaded)).toEqual([]);
    void m;
  });

  it('the emit sinks and escalation rules edit', () => {
    const ast = load(TWIN, { strict: true });
    updateConstruct(a => a.monitors, 'fleet_watch', {
      emit: [{ stream: 'verdicts', target: 'audit_log' }],
      escalate: [{ outcome: 'fail', actions: [{ action: 'notify', role: 'metrologist' }, { action: 'flag_certificate', role: '' }] }],
    }).apply(ast);
    const text = dump(ast);
    expect(text).toContain('verdicts -> audit_log');
    expect(text).toContain('on fail { notify metrologist flag_certificate }');
    const reloaded = load(text, { strict: true });
    expect(reloaded.monitors[0]?.escalate[0]?.actions[0]).toEqual({ action: 'notify', role: 'metrologist' });
    expect(validate(reloaded)).toEqual([]);
  });

  it('edits the passport upi, carriers, and the access-classed entries; undo restores', () => {
    const patch = updateConstruct(a => a.passports, 'lc500_passport', {
      upi: { pattern: 'upi:acme:lc500:{serial}', level: 'item' },
      carriers: [{ kind: 'qr', payload: 'https://passport.acme.example/p.json' }, { kind: 'nfc', payload: 'https://passport.acme.example/n' }],
      entries: [
        { access: 'public', contentClass: 'identity', ref: '' },
        { access: 'restricted', contentClass: 'artifacts', ref: 'evidence_file' },
        { access: 'authority', contentClass: 'live_compliance_status', ref: '' },
      ],
    });
    const ast = run(TWIN, patch);
    const text = dump(ast);
    expect(text).toContain('upi { pattern "upi:acme:lc500:{serial}" level item }');
    expect(text).toContain('carrier { kind nfc payload https://passport.acme.example/n }');
    expect(text).toContain('restricted { artifacts.evidence_file }');
    const reloaded = load(text, { strict: true });
    expect(reloaded.passports[0]?.entries).toHaveLength(3);
    expect(reloaded.passports[0]?.entries[1]?.ref).toBe('evidence_file');
    expect(validate(reloaded)).toEqual([]);
    patch.revert(ast);
    expect(dump(ast)).toBe(dump(load(TWIN, { strict: true })));
  });

  it('deletes each kind; the removals revert to the exact slots', () => {
    const delC = deleteConstruct(a => a.connectorProfiles, 'rest_https');
    const delM = deleteConstruct(a => a.monitors, 'fleet_watch');
    const delP = deleteConstruct(a => a.passports, 'lc500_passport');
    const ast = run(TWIN, delC, delM, delP);
    expect(ast.connectorProfiles).toHaveLength(0);
    expect(ast.monitors).toHaveLength(0);
    expect(ast.passports).toHaveLength(0);
    delP.revert(ast);
    delM.revert(ast);
    delC.revert(ast);
    expect(dump(ast)).toBe(dump(load(TWIN, { strict: true })));
  });
});

describe('W3.2 the passport vocabularies — the browser-bundle gap pin', () => {
  it('the inspector-local PASSPORT_* option lists equal the kernel node-side constants', async () => {
    // The node build exports the vocabularies; the browser bundle
    // (dist-browser/index.mjs) does not (the kernel packaging gap the
    // PassportInspector's local lists stand in for). Vitest resolves the
    // node build — this pins the local lists against the kernel's truth.
    const kernel = await import('@primmel/primmel');
    expect(kernel.PASSPORT_ACCESS_CLASSES).toEqual(['public', 'restricted', 'authority']);
    expect(kernel.PASSPORT_CONTENT_CLASSES).toEqual(['identity', 'composition', 'promises_as_verified', 'live_compliance_status', 'artifacts', 'sustainability']);
    expect(kernel.PASSPORT_UPI_LEVELS).toEqual(['model', 'batch', 'item']);
  });
});

describe('W3.2 the registry plane — invariants, formulas-used, texts, archetypes, competence kinds, predicates, discrepancy records', () => {
  const REGISTRY = `invariant INV-1 {
  name "No bare numbers"
  statement "every physical quantity is a QuantityValue"
  severity error
  applies_to { QuantityValue }
  source "docs/oiml-core/09-invariants.md#9.2"
  enforcement { kernel:C32 gate:schema-quantity-value }
}

formulas_used /conf/metrological/mdlo {
  name "MDLO evaluation formulas"
  description "The evaluation-level quantities"
  formulas { conversion_factor_f e_l }
  source { doc "urn:oiml:pub:r:60-3:2021" clause "2.1" }
}

text load-cell.definition {
  spell de "Wägezelle"
  spell fr "Capteur de force"
}

activity_archetype peer-assessment {
  label "peer assessment"
  clause "6.2"
  definition "assessment of a body by others in the same field"
  parent assessment
}

competence_kind force-measurement {
  label "Force measurement"
  definition "d"
  source { doc "urn:iso:std:iso-iec:17025:2017" clause "6.2" }
  method_standard iec-61000-4-4 "IEC 61000-4-4 — bursts"
}

predicate derives-from {
  kind citation
  description "the clause-URN provenance"
  subject_kinds { requirement }
  target_kinds { document }
  resolution must-resolve
  inverse derived-in
  transitive true
}

discrepancy_record dr-1 {
  status open
  summary "The 2017 and 2021 editions disagree on the creep band"
  sources { "urn:oiml:pub:r:60:2017" "urn:oiml:pub:r:60:2021" }
}
`;

  it('creates all seven kinds with the parse defaults; the dump round-trips', () => {
    const ast = run(
      REGISTRY,
      createConstruct(a => a.invariants, newInvariant('INV-2')),
      createConstruct(a => a.formulasUsed, newFormulasUsed('/conf/other')),
      createConstruct(a => a.texts, newTextContent('t.x')),
      createConstruct(a => a.activityArchetypes, newActivityArchetype('aa-new')),
      createConstruct(a => a.competenceKinds, newCompetenceKind('ck-new')),
      createConstruct(a => a.predicates, newPredicate('cites')),
      createConstruct(a => a.discrepancyRecords, newDiscrepancyRecord('dr-2')),
    );
    const reloaded = load(dump(ast), { strict: true });
    expect(reloaded.invariants.map(i => i.id)).toContain('INV-2');
    expect(reloaded.formulasUsed.map(f => f.id)).toContain('/conf/other');
    expect(reloaded.texts.map(t => t.id)).toContain('t.x');
    expect(reloaded.activityArchetypes.map(a => a.id)).toContain('aa-new');
    expect(reloaded.competenceKinds.map(c => c.id)).toContain('ck-new');
    expect(reloaded.predicates.map(p => p.id)).toContain('cites');
    expect(reloaded.discrepancyRecords.map(d => d.id)).toContain('dr-2');
    expect(validate(reloaded)).toEqual([]);
  });

  it('the invariant enforcement edits as the C90 XOR (claims list XOR aspirational)', () => {
    const ast = run(REGISTRY, updateConstruct(a => a.invariants, 'INV-1', {
      enforcement: { aspirational: true, claims: [] },
    }));
    const text = dump(ast);
    expect(text).toContain('enforcement aspirational');
    const reloaded = load(text, { strict: true });
    expect(reloaded.invariants[0]?.enforcement.aspirational).toBe(true);
    expect(validate(reloaded)).toEqual([]);
    const back = run(REGISTRY, updateConstruct(a => a.invariants, 'INV-1', {
      enforcement: { aspirational: false, claims: ['kernel:C32', 'linker:quantity-coherence'] },
    }));
    expect(dump(back)).toContain('enforcement { kernel:C32 linker:quantity-coherence }');
  });

  it('the formulas-used trace edits its formulas + sourceRefs (the repeated source blocks)', () => {
    const patch = updateConstruct(a => a.formulasUsed, '/conf/metrological/mdlo', {
      formulas: ['conversion_factor_f', 'e_l', 'e_r'],
      sourceRefs: [{ doc: 'urn:oiml:pub:r:60-3:2021', clause: '2.1' }, { doc: 'urn:oiml:pub:r:60-3:2021', clause: '2.2' }],
    });
    const ast = run(REGISTRY, patch);
    const text = dump(ast);
    expect(text).toContain('formulas { conversion_factor_f e_l e_r }');
    const reloaded = load(text, { strict: true });
    expect(reloaded.formulasUsed[0]?.sourceRefs).toHaveLength(2);
    expect(validate(reloaded)).toEqual([]);
    patch.revert(ast);
    expect(dump(ast)).toBe(dump(load(REGISTRY, { strict: true })));
  });

  it('the text spellings edit (incl. the via marker)', () => {
    const patch = updateConstruct(a => a.texts, 'load-cell.definition', {
      entries: [
        { spelling: 'de', value: 'Wägezelle' },
        { spelling: 'fr', value: 'Capteur de force (normalisé)', via: 'iso24229:latn:fr:x-derive' },
      ],
    });
    const ast = run(REGISTRY, patch);
    const text = dump(ast);
    expect(text).toContain('spell de "Wägezelle"');
    const reloaded = load(text, { strict: true });
    expect(reloaded.texts[0]?.entries[1]?.via).toBe('iso24229:latn:fr:x-derive');
    expect(validate(reloaded)).toEqual([]);
    patch.revert(ast);
    expect(dump(ast)).toBe(dump(load(REGISTRY, { strict: true })));
  });

  it('the archetype, competence kind (with method standards), predicate, and discrepancy record edit and undo', () => {
    const ast = load(REGISTRY, { strict: true });
    const edits = [
      updateConstruct(a => a.activityArchetypes, 'peer-assessment', { label: 'peer assessment (edited)', parent: '' }),
      updateConstruct(a => a.competenceKinds, 'force-measurement', { methodStandards: [{ id: 'iec-61000-4-4', title: 'IEC 61000-4-4 — bursts' }, { id: 'iec-60068-2-30', title: 'Damp heat' }] }),
      updateConstruct(a => a.predicates, 'derives-from', { symmetric: true, resolution: 'best-effort' }),
      updateConstruct(a => a.discrepancyRecords, 'dr-1', { status: 'resolved', resolution: 'follows_clause_x', governing: 'urn:oiml:pub:r:60:2021', rationale: 'the 2021 edition supersedes' }),
    ];
    for (const c of edits) c.apply(ast);
    const text = dump(ast);
    expect(text).toContain('label "peer assessment (edited)"');
    expect(text).toContain('method_standard iec-60068-2-30 "Damp heat"');
    expect(text).toContain('symmetric true');
    expect(text).toContain('resolution follows_clause_x');
    const reloaded = load(text, { strict: true });
    expect(reloaded.competenceKinds[0]?.methodStandards).toHaveLength(2);
    expect(reloaded.discrepancyRecords[0]?.governing).toBe('urn:oiml:pub:r:60:2021');
    expect(validate(reloaded)).toEqual([]);
    for (const c of [...edits].reverse()) c.revert(ast);
    expect(dump(ast)).toBe(dump(load(REGISTRY, { strict: true })));
  });

  it('deletes each registry kind; the removals revert to the exact slots', () => {
    const dels = [
      deleteConstruct(a => a.invariants, 'INV-1'),
      deleteConstruct(a => a.formulasUsed, '/conf/metrological/mdlo'),
      deleteConstruct(a => a.texts, 'load-cell.definition'),
      deleteConstruct(a => a.activityArchetypes, 'peer-assessment'),
      deleteConstruct(a => a.competenceKinds, 'force-measurement'),
      deleteConstruct(a => a.predicates, 'derives-from'),
      deleteConstruct(a => a.discrepancyRecords, 'dr-1'),
    ];
    const ast = run(REGISTRY, ...dels);
    expect(dump(ast)).toBe(dump(load('', { strict: true })));
    for (const d of [...dels].reverse()) d.revert(ast);
    expect(dump(ast)).toBe(dump(load(REGISTRY, { strict: true })));
  });
});

describe('W3.2 dataspaces + policies — the governance plane', () => {
  const GOV = `dataspace oiml-cs-dataspace {
  name "OIML-CS"
  description "The scheme dataspace"
  participant_class issuer {
    label "Issuing Authority"
    description "d"
  }
  artifact_class test_report {
    label "Test report"
    description "d"
    element tr-form
    policy default-sharing
  }
  policies { default-sharing }
  default_policy default-sharing
  trust_anchor biml {
    trust_ref oiml key biml-2026
    role registry
    description "the BIML register"
  }
  compatible_with { other-ds }
  source { doc "urn:oiml:pub:b:18:2025" clause "5.1" }
}

policy default-sharing {
  name "Default sharing"
  description "d"
  governs { test_report }
  default_posture true
  rule read-ok {
    kind permission
    action read
    artifact test_report
    constraint "ocl{requester.accredited}"
  }
  rule keep-nothing {
    kind prohibition
    action retain
  }
}
`;

  it('creates both kinds with the parse defaults; the dump round-trips', () => {
    const ast = run(
      GOV,
      createConstruct(a => a.dataspaces, newDataspace('ds_new')),
      createConstruct(a => a.policies, newPolicy('pol_new')),
    );
    const reloaded = load(dump(ast), { strict: true });
    expect(reloaded.dataspaces.map(d => d.id)).toContain('ds_new');
    expect(reloaded.policies.map(p => p.id)).toContain('pol_new');
    expect(validate(reloaded)).toEqual([]);
  });

  it('edits the dataspace classes + the trust anchor (org + key id); undo restores', () => {
    const patch = updateConstruct(a => a.dataspaces, 'oiml-cs-dataspace', {
      artifactClasses: [{ id: 'test_report', label: 'Test report', description: 'd', element: 'tr-form-v2', policy: '' }],
      trustAnchors: [{ id: 'biml', trustRef: { org: 'oiml', kid: 'biml-2027' }, role: 'notary', description: 'the BIML register' }],
    });
    const ast = run(GOV, patch);
    const text = dump(ast);
    expect(text).toContain('element tr-form-v2');
    expect(text).toContain('trust_ref oiml key biml-2027');
    expect(text).toContain('role notary');
    const reloaded = load(text, { strict: true });
    expect(reloaded.dataspaces[0]?.trustAnchors[0]?.trustRef?.kid).toBe('biml-2027');
    expect(reloaded.dataspaces[0]?.artifactClasses[0]?.policy).toBe('');
    expect(validate(reloaded)).toEqual([]);
    patch.revert(ast);
    expect(dump(ast)).toBe(dump(load(GOV, { strict: true })));
  });

  it('edits the policy rules (kind/action/artifact/constraints) and the tri-state posture', () => {
    const patch = updateConstruct(a => a.policies, 'default-sharing', {
      defaultPosture: null,
      rules: [
        { id: 'read-ok', kind: 'permission', action: 'read', artifact: 'test_report', constraints: ['ocl{requester.accredited}', 'ocl{requester.inScope}'] },
        { id: 'share-bound', kind: 'obligation', action: 'log', artifact: '', constraints: [] },
      ],
    });
    const ast = run(GOV, patch);
    const text = dump(ast);
    expect(text).not.toContain('default_posture');
    expect(text).toContain('constraint "ocl{requester.accredited}"');
    expect(text).toContain('constraint "ocl{requester.inScope}"');
    expect(text).toContain('rule share-bound {');
    const reloaded = load(text, { strict: true });
    expect(reloaded.policies[0]?.rules[1]?.kind).toBe('obligation');
    expect(validate(reloaded)).toEqual([]);
    patch.revert(ast);
    expect(dump(ast)).toBe(dump(load(GOV, { strict: true })));
  });

  it('deletes both kinds; the removals revert to the exact slots', () => {
    const delD = deleteConstruct(a => a.dataspaces, 'oiml-cs-dataspace');
    const delP = deleteConstruct(a => a.policies, 'default-sharing');
    const ast = run(GOV, delD, delP);
    expect(ast.dataspaces).toHaveLength(0);
    expect(ast.policies).toHaveLength(0);
    delP.revert(ast);
    delD.revert(ast);
    expect(dump(ast)).toBe(dump(load(GOV, { strict: true })));
  });
});
