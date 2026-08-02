# 08 — The coverage overlay: the calculus on canvas

**Wave:** mapping · **Depends on:** 07 · **Priority:** P0

## Goal

The MMEL extension's coverage styles (FULL/PASS/PARTIAL/NONE) —
computed by the KERNEL's `mapping-coverage.ts`, never reimplemented —
rendered as node tints on both mapper canvases, with the authored
assertion vs computed display (C23).

## Spec

- `src/lib/coverage.ts`: the bridge from the kernel's engine to the
  canvas (load REF standard + IMP standard + the profile →
  `MapResultType`-equivalent per REF node id: full | minimal |
  partial | none).
- **Tint semantics** (the extension's legend): full = green,
  minimal = teal, partial = amber, none = slate — nodes tinted on the
  REF canvas; the IMP canvas shows mapped/unmapped (hasmap/nomap).
- **Aggregation display**: hover a parent → its aggregation basis
  (children full ⇒ full; gateway minimum ⇒ minimal) in a tooltip —
  the calculus's rules 1–3 made visible.
- **Assertion vs computed**: where the profile's `coverage:` map
  asserts a level that DISAGREES with the calculus, the node gets the
  conflict marker (the C23 lint's visual form) with both values shown.
- **The numbers match the kernel exactly** — the overlay is proven by
  running the kernel's own coverage fixtures through the bridge
  (never a Studio-side recomputation).

## Homes

1. `src/lib/coverage.ts` (+ the kernel import boundary).
2. `src/components/mapper/CoverageLegend.vue` + the node tint wiring.
3. `src/lib/__tests__/coverage.test.ts` (kernel fixtures → bridge).

## Acceptance

- The R 60 reference + a sample IMP + profile: the tints match the
  kernel's `mappingCoverage()` output node-for-node.
- The conflict marker shows on a deliberately wrong assertion.
- The aggregation tooltip shows the correct rule basis per parent.
- Gates green.
