// ─────────────────────────────────────────────────────────────────────
// The check view (TODO.editor/05, slice 4) — the pure derivation behind
// the Check panel. The kernel ships TWO halves: the checks themselves
// are fs-bound (they judge the saved package — the dev server runs
// them, see scripts/package-check.ts), and the RULE CATALOG is pure
// data (@primmel/primmel/check-rules, browser-safe). This module joins
// the wire issues to the catalog: severity counts that honour the
// allowlist doctrine (KNOWN prints, never counts), grouped by rule
// family in catalog order, with uncatalogued ids last and honest.
// ─────────────────────────────────────────────────────────────────────

import { CHECK_RULES, checkRule, type CheckFamily, type CheckRule } from '@primmel/primmel/check-rules';
import type { CheckIssue } from '@primmel/primmel';

/** One kernel issue joined to its catalog entry. */
export interface CheckViewIssue {
  issue: CheckIssue;
  /** The catalog entry, when the rule id is catalogued. */
  rule: CheckRule | undefined;
  /** Allowlist-suppressed (the kernel's KNOWN): prints, never counts. */
  known: boolean;
}

/** One rule family's group. */
export interface CheckViewFamily {
  family: CheckFamily | 'uncatalogued';
  issues: CheckViewIssue[];
  errors: number;
  warnings: number;
  known: number;
}

/** The panel's projection of a check run. */
export interface CheckView {
  /** Severity counts with KNOWN excluded ("prints, never counts"). */
  errors: number;
  warnings: number;
  known: number;
  clean: boolean;
  /** Family groups in catalog order; 'uncatalogued' last. */
  families: CheckViewFamily[];
}

const FAMILY_ORDER: (CheckFamily | 'uncatalogued')[] = [...new Set(CHECK_RULES.map((r) => r.family)), 'uncatalogued'];

export function checkView(issues: CheckIssue[]): CheckView {
  const byFamily = new Map<CheckFamily | 'uncatalogued', CheckViewIssue[]>();
  let errors = 0;
  let warnings = 0;
  let known = 0;
  for (const issue of issues) {
    const rule = checkRule(issue.check);
    const row: CheckViewIssue = { issue, rule, known: issue.known === true };
    const family = rule?.family ?? 'uncatalogued';
    const rows = byFamily.get(family) ?? [];
    rows.push(row);
    byFamily.set(family, rows);
    if (row.known) known += 1;
    else if (issue.severity === 'error') errors += 1;
    else warnings += 1;
  }
  const families: CheckViewFamily[] = [];
  for (const family of FAMILY_ORDER) {
    const rows = byFamily.get(family);
    if (!rows) continue;
    families.push({
      family,
      issues: rows,
      errors: rows.filter((r) => !r.known && r.issue.severity === 'error').length,
      warnings: rows.filter((r) => !r.known && r.issue.severity === 'warning').length,
      known: rows.filter((r) => r.known).length,
    });
  }
  return { errors, warnings, known, clean: errors === 0 && warnings === 0, families };
}
