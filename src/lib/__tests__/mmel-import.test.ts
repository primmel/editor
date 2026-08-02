// ─────────────────────────────────────────────────────────────────────
// TODO.editor/15 — the legacy import's proofs, on the REAL corpus:
//   - PAS2060 converts with every process/role/provision/dataclass
//     intact; the kernel validator accepts the output;
//   - ISO 27001 same;
//   - the report names every difference applied (the renames) and
//     lists anything unknown (nothing dropped silently).
// ─────────────────────────────────────────────────────────────────────

import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { dump, load } from '@primmel/primmel';
import { importLegacy, keywordInventory } from '../mmel-import';

const fixtures = join(__dirname, 'fixtures');
const pas2060 = readFileSync(join(fixtures, 'corpus/pas2060.mmel'), 'utf8');
const iso27001 = readFileSync(join(fixtures, 'corpus/iso27001-plugin.mmel'), 'utf8');

describe('15 — the real corpus converts', () => {
  it('PAS2060: every construct intact, the validator accepts', () => {
    const { standard, canonical, report } = importLegacy(pas2060);

    expect(standard.processes).toHaveLength(56);
    expect(standard.roles).toHaveLength(3);
    expect(standard.provisions).toHaveLength(100);
    expect(standard.dataclasses).toHaveLength(14);
    expect(standard.regs).toHaveLength(10);
    expect(standard.references).toHaveLength(49);
    expect(standard.variables).toHaveLength(7);
    expect(standard.pages).toHaveLength(10);

    // The kernel validator accepts the converted model.
    expect(report.validationIssues).toEqual([]);

    // The report names the renames (measurement → variable,
    // subprocess → canvas) with their counts.
    expect(report.renames).toEqual([
      { from: 'measurement', to: 'variable', count: 7 },
      { from: 'subprocess', to: 'canvas', count: 10 },
    ]);
    // Nothing unknown — the whole file has a v3 home.
    expect(report.unknownKeywords).toEqual([]);

    // The canonical form re-parses to the same structure (strict).
    const reparsed = load(canonical, { strict: true });
    expect(reparsed.processes).toHaveLength(56);
    expect(reparsed.provisions).toHaveLength(100);
    expect(reparsed.pages).toHaveLength(10);
    // …and the canonical dump is byte-stable.
    expect(canonical).toBe(dump(reparsed));
  });

  it('ISO 27001: same guarantee', () => {
    const { standard, canonical, report } = importLegacy(iso27001);

    expect(standard.processes).toHaveLength(43);
    expect(standard.provisions).toHaveLength(17);
    expect(standard.variables).toHaveLength(3);
    expect(standard.pages).toHaveLength(9);
    expect(report.validationIssues).toEqual([]);
    expect(report.unknownKeywords).toEqual([]);
    expect(report.renames).toEqual([
      { from: 'measurement', to: 'variable', count: 3 },
      { from: 'subprocess', to: 'canvas', count: 9 },
    ]);

    const reparsed = load(canonical, { strict: true });
    expect(reparsed.processes).toHaveLength(43);
    expect(canonical).toBe(dump(reparsed));
  });
});

describe('15 — the report never drops silently', () => {
  it('an unknown top-level keyword is listed', () => {
    // A file with a made-up construct the v3 kernel has no home for
    // cannot strict-parse — the inventory names it before the parse
    // even runs.
    const weird = `root Root\n\nmetadata {\n  title "T"\n}\n\nfrobnicate X {\n}\n`;
    const inventory = keywordInventory(weird);
    expect(inventory.has('frobnicate')).toBe(true);
  });

  it('prose wraps at column zero are NOT keywords (quoted content)', () => {
    const wrapped = `root Root\n\nmetadata {\n  title "T\nwrapped line at zero"\n}\n`;
    const inventory = keywordInventory(wrapped);
    expect(inventory.has('wrapped')).toBe(false);
    expect(inventory.get('metadata')).toBe(1);
  });
});
