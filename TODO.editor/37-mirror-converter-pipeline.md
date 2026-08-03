# 37 — The mirror converter pipeline (Metanorma → JSON)

**Wave:** oiml-cs · **Depends on:** 10 · **Priority:** P0

## Goal

The honest document toolchain: Metanorma's own converter
(`metanorma-document to-mirror`, the metanorma/mirror format) turns
the corpus's presentation XML into Mirror JSON — replacing the
hand-rolled DOM walk as the preferred document path. The converter
runs at build time (a Ruby bundle); the Studio consumes the JSON at
runtime (no Ruby in the browser).

## Spec

- `scripts/mirror-env/Gemfile` — the isolated bundle
  (metanorma-document from git main + metanorma-iso + metanorma-generic,
  resolved matrix, lutaml-model 0.8.19).
- `scripts/mirror-convert.sh <xml> <out>` — the wrapper: copies the
  input to a FLAVOR-prefixed temp name (`iso-<name>.xml` — the
  flavor inference maps the basename, and the plain `document.*`
  name maps to the abstract 'document' flavor and fails — the
  discovered rule) and runs `bundle exec metanorma-document
  to-mirror` from `scripts/mirror-env`.
- The batch fixtures: all 13 OIML-CS documents (b018-e25, cs-pd-01..09,
  cs-od-01/02, cs-cid-01) + r007-e79 converted to
  `src/lib/__tests__/fixtures/mirror/<name>.mirror.json`.
- The wrapper's output verified non-empty per document (the script
  asserts each JSON parses and carries text leaves).

## Homes

1. `scripts/mirror-env/` + `scripts/mirror-convert.sh`.
2. `src/lib/__tests__/fixtures/mirror/*.mirror.json` (15 files).

## Acceptance

- All 15 documents convert with real text content (the pd-01 class
  of previously-empty documents included).
- The converter is reproducible from a clean checkout (bundle install
  in scripts/mirror-env).
- Gates green.
