# 22 — The new-model flow (File → New)

**Wave:** foundation · **Depends on:** 01 · **Priority:** P0

## Goal

The Studio creates new Primmel models from nothing: a New button with
three templates — **blank** (the minimal working model), **reference**
(a standards-model skeleton: namespace + role + a first process +
root canvas), **implementation** (the same plus an empty
`map_profile` slot ready for the lens). No more boot-sample-only.

## Spec

- `src/lib/templates.ts`: `newModelTemplate(kind: 'blank' | 'reference' | 'implementation', opts: { title, namespace }) → string`
  — honest PRL text (the template is text, parsed by the same kernel
  path as every other model — no special AST seeding).
- `src/components/NewModelDialog.vue`: kind picker (three cards with
  the doctrine one-liner each — reference = "the standard you comply
  with", implementation = "your operations that comply"), title +
  namespace inputs, create → `modelStore.loadText(template)` (the
  store's normal load path — history resets, dirty false).
- The topbar: **New** beside Import/Save; Ctrl+N.
- The implementation template seeds `map_profile <ns-placeholder>`
  commented… NO — an empty mapping is not valid empty-profile PRL;
  the profile materializes on the first pair (the mapper already
  auto-creates). The implementation template carries a `note`
  explaining the mapping flow instead (a documentary note, real PRL).

## Homes

1. `src/lib/templates.ts` + `src/lib/__tests__/templates.test.ts`.
2. `src/components/NewModelDialog.vue` + the topbar button.

## Acceptance

- New blank/reference/implementation each parse (strict), boot the
  workspace, show on the canvas; the reference template's role +
  process are editable immediately.
- The e2e leg: create a new reference and a new implementation in one
  session, map one pair between them (the full create→map loop).
- Gates green.
