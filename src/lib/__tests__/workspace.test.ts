// ─────────────────────────────────────────────────────────────────────
// The workspace index (TODO.editor wave 05, audit G9) — the typed
// Imp/Ref/Doc derivation over the session state: the open model's
// typing (manifest tier vs loose file), the package-session inventory,
// the reference registry (sorted, the active lens flagged), the
// doc-mirror attachment.
// ─────────────────────────────────────────────────────────────────────

import { describe, it, expect } from 'vitest';
import { load } from '@primmel/primmel';
import { workspaceIndex } from '../workspace';
import type { PackageOpenResult } from '../package';
import type { DocumentModel } from '../document-model';

const MODEL = `metadata {
  title "The open model"
  schema ""
  edition ""
  author ""
  namespace "urn:example:imp"
}

process P1 {
  name "Do the thing"
}

term widget {
  label "widget"
  definition "a measurable thing"
}
`;

const REF_A = `metadata {
  title "Reference A"
  schema ""
  edition ""
  author ""
  namespace "urn:example:ref-a"
}

requirement /req/a1 {
  name "A1"
  statement "shall a"
}
`;

const REF_B = `metadata {
  title "Reference B"
  schema ""
  edition ""
  author ""
  namespace "urn:example:ref-b"
}
`;

const PACKAGE_MODEL = `package {
  id demo-pkg
  title "Demo package"
  kind module
  editions { 2025 2021 }
  uses { oiml-cs }
}

process P1 {
  name "Do the thing"
}
`;

function pkgSession(): PackageOpenResult {
  return {
    dir: '/pkgs/demo-pkg',
    id: 'demo-pkg',
    title: 'Demo package',
    manifest: load(PACKAGE_MODEL, { strict: true }).packageManifest!,
    composition: { root: 'demo-pkg', order: ['oiml-cs', 'demo-pkg'] },
    issues: [],
    files: [
      { path: 'package.primmel', role: 'manifest', constructs: 1, text: '' },
      { path: 'model.prl', role: 'content', constructs: 1, text: '' },
    ],
    imports: [
      { package: 'oiml-cs', files: [{ path: 'cs.prl', constructs: 42 }, { path: 'terms.prl', constructs: 8 }] },
    ],
    layers: [],
    overlays: [],
    dump: '',
    provenance: { constructs: {} },
  };
}

function docMirror(): DocumentModel {
  return {
    docid: 'R 60',
    title: 'Non-automatic weighing instruments',
    urnBase: 'urn:oiml:pub:r:60-1:2021',
    clauses: [
      { id: '1', number: '1', title: 'Scope', paragraphs: [] },
      { id: '2', number: '2', title: 'Terminology', paragraphs: [] },
    ],
    statements: new Map([
      ['1.p1.s1', { id: '1.p1.s1', urn: 'urn:oiml:pub:r:60-1:2021#1.p1.s1', text: 's1', clauseNumber: '1' }],
      ['2.p1.s1', { id: '2.p1.s1', urn: 'urn:oiml:pub:r:60-1:2021#2.p1.s1', text: 's2', clauseNumber: '2' }],
      ['2.p1.s2', { id: '2.p1.s2', urn: 'urn:oiml:pub:r:60-1:2021#2.p1.s2', text: 's3', clauseNumber: '2' }],
    ]),
  };
}

describe('W5 — the workspace index (the typed Imp/Ref/Doc session)', () => {
  it('a loose single-file model types as kind "model" with no package inventory', () => {
    const idx = workspaceIndex(load(MODEL, { strict: true }), null, {}, null, null);
    expect(idx.imp.id).toBe('urn:example:imp');
    expect(idx.imp.title).toBe('The open model');
    expect(idx.imp.kind).toBe('model');
    expect(idx.imp.files).toBe(null);
    expect(idx.imp.imports).toEqual([]);
    expect(idx.imp.editions).toEqual([]);
    expect(idx.imp.counts).toEqual({ processes: 1, requirements: 0, terms: 1 });
    expect(idx.refs).toEqual([]);
    expect(idx.doc).toBe(null);
  });

  it('a package-carrying model types by the manifest tier; the session carries files/imports/editions', () => {
    const idx = workspaceIndex(load(PACKAGE_MODEL, { strict: true }), pkgSession(), {}, null, null);
    expect(idx.imp.id).toBe('demo-pkg');
    expect(idx.imp.kind).toBe('module');
    expect(idx.imp.files).toBe(2);
    expect(idx.imp.imports).toEqual([{ id: 'oiml-cs', constructs: 50 }]);
    expect(idx.imp.editions).toEqual(['2025', '2021']);
  });

  it('a manifest without a kind tier is an ordinary rec package', () => {
    const bare = `package {\n  id plain-pkg\n  title "Plain"\n}\n`;
    const idx = workspaceIndex(load(bare, { strict: true }), null, {}, null, null);
    expect(idx.imp.kind).toBe('rec');
  });

  it('the reference registry lists sorted with the active lens flagged', () => {
    const refs = {
      'urn:example:ref-b': load(REF_B, { strict: true }),
      'urn:example:ref-a': load(REF_A, { strict: true }),
    };
    const idx = workspaceIndex(load(MODEL, { strict: true }), null, refs, 'urn:example:ref-a', null);
    expect(idx.refs.map(r => r.namespace)).toEqual(['urn:example:ref-a', 'urn:example:ref-b']);
    expect(idx.refs[0]?.active).toBe(true);
    expect(idx.refs[1]?.active).toBe(false);
    expect(idx.refs[0]?.counts).toEqual({ processes: 0, requirements: 1, terms: 0 });
  });

  it('the attached document carries the clause/statement counts', () => {
    const idx = workspaceIndex(load(MODEL, { strict: true }), null, {}, null, docMirror());
    expect(idx.doc).toEqual({
      title: 'Non-automatic weighing instruments',
      urnBase: 'urn:oiml:pub:r:60-1:2021',
      clauses: 2,
      statements: 3,
    });
  });
});
