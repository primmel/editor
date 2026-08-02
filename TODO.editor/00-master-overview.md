# 00 — Primmel Studio: the master overview (the MMEL port)

**Mission.** Port the Paneron MMEL Editor/Viewer/Mapper (extension of
28 Jan 2022, `@paneron/extension-hls` v1.0.0-dev18) to Primmel v3 as
**Primmel Studio** — the premier model editor for the Primmel SMART
platform, with the OIML SMART program as its first layer. This app
(`~/src/primmel/editor`) is the home; the kernel
(`~/src/primmel/primmel-ts`) is the only semantics.

## The source's feature surface (investigated)

From `~/src/mn/SMART-documentation/Demo/Extension/extension 28 Jan 2022.zip`:

- **Model core** — `EditorModel` (meta, roles, provisions, elements,
  refs, enums, vars, notes, pages, views, terms, tables, figures,
  sections, links, comments), four model types (EDIT/REF/IMP/EDITREF),
  command-pattern edits with history, version compare.
- **The canvas** (react-flow) — drag/drop nodes, connect edges with
  conditions, subprocess pages with neighbor tracking, data links.
- **Element editors** — attribute (cardinality/datatype), edge list,
  measurement list, note list, provision list, reference/registry/role
  selectors, link/note/term/section/approval/view-profile editors.
- **The Mapper** — MapProfile/MapSet, side-by-side REF/IMP canvases,
  click-pair mapping, coverage overlay (FULL/PASS/PARTIAL/NONE),
  diff maps (new/same/delete), party lists, automapper (suggest+merge).
- **Document mapping** — model elements ↔ document paragraphs/
  sections/statements.
- **Simulation** — process simulation with state inspection.
- **Measurement** — validation pane, variable settings, result formatter.
- **Review workflow** — change-requests, reviews, revisions, comments.
- **Application packages** — program-specific UIs (ISO27001, PAS2060).

## What we already have

- **primmel-ts kernel** — the full v3 type surface (superset of
  MMEL's), parser + dumper (byte-clean round trip), the linker, the
  coverage calculus (`mapping-coverage.ts`: inheritance, aggregation,
  transitivity-discovery, closure-proposals, C23 assertion checks),
  `model-diff`/`package-diff`, `MapProfile` (the v3 mapping primitive:
  multi-target pairs with description/justification/coverage).
- **This app** — Vue 3 + Vite + Pinia skeleton: ModelTree,
  ProcessCanvas (SVG pan/zoom + auto-layout), ElementInspector,
  CodeEditor (Monaco planned), CompliancePanel, MappingView,
  DataRegistry, stores (model/ui/registry), render/layout libs.

## The architecture (the rules every item holds)

- **Model-driven.** The editor renders and edits the PRL AST; every
  mutation is a typed command on the AST; the kernel's dump
  round-trips byte-clean. No shadow copies that can drift.
- **Open/closed.** The Studio kernel knows ONLY Primmel constructs.
  Programs (OIML SMART, later others) register palettes, inspectors,
  and panels through a plugin registry — never an `if (program === …)`.
- **MECE.** Tree (structure), canvas (visual), code (text), inspector
  (properties) are four projections of ONE Pinia model store; edits
  only through the command layer (undo/redo, audit of changes).
- **DRY.** Parsing, coverage, diff, and layout semantics come from the
  kernel or one shared lib — never reimplemented in a component.
- **Layers.** Primmel Studio (generic) is the base; the OIML SMART
  layer is a plugin (item 17) — the pattern every later 〈scope〉 SMART
  program reuses.

## The item map

| # | Item | Priority | Wave |
|---|---|---|---|
| 01 | the model core (AST + command layer + undo/redo) | P0 | foundation |
| 02 | the canvas engine (drag/connect/pages) | P0 | foundation |
| 03 | the element palette (create nodes) | P0 | foundation |
| 04 | the inspectors (per-type property editors) | P0 | foundation |
| 05 | the data-model editors (HAS axis) | P0 | foundation |
| 06 | subprocess pages (nested canvases) | P0 | foundation |
| 07 | the mapper core (REF⇄IMP pairs) | P0 | mapping |
| 08 | the coverage overlay (the calculus) | P0 | mapping |
| 09 | multi-reference mapping (the lens) | P1 | mapping |
| 10 | document mapping (elements ↔ paragraphs) | P1 | mapping |
| 11 | automap (suggest + confirm + merge) | P1 | mapping |
| 12 | the model-diff view | P1 | advanced |
| 13 | the process simulation | P2 | advanced |
| 14 | element comment threads | P2 | advanced |
| 15 | legacy .mmel import (v1/v2 DSL → PRL) | P1 | migration |
| 16 | the measurement harness view | P2 | program |
| 17 | the OIML SMART layer (the program plugin) | P1 | program |
| 18 | save-to-SSOT + the change preview | P0 | persistence |
| 19 | e2e + docs (chapter, README, AGENTS) | P1 | polish |
| 20 | the Monaco code editor (PRL language mode) | P2 | polish |

## The gates (every item lands green)

```
cd ~/src/primmel/editor && npx vue-tsc --noEmit
cd ~/src/primmel/editor && npx vitest run
cd ~/src/primmel/editor && npm run build
```

Small commits per item; the byte-clean round trip (parse → command
edits → dump ≡ identity) is the foundational proof (item 01's gate);
the mapping calculus must match the kernel's numbers exactly (item
08's gate — never a reimplementation).
