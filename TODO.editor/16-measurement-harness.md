# 16 — The measurement harness view

**Wave:** program · **Depends on:** 04, 05 · **Priority:** P2

## Goal

The MMEL extension's measurement pane: variable settings, the
validation pane, and the result formatter — reframed over the
Primmel conformance/test-run model (the Studio reads the test's
declared variables; the run records values; the pane validates and
formats).

## Spec

- `src/lib/measurement.ts`: the measurement model over PRL — a
  process's declared measurement points (the `measurement` facet) →
  the variable-setting rows (value + unit + uncertainty), the
  validation (cardinality + unit + the test's declared constraints),
  and the result formatter (the measurement record rendered per the
  test's result shape).
- `components/measurement/MeasurementPanel.vue`: per selected
  process — the variable settings, the validation state per row
  (valid / warning / missing), and the formatted result preview.
- **The wall**: measurement values are EVIDENCE-adjacent (a run's
  input), never model content — the panel writes run values, not AST
  (model edits stay in the inspectors).

## Homes

1. `src/lib/measurement.ts` (+ tests).
2. `src/components/measurement/MeasurementPanel.vue`.

## Acceptance

- A process with declared measurements: the rows render with unit +
  cardinality; an out-of-cardinality value flags; the formatted
  result matches the test's declared shape.
- Gates green.
