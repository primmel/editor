// ─────────────────────────────────────────────────────────────────────
// TODO.editor/06 — the subprocess-page proofs:
//   - the page tree / breadcrumb / neighbor map match the AST's
//     nesting (and cycles cannot hang the walkers);
//   - createPageForProcess / linkProcessToPage / renamePage apply and
//     revert exactly, and the dump carries the nesting;
//   - the cross-page edge is refused as 'cross-page' (the actionable
//     verdict), not the generic 'endpoint-missing'.
// ─────────────────────────────────────────────────────────────────────

import { describe, it, expect } from 'vitest';
import { dump, load, type Standard } from '@primmel/primmel';
import {
  createPageForProcess,
  linkProcessToPage,
  renamePage,
  type Subprocess,
} from '../commands';
import { canConnect } from '../edges';
import {
  buildPageTree,
  childPagesOf,
  neighborsOf,
  orphanPages,
  pagePath,
  parentPageOf,
} from '../pages';

const TEXT = `root Root

version "v1.0.0-dev1"

metadata {
  title "T"
  schema "Primmel 0.1"
  namespace "N"
}

role r1 { name "R1" }

start_event Start { }
end_event Done { }

process P1 {
  name "P one"
  actor r1
  canvas Page1
}

process P2 {
  name "P two"
  actor r1
  canvas Page2
}

process P3 {
  name "P three"
  actor r1
}

canvas Root {
  elements {
    Start { x 0 y 0 }
    P1 { x 0 y 100 }
    P3 { x 0 y 200 }
  }
  process_flow {
    E1 { from Start to P1 }
  }
}

canvas Page1 {
  elements {
    P2 { x 0 y 0 }
    Done { x 0 y 100 }
  }
  process_flow {
    E2 { from P2 to Done }
  }
}

canvas Page2 {
  elements {
    Done { x 0 y 0 }
  }
  process_flow {
  }
}`;

function fresh(): Standard {
  return load(TEXT);
}

function page(ast: Standard, id: string): Subprocess {
  return ast.pages.find(p => p.id === id)!;
}

describe('the page tree', () => {
  it('nests exactly as the AST does', () => {
    const ast = fresh();
    expect(childPagesOf(ast, 'Root')).toEqual(['Page1']);
    expect(childPagesOf(ast, 'Page1')).toEqual(['Page2']);
    expect(childPagesOf(ast, 'Page2')).toEqual([]);
    const tree = buildPageTree(ast)!;
    expect(tree.id).toBe('Root');
    expect(tree.children.map(c => c.id)).toEqual(['Page1']);
    expect(tree.children[0]!.children.map(c => c.id)).toEqual(['Page2']);
  });

  it('the breadcrumb walks up exactly; the neighbor map is up/down', () => {
    const ast = fresh();
    expect(pagePath(ast, 'Page2')).toEqual(['Root', 'Page1', 'Page2']);
    expect(pagePath(ast, 'Root')).toEqual(['Root']);
    expect(parentPageOf(ast, 'Page2')).toBe('Page1');
    expect(parentPageOf(ast, 'Root')).toBeNull();
    expect(neighborsOf(ast, 'Page1')).toEqual({ up: 'Root', down: ['Page2'] });
  });

  it('a page cycle cannot hang the walkers', () => {
    const ast = fresh();
    // P2 (on Page1) links back to Root: the cycle is Root ↔ Page1.
    // Page2 loses its only linker and becomes an orphan.
    linkProcessToPage('P2', 'Root').apply(ast);
    expect(pagePath(ast, 'Page1')).toEqual(['Root', 'Page1']);
    expect(pagePath(ast, 'Root')).toEqual(['Root']);
    expect(orphanPages(ast)).toEqual(['Page2']);
    const tree = buildPageTree(ast)!;
    expect(tree.id).toBe('Root');
    expect(tree.children.map(c => c.id)).toEqual(['Page1']);
    // The cycle does not re-descend into Root from Page1.
    expect(tree.children[0]!.children).toEqual([]);
  });

  it('orphans are reported apart until a process links them', () => {
    const ast = fresh();
    expect(orphanPages(ast)).toEqual([]);
    createPageForProcess('P3').apply(ast); // links P3 → Page3 (not an orphan)
    expect(orphanPages(ast)).toEqual([]);
    linkProcessToPage('P3', null).apply(ast); // Page3 is now unlinked
    expect(orphanPages(ast)).toEqual(['Page3']);
    expect(pagePath(ast, 'Page3')).toBeNull();
  });
});

describe('the page commands', () => {
  it('createPageForProcess: one command, one undo unit, dump carries the link', () => {
    const ast = fresh();
    const before = JSON.parse(JSON.stringify(ast));
    const cmd = createPageForProcess('P3');
    cmd.apply(ast);
    const proc = ast.processes.find(p => p.id === 'P3')!;
    expect((proc.page as { id: string } | null)?.id).toBe('Page3');
    expect(ast.pages.map(p => p.id)).toContain('Page3');
    expect(childPagesOf(ast, 'Root')).toEqual(['Page1', 'Page3']);
    // The serialize round-trip preserves the new page + link.
    const reparsed = load(dump(ast));
    expect(pagePath(reparsed, 'Page3')).toEqual(['Root', 'Page3']);
    cmd.revert(ast);
    expect(JSON.parse(JSON.stringify(ast))).toEqual(before);
  });

  it('createPageForProcess refuses a second page on the same process', () => {
    const ast = fresh();
    expect(() => createPageForProcess('P1').apply(ast)).toThrow('already has a page');
  });

  it('linkProcessToPage retargets and reverts (page identity is by id)', () => {
    const ast = fresh();
    const proc = ast.processes.find(p => p.id === 'P1')!;
    // The kernel's resolver strips `_relations` — a process holds a
    // COPY of its page; identity is by id, never by object.
    expect((proc.page as { id: string }).id).toBe('Page1');
    const cmd = linkProcessToPage('P1', null);
    cmd.apply(ast);
    expect(proc.page).toBeNull();
    expect(orphanPages(ast)).toContain('Page1');
    cmd.revert(ast);
    expect((proc.page as { id: string }).id).toBe('Page1');
    expect(ast.pages.some(p => p.id === 'Page1')).toBe(true);
  });

  it('renamePage updates placements + edges; the process follows; reverts exactly', () => {
    const ast = fresh();
    const before = JSON.parse(JSON.stringify(ast));
    const cmd = renamePage('Page1', 'AssemblyBay');
    cmd.apply(ast);
    expect(ast.pages.map(p => p.id)).toContain('AssemblyBay');
    expect(pagePath(ast, 'AssemblyBay')).toEqual(['Root', 'AssemblyBay']);
    const text = dump(ast);
    expect(text).toContain('canvas AssemblyBay');
    const reparsed = load(text);
    expect(pagePath(reparsed, 'AssemblyBay')).toEqual(['Root', 'AssemblyBay']);
    cmd.revert(ast);
    expect(JSON.parse(JSON.stringify(ast))).toEqual(before);
  });

  it('renamePage refuses a taken id', () => {
    const ast = fresh();
    expect(() => renamePage('Page1', 'P1').apply(ast)).toThrow('already taken');
    expect(() => renamePage('Page1', '  ').apply(ast)).toThrow('empty');
  });
});

describe('the cross-page edge discipline', () => {
  it('an element on ANOTHER page refuses as cross-page (the actionable verdict)', () => {
    const ast = fresh();
    // P2 lives on Page1; connecting it from the Root page is cross-page.
    const verdict = canConnect(page(ast, 'Root'), 'P1', 'P2', '', ast);
    expect(verdict).toEqual({ ok: false, reason: 'cross-page' });
  });

  it('without the model context the same attempt reports endpoint-missing', () => {
    const ast = fresh();
    const verdict = canConnect(page(ast, 'Root'), 'P1', 'P2');
    expect(verdict).toEqual({ ok: false, reason: 'endpoint-missing' });
  });

  it('within one page the connect is legal', () => {
    const ast = fresh();
    const verdict = canConnect(page(ast, 'Page1'), 'P2', 'Done', '', ast);
    expect(verdict.ok).toBe(false); // E2 already occupies the pair
    const fresh_ = canConnect(page(ast, 'Page1'), 'Done', 'P2', '', ast);
    expect(fresh_).toEqual({ ok: true });
  });
});
