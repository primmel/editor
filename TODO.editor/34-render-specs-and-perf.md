# 34 — The render-layer specs + the scale proof ✅ DONE (d46a9e4)

**Wave:** audit · **Depends on:** 02 · **Priority:** P1

## Goal

The render layer (render.ts, layout.ts, monaco-language.ts) is the
only untested lib surface, and nothing proves the app holds at corpus
scale (ISO27001: 262 processes, 77 pages). Both close here.

## Spec

- **`src/lib/__tests__/render.test.ts`**: resolveLabel (name falls
  back to id), resolveNodeKind (every kind + the data section), the
  viewport cull (a 500-node page culls to the visible window with the
  margin), bezierPath (anchors), extractCanvas (root fallback).
- **`src/lib/__tests__/layout.test.ts`**: the BFS level assignment
  (a diamond flow levels correctly; a cycle cannot hang it).
- **`src/lib/__tests__/monaco-language.test.ts`**: the monarch
  definition's keyword classes are the kernel's vocabulary (no stale
  local list — the construct keywords are shared with monaco-prl's
  CONSTRUCT_KEYWORDS).
- **The scale proof** (`e2e/scale-smoke.ts`): load
  `fixtures/corpus/iso27001.mmel` (262 processes, 77 pages) — the
  tree renders, a canvas page renders under 100ms per frame budget
  (measure via performance marks, assert the cull keeps rendered
  nodes under the cap), the mapper opens with it as IMP, and the
  save preview computes without a freeze (>0ms and <10s).

## Homes

1. The three test files + the scale smoke.

## Acceptance

- render/layout/monaco-language covered; the scale smoke green with
  its timing assertions.
- Gates green.
