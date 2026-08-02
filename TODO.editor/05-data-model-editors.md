# 05 — The data-model editors (the HAS axis) ✅ DONE (8467e2d)

**Wave:** foundation · **Depends on:** 04 · **Priority:** P0

## Goal

The data side of the MMEL editor: the dataclass / attribute / registry
/ enum editors with cardinality, datatype, and references — the HAS
axis of the model, fully editable.

## Spec

- `components/inspectors/DataClassInspector.vue`: the class name,
  attributes list (`AttributeList` with add/remove/reorder), each
  attribute's editor (`AttributeEdit`: name, cardinality
  `[0..1] [1..*] [0..*] [n..m]`, datatype selector (string/number/
  integer/boolean/date/datetime/enum/reference/text/object/map),
  the enum/registry/reference target pickers).
- `components/inspectors/RegistryInspector.vue`: registry entries
  (the data registry's item list).
- `components/inspectors/EnumInspector.vue`: enum values
  (add/remove/reorder).
- **The type system is the kernel's** — the datatype vocabulary comes
  from the PRL type expressions (`type-expr.ts`), never a local list.
- Data links (dataclass ↔ dataclass, dataclass ↔ process) render and
  edit as first-class edges (item 02's data-link kind).

## Homes

1. `src/components/inspectors/{DataClass,Registry,Enum}Inspector.vue`.
2. `src/components/fields/{AttributeList,AttributeEdit,CardinalityEdit,
   DataTypeSelector,RegistrySelector,ReferenceSelector}.vue`.
3. `src/lib/__tests__/data-editors.test.ts`.

## Acceptance

- Create a dataclass with 3 attributes (varied cardinality/datatype)
  — the AST matches hand-written PRL; serialize round-trips.
- Reorder attributes; edit a reference target (enum/registry).
- Enum values edit + reorder; a dataclass attribute binds an enum.
- Gates green.
