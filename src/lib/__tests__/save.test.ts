// ─────────────────────────────────────────────────────────────────────
// TODO.editor/18 — the save path's proofs:
//   - the written bytes parse back to the same model (byte-clean
//     through the kernel's dump);
//   - the preview shows EXACTLY the edits made (nothing more);
//   - the dirty discipline across undo/redo (cursor ≠ saved cursor).
// ─────────────────────────────────────────────────────────────────────

import { describe, it, expect } from 'vitest';
import { load, type Standard } from '@primmel/primmel';
import { serializeForSave, suggestedFileName } from '../save';
import { updateElement } from '../commands';

const ORIGINAL = `root Root

version "v1.0.0-dev1"

metadata {
  title "T"
  schema "Primmel 0.1"
  namespace "AcmeOps"
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

describe('18 — serialize for save', () => {
  it('the written bytes parse back to the same model', () => {
    const ast: Standard = load(ORIGINAL, { strict: true });
    updateElement((a: Standard) => a.processes, 'P1', { name: 'P one edited' }).apply(ast);

    const { text } = serializeForSave(ast, ORIGINAL);
    const reparsed = load(text, { strict: true });
    expect(reparsed.processes.find(p => p.id === 'P1')!.name).toBe('P one edited');
    expect(reparsed.processes).toHaveLength(1);
    expect(reparsed.roles).toHaveLength(1);
  });

  it('the preview shows exactly the edits — nothing more', () => {
    const ast: Standard = load(ORIGINAL, { strict: true });
    updateElement((a: Standard) => a.processes, 'P1', { name: 'P one edited' }).apply(ast);

    const { diff } = serializeForSave(ast, ORIGINAL);
    expect(diff).not.toBeNull();
    expect(diff!.diff.added).toHaveLength(0);
    expect(diff!.diff.removed).toHaveLength(0);
    expect(diff!.diff.changed).toHaveLength(1);
    expect(diff!.diff.changed[0]!.id).toBe('P1');
    const facet = diff!.byStatus.changed[0]!.facets.find(f => f.aspect === 'statement')!;
    expect(facet.before).toContain('P one');
    expect(facet.after).toContain('edited');
  });

  it('an unedited model previews empty', () => {
    const ast: Standard = load(ORIGINAL, { strict: true });
    const { diff } = serializeForSave(ast, ORIGINAL);
    expect(diff!.diff.empty).toBe(true);
    expect(diff!.rows).toHaveLength(0);
  });

  it('the file name comes from the namespace', () => {
    const ast: Standard = load(ORIGINAL, { strict: true });
    expect(suggestedFileName(ast)).toBe('AcmeOps.prl');
  });
});

describe('18 — the dirty discipline', () => {
  it('cursor vs saved cursor across commands and undo/redo', async () => {
    // The store-level discipline: any command dirties; markSaved
    // clears; undo/redo re-dirties exactly.
    const { useModelStore } = await import('../../stores/model');
    const { createPinia, setActivePinia } = await import('pinia');
    setActivePinia(createPinia());
    const store = useModelStore();

    expect(store.dirty).toBe(false);
    store.execute(updateElement((a: Standard) => a.processes, 'Manufacturing', { name: 'X' }));
    expect(store.dirty).toBe(true);
    store.markSaved();
    expect(store.dirty).toBe(false);
    store.undo();
    expect(store.dirty).toBe(true);
    store.redo();
    expect(store.dirty).toBe(false); // cursor back at the saved point
  });
});
