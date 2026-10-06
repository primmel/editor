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

---

# The deep extension (2026-10-06, second pass): data management, live APIs, the corpus

The first pass covered the editor surfaces. This pass opens the two
planes it under-described — the DATA layer and the RUNTIME/API
integrations — and inventories the model corpus the legacy shipped
with.

## The data-management layer (the registry plane)

**The schema** is MMEL's `data_registry X { data_class X#data }` (the
Studio knows this plane: RegistryInspector, DataRegistry.vue,
attributes with types/cardinality/modality).

**The data** is a separate persisted artifact — the `MMEL_WORKSPACE`
(`.sws` files; the legacy keeps one per model at `workspace/<ns>.json`):

```
SMARTWorkspace   docs[modelNamespace]           → SMARTModelStore
SMARTModelStore  store[registryId]              → SMARTDocumentStore
SMARTDocumentStore docs[rowNumber]              → SMARTDocument
SMARTDocument    { id, name, attributes: Record<string,string> }
```

- One workspace per implementation model; registries are the model's
  data_registry ids; rows are number-keyed documents.
- **The entry UI is schema-driven**: `DocumentEditor` renders the data
  class as a form — basic types (text/boolean/number via
  BasicTypeAttribute), enums (EnumAttribute), **nested data classes
  recurse with prefixed attribute keys** (`attrid#nestedid#...`), and
  **registry-reference attributes render as pickers over the OTHER
  registries' stores** — a relational foreign-key UI, all client-side
  (RegistryDocManagement is CRUD over the rows; RegistryList the
  index).
- **The consumers**: the measurement engine seeds variable values from
  the workspace defaults and view profiles; the checklist reads
  approval records and data-class attributes; the "Implementation"
  module IS this plane (the workspace + the model together).
- The corpus carries a real example: `ribose.sws` — one model
  (RiboseCrimson), one registry (TestingRegistry), one row
  ("Happy first document", attributes string/empty/boolean).
- The VIEWER links into it: registries with stores grow a
  View-data-workspace button on their canvas node.

**Studio state**: the SCHEMA side exists (RegistryInspector,
DataRegistry.vue). The INSTANCE side does not: no workspace store, no
schema-driven entry forms, no nested/cross-registry pickers, no
persisted rows.

## Running and API integration (the live plane)

Four integrations existed, all client-side, all with contracts but
only mock or local backends:

1. **The sensor aggregator** (PAS 2060): `obtainData(url)` →
   `{x, y, z, v_i, v_e}[]` readings on a 5s poll. The contract is
   real; the implementation throws for every URL except the
   hardcoded localhost mock (21 synthetic sensors across 4
   buildings). Readings flow: **3-D bounding-box assignment** (per
   emission source, boxes from imported IFC JSON / GML / ifcOWL-TTL
   polygons in `ConfigurePage`; overlaps flagged) → per-source
   Include/Exclude lists → **the measurement engine as LISTDATA
   variables** (`Included_Emission`/`Excluded_Emission`) → per-source
   pass/fail gauges, a 10-entry log with raw-JSON export, and the
   building minimap. NOTE: readings NEVER write the workspace store —
   the live feed and the human-entered registry data are separate
   planes that meet only in the evaluator.
2. **ISO 27001 monitor**: the same shape (2s poll, login/failure/
   connection counts, range-configured gauge + rolling LineChart).
3. **Metanorma**: the report generator shells the Metanorma CLI
   (`-t ribose <file> -o <dir>`) — the output dir is HARDCODED to a
   developer path; PID + stdout/stderr surfaced in the dialog.
4. **CoreNLP**: the knowledge graph POSTs provision sentences to
   `localhost:9000` and parses enhanced++ dependencies into
   subject/action/object triples (actor injected as subject, modality
   as an edge); NL questions are parsed the same way and answered by
   structural similarity over the triple graph.

**Studio state**: none of the four. The measurement panel is
manual-value; the smart platform's monitor plane covers the
dashboard class at product level.

## The corpus (what the repo's artifacts prove)

| Artifact | What it is / proves |
|---|---|
| `BS20400.mmel` + `BS20400impl.mmel` + `BS20400impl(mapped).mmel` | THE reference/implementation pair (6080 vs ~1000 lines) + a mapped variant — the workflow's flagship example |
| `13485 (for diff)/` | **Two map profiles of ISO 13485 across editions (2016 vs 2021 JSON + 2021.map + both .mmel editions)** — and the mapSet keys tell the real story: the 2016 profile maps to EU DIRECTIVES (`EU90/385/EECAnnex2-doc`, `MDSAP`), the 2021 profile to EU REGULATIONS (`Regulation(EU)2017/745Article10-doc`…) — **clause-level DOCUMENT mappings, migrated across the directive→regulation transition**. The map-diff fixture (`compare1/2.json`) rides beside them |
| `documents/*.sdc` | 13 EU directive/regulation annex clause documents (the `namespace#…`/`title#…`/`n#statement` format) — the doc-mapping TARGETS |
| `*.map` (13485, 14971, acme, QMS, ribose.map + ribosemap.json) | map profiles in the wild: multi-reference mapSets (`defaultns`, `BS13485`, `ISO14971`), document mapSets, mostly-empty mappings (the profiles are ORGANIZATIONAL scaffolds as much as data) |
| `showcase 5/` | BS 6004 reference + updated implementation + the BSI source XML + **CSV table-import fixtures** + a generated Statement-of-Applicability Asciidoc report (the Liquid pipeline's output) |
| `artificial models/` | feature fixtures: 9 link models (Links), knowledge-graph models, the map-diff pair, 3 model-diff models |
| `geo/*.json` | IFC building models (the PAS 2060 source-location imports) |
| `demo models [old]/`, `HLS/MDSAP/ISO27001/dptm/…mmel`, `RiboseImplementation.mmel` | the model corpus (38 models audited in the owner's spec program) |
| `TODO.update-specs/` | the owner's OWN completed program: the MMEL spec rewritten as 88 files/~13k lines FROM these guides and models (00-master-plan: parts 1–9 + authoring + methodology, DONE) |
| `scripts/build.rb`, root `dist/` | the spec site build |
| `testing.adoc` | a generated SoA report (the same Liquid output class) |

## The extended gap register

| # | Missing piece | Size | Notes |
|---|---|---|---|
| **G13** | **The registry data plane** — MMEL_WORKSPACE instance store + schema-driven entry forms (nested-class prefixes, enum/basic/reference-attr fields, cross-registry pickers), persisted per package, wired to the measurement/checklist consumers | **L** | the Studio has the schema side only; this is the legacy's "Implementation" module proper |
| **G14** | **The live-feed contract** — configurable aggregator URL → typed readings → LISTDATA measurement variables, polling dashboards, logs + export | **M** | decide the seam: editor-side (as legacy) vs the smart platform's monitor plane (which already covers the class) |
| **G15** | **Edition-crossed map profiles** — an implementation's mapSet per reference EDITION, document mapSets included, with the directive→regulation migration as the canonical case | **S–M** | rides G3 (mapping diff) + G6 (edition compare); the corpus fixture exists to test against |
| — | `.sdc` clause-document import into the DocumentView plane | **S** | fold into G11 (document import) |
| — | CSV round-trip for tables (import/export) | **S** | showcase 5's CSVs are the fixtures |

## The verdict, extended

The legacy's "running" story is a set of well-shaped CLIENT contracts
with mock backends (the aggregator throws for any non-localhost URL;
Metanorma's output dir is a developer's home path). The durable ideas
worth parity: (1) the registry data plane as a first-class persisted
artifact wired into measurement/checklists (G13 — the biggest true
gap), (2) the live-feed → measurement-variable contract (G14, seam
decision needed), (3) edition-crossed map profiles as the adoption
artifact (G15, riding the wave-1 items). The corpus in this repo —
especially `13485 (for diff)` — is the test-fixture set for all three.

---

# The third pass (2026-10-06): the Git substrate, the twin loop, the two processing modes

## The data-management substrate is GIT (the layer under everything)

Every write in the legacy is a **commit**: `updateObjects({
commitMessage: 'Update by Paneron', objectChangeset: { path:
{ newValue } } })` — multi-object ATOMIC changesets (a model save
commits the model + map profile + workspace + rdf + the repo index in
ONE commit). The dataset is a Git repository managed by the Paneron
host; objects are path-addressed (`/model/<ns>.json`,
`/map/<ns>.json`, `/workspace/<ns>.json`, `/rdf/<ns>.json`,
`/index.json`); the index is itself a versioned object; datasets
carry migrations; `usePersistentDatasetStateReducer` keeps per-dataset
UI state. So "data management" = **versioned, commit-atomic,
path-addressed objects** — audit history for free, external Git
tooling, clone/sync — and the `.sws` registry rows from the second
pass are just more Git objects.

The Studio's substrate differs by design: the PRL package is ONE
atomic artifact (the kernel's parse gives the determinism; the smart
platform's evidence registry gives the audit trail). The parity item
is NOT git-in-the-editor — it is G13's instance store gaining the
same *discipline*: atomic saves, a change record, an index. The
package format already provides the shape.

## Running = the digital-twin loop (measurement streams are STREAMS)

The two dashboards are not "charts" — they are the PROCESS MODEL
RUNNING as a twin, in stream mode:

```
setInterval(tick: 2s ISO27001 / 5s PAS2060)          ← the stream clock
  → obtainData(url, time)                            ← the SOURCE (time-parameterized)
      ISO27001: recurring bias WINDOWS over the tick clock
      ((time + cycle − offset) % cycle < duration ⇒ regime shift)
  → assignment (PAS2060: readings → emission sources
      by 3-D bounding box; unassigned counted)
  → testMeasurement(model, values)                   ← THE MODEL EXECUTES
      (the twin's invariants = the processes' measure
       expressions + gateway conditions; per-source
       LISTDATA variables; overall pass/fail)
  → surfaces: gauge (range-configured), rolling series
      (vs a reference line), the tick log (history),
      hasFail alert state, raw-JSON export
```

The two processing modes, made precise:

- **Data mode (at rest)**: Git-committed objects — the model, the map
  profile, the workspace registry rows, the rdf graph, the index.
  Batch consumers: coverage, checklists, summaries, reports.
- **Stream mode (in flight)**: the tick pipeline above — a
  time-parameterized source, per-tick assignment, per-tick model
  evaluation, rolling surfaces. **Measurement streams are streams**:
  the legacy's feed takes the tick time as an argument and carries
  recurring window cycles; the series is rolling; the alert is
  edge-triggered (hasFail latches until cleared).

The `measure` on processes + gateway conditions are the twin's
invariants; the log is its history; the model IS the twin. The API
contract (the configurable aggregator URL) is the twin's data source
— in the legacy always a mock, but the CONTRACT (typed readings,
per-tick, source-addressable) is the durable idea.

## Corpus additions from this pass

- `44001.xml` — a Metanorma **BSI semantic XML** (`bsi-standard`
  type=semantic): the real input shape for the XML document import.
- `dptm.sdc`, `test.sdc` — more clause documents (DPTM certification
  requirements; a testing guideline).
- `ribose.json` — another MMEL_MAP profile (the format everywhere).
- `.github/workflows/deploy.yml` — the spec site's deploy; root
  `dist/` is the built spec site.

## The gaps, reframed

- **G13 (the registry data plane)** — design note added: the instance
  store must be commit-atomic and change-recorded (the package
  format provides the shape; the parity debt is the store + the
  schema-driven forms + the pickers).
- **G14 (the live feed)** — reframed from "an aggregator URL" to the
  **tick pipeline contract**: `{ clock → source(time) → assignment →
  model evaluation → surfaces }`, with measurement streams treated as
  streams (windows, cycles, rolling series, edge-triggered alerts).
  The seam decision stands (editor-side vs the smart monitor plane),
  but the contract is now precise enough to specify against.
- The corpus fixtures for both: `ribose.sws` (data mode) and the
  two dashboards' feeds (stream mode) — plus `44001.xml` for the
  document import (G11).
