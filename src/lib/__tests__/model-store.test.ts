// ─────────────────────────────────────────────────────────────────────
// TODO.editor/01 — the store's dirty/undo/redo discipline.
// ─────────────────────────────────────────────────────────────────────

import { describe, it, expect, beforeEach } from 'vitest';
import { createPinia, setActivePinia } from 'pinia';
import { useModelStore } from '../../stores/model';
import { createEdge, createElement, updateMeta } from '../commands';

beforeEach(() => {
  setActivePinia(createPinia());
});

describe('the model store', () => {
  it('loads the sample; every mutation is a command; undo/redo walks exactly', () => {
    const store = useModelStore();
    store.loadText(store.rawText);
    expect(store.standard).toBeTruthy();
    expect(store.parseError).toBeNull();
    expect(store.dirty).toBe(false);

    store.execute(createElement('process', 'PX1', { x: 1, y: 2 }));
    expect(store.dirty).toBe(true);
    expect(store.standard!.processes.map(p => p.id)).toContain('PX1');

    store.undo();
    expect(store.standard!.processes.map(p => p.id)).not.toContain('PX1');
    expect(store.dirty).toBe(false);

    store.redo();
    expect(store.standard!.processes.map(p => p.id)).toContain('PX1');
    expect(store.dirty).toBe(true);

    store.markSaved();
    expect(store.dirty).toBe(false);
  });

  it('a create → edit → save chain serializes the edits byte-clean', () => {
    const store = useModelStore();
    store.loadText(store.rawText);
    store.execute(createElement('process', 'PX1', { x: 1, y: 2 }));
    store.execute(updateMeta({ title: 'Renamed' }));
    store.execute(createEdge('root', 'E9', 'Manufacturing', 'PX1'));
    const text = store.serialize();
    expect(text).toContain('PX1');
    expect(text).toContain('Renamed');
    expect(text).toContain('E9');
    // The serialized text parses back to an equivalent AST.
    const back = useModelStore();
    back.loadText(text);
    expect(back.parseError).toBeNull();
    expect(back.standard!.meta.title).toBe('Renamed');
  });

  it('setText parses good text and surfaces parse errors without touching the AST', () => {
    const store = useModelStore();
    store.loadText(store.rawText);
    const before = store.standard;
    store.setText('this is not valid prl {{{');
    expect(store.parseError).toBeTruthy();
    expect(store.standard).toBe(before);
  });
});

describe('W4 — the read-only store (the viewer mode)', () => {
  const UNPOSITIONED = `root Root

version "v1.0.0-dev1"

metadata {
  title "T"
  schema "Primmel 0.1"
  namespace "N"
}

start_event Start { }
process A { }
end_event Done { }

canvas Root {
  elements {
    Start { }
    A { }
    Done { }
  }
  process_flow {
    E1 { from Start to A }
    E2 { from A to Done }
  }
}`;

  it('every mutation path refuses; loading still works', () => {
    const store = useModelStore();
    store.setReadOnly(true);
    store.loadText(store.rawText);
    expect(store.standard).toBeTruthy();
    expect(store.parseError).toBeNull();

    const processes = store.standard!.processes.length;
    store.execute(createElement('process', 'PX1', { x: 1, y: 2 }));
    expect(store.standard!.processes.length).toBe(processes);
    expect(store.dirty).toBe(false);
    expect(store.canUndo).toBe(false);

    const text = store.rawText;
    store.setText('root X');
    store.loadFile('root X');
    store.format();
    expect(store.rawText).toBe(text);
    expect(store.parseError).toBeNull();

    store.undo();
    store.redo();
    expect(store.standard!.processes.length).toBe(processes);
  });

  it('the layout pass fires on load: unpositioned pages draw, authored pages keep their positions', () => {
    const store = useModelStore();
    store.setReadOnly(true);
    store.loadText(UNPOSITIONED);
    const canvas = store.standard!.pages[0]!;
    const pos = Object.fromEntries(canvas.childs.map(c => [c.name, [c.x, c.y]]));
    expect(pos['Start']).toEqual([0, 0]);
    expect(pos['A']).toEqual([160, 0]);
    expect(pos['Done']).toEqual([320, 0]);
    // The pass is a display projection: the code view's text is untouched.
    expect(store.rawText).toBe(UNPOSITIONED);
    expect(store.dirty).toBe(false);
  });

  it('edit mode (the default) never repositions on load', () => {
    const store = useModelStore();
    store.loadText(UNPOSITIONED);
    const canvas = store.standard!.pages[0]!;
    expect(canvas.childs.every(c => c.x === 0 && c.y === 0)).toBe(true);
  });
});
