// ─────────────────────────────────────────────────────────────────────
// TODO.editor/21 — the legacy corpus completes: the four files that
// previously failed (the `view` keyword, note EXAMPLE/COMMENTARY, the
// v2 comment forms) now convert clean, with the report naming the
// legacy spellings. The full pinned matrix is 24.
// ─────────────────────────────────────────────────────────────────────

import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { dump, load } from '@primmel/primmel';
import { importLegacy } from '../mmel-import';

const corpus = (name: string) =>
  readFileSync(join(__dirname, 'fixtures/corpus', name), 'utf8');

describe('21 — the `view` alias', () => {
  it.each(['bs13485.mmel', 'bs13485-2012.mmel'])('%s converts with the rename reported', (name) => {
    const { standard, canonical, report } = importLegacy(corpus(name));
    expect(standard.viewProfiles.length).toBeGreaterThan(0);
    expect(report.renames).toContainEqual({ from: 'view', to: 'view_profile', count: standard.viewProfiles.length });
    expect(report.validationIssues).toEqual([]);
    expect(report.unknownKeywords).toEqual([]);
    expect(dump(load(canonical, { strict: true }))).toBe(canonical);
  });
});

describe('21 — the legacy note types', () => {
  it('iso14971: EXAMPLE notes parse and re-emit', () => {
    const { standard, report } = importLegacy(corpus('iso14971.mmel'));
    expect(standard.notes.some(n => n.type === 'EXAMPLE')).toBe(true);
    expect(report.validationIssues).toEqual([]);
    expect(dump(load(dump(standard), { strict: true }))).toBe(dump(standard));
  });

  it('bs6004: COMMENTARY notes parse and re-emit', () => {
    const { standard, report } = importLegacy(corpus('bs6004.mmel'));
    expect(standard.notes.some(n => n.type === 'COMMENTARY')).toBe(true);
    expect(report.validationIssues).toEqual([]);
  });
});

describe('21 — the v2 comment forms', () => {
  it('iso14971-dev3: username/message/feedback/bare-resolved map to the v3 shape', () => {
    const { standard, report } = importLegacy(corpus('iso14971-dev3.mmel'));
    expect(standard.comments).toHaveLength(3);
    const c2 = standard.comments.find(c => c.id === 'comment2')!;
    const c3 = standard.comments.find(c => c.id === 'comment3')!;
    expect(c2.resolved).toBe(true);           // the bare legacy flag
    expect(c3.replyTo).toBe('comment2');      // the feedback inversion
    expect(report.validationIssues).toEqual([]);
    expect(dump(load(dump(standard), { strict: true }))).toBe(dump(standard));
  });
});
