// ─────────────────────────────────────────────────────────────────────
// TODO.editor/29 — the validation surface's proofs:
//   - the summary counts by severity and passes the kernel's issues
//     through (never a Studio-side re-check);
//   - the issue target resolves to a selectable element.
// ─────────────────────────────────────────────────────────────────────

import { describe, it, expect } from 'vitest';
import { load, type Standard } from '@primmel/primmel';
import { issueTarget, validationSummary } from '../validation';

const CLEAN = `root Root

version "v1.0.0-dev1"

metadata {
  title "T"
  schema "Primmel 0.1"
  namespace "N"
}

role r1 { name "R1" }

process P1 {
  name "P one"
  actor r1
}

canvas Root {
  elements {
    P1 { x 0 y 0 }
  }
  process_flow {
  }
}`;

const BROKEN = `root Root

version "v1.0.0-dev1"

metadata {
  title "T"
  schema "Primmel 0.1"
  namespace "N"
}

role r1 { name "R1" }

process P1 {
  name "P one"
  actor r1
}

form F1 {
  name "A form"
  conformance_process GhostProcess
}

canvas Root {
  elements {
    P1 { x 0 y 0 }
  }
  process_flow {
  }
}`;

describe('29 — the validation summary', () => {
  it('a clean model: zero counts, empty issues', () => {
    const s = validationSummary(load(CLEAN));
    expect(s.errors).toBe(0);
    expect(s.warnings).toBe(0);
    expect(s.issues).toEqual([]);
  });

  it('a broken model: the kernel issue, counted', () => {
    const s = validationSummary(load(BROKEN));
    expect(s.errors).toBe(1);
    expect(s.issues[0]!.code).toBe('form-conformance-process-missing');
    expect(s.issues[0]!.construct).toBe('form');
    expect(s.issues[0]!.message).toContain('GhostProcess');
  });

  it('a null model summarizes empty', () => {
    expect(validationSummary(null).issues).toEqual([]);
  });
});

describe('29 — the issue target', () => {
  it('resolves to a selectable element when the id is one', () => {
    const model: Standard = load(BROKEN);
    const s = validationSummary(model);
    // The issue points at F1 — a form, not canvas-selectable: null.
    expect(issueTarget(model, s.issues[0]!)).toBeNull();
  });

  it('resolves a process id to its kind', () => {
    const model: Standard = load(CLEAN);
    const target = issueTarget(model, {
      severity: 'error', code: 'x', construct: 'process', id: 'P1', message: 'm',
    });
    expect(target).toEqual({ kind: 'process', id: 'P1' });
  });
});
