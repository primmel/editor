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
import { loadDocument, parseMirrorJson, urnBaseFor } from '../document-model';

const mirror = (name: string) =>
  readFileSync(join(__dirname, 'fixtures/mirror', `${name}.mirror.json`), 'utf8');

describe('38 — the URN families', () => {
  it('B 18, R with year, CS PD/OD/CID, D/G/E, and the slug fallback', () => {
    expect(urnBaseFor('OIML B 18:2025(E)')).toBe('urn:oiml:pub:b:18:2025');
    expect(urnBaseFor('OIML R 7', '1979')).toBe('urn:oiml:pub:r:7:1979');
    expect(urnBaseFor('OIML R 60-2:2021')).toBe('urn:oiml:pub:r:60-2:2021');
    expect(urnBaseFor('OIML-CS PD-05 Edition 6 (Amendment 1)', '2024')).toBe('urn:oiml:pub:cs:pd-05:2024');
    expect(urnBaseFor('OIML-CS OD-01 Edition 4', '2024')).toBe('urn:oiml:pub:cs:od-01:2024');
    expect(urnBaseFor('OIML-CS CID-01 Edition 6')).toBe('urn:oiml:pub:cs:cid-01');
    expect(urnBaseFor('OIML D 11:2013')).toBe('urn:oiml:pub:d:11:2013');
    expect(urnBaseFor('OIML G 21:2017')).toBe('urn:oiml:pub:g:21:2017');
    expect(urnBaseFor('OIML E 6:2011')).toBe('urn:oiml:pub:e:6:2011');
    expect(urnBaseFor('Some Other Document')).toBe('doc:Some-Other-Document');
  });
});

describe('38 — the mirror path', () => {
  it('pd-01 parses with real clauses and real text (was empty under the DOM path)', () => {
    const doc = parseMirrorJson(JSON.parse(mirror('oiml-cs-pd-01')));
    expect(doc.urnBase).toBe('urn:oiml:pub:cs:pd-01:2024');
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
    expect(first.urn.startsWith('urn:oiml:pub:cs:pd-01:2024#')).toBe(true);
  });

  it('pd-05 parses the full clause structure (13 top clauses, the annex content)', () => {
    const doc = parseMirrorJson(JSON.parse(mirror('oiml-cs-pd-05')));
    expect(doc.urnBase).toBe('urn:oiml:pub:cs:pd-05:2024');
    expect(doc.title).toContain('Processing an application');
    expect(doc.clauses.length).toBeGreaterThanOrEqual(13);
    expect(doc.statements.size).toBeGreaterThan(100);
    const titles = doc.clauses.map(c => c.title);
    expect(titles.some(t => t.includes('Scope'))).toBe(true);
    expect(titles.some(t => t.includes('Processing an OIML certificate'))).toBe(true);
  });

  it('b018-e25 parses with its framework content', () => {
    const doc = parseMirrorJson(JSON.parse(mirror('b018-e25')));
    expect(doc.urnBase).toBe('urn:oiml:pub:b:18:2025');
    expect(doc.statements.size).toBeGreaterThan(100);
  });

  it('r007 keeps its own URN (the R family with the bibdata year)', () => {
    const doc = parseMirrorJson(JSON.parse(mirror('r007-e79')));
    expect(doc.urnBase).toBe('urn:oiml:pub:r:7:1979');
    expect(doc.statements.size).toBeGreaterThan(100);
  });

  it('loadDocument dispatches on the mirror shape', () => {
    const doc = loadDocument(mirror('oiml-cs-pd-01'));
    expect(doc.urnBase).toBe('urn:oiml:pub:cs:pd-01:2024');
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
