// ─────────────────────────────────────────────────────────────────────
// TODO.editor/02 — the edge/connect logic: the connection discipline,
// the edge-id mint, the double-click navigation.
// ─────────────────────────────────────────────────────────────────────

import { describe, it, expect } from 'vitest';
import { load, type Standard } from '@primmel/primmel';
import { canConnect, edgeEnds, mintEdgeId, pageChildNames, pageDataNames, pageForNode } from '../edges';

const TEXT = `root Root

version "v1"

metadata { title "T" schema "Primmel 0.1" namespace "N" author "A" }

start_event Start { }
end_event Done { }

process P1 {
  name "one"
  subprocess Page0
}

subprocess Page0 {
  elements {
    Start { x 0 y 0 }
  }
  process_flow { }
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

function rootPage(ast: Standard) {
  return ast.pages.find(p => p.id === ast.root?.id)!;
}

describe('the connection discipline', () => {
  it('refuses a self-loop', () => {
    const page = rootPage(fresh());
    expect(canConnect(page, 'P1', 'P1')).toEqual({ ok: false, reason: 'same-node' });
  });

  it('refuses a missing endpoint', () => {
    const page = rootPage(fresh());
    expect(canConnect(page, 'P1', 'Ghost')).toEqual({ ok: false, reason: 'endpoint-missing' });
  });

  it('refuses an exact duplicate (from + to + condition)', () => {
    const page = rootPage(fresh());
    expect(canConnect(page, 'Start', 'P1')).toEqual({ ok: false, reason: 'duplicate-edge' });
    // …but a different condition is a different edge.
    expect(canConnect(page, 'Start', 'P1', 'x > 0').ok).toBe(true);
  });

  it('accepts a fresh connection', () => {
    const page = rootPage(fresh());
    expect(canConnect(page, 'Done', 'Start').ok).toBe(true);
  });

  it('page membership reads names through both shapes', () => {
    const ast = fresh();
    expect(pageChildNames(rootPage(ast))).toEqual(['Start', 'P1', 'Done']);
    expect(pageDataNames(rootPage(ast))).toEqual([]);
  });
});

describe('edgeEnds', () => {
  it('reads endpoint ids through the resolved shape', () => {
    const page = rootPage(fresh());
    const e1 = page.edges.find(e => e.id === 'E1')!;
    expect(edgeEnds(e1)).toEqual({ from: 'Start', to: 'P1' });
    const e2 = page.edges.find(e => e.id === 'E2')!;
    expect(edgeEnds(e2)).toEqual({ from: 'P1', to: 'Done' });
  });
});

describe('mintEdgeId', () => {
  it('mints the smallest free E{n}', () => {
    const page = rootPage(fresh());
    expect(mintEdgeId(page)).toBe('E3');
  });
});

describe('pageForNode (double-click navigation)', () => {
  it('a subprocess page id navigates to itself', () => {
    expect(pageForNode(fresh(), 'Page0')).toBe('Page0');
  });

  it('a process with a subprocess link navigates to its page', () => {
    expect(pageForNode(fresh(), 'P1')).toBe('Page0');
  });

  it('a plain node does not navigate', () => {
    expect(pageForNode(fresh(), 'Start')).toBeNull();
  });
});
