# 07 — The mapper core: REF ⇄ IMP pairs

**Wave:** mapping · **Depends on:** 02, 01 · **Priority:** P0

## Goal

The mapper (the MMEL extension's MappingsCanvus): a REF model on the
left, the IMP model on the right, click-pair to map — the
`MapProfile` (the v3 mapping primitive) created and edited through
the command layer.

## Spec

- `components/mapper/MapperView.vue`: two synchronized canvases (the
  item-02 canvas in read+select mode) with the map edges rendered
  between them (curved SVG across the split, hover-highlighted both
  ends).
- **Pair CRUD**: click REF element, then IMP element (or reverse) →
  the mapping pair dialog (description "how the fulfilment works",
  justification "why the claim holds") → `createMappingPair` command.
  Click an existing map edge → edit the meta or delete.
- **Multi-target pairs**: one IMP element may map to several REF
  targets ("write once, comply twice" — the v3 list shape), and one
  REF element may receive several sources.
- **The profile model**: `MapProfile { namespace, description,
  mappings: Record<sourceId, MappingPair[]> }` — authored in
  `mappings.prl` of the IMP package; load/save through item 01's core.
- **Party lists** (`components/mapper/MapPartyList.vue`): the
  mapped/unmapped lists per side (findImpMapPartners /
  findRefMapPartners equivalents over the profile).

## Homes

1. `src/components/mapper/{MapperView,MapEdge,MapPairDialog,
   MapPartyList}.vue`.
2. `src/lib/mapper.ts` (pure: pair CRUD over the profile, party
   queries) + tests.

## Acceptance

- Load two packages (REF + IMP); map 3 pairs with meta; the profile
  serializes exactly as the PRL mapping grammar expects.
- Multi-target: one IMP → two REF targets (the list shape holds).
- Unmapped lists correct on both sides after each edit; undo reverts.
- Gates green.
