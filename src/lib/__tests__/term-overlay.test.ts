// ─────────────────────────────────────────────────────────────────────
// Wave 0 (smart TODO.editor/00; audit PROGRESS/39 §C-3) — the term
// `overlay true` regression: kernel 1.5.3 parses the marker WITHOUT
// error but drops it from the AST, so an editor save silently stripped
// the overlay semantics and the next `uses` composition then broke the
// no-redefine rule. Kernel 1.6.1 (Extension 4) parses the marker into
// the AST (`Term.overlay`) and the composition engine honors it
// (uses-no-redefine lifts for overlay-marked terms). These legs pin the
// parse-level round trip — red on 1.5.3, green on 1.6.1.
//
// Kernel 1.9.0 closes the dump side: dumpTerm emits `overlay true`
// back into the text, so dump→reload keeps the marker and the term
// inspector edits it directly (the read-only pin lifts).
// ─────────────────────────────────────────────────────────────────────

import { describe, it, expect } from 'vitest';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { dump, load, validate } from '@primmel/primmel';

const SYNTHETIC = `term sample-overlay {
  overlay true
  label "sample"
  definition "a sample definition"
  source "X, 3.1"
}

term plain-term {
  label "plain"
  definition "no overlay marker"
  source "X, 3.2"
}
`;

// The audit's fixtures live in the sibling oimlsmart/smart checkout; the
// legs run when it is present and skip honestly when it is not (CI).
// The smart corpus re-aligned on kernel 1.9.0 (2026-09-05, "the corpus
// re-aligns to the kernel-canonical orderings"): the terminologies no
// longer author `overlay true` (the estate's layering moved to the
// generated overlay files) — the fixture legs pin the clean parse +
// the dump round-trip; the marker coverage stays on the synthetic legs.
const SMART_PACKAGES = join(__dirname, '../../../../../oimlsmart/smart/primmel-packages');
const FIXTURES = [
  { file: 'iso-iec-17025/terminology.prl', terms: 9 },
  { file: 'iso-iec-17067/terminology.prl', terms: 3 },
];

describe('W0 — the term overlay marker survives the parse (kernel >= 1.6.1)', () => {
  it('a term carrying `overlay true` loads with overlay === true; an unmarked term does not', () => {
    const ast = load(SYNTHETIC, { strict: true });
    expect(ast.terms).toHaveLength(2);
    expect(ast.terms.find(t => t.id === 'sample-overlay')?.overlay).toBe(true);
    expect(ast.terms.find(t => t.id === 'plain-term')?.overlay).not.toBe(true);
    expect(validate(ast)).toEqual([]);
  });

  it('the overlay marker round-trips through the dump (kernel >= 1.9.0)', () => {
    const ast = load(SYNTHETIC, { strict: true });
    const text = dump(ast);
    expect(text).toContain('overlay true');
    const reloaded = load(text, { strict: true });
    expect(reloaded.terms.find(t => t.id === 'sample-overlay')?.overlay).toBe(true);
    expect(reloaded.terms.find(t => t.id === 'plain-term')?.overlay).not.toBe(true);
    expect(validate(reloaded)).toEqual([]);
  });

  for (const fixture of FIXTURES) {
    const path = join(SMART_PACKAGES, fixture.file);
    const itIfLocal = existsSync(path) ? it : it.skip;
    itIfLocal(`${fixture.file}: parses clean and the dump round-trips`, () => {
      const text = readFileSync(path, 'utf8');
      const ast = load(text, { strict: true });

      expect(ast.terms).toHaveLength(fixture.terms);
      expect(validate(ast)).toEqual([]);

      const reloaded = load(dump(ast), { strict: true });
      expect(reloaded.terms.map(t => t.id)).toEqual(ast.terms.map(t => t.id));
      expect(validate(reloaded)).toEqual([]);
    });
  }
});
