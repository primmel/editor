// ─────────────────────────────────────────────────────────────────────
// TODO.editor/05 — the data-model editors' proofs:
//   - a command-built dataclass matches hand-written PRL, and the
//     serialize round-trip preserves it;
//   - attribute reorder + reference-target retarget;
//   - enum value CRUD + reorder; an attribute binds an enum;
//   - the generic list CRUD (createInList/deleteInList) reverts
//     exactly.
// ─────────────────────────────────────────────────────────────────────

import { describe, it, expect } from 'vitest';
import { dump, load, type DataAttribute, type Standard } from '@primmel/primmel';
import {
  addAttribute,
  createElement,
  createInList,
  deleteInList,
  reorderList,
  updateAttribute,
  updateElement,
} from '../commands';

const BASE = `root Root

version "v1.0.0-dev1"

metadata {
  title "T"
  schema "Primmel 0.1"
  namespace "N"
}

role r1 { name "R1" }

start_event Start { }

process P1 {
  name "P one"
  actor r1
}

canvas Root {
  elements {
    Start { x 0 y 0 }
    P1 { x 0 y 100 }
  }
  process_flow {
    E1 { from Start to P1 }
  }
}`;

/** The same content, hand-written — the command-built model must
 *  match this structure exactly (the semantic fields). */
const HANDWRITTEN = `${BASE}

class LoadCell {
  store { instruments }
  capacity: QuantityValue[1..1] {
    definition "Maximum capacity"
    modality SHALL
    required true
    unit "kg"
  }
  accuracyClass: enum[1..1] {
    definition "Accuracy class"
    enum_values { A C D }
  }
  certificate: reference(Certificate)[0..1] {
    definition "The issued certificate"
  }
}

class Certificate {
  number: string {
    definition "Certificate number"
  }
}

enum AccuracyClass {
  A { definition "Class A" }
  C { definition "Class C" }
  D { definition "Class D" }
}

data_registry InstrumentRegister {
  title "Instrument register"
  data_class LoadCell
}

reference R60 {
  document "urn:oiml:pub:r:60-1:2021"
  clause "5.1"
}`;

function fresh(): Standard {
  return load(BASE);
}

/** The semantic projection of an attribute — parsed attributes carry
 *  the resolver's `_relations` residue; the comparison is over the
 *  fields the language defines. */
function attrShape(a: DataAttribute) {
  return {
    id: a.id,
    type: a.type,
    modality: a.modality,
    cardinality: a.cardinality,
    definition: a.definition,
    ref: a.ref.map(r => r.id),
    satisfy: a.satisfy,
    onDelete: a.onDelete,
    deprecated: a.deprecated,
    enumValues: a.enumValues,
    required: a.required,
    unit: a.unit,
    defaultValue: a.defaultValue,
  };
}

function classShapes(ast: Standard, classId: string) {
  const cls = ast.dataclasses.find(d => d.id === classId);
  return cls?.attributes.map(attrShape);
}

describe('05 — the dataclass build', () => {
  it('command-built attributes match hand-written PRL', () => {
    const ast = fresh();
    createElement('dataclass', 'LoadCell').apply(ast);
    updateElement((a: Standard) => a.dataclasses, 'LoadCell', { store: 'instruments' }).apply(ast);
    addAttribute('LoadCell', {
      id: 'capacity', type: 'QuantityValue', modality: 'SHALL', cardinality: '1..1',
      definition: 'Maximum capacity', required: true, unit: 'kg', ref: [], satisfy: [],
    }).apply(ast);
    addAttribute('LoadCell', {
      id: 'accuracyClass', type: 'enum', modality: '', cardinality: '1..1',
      definition: 'Accuracy class', enumValues: ['A', 'C', 'D'], ref: [], satisfy: [],
    }).apply(ast);
    addAttribute('LoadCell', {
      id: 'certificate', type: 'reference(Certificate)', modality: '', cardinality: '0..1',
      definition: 'The issued certificate', ref: [], satisfy: [],
    }).apply(ast);

    const hand = load(HANDWRITTEN);
    expect(classShapes(ast, 'LoadCell')).toEqual(classShapes(hand, 'LoadCell'));
  });

  it('the serialize round-trip preserves the built class', () => {
    const ast = load(HANDWRITTEN);
    const before = classShapes(ast, 'LoadCell');
    const reparsed = load(dump(ast));
    expect(classShapes(reparsed, 'LoadCell')).toEqual(before);
    // The class-level facets survive too.
    const cls = reparsed.dataclasses.find(d => d.id === 'LoadCell')!;
    expect(cls.store).toBe('instruments');
  });

  it('reorder attributes, then revert restores the order', () => {
    const ast = load(HANDWRITTEN);
    const order = () => ast.dataclasses.find(d => d.id === 'LoadCell')!.attributes.map(a => a.id);
    expect(order()).toEqual(['capacity', 'accuracyClass', 'certificate']);
    const cmd = reorderList((a: Standard) => a.dataclasses.find(d => d.id === 'LoadCell')!.attributes, 0, 2);
    cmd.apply(ast);
    expect(order()).toEqual(['accuracyClass', 'certificate', 'capacity']);
    cmd.revert(ast);
    expect(order()).toEqual(['capacity', 'accuracyClass', 'certificate']);
  });

  it('retarget a reference type; the dump carries the new target', () => {
    const ast = load(HANDWRITTEN);
    createElement('dataclass', 'OtherCert').apply(ast);
    updateAttribute('LoadCell', 'certificate', { type: 'reference(OtherCert)' }).apply(ast);
    const attr = ast.dataclasses.find(d => d.id === 'LoadCell')!.attributes.find(a => a.id === 'certificate')!;
    expect(attr.type).toBe('reference(OtherCert)');
    expect(dump(ast)).toContain('certificate: reference(OtherCert)[0..1]');
  });
});

describe('05 — enums and registries', () => {
  it('enum values add/edit/reorder/remove, each reverting', () => {
    const ast = fresh();
    createInList((a: Standard) => a.enums, { id: 'AccuracyClass', values: [] }, 'create enum').apply(ast);
    const valuesOf = (a: Standard) => a.enums.find(e => e.id === 'AccuracyClass')!.values;

    createInList(valuesOf, { id: 'A', value: 'Class A' }).apply(ast);
    createInList(valuesOf, { id: 'C', value: 'Class C' }).apply(ast);
    createInList(valuesOf, { id: 'D', value: 'Class D' }).apply(ast);
    expect(ast.enums[0]!.values.map(v => v.id)).toEqual(['A', 'C', 'D']);

    const edit = updateElement(valuesOf, 'C', { value: 'Class C (revised)' });
    edit.apply(ast);
    expect(ast.enums[0]!.values[1]!.value).toBe('Class C (revised)');
    edit.revert(ast);
    expect(ast.enums[0]!.values[1]!.value).toBe('Class C');

    const move = reorderList(valuesOf, 2, 0);
    move.apply(ast);
    expect(ast.enums[0]!.values.map(v => v.id)).toEqual(['D', 'A', 'C']);
    move.revert(ast);
    expect(ast.enums[0]!.values.map(v => v.id)).toEqual(['A', 'C', 'D']);

    const rm = deleteInList(valuesOf, 'D');
    rm.apply(ast);
    expect(ast.enums[0]!.values.map(v => v.id)).toEqual(['A', 'C']);
    rm.revert(ast);
    expect(ast.enums[0]!.values.map(v => v.id)).toEqual(['A', 'C', 'D']);

    // The serialize round-trip preserves the enum.
    const reparsed = load(dump(ast));
    expect(reparsed.enums.find(e => e.id === 'AccuracyClass')!.values.map(v => [v.id, v.value]))
      .toEqual([['A', 'Class A'], ['C', 'Class C'], ['D', 'Class D']]);
  });

  it('an attribute binds an enum (inline values); retarget a registry', () => {
    const ast = load(HANDWRITTEN);
    // Bind: type enum + the inline value list (already on the fixture's
    // accuracyClass) — edit the binding itself.
    const bind = updateAttribute('LoadCell', 'accuracyClass', { enumValues: ['A', 'C'] });
    bind.apply(ast);
    expect(dump(ast)).toContain('enum_values { A C }');
    bind.revert(ast);
    expect(dump(ast)).toContain('enum_values { A C D }');

    // Registry retarget: InstrumentRegister carries Certificate now.
    const cert = ast.dataclasses.find(d => d.id === 'Certificate')!;
    const retarget = updateElement((a: Standard) => a.regs, 'InstrumentRegister', { data: cert });
    retarget.apply(ast);
    expect(dump(ast)).toContain('data_class Certificate');
    retarget.revert(ast);
    expect(dump(ast)).toContain('data_class LoadCell');
  });

  it('attribute references resolve against the model reference list', () => {
    const ast = load(HANDWRITTEN);
    const r60 = ast.references.find(r => r.id === 'R60')!;
    updateAttribute('LoadCell', 'capacity', { ref: [r60] }).apply(ast);
    const attr = ast.dataclasses.find(d => d.id === 'LoadCell')!.attributes.find(a => a.id === 'capacity')!;
    expect(attr.ref.map(r => r.id)).toEqual(['R60']);
    const text = dump(ast);
    expect(text).toContain('reference {\n      R60\n    }');
    // And the round trip re-resolves the reference object.
    const reparsed = load(text);
    const attr2 = reparsed.dataclasses.find(d => d.id === 'LoadCell')!.attributes.find(a => a.id === 'capacity')!;
    expect(attr2.ref.map(r => r.id)).toEqual(['R60']);
    expect(attr2.ref[0]!.document).toBe('urn:oiml:pub:r:60-1:2021');
  });
});
