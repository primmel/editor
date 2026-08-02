# 12 — The model-diff view

**Wave:** advanced · **Depends on:** 01 · **Priority:** P1

## Goal

The MMEL extension's versioncompare: two versions of a model (or
package) side by side with the kernel's `model-diff`/`package-diff`
rendered — added/changed/deleted per element and per facet, with the
mapping diff (new/same/delete) when a profile is present.

## Spec

- `src/lib/diff-view.ts`: bridge the kernel's diff output to the view
  model (per-element status + per-facet changes) — never a Studio-side
  reimplementation of the comparison.
- `components/diff/DiffView.vue`: the two-version selector (file
  picker or two open packages), the changed-element list (grouped by
  status), the per-element facet diff (before → after per changed
  facet), and the mapping diff where profiles exist.
- **Canvas diff mode**: the canvas tinted by diff status (new /
  changed / deleted / same) for the spatially-minded review.

## Homes

1. `src/lib/diff-view.ts` (+ kernel-boundary tests).
2. `src/components/diff/DiffView.vue` + the canvas tint.

## Acceptance

- Diff a package against its edited copy: every change appears with
  its facet-level before/after, matching the kernel's `modelDiff()`.
- The mapping diff shows new/same/deleted pairs correctly.
- Gates green.
