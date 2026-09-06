// ─────────────────────────────────────────────────────────────────────
// TODO.editor/05 slice 4 — the check view derivation + the server-side
// check payload, proven: severity counts honour the allowlist doctrine
// (KNOWN prints, never counts), families group in catalog order with
// uncatalogued ids last, and checkPackagePayload runs the real kernel
// check against the committed fixture package.
// ─────────────────────────────────────────────────────────────────────

import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { CHECK_RULES, activeRuleIds, checkRule } from '@primmel/primmel/check-rules';
import type { CheckIssue } from '@primmel/primmel';
import { checkView } from '../check';
import { checkPackagePayload } from '../../../scripts/package-check';

const PKG = path.resolve(import.meta.dirname, 'fixtures/pkg-app');

describe('05 slice 4 — the check view', () => {
  const issues: CheckIssue[] = [
    { check: 'C5', severity: 'warning', message: 'a coverage gap' },
    { check: 'C21', severity: 'error', message: 'a dangling mapping' },
    { check: 'C21', severity: 'error', message: 'an allowlisted mapping', known: true },
    { check: 'X99', severity: 'error', message: 'a rule the catalog does not know' },
  ];

  it('counts severities with KNOWN excluded (prints, never counts)', () => {
    const view = checkView(issues);
    expect(view.errors).toBe(2); // the C21 error + the uncatalogued X99
    expect(view.warnings).toBe(1);
    expect(view.known).toBe(1);
    expect(view.clean).toBe(false);
  });

  it('groups by the catalog family, uncatalogued ids last', () => {
    const view = checkView(issues);
    expect(view.families.map((f) => f.family)).toEqual(['base', 'mapping', 'uncatalogued']);
    const mapping = view.families[1];
    expect(mapping.errors).toBe(1);
    expect(mapping.known).toBe(1);
    expect(mapping.issues.map((r) => r.rule?.id)).toEqual(['C21', 'C21']);
    const uncatalogued = view.families[2];
    expect(uncatalogued.issues[0].rule).toBeUndefined();
    expect(uncatalogued.issues[0].issue.check).toBe('X99');
  });

  it('an empty run is clean', () => {
    const view = checkView([]);
    expect(view.clean).toBe(true);
    expect(view.families).toEqual([]);
  });

  it('the catalog is sane: unique ids, audit a superset of normal', () => {
    expect(new Set(CHECK_RULES.map((r) => r.id)).size).toBe(CHECK_RULES.length);
    const normal = activeRuleIds('normal');
    const audit = activeRuleIds('audit');
    for (const id of normal) expect(audit.has(id)).toBe(true);
    for (const rule of CHECK_RULES) expect(normal.has(rule.id) || rule.level === 'audit').toBe(true);
  });
});

describe('05 slice 4 — the package-check payload (server half)', () => {
  it('runs the kernel check against the fixture package on disk', () => {
    const { issues } = checkPackagePayload(PKG);
    // The fixture's one finding: /req/app/weight declares no verification.
    expect(issues).toHaveLength(1);
    expect(issues[0].check).toBe('C5');
    expect(issues[0].severity).toBe('warning');
    expect(issues[0].known).toBeUndefined();
    // The panel can always resolve a real run's rule ids against the catalog.
    expect(checkRule(issues[0].check)).toBeDefined();
  });

  it('refuses a directory without a manifest and an empty argument', () => {
    const bare = fs.mkdtempSync(path.join(os.tmpdir(), 'prl-check-'));
    try {
      expect(() => checkPackagePayload(bare)).toThrow('no package.primmel');
    } finally {
      fs.rmSync(bare, { recursive: true, force: true });
    }
    expect(() => checkPackagePayload('')).toThrow('empty');
  });
});
