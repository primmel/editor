# 01 — The model core: PRL AST + the command layer ✅ DONE (ba7b264 + primmel-ts f0d4565)

**Wave:** foundation · **Depends on:** nothing · **Priority:** P0

## Goal

The Studio's single source of model truth: load a `.prl` package into
an editable AST store, mutate ONLY through typed commands (undo/redo
history), serialize back byte-clean. Everything else (tree, canvas,
code, inspector) is a projection of this store.

## Spec

- **The store** (Pinia `stores/model.ts` extension): `standard:
  Standard | null` (the kernel's parsed AST), `parseError`,
  `dirty: boolean`, `history: Command[]` + `cursor` (undo/redo),
  `packageMeta: { path?, name? }`.
- **The command layer** (`src/lib/commands.ts`): typed commands
  mirroring the MMEL commands (data/elements/page/comment):
  `createElement`, `deleteElement`, `updateElement`, `createEdge`,
  `removeEdge`, `updateAttribute`, `reorderList`, `updateMeta`,
  `createMappingPair`, `deleteMappingPair`, `updateMappingMeta`.
  Each command carries `apply(ast)` + `revert(ast)` — the undo/redo
  is exact (never a re-derive).
- **Load/save**: `loadText(text)` (kernel `parse`), `serialize()`
  (kernel `dump`) — the round-trip proof: `dump(parse(text)) ≡ text`
  (modulo the kernel's canonicalization), and `serialize()` after
  commands reflects them.
- **Test infra**: vitest + the first suites (this item also boots the
  test setup: `vitest.config.ts`, jsdom not required — the core is
  pure).

## Homes

1. `src/stores/model.ts` — the store.
2. `src/lib/commands.ts` — the command layer (pure, tested).
3. `vitest.config.ts` + `src/lib/__tests__/commands.test.ts` — infra + proofs.

## Acceptance

- Round-trip: parse → dump is byte-stable on the R 60 package's
  model files and the PAS2060/ISO27001 legacy files (post-15 import).
- Every command applies and reverts exactly (apply → revert ≡ identity
  on the AST).
- The store's dirty flag tracks; undo/redo walks the history exactly.
- Gates green (vue-tsc, vitest, build).
