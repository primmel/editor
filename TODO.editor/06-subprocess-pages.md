# 06 — Subprocess pages: nested canvases ✅ DONE (3903245)

**Wave:** foundation · **Depends on:** 02 · **Priority:** P0

## Goal

The subprocess pages (the MMEL extension's EditorSubprocess with its
`neighbor` map): nested canvases with a page tree, breadcrumbs, and
processes that live on pages — the full drill-down model.

## Spec

- **The page model**: every subprocess owns a page (its start event +
  elements + edges); processes declare `subprocess Page0` — the
  inspector links it, the canvas navigates it.
- `components/PageTree.vue`: the page hierarchy (root → subprocess
  pages → nested), with create-page + rename.
- **Navigation**: double-click a subprocess node to enter; breadcrumb
  `root / Page0 / Page3` to walk back; the "go to next model" hook
  (the MMEL's goToNextModel) for cross-package links later.
- **Edge behavior across pages**: an edge between an outer element
  and an inner-page element is FORBIDDEN (the MMEL's discipline —
  edges stay within one page; communication is via the subprocess
  node). Enforced at connect time.
- **The neighbor map**: entering/exiting a page updates the current
  page's visible neighbor set (up/down navigation).

## Homes

1. `src/components/PageTree.vue` + the canvas's page switching.
2. `src/lib/pages.ts` (pure: page tree, navigation, edge discipline).
3. `src/lib/__tests__/pages.test.ts`.

## Acceptance

- Create a subprocess page inside a process; drag elements into it;
  the AST nests correctly.
- The cross-page edge is refused at connect time with a clear hint.
- Breadcrumb walks up exactly; the tree matches the AST's nesting.
- Gates green.
