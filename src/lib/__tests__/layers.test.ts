// ─────────────────────────────────────────────────────────────────────
// TODO.editor/05 slice 3 — the layer-overlay view, proven: the open
// payload's composition stack (the per-package kind census from the
// provenance) and the overlay pairs (the term marked `overlay true`
// joined to the upstream definition it supersedes), plus the panel's
// pure derivation (stack ordering, totals, the honest empty states).
//
// Q1 — the copy-up verb: the upstream-candidate derivation (terms a
// layer beneath authors, not yet claimed here) and the marker-flip
// command with its exact undo.
// ─────────────────────────────────────────────────────────────────────

import { describe, it, expect } from 'vitest';
import path from 'node:path';
import { load } from '@primmel/primmel';
import { copyUpTerm, kindCensus, layersView, upstreamAuthorOf, upstreamTerms } from '../layers';
import type { PackageOpenResult } from '../package';
import { openPackagePayload } from '../../../scripts/package-open';

const OVER = path.resolve(import.meta.dirname, 'fixtures/pkg-over');

describe('05 slice 3 — the payload: the composition stack + the overlay pairs', () => {
  const session = openPackagePayload(OVER);

  it('the stack lists every package in merge order with its kind census', () => {
    expect(session.layers.map((l) => l.package)).toEqual(['pkg-base', 'pkg-over']);
    expect(session.layers.find((l) => l.package === 'pkg-over')?.root).toBe(true);
    expect(session.layers.find((l) => l.package === 'pkg-base')?.root).toBe(false);
  });

  it('the winner takes the attribution: pkg-base declares 2 terms, the merged census credits it 1', () => {
    // impartiality's provenance names the OVERLAYING package (last-write-
    // wins); pkg-base keeps traceability only. The overlay pair below
    // still names pkg-base as the upstream the term was taken from.
    const base = session.layers.find((l) => l.package === 'pkg-base');
    const over = session.layers.find((l) => l.package === 'pkg-over');
    expect(base?.kinds).toEqual([{ field: 'terms', constructs: 1 }]);
    expect(over?.kinds).toEqual([{ field: 'terms', constructs: 2 }]);
  });

  it('the overlay pair joins the marked term to the upstream definition it supersedes', () => {
    expect(session.overlays).toHaveLength(1);
    const o = session.overlays[0];
    expect(o.id).toBe('impartiality');
    expect(o.package).toBe('pkg-over');
    expect(o.file).toBe('terminology.prl');
    expect(o.definition).toContain("the rec's tighter reading");
    expect(o.overlaidPackage).toBe('pkg-base');
    expect(o.overlaid?.definition).toContain("the base layer's reading");
    expect(o.overlaid?.source).toBe('BASE, 4.1');
  });

  it('a package without imports ships an empty overlay table and a one-row stack', () => {
    const base = openPackagePayload(path.resolve(import.meta.dirname, 'fixtures/pkg-base'));
    expect(base.layers.map((l) => l.package)).toEqual(['pkg-base']);
    expect(base.overlays).toEqual([]);
  });
});

describe('05 slice 3 — layersView (the panel derivation)', () => {
  function fabricated(overlays: PackageOpenResult['overlays']): PackageOpenResult {
    return {
      dir: '/pkgs/pkg-over',
      id: 'pkg-over',
      title: 'Probe Overlay Rec',
      manifest: openPackagePayload(OVER).manifest,
      composition: { root: 'pkg-over', order: ['pkg-base', 'pkg-over'] },
      issues: [],
      files: [],
      imports: [],
      layers: [
        { package: 'pkg-base', root: false, kinds: [{ field: 'terms', constructs: 2 }] },
        { package: 'pkg-over', root: true, kinds: [{ field: 'terms', constructs: 2 }, { field: 'processes', constructs: 1 }] },
      ],
      overlays,
      dump: '',
      provenance: { constructs: {} },
    };
  }

  it('the stack displays the root on top, then the layers nearest-winner first', () => {
    const view = layersView(fabricated([]));
    expect(view.stack.map((l) => l.package)).toEqual(['pkg-over', 'pkg-base']);
    expect(view.stack[0].total).toBe(3);
    expect(view.hasLayers).toBe(true);
  });

  it('the kind census renders count-desc, field-asc', () => {
    expect(kindCensus({ package: 'x', root: true, kinds: [{ field: 'processes', constructs: 1 }, { field: 'terms', constructs: 2 }] }))
      .toBe('2 terms · 1 processes');
  });

  it('a lone package has no layers beneath it', () => {
    const view = layersView({ ...fabricated([]), layers: [{ package: 'pkg-over', root: true, kinds: [] }] });
    expect(view.hasLayers).toBe(false);
    expect(view.stack[0].total).toBe(0);
  });

  it('a marker without an upstream target surfaces honestly (null, never invented)', () => {
    const view = layersView(fabricated([
      { id: 'lone-overlay', package: 'pkg-over', file: 'terminology.prl', overlaidPackage: null, overlaid: null },
    ]));
    expect(view.overlays).toHaveLength(1);
    expect(view.overlays[0].overlaidPackage).toBeNull();
  });
});

describe('Q1 — the copy-up verb: the candidates, the flip, the exact undo', () => {
  const session = openPackagePayload(OVER);

  it('the candidate list names the upstream-authored terms, the authoring layer attested', () => {
    const ups = upstreamTerms(session, load(session.dump, { strict: true }));
    expect(ups.map((u) => u.id)).toEqual(['traceability']);
    expect(ups[0].package).toBe('pkg-base');
  });

  it('the seed IS the nearest-upstream definition — the merged term carries it verbatim', () => {
    const ups = upstreamTerms(session, load(session.dump, { strict: true }));
    expect(ups[0].label).toBe('traceability');
    expect(ups[0].definition).toContain('related to references');
    expect(ups[0].source).toBe('BASE, 4.2');
  });

  it('the local overlay and the root-authored term are never candidates', () => {
    const ids = upstreamTerms(session, load(session.dump, { strict: true })).map((u) => u.id);
    expect(ids).not.toContain('impartiality'); // already claimed (the overlay pair)
    expect(ids).not.toContain('own-scope');    // the root's own
  });

  it('upstreamAuthorOf attests the authoring layer (null for the root’s own and the unknown)', () => {
    expect(upstreamAuthorOf(session, 'traceability')).toBe('pkg-base');
    expect(upstreamAuthorOf(session, 'impartiality')).toBeNull(); // the winner is the root
    expect(upstreamAuthorOf(session, 'own-scope')).toBeNull();
    expect(upstreamAuthorOf(session, 'nope')).toBeNull();
  });

  it('the verb flips the marker and keeps the upstream content as the seed; undo reverts exactly', () => {
    const work = load(session.dump, { strict: true });
    const cmd = copyUpTerm('traceability');
    expect(cmd.label).toContain('copy up term traceability');
    cmd.apply(work);
    const t = work.terms.find((x) => x.id === 'traceability');
    expect(t?.overlay).toBe(true);
    expect(t?.definition).toContain('related to references'); // the seed
    cmd.revert(work);
    expect(work.terms.find((x) => x.id === 'traceability')?.overlay).not.toBe(true);
  });

  it('a claimed term drops out of the candidate list (the panel’s live read)', () => {
    const work = load(session.dump, { strict: true });
    copyUpTerm('traceability').apply(work);
    expect(upstreamTerms(session, work)).toEqual([]);
  });

  it('the verb refuses an unknown term', () => {
    const work = load(session.dump, { strict: true });
    expect(() => copyUpTerm('nope').apply(work)).toThrow('unknown construct');
  });
});
