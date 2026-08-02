// ─────────────────────────────────────────────────────────────────────
// TODO.editor/22 — the new-model flow's proofs:
//   - the three templates parse (strict) and boot the workspace;
//   - the reference/implementation templates carry the role + first
//     process + the two-edge flow;
//   - the implementation template carries the mapping guide note.
// ─────────────────────────────────────────────────────────────────────

import { describe, it, expect } from 'vitest';
import { load } from '@primmel/primmel';
import { newModelTemplate } from '../templates';

describe('22 — the templates', () => {
  it('blank: minimal and valid', () => {
    const ast = load(newModelTemplate('blank', { title: 'Blank', namespace: 'BlankNs' }), { strict: true });
    expect(ast.meta.namespace).toBe('BlankNs');
    expect(ast.roles.map(r => r.id)).toEqual(['BlankNs']);
    expect(ast.processes).toHaveLength(0);
    expect(ast.pages).toHaveLength(1);
    expect(ast.events).toHaveLength(2);
  });

  it('reference: role + first process + the two-edge flow', () => {
    const ast = load(newModelTemplate('reference', { title: 'Clinical thermometers', namespace: 'OIML.R7' }), { strict: true });
    expect(ast.meta.title).toBe('Clinical thermometers');
    expect(ast.meta.namespace).toBe('OIML.R7');
    expect(ast.roles.map(r => r.id)).toEqual(['OIMLR7']);
    expect(ast.processes.map(p => p.id)).toEqual(['FirstProcess']);
    expect(ast.processes[0]!.modality).toBe('SHALL');
    const root = ast.pages.find(p => p.id === ast.root?.id)!;
    expect(root.childs.map(c => c.name)).toEqual(['Start', 'FirstProcess', 'Done']);
    expect(root.edges).toHaveLength(2);
  });

  it('implementation: the mapping guide note is real PRL', () => {
    const ast = load(newModelTemplate('implementation', { title: 'Acme Ops', namespace: 'AcmeOps' }), { strict: true });
    expect(ast.notes.map(n => n.id)).toEqual(['MappingGuide']);
    expect(ast.notes[0]!.message).toContain('Mapping view');
    expect(ast.processes).toHaveLength(1);
  });

  it('special characters in titles escape honestly', () => {
    const ast = load(newModelTemplate('blank', { title: 'A "quoted" title', namespace: 'Ns' }), { strict: true });
    expect(ast.meta.title).toBe('A "quoted" title');
  });

  it('empty options fall back to honest defaults', () => {
    const ast = load(newModelTemplate('blank', { title: '', namespace: '' }), { strict: true });
    expect(ast.meta.namespace).toBe('NewModel');
    expect(ast.roles).toHaveLength(1);
  });
});
