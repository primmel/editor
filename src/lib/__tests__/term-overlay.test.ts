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
// Known upstream gap (not pinned here): the 1.6.1 serializer's dumpTerm
// does not emit `overlay true` back into the text, so dump→reload still
// loses the marker. The dump leg lands with the kernel fix (primmel-ts),
// not with an editor-side workaround.
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
const SMART_PACKAGES = join(__dirname, '../../../../../oimlsmart/smart/primmel-packages');
const FIXTURES = [
  {
    file: 'iso-iec-17025/terminology.prl',
    terms: 9,
    overlayIds: ['impartiality', 'complaint', 'verification', 'validation'],
  },
  {
    file: 'iso-iec-17067/terminology.prl',
    terms: 3,
    overlayIds: ['certification-scheme', 'scheme-owner'],
  },
];

describe('W0 — the term overlay marker survives the parse (kernel >= 1.6.1)', () => {
  it('a term carrying `overlay true` loads with overlay === true; an unmarked term does not', () => {
    const ast = load(SYNTHETIC, { strict: true });
    expect(ast.terms).toHaveLength(2);
    expect(ast.terms.find(t => t.id === 'sample-overlay')?.overlay).toBe(true);
    expect(ast.terms.find(t => t.id === 'plain-term')?.overlay).not.toBe(true);
    expect(validate(ast)).toEqual([]);
  });

  for (const fixture of FIXTURES) {
    const path = join(SMART_PACKAGES, fixture.file);
    const itIfLocal = existsSync(path) ? it : it.skip;
    itIfLocal(`${fixture.file}: every source-level overlay marker lands in the AST`, () => {
      const text = readFileSync(path, 'utf8');
      const sourceMarkers = (text.match(/^\s*overlay true\s*$/gm) ?? []).length;
      const ast = load(text, { strict: true });

      expect(ast.terms).toHaveLength(fixture.terms);
      expect(sourceMarkers).toBe(fixture.overlayIds.length);
      expect(ast.terms.filter(t => t.overlay === true).map(t => t.id).sort()).toEqual(
        [...fixture.overlayIds].sort(),
      );
      expect(validate(ast)).toEqual([]);
    });
  }
});
