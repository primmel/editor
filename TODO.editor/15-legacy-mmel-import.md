# 15 — Legacy .mmel import (v1/v2 DSL → PRL) ✅ DONE (635cec4)

**Wave:** migration · **Depends on:** 01 · **Priority:** P1

## Goal

The legacy corpus comes home: the MMEL v1/v2 DSL files (the PAS2060
and ISO 27001 plugins, and the Demo models) parse and convert to
Primmel v3 packages — with a report of every construct that needed
translation and anything unconvertible (named, never dropped).

## Spec

- `src/lib/mmel-import.ts`: the legacy grammar reader (the extension's
  serialize/interface vocabulary: metadata, roles, provisions,
  process/approval/dataclass/registry/events/gates, refs, enums,
  vars, notes, views, terms, tables, figures, sections, links,
  comments) → the v3 AST — mostly 1:1 (Primmel is the descendant),
  with the named differences (v2→v3: modality facet spellings,
  validate_provision → the v3 provision links, the MMEL_JSON vs DSL
  text forms).
- **The import report**: per file — constructs converted, constructs
  renamed (with both spellings), constructs with no v3 home (listed,
  never silently dropped).
- **Round-trip proof**: PAS2060 + ISO 27001 convert, validate (the
  kernel's own validator), and their process/data structure matches
  the source file's declarations.

## Homes

1. `src/lib/mmel-import.ts` + `src/lib/__tests__/mmel-import.test.ts`
   (the two demo plugins as fixtures).
2. `src/components/ImportPanel.vue` — file → preview the report →
   import into the store.

## Acceptance

- PAS2060 - plugin.mmel converts with every process/role/provision/
  dataclass intact; the kernel validator accepts the output.
- Ribose ISO 27001 - plugin.mmel same.
- The report names every difference applied; nothing unconvertible is
  dropped without being listed.
- Gates green.
