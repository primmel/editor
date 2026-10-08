// ─────────────────────────────────────────────────────────────────────
// G5 — the adopt cascade's proofs: a reference term lands in the
// implementation with its wording intact; the pair arrives with it;
// undo removes both; a colliding id refuses; a non-existent element
// refuses; requirements and processes adopt the same way.
// ─────────────────────────────────────────────────────────────────────
import { describe, it, expect } from 'vitest';
import { load, type Standard } from '@primmel/primmel';
import { adoptElement, adoptWithPair } from '../adopt';

const IMP = `root Root

version "v1.0.0-dev1"

metadata {
  title "IMP"
  schema "Primmel 0.1"
  namespace "imp"
}

process p_local {
  name "Local work"
  modality shall
}
`;

const REF = `root RefA

version "v1.0.0-dev1"

metadata {
  title "Ref A"
  schema "Primmel 0.1"
  namespace "refA"
}

term adopted_term {
  label "adopted"
  definition "the definition that comes across"
}

requirement /req/upstream {
  name "Upstream"
  statement "shall carry across"
}
`;

function imp(): Standard {
  return load(IMP) as unknown as Standard;
}
function ref(): Standard {
  return load(REF) as unknown as Standard;
}

describe('the adopt cascade (G5)', () => {
  it('adopts the term with its wording intact, and the pair arrives with it', () => {
    const ast = imp();
    const { adoption, pair } = adoptWithPair(ast, ref(), 'refA', 'adopted_term');
    adoption.apply(ast);
    pair.apply(ast);
    const term = ast.terms.find((t) => t.id === 'adopted_term')!;
    expect(term.label).toBe('adopted');
    expect(term.definition).toBe('the definition that comes across');
    const profile = ast.mapProfiles.find((p) => p.namespace === 'refA')!;
    expect(profile.mappings['adopted_term']).toHaveLength(1);
    expect(profile.mappings['adopted_term']![0]!.target).toBe('refA#adopted_term');
  });

  it('undo removes the element and the pair', () => {
    const ast = imp();
    const { adoption, pair } = adoptWithPair(ast, ref(), 'refA', 'adopted_term');
    adoption.apply(ast);
    pair.apply(ast);
    pair.revert(ast);
    adoption.revert(ast);
    expect(ast.terms.find((t) => t.id === 'adopted_term')).toBeUndefined();
    expect(ast.mapProfiles.find((p) => p.namespace === 'refA')?.mappings['adopted_term']).toBeUndefined();
  });

  it('adopts a requirement the same way', () => {
    const ast = imp();
    adoptElement(ast, ref(), '/req/upstream').apply(ast);
    const req = (ast.requirements ?? []).find((r) => r.id === '/req/upstream')!;
    expect(req.statement).toBe('shall carry across');
  });

  it('refuses a colliding id with the map-instead diagnostic', () => {
    const ast = imp();
    expect(() => adoptElement(ast, ast, 'p_local')).toThrow(/map it instead/);
  });

  it('refuses an element the reference does not declare', () => {
    expect(() => adoptElement(imp(), ref(), 'nope')).toThrow(/no adoptable element/);
  });
});
