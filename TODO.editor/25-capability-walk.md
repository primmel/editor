# 25 — The capability walk (the ultimate e2e validation)

**Wave:** validation · **Depends on:** 22, 23 · **Priority:** P0

## Goal

The user-facing promise, proven in one orchestrated e2e suite: with
ONLY the Studio (no hand-edited files), a modeller can create new
Primmel models (reference + implementation), import old MMEL models,
do mappings with the coverage overlay, navigate (tree / pages /
breadcrumbs / tabs), create data registers and dataclasses, create
processes, drill in and out of them, see the diagrams, and run the
execution (simulation) — every leg green against `npm run dev`.

## Spec — `e2e/capability-walk.ts`, one continuous session:

1. **New reference model** (R7-like skeleton: two requirements-shaped
   processes + a role) via the New dialog.
2. **New implementation model** via the New dialog.
3. **Create a data register** (tree +) and a dataclass (palette →
   data section), with attributes; the registry's data_class links.
4. **Create processes** (palette), edit facets (inspector: name,
   actor, modality), **drill in** (create subprocess page from the
   inspector, add a node inside), **drill out** (breadcrumb).
5. **Diagrams** — canvas nodes + edges render (the SVG assertions),
   page tabs switch.
6. **Mapping** — load the reference as the REF side (the session's
   own serialized text through the store hook), click-pair two
   elements with meta; the overlay edge draws; the coverage tint
   shows on both panes.
7. **Run execution** — simulate: walk the implementation's flow to
   completion; the trajectory records the steps; a gateway branches
   on an edited register.
8. **Import** — run one corpus file through the import path
   in-browser; the report renders; the model swaps.
9. **Save** — the diff preview names the session's changes; the
   written file parses back.

Each leg asserts the AST AND the DOM (the user's list is a contract).

## Homes

1. `e2e/capability-walk.ts` (+ a line in `e2e/run-all.sh`).

## Acceptance

- The walk: 9/9 legs green in one session, in order.
- `e2e/run-all.sh` (now 19 legs) green end to end.
- Gates green.
