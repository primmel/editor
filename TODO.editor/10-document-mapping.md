# 10 — Document mapping: elements ↔ paragraphs ✅ DONE (d01bf61)

**Wave:** mapping · **Depends on:** 07 · **Priority:** P1

## Goal

The MMEL extension's document mapper: model elements mapped against
a document's structural units (sections → paragraphs → statements) —
the clause-URN provenance story made visual and editable.

## Spec

- `src/lib/document-model.ts`: a document (from our
  `data/<rec>/document.presentation.xml` corpus or a pasted plain
  document) parsed into sections/paragraphs/statements with stable
  ids — the mapping targets.
- `components/mapper/DocumentView.vue`: the document pane (the
  extension's SectionView/ParagraphView/StatementView) beside the
  model canvas; click-pair mapping element ↔ statement (a doc-map
  profile — `doc_mappings.prl` — with the same description/
  justification meta).
- **Statement splitting**: a paragraph splits into statements
  (sentence boundaries + list items) — each individually mappable;
  unsplit paragraphs map as one unit.
- **The URN discipline**: mapped statements mint their clause URNs
  (`urn:oiml:pub:r:60-2:2021#clause-2.10.1`-shaped where resolvable,
  else the document-local fragment id) — the provenance the
  requirements corpus already carries.

## Homes

1. `src/lib/document-model.ts` (pure parser + URN minting) + tests.
2. `src/components/mapper/DocumentView.vue` + the doc-map profile.

## Acceptance

- Load R 60-2's presentation document; map 5 statements to model
  elements with meta; the profile serializes with correct URNs.
- A paragraph splits into statements; each maps independently.
- Gates green.
