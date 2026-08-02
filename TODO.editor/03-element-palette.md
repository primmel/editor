# 03 — The element palette: create nodes

**Wave:** foundation · **Depends on:** 02 · **Priority:** P0

## Goal

The creation palette: drag (or click) an element kind onto the canvas
to create it with sane defaults and a unique id — every kind the PRL
supports (process, approval, dataclass, registry, start/end/timer/
signal events, gates, subprocess).

## Spec

- `components/PalettePanel.vue`: the kind list with icons (house
  style, one SVG glyph per kind), drag-to-canvas + click-to-add.
- `src/lib/factory.ts`: `createElement(kind, position, ast)` →
  the create command: id minting (`{kind}{n}` — the smallest free
  number in the package), the default facets per kind (modality
  SHALL for processes, an empty attributes list for dataclasses, the
  initial state for events).
- **Id discipline**: unique within the package; on collision the
  mint bumps (never overwrites).
- **Undo**: create commands revert cleanly (delete the minted element
  and anything attached).

## Homes

1. `src/components/PalettePanel.vue`.
2. `src/lib/factory.ts` (+ `src/lib/__tests__/factory.test.ts`).

## Acceptance

- Every kind creates with a valid AST (the kernel's own validation
  accepts the minted element).
- Ids never collide across 100 rapid creates.
- Undo of a create removes the element AND its edges.
- Gates green.
