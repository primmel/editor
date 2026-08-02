// ─────────────────────────────────────────────────────────────────────
// The measurement harness (TODO.editor/16) — the measurement model
// over PRL: a process's declared measurement points (the
// validate_measurement facet) → variable-setting rows (value + unit +
// uncertainty), the per-row validation (declared type + presence),
// and the result formatter.
//
// The wall: measurement values are EVIDENCE-adjacent (a run's input),
// never model content — the values live in the measurement store,
// never the AST.
// ─────────────────────────────────────────────────────────────────────

import type { Standard, Variable } from '@primmel/primmel';

export interface MeasurementRow {
  /** The declared measurement point id (from the process's facet). */
  id: string;
  /** The model's variable declaration for this point (null when the
   *  point is not a declared variable — free-typed). */
  declared: Variable | null;
}

export interface MeasurementValue {
  value: string;
  unit: string;
  uncertainty: string;
}

/** The rows for a process: one per declared measurement point, in the
 *  facet's order. */
export function measurementRows(model: Standard, processId: string): MeasurementRow[] {
  const proc = model.processes.find(p => p.id === processId);
  if (!proc) return [];
  return proc.measure.map(id => ({
    id,
    declared: model.variables.find(v => v.id === id) ?? null,
  }));
}

export type RowVerdict = 'valid' | 'warning' | 'missing';

/** Validate a value against the row's declared type. `missing` when
 *  empty (the run never ran); `warning` when the value fails the
 *  declared type's shape; `valid` otherwise. Unknown/undeclared types
 *  accept any non-empty value. */
export function validateValue(row: MeasurementRow, value: string): RowVerdict {
  const v = value.trim();
  if (v === '') return 'missing';
  const type = row.declared?.type ?? '';
  switch (type) {
    case 'integer':
      return /^-?\d+$/.test(v) ? 'valid' : 'warning';
    case 'float':
    case 'double':
      return /^-?\d+(\.\d+)?([eE][+-]?\d+)?$/.test(v) ? 'valid' : 'warning';
    case 'boolean':
      return v === 'true' || v === 'false' ? 'valid' : 'warning';
    case 'date':
      return /^\d{4}-\d{2}-\d{2}$/.test(v) && !Number.isNaN(Date.parse(v)) ? 'valid' : 'warning';
    case 'datetime':
      return !Number.isNaN(Date.parse(v)) ? 'valid' : 'warning';
    default:
      return 'valid';
  }
}

/** The result formatter: the measurement record, one line per point —
 *  `id: value ±uncertainty unit` (missing values as em-dashes), the
 *  declared type noted when present. */
export function formatResult(
  rows: MeasurementRow[],
  values: Record<string, MeasurementValue>,
): string {
  const lines: string[] = [];
  for (const row of rows) {
    const v = values[row.id];
    const type = row.declared?.type ? ` [${row.declared.type}]` : '';
    if (!v || v.value.trim() === '') {
      lines.push(`${row.id}: —${type}`);
      continue;
    }
    const unc = v.uncertainty.trim() ? ` ±${v.uncertainty.trim()}` : '';
    const unit = v.unit.trim() ? ` ${v.unit.trim()}` : '';
    lines.push(`${row.id}: ${v.value.trim()}${unc}${unit}${type}`);
  }
  return lines.join('\n');
}
