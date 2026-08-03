# 32 — The flow-type seam (kill the structural mirror)

**Wave:** audit · **Depends on:** 01–06 · **Priority:** P0

## Goal

The kernel's flow types (`Subprocess`, `SubprocessComponent`, `Edge`,
from `src/types/flow.ts`) are REAL kernel types — the editor mirrors
them structurally in `src/lib/commands.ts` and casts through them with
`as never` 26 times across 9 files (the encapsulation-break class:
private-send equivalents). Fix the seam at its root: export the flow
types from the kernel's public API, import them in the editor, delete
the mirror and every cast that existed only for it.

## Spec

- **Upstream (primmel-ts)**: `index.ts` exports
  `Subprocess, SubprocessComponent, Edge` from `./src/types/flow`
  (type-only, alongside the other type exports) + the ser-des index
  (the browser bundle's entry) re-exports them. Kernel suite green.
- **commands.ts**: delete the structural mirror (`SubprocessComponent`,
  `Edge`, `Subprocess` interfaces) and the duplicated `edgeEnds`
  (import it from `./edges` — edges.ts is the seam's home); type the
  page/placement mutation helpers with the real types — no `as never`
  for flow shapes anywhere (ELEMENT_DEFAULTS, createElement,
  deleteElement, createEdge, removeEdge, renamePage, createPageForProcess,
  linkProcessToPage, updateComponentPosition).
- **The other 8 files**: each remaining `as never`/`as unknown`
  (App.vue, PalettePanel, ProcessCanvas, OtherInspectors,
  DataClassInspector, CodeEditor, mapper, multi-map) is either fixed
  with the real type or justified in one comment line (a genuine seam,
  e.g. the dev-only window hook).
- **The rule lands in CLAUDE.md**: no `as never` for kernel shapes —
  the fix is always the type export upstream.

## Homes

1. primmel-ts: `index.ts` + `src/ser-des/index.ts` exports.
2. `src/lib/{commands,edges}.ts` + the 8 cast sites.

## Acceptance

- `grep -rn 'as never\|as unknown' src/` is empty except the
  explicitly justified seams (each with its comment).
- `grep 'function edgeEnds' src/lib` returns exactly one definition.
- All gates green (the 148 tests + the 22 e2e legs).
