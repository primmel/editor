// ─────────────────────────────────────────────────────────────────────
// TODO.editor/24 — the corpus matrix: all ten legacy .mmel files
// vendored and proven through the import path in one matrix: strict
// parse → convert → validate → byte-stable canonical dump, with
// per-file construct counts pinned (a kernel or importer regression
// names the file).
// ─────────────────────────────────────────────────────────────────────

import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { dump, load } from '@primmel/primmel';
import { importLegacy } from '../mmel-import';

interface Row {
  file: string;
  processes: number;
  provisions: number;
  roles: number;
  pages: number;
  dataclasses: number;
  references: number;
  enums: number;
  variables: number;
  notes: number;
  viewProfiles: number;
  comments: number;
  regs: number;
  renames: { from: string; to: string; count: number }[];
}

const MATRIX: Row[] = [
  { file: 'acme.mmel', processes: 14, provisions: 5, roles: 6, pages: 3, dataclasses: 13, references: 18, enums: 1, variables: 0, notes: 2, viewProfiles: 0, comments: 0, regs: 13, renames: [{ from: 'subprocess', to: 'canvas', count: 3 }] },
  { file: 'bs13485-2012.mmel', processes: 376, provisions: 438, roles: 9, pages: 98, dataclasses: 33, references: 90, enums: 0, variables: 14, notes: 8, viewProfiles: 3, comments: 0, regs: 33, renames: [{ from: 'measurement', to: 'variable', count: 14 }, { from: 'subprocess', to: 'canvas', count: 98 }, { from: 'view', to: 'view_profile', count: 3 }] },
  { file: 'bs13485.mmel', processes: 377, provisions: 439, roles: 9, pages: 98, dataclasses: 33, references: 90, enums: 0, variables: 14, notes: 9, viewProfiles: 3, comments: 0, regs: 33, renames: [{ from: 'measurement', to: 'variable', count: 14 }, { from: 'subprocess', to: 'canvas', count: 98 }, { from: 'view', to: 'view_profile', count: 3 }] },
  { file: 'bs16341.mmel', processes: 23, provisions: 32, roles: 2, pages: 1, dataclasses: 5, references: 4, enums: 0, variables: 0, notes: 0, viewProfiles: 0, comments: 0, regs: 5, renames: [{ from: 'subprocess', to: 'canvas', count: 1 }] },
  { file: 'bs6004.mmel', processes: 105, provisions: 117, roles: 1, pages: 32, dataclasses: 0, references: 40, enums: 0, variables: 22, notes: 35, viewProfiles: 0, comments: 0, regs: 0, renames: [{ from: 'measurement', to: 'variable', count: 22 }, { from: 'subprocess', to: 'canvas', count: 32 }] },
  { file: 'iso14971-dev3.mmel', processes: 59, provisions: 84, roles: 2, pages: 18, dataclasses: 17, references: 19, enums: 0, variables: 0, notes: 38, viewProfiles: 0, comments: 3, regs: 17, renames: [{ from: 'subprocess', to: 'canvas', count: 18 }] },
  { file: 'iso14971.mmel', processes: 59, provisions: 84, roles: 2, pages: 18, dataclasses: 17, references: 19, enums: 0, variables: 0, notes: 38, viewProfiles: 0, comments: 0, regs: 17, renames: [{ from: 'subprocess', to: 'canvas', count: 18 }] },
  { file: 'iso27001-plugin.mmel', processes: 43, provisions: 17, roles: 0, pages: 9, dataclasses: 0, references: 0, enums: 0, variables: 3, notes: 0, viewProfiles: 0, comments: 0, regs: 0, renames: [{ from: 'measurement', to: 'variable', count: 3 }, { from: 'subprocess', to: 'canvas', count: 9 }] },
  { file: 'iso27001.mmel', processes: 262, provisions: 320, roles: 4, pages: 77, dataclasses: 23, references: 198, enums: 0, variables: 0, notes: 0, viewProfiles: 0, comments: 0, regs: 22, renames: [{ from: 'subprocess', to: 'canvas', count: 77 }] },
  { file: 'pas2060.mmel', processes: 56, provisions: 100, roles: 3, pages: 10, dataclasses: 14, references: 49, enums: 0, variables: 7, notes: 0, viewProfiles: 0, comments: 0, regs: 10, renames: [{ from: 'measurement', to: 'variable', count: 7 }, { from: 'subprocess', to: 'canvas', count: 10 }] },
];

const corpus = (name: string) =>
  readFileSync(join(__dirname, 'fixtures/corpus', name), 'utf8');

describe('24 — the corpus matrix (10/10)', () => {
  for (const row of MATRIX) {
    it(`${row.file}: converts with pinned counts, clean validation, byte-stable dump`, () => {
      const { standard, canonical, report } = importLegacy(corpus(row.file));

      // The pinned construct counts (a regression names the file).
      expect(standard.processes, 'processes').toHaveLength(row.processes);
      expect(standard.provisions, 'provisions').toHaveLength(row.provisions);
      expect(standard.roles, 'roles').toHaveLength(row.roles);
      expect(standard.pages, 'pages').toHaveLength(row.pages);
      expect(standard.dataclasses, 'dataclasses').toHaveLength(row.dataclasses);
      expect(standard.references, 'references').toHaveLength(row.references);
      expect(standard.enums, 'enums').toHaveLength(row.enums);
      expect(standard.variables, 'variables').toHaveLength(row.variables);
      expect(standard.notes, 'notes').toHaveLength(row.notes);
      expect(standard.viewProfiles, 'viewProfiles').toHaveLength(row.viewProfiles);
      expect(standard.comments, 'comments').toHaveLength(row.comments);
      expect(standard.regs, 'regs').toHaveLength(row.regs);

      // The validator is clean and nothing is unknown.
      expect(report.validationIssues).toEqual([]);
      expect(report.unknownKeywords).toEqual([]);
      expect(report.renames).toEqual(row.renames);

      // The canonical dump is byte-stable through a re-parse.
      expect(dump(load(canonical, { strict: true }))).toBe(canonical);
    });
  }
});
