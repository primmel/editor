# 24 — The corpus matrix (the ten, vendored and proven)

**Wave:** migration · **Depends on:** 21 · **Priority:** P0

## Goal

Every legacy .mmel file in `~/src/mn/SMART-documentation/` (the ten)
is vendored into the editor repo as a test fixture and proven through
the import path in one matrix: strict parse → convert → validate →
byte-stable canonical dump, with per-file construct counts pinned so
a kernel or importer regression names the file.

## Spec

- Vendor the eight remaining files into
  `src/lib/__tests__/fixtures/corpus/` (PAS2060 + ISO27001 plugins
  already vendored at fixtures root — move them INTO `corpus/` for
  one home; update the 15 tests' paths).
- `src/lib/__tests__/corpus-matrix.test.ts`: the ten-row matrix —
  file → expected construct counts (processes/provisions/roles/pages/
  dataclasses/references/enums/variables) + validator clean + report
  unknownKeywords empty + renames match the file's legacy spellings.
- The import report for each file is included in the test output
  (vitest `--reporter=verbose` shows the per-file row).

## Homes

1. `src/lib/__tests__/fixtures/corpus/*.mmel` (ten files).
2. `src/lib/__tests__/corpus-matrix.test.ts`.

## Acceptance

- The matrix: 10/10 convert clean with pinned counts.
- `view` → `view_profile` and the note EXAMPLE pass through the
  report honestly.
- Gates green.
