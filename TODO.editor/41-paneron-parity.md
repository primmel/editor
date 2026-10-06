# 41 — The Paneron parity audit (the legacy implementation, fully read)

The owner's directive (2026-10-06): audit the previous Paneron
implementation directly — all code and features — to ensure the Studio
reaches FULL feature parity, especially implementation/reference model
mapping and referencing, building models, and adopting new reference
models into the implementation model.

**The source**: `~/src/mn/mmel-models/Paneron extension/extension 13
Dec 2021.zip` (`@paneron/extension-hls` v1.0.0-dev18, the last build) —
302 compiled modules, every feature-bearing one read directly; the
`Guides/Mapping Guide.pptx` for the authoritative mapping semantics;
the `.map` examples (`acme.map`, `QMS.map`) for the data format. This
file is the parity contract: what the legacy did, what the Studio has,
and the sized gap register.

## The legacy architecture (one glance)

Nine modules over three repo types (`Ref` = reference model, `Imp` =
implementation model, `Doc` = SMART document):

| Module | Repo types | The legacy surface |
|---|---|---|
| Repository | all | browser, import (MMEL/XML/NISO-STS), new, rename-ns, AI-translate, delete |
| View | Ref/Imp | read-only canvas, drill, breadcrumbs, search, 7 sidebar tools |
| Edit | Imp | 12 element editors (full + quick), undo 500, copy/paste, cascades |
| **Map** | Ref/Imp | the mapper: imp↔ref canvases, coverage, automap, repo map, doc mapping, report templates |
| **Implementation** | Ref/Imp | the workspace: data-registry entry against the model, docs store |
| Doc viewer | Doc | read-only document render |
| Link Analyser | Ref/Imp | the cross-model link graph (REPO links, BFS) |
| Knowledge graph | Ref/Imp | CoreNLP semantic triples + NL questions |
| Create SMART Document | — | document editing + XML/BSI import |

Four objects per repository: `model/map/workspace/rdf` per namespace.

## The mapping semantics (the authoritative core)

From the Mapping Guide + `MappingCalculator.js`:

- **A → B means**: fulfilling ALL of A's requirements implies
  fulfilling ALL of B's. Directional; non-symmetric; no equivalence.
- **Coverage is flow-aware**: FULL (all requirements), MINIMAL (the
  minimal path — gateway OR-branches satisfy), PARTIAL, NONE; mapping
  a process inherits FULL to its whole subprocess tree recursively;
  parents aggregate over children (rules 1–3).
- **Model-level mapping is NOT transitive; PROCESS-level IS**: A→B and
  B→C implies A→C (by definition). The Auto Mapper exploits exactly
  this: transitive + inherited inference through intermediate models
  (bridge selection → destination selection → discovery report).
- **The map file**: `MMEL_MAP` JSON — one profile per implementation,
  `mapSet[refNamespace].mappings[impId][refId] = { description,
  justification }`; an imp maps MANY references simultaneously;
  references can be MODELS or DOCUMENTS (clause statements).
- **Repo map**: the model-level mapping graph, recursive (a ref's own
  mappings shown too); a link means "some mapping exists".
- **Report templates**: Liquid over `{ map, raw, imodel, rmodel }` →
  Asciidoc → Metanorma print (the SoA example).
- **MappingDiff**: re-plot the map against the OLD reference's map —
  per-source new/deleted/changed edge styling (the update impact).

## The adoption workflow (the other named core)

- **VersionTracker** (`computeDiff`): load a model with the SAME
  namespace and a DIFFERENT edition → structural diff matched by
  element id, recursing subprocesses, with per-type comparators
  (process: name/actor/IO/provisions matched by normalized
  condition+modality; approval: actor/approver/records; registry:
  title+dataclass; edges by endpoints), change comments per node,
  same/add/delete/change styling, and a base↔compared browsing switch
  that recomputes navigation through the other edition. READ-ONLY:
  no merge — the diff is the decision support, adoption is manual.
- **ModelImport** (`addProcessIfNotFound` &c.): adopt elements FROM a
  reference INTO the implementation — processes with their
  registries/roles/refs/provisions/notes/measures/tables/figures/links
  and whole subprocess pages, dedupe by id/role-name/registry-shape/
  ref(document+clause+title), copying measurement variables on demand.
  Driven by drag-and-drop from the reference canvas.
- **ModelReferenceView**: the same canvas in reference mode — the
  left pane for mapping and the drag source for adoption.

## The parity matrix

### Where the Studio is at or beyond parity (verified)

| Legacy feature | Studio state |
|---|---|
| MMEL editor (12 element types, quick+full, ID change, cascade renames) | **Beyond**: 39 inspectors over the whole PRL language (terms, symbols, verdicts, quantity registers, subjects, aspects, attestations, state machines, twin models…), the AST-command architecture (exact undo/redo vs 500 whole-model snapshots), the Code editor (PRL text) |
| Canvas engine (react-flow, drill, breadcrumbs, edges incl. self-loops) | **Beyond**: elk auto-layout (undoable), page tree, typed commands |
| Repository (Ref/Imp/Doc, filter, cards, import/export) | **Equivalent** (workspace.ts index + package open/save/check); the four-object layout collapsed into the PRL package (map profiles and workspaces ride the package) |
| Mapping core: profiles, pairs, description+justification, edit dialog | **Equivalent** (mapper.ts; MapPairDialog) |
| **Coverage calculus** (full/minimal/partial, gateway OR, inheritance) | **Beyond**: kernel-owned `computeCoverage` with authored-assertion conflict checking (C23) and visible aggregation bases — the legacy trusted the graph alone |
| Multi-reference mapping | **Beyond**: the ProfileSwitcher/badgeMap multi-map surface (the legacy exposed one active reference at a time) |
| Mapping to documents (clause statements) | **Equivalent** (DocumentView + doc-map profiles targeting statement URNs) |
| Automap (suggestions) | **Equivalent class, different engine**: name+structural similarity with the scale budget (the legacy had no similarity engine; its automap is the logical inference below) |
| Model diff (facet changes) | **Equivalent or beyond** (diff-view.ts facet-level over every construct; the legacy diffed 12 types) |
| Edition management | **Beyond**: edition tiers, labels, release notes (the legacy had no release machinery) |
| Measurement (expressions, evaluation, view profiles) | **Equivalent** (measurement panel + kernel runtime; the legacy's parser/evaluator/branch-walker are the kernel's ancestors) |
| Simulation (interactive walk) | **Equivalent** (simulator + simulation pane) |
| Search (model-wide, jump) | **Equivalent** (tree filter + navigation) |
| Table editing | **Equivalent** (TableInspector; CSV import/export — verify) |
| Check (validation) | **Beyond**: the kernel checker through the panel (the legacy validated IDs on parse) |
| Live domain dashboards (PAS2060/ISO27001) | **Platform-covered**: the smart app's monitor plane (the legacy's were mock-fed) |

### The gap register (sized)

| # | Legacy feature | Size | Notes |
|---|---|---|---|
| **G1** | **Transitive/inherited automap inference** — the Auto Mapper's logical engine: bridges + destinations, process-level transitivity, subprocess inheritance, discovery report | **M** | `mapAI`-class logic over composed profiles; the Studio already holds multi-ref profiles — the engine is pure computation + a dialog |
| **G2** | **Repo map** — the recursive model-level mapping graph view | **S** | workspace index + profiles → a canvas view |
| **G3** | **MappingDiff on reference update** — re-plot the map vs the old edition's map, new/deleted/changed styling | **S** | the pieces exist (profiles + diff styling) |
| **G4** | **Report templates** — Liquid over `{map, raw, imodel, rmodel}` → documents | **M** | the certificate/report plane overlaps; the smart side has print projections — decide the seam first |
| **G5** | **Adopt-from-reference** — element-level ModelImport cascade (process + registries + roles + refs + subprocess + vars, deduped) with DnD from the reference canvas | **M** | the composition-era analogue: copy-up exists for TERMS (layers.ts); generalize to the element kinds |
| **G6** | **Edition-compare browsing** — base↔compared switch with navigation recompute | **S** | over diff-view + edition tiers |
| **G7** | **Checklist self-assessment** — progress fixpoint, gate any-path, donut gauge | **M** | the package plane has testReportChecklists; the interactive pane is editor-side |
| **G8** | **Link Analyser** — cross-model link graph | **S** | links exist in PRL; the graph view does not |
| **G9** | **Registry summary** — input/output/records usage navigation | **S** | DataRegistry panel extension |
| **G10** | **Provision summary export** — JSON/XML/CSV by ref/clause/actor/modality | **S** | CompliancePanel export |
| **G11** | **Document import** — XML/BSI/NISO-STS → document; AI-translate doc→model | **M** | the platform's conversion pipeline (r60-lml) superseded the translate path for real content; the paste-XML import remains useful |
| **G12** | **Knowledge graph / NLP** — CoreNLP triples + NL questions | **L** | external service dependency; lowest value today — recommend NOT porting |
| — | Figures/multimedia editing (image/video in-model) | **S** | PRL has a figures register; no figure inspector |

### The verdict on the named areas

- **Implementation/reference mapping**: core parity HOLDS (pairs,
  justification, multi-ref, doc mapping) and coverage is BEYOND
  (kernel-owned, conflict-checked). Missing: the inference engine
  (G1), the repo map (G2), update impact (G3), report templates (G4).
- **Referencing / building models**: BEYOND (the whole PRL language
  vs 12 element types; packages as the unit; the kernel checker).
- **Adopting new reference models**: PARTIAL. The architecture moved
  (editions + pins + overlays + copy-up), the diff machinery is
  finer — but the interactive adopt cascade (G5) and the
  edition-compare browsing (G6) do not exist.

## The recommended wave order

G1+G2+G3 (the mapping reasoning trio — they compound), then G5+G6
(the adoption pair), then G7–G10 as surface work, G11 opportunistically,
G12 declined.
