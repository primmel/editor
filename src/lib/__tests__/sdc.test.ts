// ─────────────────────────────────────────────────────────────────────
// G11's .sdc parser — the proofs, against the REAL corpus fixture
// (dptm.sdc) and the synthetic edge classes: the header parses, same-
// number lines join into one statement, headings carry empty text.
// ─────────────────────────────────────────────────────────────────────
import { describe, it, expect } from 'vitest';
import { existsSync, readFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';
import { parseSdc } from '../sdc';

const FIXTURE = join(homedir(), 'src/mn/mmel-models/dptm.sdc');
const fixtureAvailable = existsSync(FIXTURE);

const SYNTHETIC = `namespace#urn:example:doc
title#The example
version#v2
###
1#Scope

1.1#This is clause one one,
1.1#continued across two lines.

2#Normative references
`;

describe('the .sdc clause parser (G11)', () => {
  it('parses the header, headings, and joined continuations', () => {
    const doc = parseSdc(SYNTHETIC);
    expect(doc.namespace).toBe('urn:example:doc');
    expect(doc.title).toBe('The example');
    expect(doc.version).toBe('v2');
    expect(doc.clauses).toHaveLength(3);
    expect(doc.clauses[0]).toEqual({ id: '1', text: 'Scope' });
    expect(doc.clauses[1]!.id).toBe('1.1');
    expect(doc.clauses[1]!.text).toContain('clause one one,');
    expect(doc.clauses[1]!.text).toContain('continued across two lines.');
    expect(doc.clauses[2]).toEqual({ id: '2', text: 'Normative references' });
  });

  it('a bare continuation line joins the open clause', () => {
    const doc = parseSdc('namespace#n\ntitle#t\nversion#v\n###\n1#First\nsecond line\n');
    expect(doc.clauses[0]!.text).toBe('First second line');
  });

  it.runIf(fixtureAvailable)('parses the real corpus fixture (dptm.sdc)', () => {
    const doc = parseSdc(readFileSync(FIXTURE, 'utf8'));
    expect(doc.namespace).toBe('DPTM-doc');
    expect(doc.title).toBe('DPTM certification requirements');
    expect(doc.version).toBe('v1.0.0-dev1');
    expect(doc.clauses.length).toBeGreaterThan(10);
    // The wrapped 1.1.1 statement joined its same-number lines.
    const c111 = doc.clauses.find((c) => c.id === '1.1.1')!;
    expect(c111.text).toContain('Organisation shall have data protection policies');
    expect(c111.text).toContain('approved by management');
    expect(c111.text).toContain('such as:');
    // The headings are their own (empty-ish) clauses.
    expect(doc.clauses.find((c) => c.id === '1')!.text).toBe('Governance and Transparency');
  });
});

describe('the .sdc → document plane (G11)', () => {
  it('loads through the same loadDocument the XML path uses', async () => {
    const { loadDocument } = await import('../document-model');
    const doc = loadDocument(SYNTHETIC);
    expect(doc.urnBase).toBe('urn:example:doc');
    expect(doc.title).toBe('The example');
    const heading = doc.clauses.find((c) => c.number === '1')!;
    expect(heading.title).toBe('Scope');
    const stmt = doc.clauses.find((c) => c.number === '1.1')!.paragraphs[0]!.statements[0]!;
    expect(stmt.urn).toBe('urn:example:doc#1.1.p1.s1');
    expect(stmt.text).toContain('clause one one');
    // heading clauses carry no statements
    expect(heading.paragraphs).toHaveLength(0);
  });

  it.runIf(fixtureAvailable)('the real fixture maps end to end', async () => {
    const { loadDocument } = await import('../document-model');
    const doc = loadDocument(readFileSync(FIXTURE, 'utf8'));
    const c111 = doc.clauses.find((c) => c.number === '1.1.1')!;
    expect(c111.paragraphs[0]!.statements.length).toBeGreaterThanOrEqual(1);
    expect(doc.statements.size).toBeGreaterThan(5);
  });
});
