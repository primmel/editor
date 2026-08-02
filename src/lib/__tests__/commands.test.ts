// ─────────────────────────────────────────────────────────────────────
// TODO.editor/01 — the command layer's proofs:
//   - every command applies and reverts exactly (apply → revert ≡
//     identity on the AST);
//   - the round trip (parse → dump) is byte-stable on the kernel's
//     canonicalization;
//   - the store's dirty/undo/redo discipline.
// ─────────────────────────────────────────────────────────────────────

import { describe, it, expect } from 'vitest';
import { dump, load, type Standard } from '@primmel/primmel';
import {
  addAttribute,
  createEdge,
  createElement,
  createMappingPair,
  deleteElement,
  deleteMappingPair,
  mintId,
  removeAttribute,
  removeEdge,
  reorderList,
  updateAttribute,
  updateComponentPosition,
  updateElement,
  updateMappingMeta,
  updateMeta,
} from '../commands';
import { canConnect } from '../edges';

const TEXT = `root Root

version "v1.0.0-dev1"

metadata {
  title "T"
  schema "Primmel 0.1"
  namespace "N"
  author "A"
}

role r1 { name "R1" }

start_event Start { }
end_event Done { }

process P1 {
  name "P one"
  actor r1
  modality SHALL
}

canvas Root {
  elements {
    Start { x 0 y 0 }
    P1 { x 0 y 100 }
    Done { x 0 y 200 }
  }
  process_flow {
    E1 { from Start to P1 }
    E2 { from P1 to Done }
  }
}`;

function fresh(): Standard {
  return load(TEXT);
}

function clone(ast: Standard): Standard {
  return JSON.parse(JSON.stringify(ast)) as Standard;
}

/** The root canvas's content page (resolved, full — `standard.root` is
 *  only the id marker + raw form). */
function rootPage(ast: Standard) {
  return ast.pages.find(p => p.id === ast.root?.id)!;
}

describe('the round trip', () => {
  it('parse → dump is stable under the kernel canonicalization', () => {
    const once = dump(fresh());
    const twice = dump(load(once));
    expect(twice).toBe(once);
  });
});

describe('element commands', () => {
  it('createElement + revert ≡ identity', () => {
    const ast = fresh();
    const before = clone(ast);
    const cmd = createElement('process', 'P2', { x: 10, y: 20 });
    cmd.apply(ast);
    expect(ast.processes.map(p => p.id)).toContain('P2');
    expect(rootPage(ast).childs.map(c => c.name)).toContain('P2');
    cmd.revert(ast);
    expect(ast).toEqual(before);
  });

  it('deleteElement captures element + placements + edges; revert restores all', () => {
    const ast = fresh();
    const before = clone(ast);
    const cmd = deleteElement('process', 'P1');
    cmd.apply(ast);
    expect(ast.processes.map(p => p.id)).not.toContain('P1');
    expect(rootPage(ast).childs.map(c => c.name)).not.toContain('P1');
    expect(rootPage(ast).edges.map(e => e.id)).not.toContain('E1');
    expect(rootPage(ast).edges.map(e => e.id)).not.toContain('E2');
    cmd.revert(ast);
    expect(ast).toEqual(before);
  });

  it('duplicate create throws; unknown delete throws', () => {
    const ast = fresh();
    expect(() => createElement('process', 'P1').apply(ast)).toThrow('duplicate');
    expect(() => deleteElement('process', 'Nope').apply(ast)).toThrow('unknown');
  });

  it('updateElement patches with an exact before-capture', () => {
    const ast = fresh();
    const cmd = updateElement((ast: Standard) => ast.processes, 'P1', { name: 'P renamed', modality: 'SHOULD' });
    cmd.apply(ast);
    const p = ast.processes.find(p => p.id === 'P1')!;
    expect(p.name).toBe('P renamed');
    expect(p.modality).toBe('SHOULD');
    cmd.revert(ast);
    expect(p.name).toBe('P one');
    expect(p.modality).toBe('SHALL');
  });
});

describe('edge commands', () => {
  it('createEdge validates the endpoints are on the page; revert removes', () => {
    const ast = fresh();
    expect(() => createEdge('root', 'E9', 'P1', 'Ghost').apply(ast)).toThrow('not on page');
    const cmd = createEdge('root', 'E3', 'P1', 'Start', { condition: 'x > 0' });
    cmd.apply(ast);
    const e = rootPage(ast).edges.find(e => e.id === 'E3')!;
    expect(e.condition).toBe('x > 0');
    cmd.revert(ast);
    expect(rootPage(ast).edges.map(x => x.id)).not.toContain('E3');
  });

  it('removeEdge restores at the original index', () => {
    const ast = fresh();
    const before = clone(ast);
    const cmd = removeEdge('root', 'E1');
    cmd.apply(ast);
    expect(rootPage(ast).edges.map(e => e.id)).toEqual(['E2']);
    cmd.revert(ast);
    expect(ast).toEqual(before);
  });
});

describe('data-axis commands', () => {
  it('add/update/remove attribute with exact reverts', () => {
    const ast = fresh();
    createElement('dataclass', 'DC1').apply(ast);
    const add = addAttribute('DC1', { id: 'a1', type: 'number', modality: 'SHALL', cardinality: '[1..1]', definition: '', ref: [], satisfy: [] });
    add.apply(ast);
    const cls = ast.dataclasses.find(d => d.id === 'DC1')!;
    expect(cls.attributes).toHaveLength(1);
    const upd = updateAttribute('DC1', 'a1', { cardinality: '[0..1]' });
    upd.apply(ast);
    expect(cls.attributes[0]!.cardinality).toBe('[0..1]');
    upd.revert(ast);
    expect(cls.attributes[0]!.cardinality).toBe('[1..1]');
    const rm = removeAttribute('DC1', 'a1');
    rm.apply(ast);
    expect(cls.attributes).toHaveLength(0);
    rm.revert(ast);
    expect(cls.attributes).toHaveLength(1);
  });

  it('reorderList moves and reverts', () => {
    const ast = fresh();
    createElement('dataclass', 'DC1').apply(ast);
    addAttribute('DC1', { id: 'a1', type: 'string', modality: 'SHALL', cardinality: '', definition: '', ref: [], satisfy: [] }).apply(ast);
    addAttribute('DC1', { id: 'a2', type: 'string', modality: 'SHALL', cardinality: '', definition: '', ref: [], satisfy: [] }).apply(ast);
    const before = clone(ast);
    const cmd = reorderList(ast => ast.dataclasses.find(d => d.id === 'DC1')!.attributes, 0, 1);
    cmd.apply(ast);
    expect(ast.dataclasses[0]!.attributes.map(a => a.id)).toEqual(['a2', 'a1']);
    cmd.revert(ast);
    expect(ast).toEqual(before);
  });
});

describe('meta + mapping commands', () => {
  it('updateMeta patches with revert', () => {
    const ast = fresh();
    const cmd = updateMeta({ title: 'T2' });
    cmd.apply(ast);
    expect(ast.meta.title).toBe('T2');
    cmd.revert(ast);
    expect(ast.meta.title).toBe('T');
  });

  it('mapping pairs create/edit/delete with reverts; the profile auto-creates', () => {
    const ast = fresh();
    expect(ast.mapProfiles).toHaveLength(0);
    const cmd = createMappingPair('RefNS', 'P1', 'RefNS#Process5', { description: 'how', justification: 'why' });
    cmd.apply(ast);
    const profile = ast.mapProfiles.find(p => p.namespace === 'RefNS')!;
    expect(profile.mappings['P1']).toHaveLength(1);
    expect(profile.mappings['P1']![0]).toMatchObject({ target: 'RefNS#Process5', description: 'how', justification: 'why' });

    const upd = updateMappingMeta('RefNS', 'P1', 'RefNS#Process5', { justification: 'why2' });
    upd.apply(ast);
    expect(profile.mappings['P1']![0]!.justification).toBe('why2');
    upd.revert(ast);
    expect(profile.mappings['P1']![0]!.justification).toBe('why');

    const del = deleteMappingPair('RefNS', 'P1', 'RefNS#Process5');
    del.apply(ast);
    expect(profile.mappings['P1'] ?? []).toHaveLength(0);
    del.revert(ast);
    expect(profile.mappings['P1']).toHaveLength(1);

    cmd.revert(ast);
    expect(ast.mapProfiles.find(p => p.namespace === 'RefNS')!.mappings['P1'] ?? []).toHaveLength(0);
  });
});

describe('the data section (TODO.editor/23)', () => {
  it('dataclass placements land in page.data, not childs', () => {
    const ast = fresh();
    createElement('dataclass', 'DC1', { x: 50, y: 60 }).apply(ast);
    const page = rootPage(ast);
    expect(page.data.map(c => c.name)).toContain('DC1');
    expect(page.childs.map(c => c.name)).not.toContain('DC1');
    // The dump carries the data block with the placement.
    const text = dump(ast);
    expect(text).toContain('data {\n    DC1 {');
    const reparsed = load(text);
    expect(reparsed.pages.find(p => p.id === ast.root?.id)!.data.map(c => c.name)).toContain('DC1');
  });

  it('a process ↔ dataclass edge connects through the data seam and renders as a data link', () => {
    const ast = fresh();
    createElement('dataclass', 'DC1', { x: 50, y: 60 }).apply(ast);
    const page = rootPage(ast);
    // The data seam: DC1 is connectable from the data section.
    const verdict = canConnect(page, 'P1', 'DC1', '', ast);
    expect(verdict).toEqual({ ok: true });
    createEdge('root', 'E9', 'P1', 'DC1').apply(ast);
    const text = dump(ast);
    expect(text).toContain('from P1');
    expect(text).toContain('to DC1');
  });

  it('deleteElement captures data placements; revert restores both sections', () => {
    const ast = fresh();
    createElement('dataclass', 'DC1', { x: 50, y: 60 }).apply(ast);
    createEdge('root', 'E9', 'P1', 'DC1').apply(ast);
    const before = clone(ast);
    const cmd = deleteElement('dataclass', 'DC1');
    cmd.apply(ast);
    expect(rootPage(ast).data.map(c => c.name)).not.toContain('DC1');
    expect(rootPage(ast).edges.map(e => e.id)).not.toContain('E9');
    cmd.revert(ast);
    expect(ast).toEqual(before);
  });

  it('updateComponentPosition moves data-section nodes', () => {
    const ast = fresh();
    createElement('dataclass', 'DC1', { x: 50, y: 60 }).apply(ast);
    const cmd = updateComponentPosition('root', 'DC1', 120, 240);
    cmd.apply(ast);
    const comp = rootPage(ast).data.find(c => c.name === 'DC1')!;
    expect([comp.x, comp.y]).toEqual([120, 240]);
    cmd.revert(ast);
    expect([comp.x, comp.y]).toEqual([50, 60]);
  });
});

describe('mintId', () => {
  it('mints the smallest free id, never colliding', () => {
    const ast = fresh();
    expect(mintId(ast, 'P')).toBe('P2');
    createElement('process', 'P2').apply(ast);
    expect(mintId(ast, 'P')).toBe('P3');
  });
});
