# 04 — The inspectors: per-type property editors ✅ DONE (23c1929)

**Wave:** foundation · **Depends on:** 01 · **Priority:** P0

## Goal

The right-panel property editors (the MMEL extension's edit
components): name, actor, modality, provisions (validate_provision),
inputs/outputs, measurement list, links, notes, and the view-profile
editor — each a command-emitting editor bound to the selected element.

## Spec

- `components/ElementInspector.vue` → a dispatcher over
  `components/inspectors/{ProcessInspector,ApprovalInspector,
  EventInspector,GateInspector,SubprocessInspector}.vue`.
- **Shared field components** (`components/fields/`):
  `TextField`, `ModalitySelect` (SHALL/SHOULD/MAY), `ActorSelect`
  (the model's roles), `ProvisionListEdit` (add/remove provision
  refs with the model's provision picker), `VarListEdit` (inputs/
  outputs with the var picker), `MeasurementListEdit` (measurement
  points with unit), `LinkListEdit`, `NoteListEdit`, `CardinalityEdit`,
  `ReferenceSelector`.
- Every field writes through the command layer (per-field command,
  coalesced into the undo history per edit session).
- **Validation inline**: required facets flagged (name empty, actor
  unset on a process) — from the kernel's validation, never local rules.

## Homes

1. `src/components/ElementInspector.vue` + `components/inspectors/`.
2. `src/components/fields/` (the shared field kit).
3. `src/lib/__tests__/inspectors.test.ts` (the command emission).

## Acceptance

- Edit every facet of a process (name, actor, modality, provisions,
  inputs, outputs, measurements) — the AST reflects each, undo reverts.
- The provision/var pickers list the model's own provisions/vars.
- Empty-required facets flag inline (name, actor).
- Gates green.
