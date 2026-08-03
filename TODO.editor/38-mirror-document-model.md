# 38 — The mirror document-model ✅ DONE (8f4fe36)

**Wave:** oiml-cs · **Depends on:** 37 · **Priority:** P0

## Goal

document-model.ts consumes the Mirror JSON as the preferred path:
`doc → preface/sections/annex → clause (with title) → paragraph →
text` becomes clauses → paragraphs → statements with stable ids and
the OIML URN discipline extended to the B/CS families — replacing
the DOM walk's fragile heuristics (nested clause structures, missing
titles, preface-held content — every failure the CS corpus exposed).

## Spec

- `parseMirrorJson(json, docid?) → DocumentModel` in document-model.ts:
  - clauses: `content_section` + `clause` nodes (titles from attrs,
    nested subclauses' content folds into the top clause at this
    grain); preface clauses count too (pd-01's content lives there;
    the ToC stays skipped).
  - paragraphs: `paragraph` nodes → their `text` leaves (the string
    under `text`, joined); `list_item` nodes = statements on their own.
  - statement ids: ordinal per clause (the honest caveat stands —
    these documents carry no clause numbers in titles).
  - URN minting: OIML families — `OIML B 18:2025(E)` →
    `urn:oiml:pub:b:18:2025`, `OIML R 7( 1979)` → `urn:oiml:pub:r:7:1979`,
    `OIML-CS PD-05 Edition 6 (Amendment 1)` →
    `urn:oiml:pub:cs:pd-05:2024` (year from the bibdata date when the
    identifier carries none), D/G families the same; else the doc-slug.
- `loadDocument` gains the .mirror.json input (content sniffing:
  `{"type":"doc"` → the mirror path; `<` → the DOM path; else plain).
- The existing document tests stay green (the DOM path unchanged);
  new tests pin the mirror structure (clause counts, titles, text
  content, URNs per family).

## Homes

1. `src/lib/document-model.ts` + `src/lib/__tests__/document-model-mirror.test.ts`.

## Acceptance

- pd-01/pd-05/b018 parse with real clauses and real text (counts pinned).
- The URNs for B 18 / CS PD / R 7 mint correctly.
- Gates green.
