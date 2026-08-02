# 21 — The legacy corpus complete: `view` alias + note EXAMPLE

**Wave:** migration · **Depends on:** 15 · **Priority:** P0

## Goal

The legacy .mmel corpus parses 10/10. Two files (BS13485 2012,
BS13485) use the legacy `view` keyword (the v2 view-profile block —
the v3 `view_profile`); three (ISO14971 ×2, BS6004) declare notes of
type `EXAMPLE` — both are genuine legacy vocabulary the language
must carry (the same doctrine as `measurement`/`variable` and
`canvas`/`subprocess`: Primmel accepts its ancestry).

## Spec

- **Kernel** (primmel-ts, upstream):
  - `view` as an alias of `view_profile` in the construct registry
    (config/index.ts `aliases`).
  - `NoteType` gains `'EXAMPLE'` (types/Note.ts) + the note parser
    accepts it (config/note.ts) + the dump emits it verbatim.
- **The corpus matrix** (`src/lib/__tests__/mmel-import.test.ts`
  extended): ALL TEN corpus files vendored under
  `src/lib/__tests__/fixtures/corpus/` (they are public demo content)
  — each converts with its construct counts pinned, its validator
  clean, its canonical dump byte-stable.
- The import report's renames list gains `view` → `view_profile`.

## Homes

1. primmel-ts: `src/types/Note.ts`, `src/ser-des/config/{note,index}.ts`.
2. `src/lib/__tests__/fixtures/corpus/*.mmel` (8 new fixtures).
3. `src/lib/__tests__/mmel-import.test.ts` (the matrix).

## Acceptance

- All 10 corpus files strict-parse, convert, validate clean,
  byte-stable round-trip — in one test matrix.
- Kernel suite green (1078+ tests); the note/view fixtures round-trip.
- Gates green.
