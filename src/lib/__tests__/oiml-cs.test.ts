// ─────────────────────────────────────────────────────────────────────
// TODO.editor/39 — the OIML-CS deep audit's proofs:
//   - the corpus matrix: every CS document parses through the mirror
//     path with real content (pinned clause/statement counts);
//   - the scheme package: the 34 PD-05 requirements load strict and
//     validate clean, and every doc-map target resolves against the
//     parsed PD-05 mirror (the provenance is real);
//   - the certification workflow: application → acceptance → testing →
//     test report → evaluation report → certificate → BIML registration
//     simulates — the conforming path, the information-request path,
//     and the failed-test path.
// ─────────────────────────────────────────────────────────────────────

import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { dump, load, validate, type Standard } from '@primmel/primmel';
import { parseMirrorJson } from '../document-model';
import { createRun, step, type SimState } from '../simulator';
import { splitTargetRef } from '../mapper';

const demoDir = join(__dirname, '../../../demo/oiml-cs');
const fixtureDir = join(__dirname, 'fixtures/mirror');
const MODEL = readFileSync(join(demoDir, 'model.prl'), 'utf8');
const CERT = readFileSync(join(demoDir, 'certification.prl'), 'utf8');
const PD05 = JSON.parse(readFileSync(join(demoDir, 'oiml-cs-pd-05.mirror.json'), 'utf8'));

// The corpus matrix: every CS document through the mirror path, pinned
// by (urnBase, clauses, statements) — the counts are the grain guard:
// a converter or parser change that shifts the grain fails here first.
const CORPUS: { file: string; urn: string; clauses: number; statements: number }[] = [
  { file: 'b018-e18', urn: 'urn:oiml:pub:b:18:2018', clauses: 18, statements: 281 },
  { file: 'b018-e25', urn: 'urn:oiml:pub:b:18:2025', clauses: 18, statements: 296 },
  { file: 'oiml-cs-pd-01', urn: 'urn:oiml:pub:cs:pd-01:2024', clauses: 3, statements: 82 },
  { file: 'oiml-cs-pd-02', urn: 'urn:oiml:pub:cs:pd-02:2022', clauses: 3, statements: 64 },
  { file: 'oiml-cs-pd-03', urn: 'urn:oiml:pub:cs:pd-03:2025', clauses: 3, statements: 170 },
  { file: 'oiml-cs-pd-04', urn: 'urn:oiml:pub:cs:pd-04:2025', clauses: 3, statements: 151 },
  { file: 'oiml-cs-pd-05', urn: 'urn:oiml:pub:cs:pd-05:2024', clauses: 16, statements: 220 },
  { file: 'oiml-cs-pd-06', urn: 'urn:oiml:pub:cs:pd-06:2024', clauses: 7, statements: 36 },
  { file: 'oiml-cs-pd-07', urn: 'urn:oiml:pub:cs:pd-07:2024', clauses: 3, statements: 113 },
  { file: 'oiml-cs-pd-08', urn: 'urn:oiml:pub:cs:pd-08:2024', clauses: 3, statements: 34 },
  { file: 'oiml-cs-pd-09', urn: 'urn:oiml:pub:cs:pd-09:2025', clauses: 3, statements: 60 },
  { file: 'oiml-cs-od-01', urn: 'urn:oiml:pub:cs:od-01:2024', clauses: 3, statements: 302 },
  { file: 'oiml-cs-od-02', urn: 'urn:oiml:pub:cs:od-02:2024', clauses: 3, statements: 52 },
  { file: 'oiml-cs-cid-01', urn: 'urn:oiml:pub:cs:cid-01:2024', clauses: 5, statements: 17 },
];

function model(): Standard {
  return load(MODEL, { strict: true });
}

function cert(): Standard {
  return load(CERT, { strict: true });
}

function walk(registers: Record<string, string>): { state: SimState; trajectory: string[] } {
  const ast = cert();
  let state = createRun(ast, { registers });
  let guard = 0;
  while (!state.done && !state.blocked && guard++ < 50) {
    state = step(ast, state);
  }
  return { state, trajectory: state.trajectory.map(t => t.nodeId) };
}

describe('39 — the corpus matrix', () => {
  it.each(CORPUS)('$file parses with real content (pinned grain)', ({ file, urn, clauses, statements }) => {
    const json = JSON.parse(readFileSync(join(fixtureDir, `${file}.mirror.json`), 'utf8'));
    const doc = parseMirrorJson(json);
    expect(doc.urnBase).toBe(urn);
    expect(doc.clauses).toHaveLength(clauses);
    expect(doc.statements.size).toBe(statements);
  });

  it('the CS corpus is 14 documents, every one with statements', () => {
    expect(CORPUS).toHaveLength(14);
    for (const row of CORPUS) expect(row.statements).toBeGreaterThan(0);
  });
});

describe('39 — the scheme package', () => {
  it('loads strict and validates clean, byte-stable', () => {
    const ast = model();
    expect(validate(ast)).toEqual([]);
    expect(ast.requirements).toHaveLength(34);
    expect(ast.mapProfiles).toHaveLength(1);
    expect(dump(load(dump(ast), { strict: true }))).toBe(dump(ast));
  });

  it('every requirement carries its PD-05 source facet', () => {
    for (const req of model().requirements) {
      expect(req.id).toMatch(/^\/req\/cs\//);
      expect(req.source?.doc).toMatch(/^PD-05 /);
    }
  });
});

describe('39 — the doc map resolves', () => {
  it('every map target exists in the parsed PD-05 document', () => {
    const ast = model();
    const doc = parseMirrorJson(PD05);
    expect(doc.urnBase).toBe('urn:oiml:pub:cs:pd-05:2024');

    const profile = ast.mapProfiles[0]!;
    const pairs = Object.values(profile.mappings).flat();
    expect(pairs.length).toBeGreaterThanOrEqual(10);
    // Every one of the 34 requirements is mapped.
    expect(Object.keys(profile.mappings).sort()).toEqual(
      ast.requirements.map(r => r.id).sort(),
    );
    for (const pair of pairs) {
      const ref = splitTargetRef(pair.target);
      expect(ref?.namespace).toBe('urn:oiml:pub:cs:pd-05:2024');
      expect(doc.statements.has(ref!.id), `missing statement ${ref!.id}`).toBe(true);
    }

    // The anchor pairs pin the right sentences.
    expect(doc.statements.get('s6.p9.s1')!.text).toContain('number of samples');
    expect(doc.statements.get('s6.p12.s1')!.text).toContain('fee for application');
    expect(doc.statements.get('s6.p22')!.text).toContain('dated, signed');
    expect(doc.statements.get('s8.p1')!.text).toContain('registration');
  });
});

describe('39 — the certification workflow simulates', () => {
  it('a conforming application completes at BIML registration', () => {
    const { state, trajectory } = walk({ application_complete: '1', tests_passed: '1', evaluation_approved: '1' });
    expect(state.done).toBe(true);
    expect(trajectory).toEqual([
      'ApplicationSubmitted', 'SubmitApplication', 'ReviewApplication',
      'ApplicationComplete', 'AcceptApplication', 'PerformTesting',
      'CompileTestReport', 'TestsConform', 'CompileEvaluationReport',
      'EvaluationApproved', 'IssueCertificate', 'RegisterCertificate',
      'CertificateRegistered', 'CertificateRegistered',
    ]);
  });

  it('an incomplete application routes to the information request (PD-05 4.2.1)', () => {
    const { state, trajectory } = walk({ application_complete: '0', tests_passed: '1', evaluation_approved: '1' });
    expect(state.done).toBe(true);
    expect(trajectory).toContain('RequestAdditionalInformation');
    expect(trajectory).not.toContain('AcceptApplication');
    expect(trajectory[trajectory.length - 1]).toBe('InformationRequested');
  });

  it('a failed test routes to refusal — no certificate (PD-05 4.6.1)', () => {
    const { state, trajectory } = walk({ application_complete: '1', tests_passed: '0', evaluation_approved: '1' });
    expect(state.done).toBe(true);
    expect(trajectory).toContain('NotifyFailure');
    expect(trajectory).not.toContain('IssueCertificate');
    expect(trajectory[trajectory.length - 1]).toBe('CertificateRefused');
  });

  it('a rejected evaluation routes to refusal', () => {
    const { state, trajectory } = walk({ application_complete: '1', tests_passed: '1', evaluation_approved: '0' });
    expect(state.done).toBe(true);
    expect(trajectory).toContain('CompileEvaluationReport');
    expect(trajectory).not.toContain('IssueCertificate');
    expect(trajectory[trajectory.length - 1]).toBe('CertificateRefused');
  });

  it('every workflow step names the scheme provisions it realizes', () => {
    const ast = cert();
    const reqIds = new Set(model().requirements.map(r => r.id));
    expect(ast.processes).toHaveLength(10);
    for (const proc of ast.processes) {
      expect(proc.provisionRefs.length, `${proc.id} carries no provision`).toBeGreaterThan(0);
      for (const raw of proc.provisionRefs) {
        // The parser keeps the token's quotes; the id is inside them.
        const ref = raw.replace(/^"|"$/g, '');
        expect(reqIds.has(ref), `${proc.id} references unknown provision ${ref}`).toBe(true);
      }
    }
  });
});
