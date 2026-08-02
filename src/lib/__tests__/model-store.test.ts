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
