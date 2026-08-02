# 18 — Save to SSOT + the change preview

**Wave:** persistence · **Depends on:** 01, 12 · **Priority:** P0

## Goal

The honest save: write the edited model back as `.prl` (byte-clean
through the kernel's dump), preview the change against the original
(the package-diff review before commit), and respect the SSOT
discipline (authored packages regenerate their data trees — the
drift gate stays green).

## Spec

- `src/lib/save.ts`: `serializeForSave(ast) → { text, diff }` — the
  dump + the kernel's package-diff against the loaded original; the
  save panel shows the diff (added/changed/deleted per construct)
  before writing (the review-before-commit discipline).
- **The write path**: browser download (the honest browser-only
  posture) +, where the dev server's write API exists, direct write
  to the package dir with the backup (`.bak` of the original).
- **Dirty discipline**: the dirty badge (any uncommanded state is
  impossible — every edit is a command; dirty = history cursor ≠
  saved cursor); closing with unsaved changes warns.
- **The ssot hook**: after a save to a primmel-packages path, the
  regen instruction is surfaced (the app's `npm run gen:data` keeps
  the downstream trees honest — documented, not automated from the
  browser).

## Homes

1. `src/lib/save.ts` (+ the diff-preview tests).
2. `src/components/SavePanel.vue` — the diff review + save actions.

## Acceptance

- Edit + save: the written file parses back to the same AST; the
  preview shows exactly the edits made (nothing more).
- The download fallback produces the identical bytes.
- Dirty/warn states correct across undo/redo.
- Gates green.
