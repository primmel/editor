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
  newConstraint,
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
