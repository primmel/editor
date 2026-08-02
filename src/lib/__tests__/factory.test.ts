// ─────────────────────────────────────────────────────────────────────
// TODO.editor/03 — the palette factory: minting, defaults, subtypes,
// undo.
// ─────────────────────────────────────────────────────────────────────

import { describe, it, expect } from 'vitest';
import { load, type Standard } from '@primmel/primmel';
import { PALETTE, createFromPalette, previewId } from '../factory';

const TEXT = `root Root

version "v1"

metadata { title "T" schema "Primmel 0.1" namespace "N" author "A" }

start_event Start { }
end_event Done { }

canvas Root {
  elements {
    Start { x 0 y 0 }
    Done { x 0 y 200 }
  }
  process_flow { }
}`;

function fresh(): Standard {
  return load(TEXT);
}

function rootPage(ast: Standard) {
  return ast.pages.find(p => p.id === ast.root?.id)!;
}

describe('createFromPalette', () => {
  it('creates every kind with a minted id, valid AST, and an exact undo', () => {
    for (const entry of PALETTE) {
      const ast = fresh();
      const cmd = createFromPalette(ast, entry, { x: 10, y: 20 });
      const id = previewId(ast, entry);
      cmd.apply(ast);
      if (entry.kind === 'process') expect(ast.processes.map(p => p.id)).toContain(id);
      if (entry.kind === 'approval') expect(ast.approvals.map(a => a.id)).toContain(id);
      if (entry.kind === 'dataclass') expect(ast.dataclasses.map(d => d.id)).toContain(id);
      if (entry.kind === 'event') {
        const ev = ast.events.find(e => e.id === id)!;
        expect(ev.eventType).toBe(entry.eventType);
      }
      if (entry.kind === 'gateway') expect(ast.gateways.map(g => g.id)).toContain(id);
      if (entry.kind === 'subprocess') expect(ast.pages.map(p => p.id)).toContain(id);
      else expect(rootPage(ast).childs.map(c => c.name)).toContain(id);
      cmd.revert(ast);
      expect(JSON.stringify(ast)).toBe(JSON.stringify(fresh()));
    }
  });

  it('the mint never collides across 100 rapid creates', () => {
    const ast = fresh();
    const entry = PALETTE[0]!;
    const ids = new Set<string>();
    for (let i = 0; i < 100; i++) {
      const id = previewId(ast, entry);
      expect(ids.has(id)).toBe(false);
      ids.add(id);
      createFromPalette(ast, entry, { x: i, y: i }).apply(ast);
    }
    expect(ast.processes.length).toBe(100);
  });

  it('undo of a create removes the element AND its edges', () => {
    const ast = fresh();
    const cmd = createFromPalette(ast, PALETTE[0]!, { x: 5, y: 5 });
    cmd.apply(ast);
    const id = ast.processes[0]!.id;
    rootPage(ast).edges.push({ id: 'E9', from: { name: 'Start', element: { id: 'Start' }, x: 0, y: 0 }, to: { name: id, element: { id }, x: 0, y: 0 }, description: '', condition: '' });
    cmd.revert(ast);
    expect(rootPage(ast).edges.map(e => e.id)).not.toContain('E9');
    expect(ast.processes).toHaveLength(0);
  });

  it('event subtypes mint with their own prefixes and eventTypes', () => {
    const ast = fresh();
    createFromPalette(ast, PALETTE.find(p => p.eventType === 'timer')!, { x: 0, y: 0 }).apply(ast);
    const timer = ast.events.find(e => e.eventType === 'timer')!;
    expect(timer.id).toMatch(/^T\d+$/);
    createFromPalette(ast, PALETTE.find(p => p.eventType === 'signalcatch')!, { x: 0, y: 0 }).apply(ast);
    const sig = ast.events.find(e => e.eventType === 'signalcatch')!;
    expect(sig.id).toMatch(/^Sig\d+$/);
  });
});
