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
