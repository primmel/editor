// ─────────────────────────────────────────────────────────────────────
// The validation surface (TODO.editor/29) — pure: the kernel's
// validate() reshaped into the panel's summary (counts by severity)
// and the click targets (which element an issue points at).
// ─────────────────────────────────────────────────────────────────────

import { validate, type Standard, type ValidationIssue } from '@primmel/primmel';
import { findElement, type ElementKind } from './commands';

export interface ValidationSummary {
  errors: number;
  warnings: number;
  infos: number;
  issues: ValidationIssue[];
}

/** The live model's validation state (the kernel's own validate —
 *  never a Studio-side re-check). */
export function validationSummary(model: Standard | null): ValidationSummary {
  if (!model) return { errors: 0, warnings: 0, infos: 0, issues: [] };
  const issues = validate(model);
  let errors = 0;
  let warnings = 0;
  let infos = 0;
  for (const i of issues) {
    if (i.severity === 'error') errors++;
    else if (i.severity === 'warning') warnings++;
    else infos++;
  }
  return { errors, warnings, infos, issues };
}

/** The element an issue points at (the click target) — null when the
 *  issue's id doesn't resolve to a canvas-selectable element. */
export function issueTarget(model: Standard, issue: ValidationIssue): { kind: ElementKind; id: string } | null {
  if (!issue.id) return null;
  return findElement(model, issue.id);
}
