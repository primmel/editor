# 23 — The data section: dataclasses live in `page.data`

**Wave:** foundation · **Depends on:** 02, 05 · **Priority:** P0

## Goal

The MMEL data discipline on canvas: dataclass nodes live in the
page's DATA section (`page.data`, the dashed data nodes), not the
flow section (`page.childs`) — and data links (dataclass ↔ process)
connect through the data seam. Today the palette places dataclasses
into `childs` (the flow section), and deleteElement never cleans
`data` — both wrong.

## Spec

- `createElement`: dataclass placements go to `pageOf(ast, pageId).data`
  (not `.childs`); the revert filters BOTH sections; deleteElement
  captures placements + edges from BOTH sections (restore on revert).
- The edges' data seam is already honored by `canConnect` (data names
  are connectable on the same page) — prove it: a process ↔ dataclass
  edge renders as a data link (dashed, the render.ts `isDataLink`
  path) and serializes.
- The registry (`data_registry`) stays a tree/data-model element
  (never canvas-placed) — the tree creation from 05 stands; the
  REGISTRY inspector links its data_class (already done).
- e2e: palette-create a dataclass → it lands in `data` (dashed);
  connect process → dataclass (a data link); serialize contains
  `data {` with the placement; delete restores cleanly through undo.

## Homes

1. `src/lib/commands.ts` (create/delete placement discipline).
2. `src/lib/__tests__/commands.test.ts` + `edges.test.ts` extensions.
3. `e2e/data-section-smoke.ts`.

## Acceptance

- Dataclass placements land in `page.data`; delete/undo round-trips
  placements and data-link edges exactly.
- The data link renders dashed and dumps/parses.
- Gates green.
