// ─────────────────────────────────────────────────────────────────────
// TODO.editor/38 — the mirror document-model's proofs:
//   - the previously-empty CS documents parse with real clauses and
//     real text (the mirror path);
//   - the URNs mint per OIML family (B / R + bibdata year / CS);
//   - loadDocument dispatches on the mirror shape.
// ─────────────────────────────────────────────────────────────────────

import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { urnForIdentifier } from '@oimlsmart/oiml-pubid';
import corpus from '@oimlsmart/oiml-pubid/conformance';
import { loadDocument, parseMirrorJson, urnBaseFor } from '../document-model';

// The URN expectations come from THE package's conformance corpus
// (SSOT — never hand-pinned here).
const urnOf = (id: string, year?: string) => {
  const c = corpus.cases.find((x: { identifier: string; bibdataYear?: string; urn: string }) =>
    x.identifier === id && (year === undefined || x.bibdataYear === year));
  if (!c) throw new Error(`no conformance case for ${id}`);
  return c.urn;
};

const mirror = (name: string) =>
  readFileSync(join(__dirname, 'fixtures/mirror', `${name}.mirror.json`), 'utf8');

describe('38 — the URN families (against THE conformance corpus)', () => {
  it('urnBaseFor matches the corpus, case for case', () => {
    for (const c of corpus.cases) {
      expect(urnBaseFor(c.identifier, c.bibdataYear ?? ''), c.identifier).toBe(c.urn);
    }
    expect(urnBaseFor('Some Other Document')).toBe('doc:Some-Other-Document');
  });
});

describe('38 — the mirror path', () => {
  it('pd-01 parses with real clauses and real text (was empty under the DOM path)', () => {
    const doc = parseMirrorJson(JSON.parse(mirror('oiml-cs-pd-01')));
    expect(doc.urnBase).toBe(urnOf('OIML-CS PD-01 Edition 3', '2024'));
    expect(doc.title).toContain('Appeals');
    // The grain: 3 top-level units (Foreword, Introduction, the body
    // section) with the numbered body folded in — real text throughout.
    expect(doc.clauses.length).toBe(3);
    expect(doc.statements.size).toBeGreaterThan(50);
    // A real statement's text is real.
    const all = [...doc.statements.values()].map(s => s.text).join(' ');
    expect(all).toContain('appeal');
    // Statement URNs are well-formed.
    const first = [...doc.statements.values()][0]!;
    expect(first.urn.startsWith(urnOf('OIML-CS PD-01 Edition 3', '2024') + '#')).toBe(true);
  });

  it('pd-05 parses the full clause structure (13 top clauses, the annex content)', () => {
    const doc = parseMirrorJson(JSON.parse(mirror('oiml-cs-pd-05')));
    expect(doc.urnBase).toBe(urnOf('OIML-CS PD-05 Edition 6 (Amendment 1)', '2024'));
    expect(doc.title).toContain('Processing an application');
    expect(doc.clauses.length).toBeGreaterThanOrEqual(13);
    expect(doc.statements.size).toBeGreaterThan(100);
    const titles = doc.clauses.map(c => c.title);
    expect(titles.some(t => t.includes('Scope'))).toBe(true);
    expect(titles.some(t => t.includes('Processing an OIML certificate'))).toBe(true);
  });

  it('b018-e25 parses with its framework content', () => {
    const doc = parseMirrorJson(JSON.parse(mirror('b018-e25')));
    expect(doc.urnBase).toBe(urnOf('OIML B 18:2025(E)'));
    expect(doc.statements.size).toBeGreaterThan(100);
  });

  it('r007 keeps its own URN (the R family with the bibdata year)', () => {
    const doc = parseMirrorJson(JSON.parse(mirror('r007-e79')));
    expect(doc.urnBase).toBe(urnOf('OIML R 7', '1979'));
    expect(doc.statements.size).toBeGreaterThan(100);
  });

  it('loadDocument dispatches on the mirror shape', () => {
    const doc = loadDocument(mirror('oiml-cs-pd-01'));
    expect(doc.urnBase).toBe(urnOf('OIML-CS PD-01 Edition 3', '2024'));
    expect(() => loadDocument('{"type":"other"}')).toThrow('not a Mirror JSON');
  });

  it('list items are statements on their own', () => {
    const doc = parseMirrorJson(JSON.parse(mirror('oiml-cs-pd-05')));
    const listItems = [...doc.statements.keys()].filter(id => id.includes('.li'));
    expect(listItems.length).toBeGreaterThan(5);
    const stmt = doc.statements.get(listItems[0]!)!;
    expect(stmt.text.length).toBeGreaterThan(10);
  });
});
