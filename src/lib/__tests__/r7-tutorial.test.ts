// ─────────────────────────────────────────────────────────────────────
// TODO.editor/26 — the R 7 tutorial model's proofs:
//   - the package loads (strict) and validates clean;
//   - every doc-map target resolves against the parsed R 7
//     presentation XML (the provenance is real);
//   - the verification workflow simulates: the ambient gate routes on
//     the clause-8 validity range, the MPE gate routes on the error,
//     and a conforming run completes at the verdict.
// ─────────────────────────────────────────────────────────────────────

import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { DOMParser } from 'linkedom';
import { dump, load, validate, type Standard } from '@primmel/primmel';
import { parsePresentationXml } from '../document-model';
import { createRun, step, type SimState } from '../simulator';
import { splitTargetRef } from '../mapper';

const dir = join(__dirname, '../../../demo/r7-clinical-thermometer');
const MODEL = readFileSync(join(dir, 'model.prl'), 'utf8');
const XML = readFileSync(join(dir, 'document.presentation.xml'), 'utf8');

function ast(): Standard {
  return load(MODEL, { strict: true });
}

function walk(registers: Record<string, string>): { state: SimState; trajectory: string[] } {
  const model = ast();
  let state = createRun(model, { registers });
  let guard = 0;
  while (!state.done && !state.blocked && guard++ < 50) {
    state = step(model, state);
  }
  return { state, trajectory: state.trajectory.map(t => t.nodeId) };
}

describe('26 — the package', () => {
  it('loads strict and validates clean, byte-stable', () => {
    const model = ast();
    expect(validate(model)).toEqual([]);
    expect(model.subjects.map(s => s.id)).toEqual(['ClinicalThermometer']);
    expect(model.requirements).toHaveLength(5);
    expect(model.conformanceTests).toHaveLength(4);
    expect(model.forms).toHaveLength(1);
    expect(model.mapProfiles).toHaveLength(1);
    expect(dump(load(dump(model), { strict: true }))).toBe(dump(model));
  });

  it('every requirement carries its clause URN', () => {
    const model = ast();
    for (const req of model.requirements) {
      expect(req.source?.doc).toBe('urn:oiml:pub:r:7:1979');
      expect(req.source?.clause).toBeTruthy();
    }
    // The MPE is the hard number, provenance intact.
    const mpe = model.requirements.find(r => r.id === 'REQ-MPE')!;
    expect(mpe.source?.clause).toBe('8');
    expect(mpe.statement).toContain('+0.1 °C');
    expect(mpe.statement).toContain('−0.15 °C');
  });
});

describe('26 — the doc map resolves', () => {
  it('every map target exists in the parsed R 7 document', () => {
    const model = ast();
    const doc = parsePresentationXml(XML, new DOMParser());
    expect(doc.urnBase).toBe('urn:oiml:pub:r:7:1979');

    const profile = model.mapProfiles[0]!;
    const pairs = Object.values(profile.mappings).flat();
    expect(pairs.length).toBeGreaterThanOrEqual(10);
    for (const pair of pairs) {
      const ref = splitTargetRef(pair.target);
      expect(ref?.namespace).toBe('urn:oiml:pub:r:7:1979');
      expect(doc.statements.has(ref!.id), `missing statement ${ref!.id}`).toBe(true);
    }

    // The anchor pairs pin the right sentences.
    expect(doc.statements.get('s8.p1')!.text).toContain('maximum permissible errors');
    expect(doc.statements.get('s5.p1')!.text).toContain('free from any defects');
    expect(doc.statements.get('s14.p1.s2')!.text).toContain('well-stirred water baths');
  });
});

describe('26 — the workflow simulates', () => {
  it('a conforming run completes at the verdict', () => {
    const { state, trajectory } = walk({ ambient_temperature: '22', error_of_indication: '0.05' });
    expect(state.done).toBe(true);
    expect(trajectory).toEqual([
      'Received', 'ReceiveSample', 'VisualExamination', 'AmbientValid',
      'ErrorDetermination', 'WithinMPE', 'MaximumDeviceTest',
      'ColorationTest', 'IssueVerdict', 'VerdictIssued', 'VerdictIssued',
    ]);
  });

  it('an out-of-range ambient aborts before the error determination (clause 8 validity)', () => {
    const { state, trajectory } = walk({ ambient_temperature: '35', error_of_indication: '0.05' });
    expect(state.done).toBe(true);
    expect(trajectory).not.toContain('ErrorDetermination');
    expect(trajectory).toContain('VerdictIssued');
  });

  it('an out-of-MPE error routes to the fail path', () => {
    const { state, trajectory } = walk({ ambient_temperature: '22', error_of_indication: '0.2' });
    expect(state.done).toBe(true);
    expect(trajectory).toContain('ErrorDetermination');
    expect(trajectory).not.toContain('MaximumDeviceTest');
  });
});
