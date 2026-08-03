# 00 — Primmel Studio: the master overview (the MMEL port) ✅ COMPLETE (2026-08-03)

**Mission.** Port the Paneron MMEL Editor/Viewer/Mapper (extension of
28 Jan 2022, `@paneron/extension-hls` v1.0.0-dev18) to Primmel v3 as
**Primmel Studio** — the premier model editor for the Primmel SMART
platform, with the OIML SMART program as its first layer. This app
(`~/src/primmel/editor`) is the home; the kernel
(`~/src/primmel/primmel-ts`) is the only semantics.

> **Program complete.** All twenty items landed, each in its own
> commit with its gates green: 19 vitest files / 108 tests, the type
> check, the production build, and the 18-leg e2e suite
> (`e2e/run-all.sh`). The four kernel additions upstream: the
> `version` line strict-parse special case (f0d4565), the `EnumValue`
> type export (af1a5f6), the browser-bundle re-exports — type-expr +
> mapping-coverage (12c26bc) and model-diff — and the `comment`
> construct. The MMEL extension's full feature surface is ported:
> model core, canvas, editors, the mapper with coverage, document
> mapping, automap, simulation, measurement, comments, diff, legacy
> import, and the OIML program layer proving the plugin seam.

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
| 01 | the model core (AST + command layer + undo/redo) | P0 | foundation | ✅ ba7b264 |
| 02 | the canvas engine (drag/connect/pages) | P0 | foundation | ✅ a3af55b |
| 03 | the element palette (create nodes) | P0 | foundation | ✅ c700d5f |
| 04 | the inspectors (per-type property editors) | P0 | foundation | ✅ df19747 |
| 05 | the data-model editors (HAS axis) | P0 | foundation | ✅ 26b513a |
| 06 | subprocess pages (nested canvases) | P0 | foundation | ✅ 9d631c7 |
| 07 | the mapper core (REF⇄IMP pairs) | P0 | mapping | ✅ 6a55ed3 |
| 08 | the coverage overlay (the calculus) | P0 | mapping | ✅ e2087c3 |
| 09 | multi-reference mapping (the lens) | P1 | mapping | ✅ 938cc7a |
| 10 | document mapping (elements ↔ paragraphs) | P1 | mapping | ✅ e4e0687 |
| 11 | automap (suggest + confirm + merge) | P1 | mapping | ✅ 957543d |
| 12 | the model-diff view | P1 | advanced | ✅ 25572e3 |
| 13 | the process simulation | P2 | advanced | ✅ bda9d2c |
| 14 | element comment threads | P2 | advanced | ✅ 3373834 |
| 15 | legacy .mmel import (v1/v2 DSL → PRL) | P1 | migration | ✅ 7b4aa73 |
| 16 | the measurement harness view | P2 | program | ✅ 58227c0 |
| 17 | the OIML SMART layer (the program plugin) | P1 | program | ✅ e93171d |
| 18 | save-to-SSOT + the change preview | P0 | persistence | ✅ 99ddec3 |
| 19 | e2e + docs (chapter, README, AGENTS) | P1 | polish | ✅ e1b2128 |
| 20 | the Monaco code editor (PRL language mode) | P2 | polish | ✅ aede694 |

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

## The validation wave (21–28) — the capability contract

| # | Item | Priority | Wave |
|---|---|---|---|
| 21 | the legacy corpus complete (view alias + note EXAMPLE) | P0 | migration | ✅ b7b4d07 |
| 22 | the new-model flow (File → New) | P0 | foundation | ✅ b412967 |
| 23 | the data section (dataclasses in `page.data`) | P0 | foundation | ✅ 5f12117 |
| 24 | the corpus matrix (the ten, vendored and proven) | P0 | migration | ✅ 9b0ead3 |
| 25 | the capability walk (the ultimate e2e validation) | P0 | validation | ✅ 73cd4d3 |
| 26 | the R 7 tutorial model (Clinical thermometers) | P0 | program | ✅ 5e1605b |
| 27 | the dual-demo tutorial (model YOUR Recommendation) | P1 | docs | ✅ 1d758d4 |
| 28 | the validation close-out (VALIDATION.md) | P0 | validation |
| 29 | validation throughout (the Primmel validation surface) | P0 | validation | ✅ 648c8f4 |
| 30 | the Studio user guide (the audience manual) | P0 | docs | ✅ fa0d0b8 |
| 31 | the audience-flow integration (Primmel + OIML SMART) | P1 | docs | ✅ ed729d9 |

The contract: create new Primmel models (reference/implementation),
import old MMEL models (all ten), do mappings with coverage, navigate,
create data registers and processes, drill in and out, show diagrams,
run execution, and model a new OIML Recommendation (R 7, Clinical
thermometers) as the dual demo with the smart-r60 classroom.

## The validation wave closes

All items 21–31 landed; the capability contract is proven in
[VALIDATION.md](VALIDATION.md) — the full matrix (22 promises, each
with its leg and proof), the recorded close-out sweep, and the honest
"not yet" list (form-field builder, requirement/test inspectors,
multi-file packages, the formal review workflow, collaboration).
