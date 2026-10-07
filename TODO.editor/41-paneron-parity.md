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

**The substrate decision (the owner's direction, 2026-10-06)**:
Paneron's host runs datasets on **isomorphic-git** — the extension
only ever sees the kit's DatasetContext, and the host translates
`updateObjects` into git commits. That makes git the *proven
substrate* for exactly this class of data plane, and using it in the
Studio is not wrong — it is the sanctioned shape. The save API (the
dev server, Node) gains isomorphic-git: the package directory is the
work tree; each save is `add` + `commit` with the save's message
(generated when absent); the G13 instance store rides as ordinary
package files, so its commit-atomicity and change record come free;
history/diff come from git; branches/tags per edition give G6/G15 a
substrate; push/pull to a remote is the sync story (never automatic).
The `.git` dir is invisible to the kernel loader and the bake (dot
entries are skipped), and an already-git package is REUSED, never
re-initialized; nothing pushes without instruction. The browser-side
option (LightningFS) stays open for a fully-client mode later.

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

---

# The rename contract (MMEL v2 → Primmel) — the audit's basis, restated

The owner's correction (2026-10-06): the extensions were renamed
INTENTIONALLY — MMEL v2 became Primmel (.mmel → .prl, construct
spellings where needed) to DISTINGUISH FORMAT AND USAGE — under the
contract: **retain all semantics, improve on them**. The first pass's
"more element types" framing was the wrong lens: the type-count
difference is the ADDITIVE extension vocabulary (MN 113-6…113-10),
not changed semantics. The kernel encodes the contract literally
(ser-des/config/index.ts): *"MMEL 0.1 spec-parity parsers/dumpers"*
for the retained core, *"Primmel extension parsers/dumpers (MN
113-6 to 113-10)"* for the additions, and legacy spellings aliased
(*"`view` is the legacy (MMEL v2) spelling of the view-profile
block"*). The map format accepts BOTH markers
(`KNOWN_TYPES = { MMEL_MAP, Primmel_MAP }`) — legacy profiles load
as-is.

## The correspondence (verified in the corpus + kernel)

| MMEL v2 | Primmel | Retention |
|---|---|---|
| `.mmel` | `.prl` | the format/usage rename |
| brace-block text DSL | the same DSL | retained — the kernel parses it as the spec-parity set |
| `root` / `metadata` | the package manifest (+ the root page) | owned by the manifest |
| `process` | `process` (+ `page` = subprocess) | retained; the `subprocess` command became the page facet |
| `approval` | `approval` | retained |
| `exclusive_gateway`, `start_event`, `end_event`, `timer_event`, `signal_catch_event` | the same spellings | retained verbatim |
| `class` (+ the `#data` convention) | `class` (`X#data`) | retained verbatim |
| `data_registry` | `data_registry` (processes cite `reference_data_registry`) | retained |
| `measurement` (DATA/LISTDATA/TEXT/DERIVED/TABLE) | `measurement` (r60-lml: 20 declarations) | retained |
| `provision` | provisions + the requirements plane | retained and extended |
| `role` | `role` | retained |
| `note`, `term`, `table`, `figure`, `link`, `enum` | the same spellings (r60-lml: term ×85, note ×6, table ×3) | retained verbatim |
| `reference` | `ref derives-from` (URN targets) | retained, retargeted to URNs |
| `view` | `view_profile` — the legacy spelling ALIASED | retained via the kernel alias |
| `subprocess` | `process.page` | retained, representation |
| `MMEL_MAP` (JSON) | MapProfile — both markers load | format-compatible |
| `MMEL_WORKSPACE` (`.sws`) | G13's instance store (to build, on the git substrate) | the open gap |
| `validate_provision` / `measure` | the same facets (conduct_tests shows both) | retained |
| — no counterpart | the Primmel extensions (requirements, conformance, subjects, verdicts, symbols, forms, calculations, state machines, quantity registers, …) | additive vocabulary |

**The improvements already verified in this audit**: the checker's
C-rules (the legacy validated IDs on parse), the coverage calculus
with authored-assertion conflicts, packages + composition (vs the
4-object dataset), editions and pins, the runtime, and the
provider-scoped KNOWN register.

**The audit restated under this lens**: "building models — beyond
parity" meant the EXTENSION vocabulary edits on top of a RETAINED
MMEL core — never renamed-away semantics. The retention guarantee is
the kernel's spec-parity parser set + the round-trip gate; the
semantic-retention risks worth pinning as specs: the measurement
expression operator set (the legacy's `[var]`/`.sum/.max/.min/.count/
.average`/comparators — the TODO.update-specs/03 conversion covers the
guide side; the operator table deserves the same pinning), the egate
default/empty edge semantics, and the registry↔dataclass pairing
invariants.

## The retention proof (the mechanical test, 2026-10-06)

The definitive check for "retain all semantics": feed the ENTIRE
legacy corpus through the kernel. Result (TODO.editor/15's importer,
the honest report):

- **38/38 `.mmel` files parse natively** — the models (BS 20400
  reference/implementation/(mapped), ISO 27001, 14971, MDSAP, HLS,
  dptm, acme, QMS, the artificial/model-diff/knowledge-graph/link
  fixtures, the PAS 2060 geo models, the showcase) — **0 validation
  issues, 0 unknown keywords** (every legacy top-level keyword has a
  v3 home).
- **The measured rename table** (corpus totals, not guesses):
  `measurement → variable` ×113 · `subprocess → canvas` ×802 ·
  `view → view_profile` ×9. Everything else parses under its MMEL
  spelling verbatim.
- **One real gap found and fixed**: the corpus's mapped fixture
  serialized inline mappings in the v2 two-line form
  (`from <id>` / `to <id>`); the parser accepted only the arrow.
  Now aliased exactly like `view` (kernel PR #105; round-trips to
  the canonical arrow; a source literally named `from` still parses
  in arrow form) — with a spec pinning it.

The retention guarantees, restated as machinery: the kernel's
"MMEL 0.1 spec-parity" parser set, the aliased legacy spellings
(`view`, now the from/to mapping form), the dual map markers
(`MMEL_MAP`/`Primmel_MAP`), and this corpus test as the standing
regression (it belongs in CI as the rename-contract gate).

---

# The unwrapBlock sweep (2026-10-07): the defect class measured and closed

The `stripWrapping`-vs-`unwrapBlock` mangling class (two instances
found by accident: `view`, `condition default`) was never swept
systematically. The instrument: `unwrapBlock` itself, patched to
record every call whose token is not actually quote/brace-wrapped,
run over **every `.mmel` and `.prl` file in both repositories —
594 files**.

- **3,446 distinct hits** — and **3,445 are whitespace-benign**
  (double-strips of block content whose first/last chars are
  newlines/spaces; the inner parsers re-tokenize whitespace away).
- **Exactly ONE hit destroys non-whitespace characters**: a
  bracketed list item (`[qms-manager]` → `qms-manager`) — a
  bracket-strip that IS the intended read.
- Conclusion: `condition default` was the only damaging instance in
  real content (fixed in 1.21.6). **The class is closed with
  evidence, not assumption.**

## The format dispositions (the last two never-tested)

- **`.sdc` clause documents** — the format is trivial
  (`namespace#…` / `title#…` / `version#…` / `###` / `n#statement`);
  the Studio's DocumentModel has the statement machinery but NO
  importer. **Folds into G11** with the format spec'd above.
- **The legacy JSON in `13485 (for diff)/`** — the `2016/2021.json`
  files are **MAP profiles** (`MMEL_MAP`: mapSet/docs), not models —
  they already load via the dual-marker compatibility. The MODEL-JSON
  shape (`MMELToSerializable`) was Paneron's internal storage,
  superseded by the PRL package — **documented disposition: not a
  retention obligation** (the `.mmel` text is the source of record,
  and it parses 38/38).

## The ledger, final form

| Plane | Evidence |
|---|---|
| Syntax | 38/38 corpus, 594/594 overall |
| Renames | measured (×113 / ×802 / ×9 / verbatim) |
| Fidelity | 36/38 + one documented normalization |
| Expressions | 27/27 executable |
| Conditions | corpus-complete |
| Gateways | default + inclusive exact (parser + simulator) |
| Registry pairing | C157 enforced, library 41/41 |
| **The unwrap class** | **measured: 1 damaging case in 594 files — fixed; the rest benign** |
