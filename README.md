# Primmel Studio

The premier editing tool for the Primmel modelling language (PRL v3) —
the full port of the Paneron MMEL Editor/Viewer/Mapper lineage onto
the Primmel v3 kernel: canvas drag/drop/connect, inspectors, data
modelling, subprocess pages, the reference⇄implementation mapper with
the kernel's coverage calculus, multi-reference lenses, document
mapping, automap, model-diff, simulation, comments, measurements,
legacy import, and the honest save.

## Run

```bash
npm install
npm run dev        # http://localhost:5173
```

## The doc map (audiences → their page)

- **The user guide** — [`docs/`](docs/README.md): the audience manual
  (quickstart, the workspace, modelling, mapping, review & save,
  importing legacy, authoring OIML, glossary) with 15 teaching
  diagrams in `docs/diagrams/`.
- **The Primmel product site** — [primmel.github.io/docs/studio](https://primmel.github.io/docs/studio)
  for the language audience (publishers, implementers, auditors).
- **The OIML SMART site** — [oimlsmart.github.io/docs/guides/primmel-studio](https://www.oimlsmart.org/docs/guides/primmel-studio/)
  for the metrology audience (authoring a Recommendation).
- **The architecture chapter** — [docs/architecture/21-primmel-studio.md](https://github.com/oimlsmart/smart/blob/main/docs/architecture/21-primmel-studio.md)
  in the smart repo.
- **The federation volumes** — [platform ch.08](https://primmel.github.io/primmel-smart-docs/platform/08-primmel-studio/)
  and [learn Tier 5 — the dual demo](https://primmel.github.io/primmel-smart-docs/learn/05-the-dual-demo/).
- **The R 7 tutorial** — [`demo/r7-clinical-thermometer/`](demo/r7-clinical-thermometer/README.md):
  a complete OIML Recommendation modelled with the Studio, dual-demo
  with the smart-r60 classroom.
- **Developers/agents** — [CLAUDE.md](CLAUDE.md) (the laws + gotchas).

## The gates

```bash
npx vue-tsc --noEmit     # type check
npx vitest run           # unit tests (213 tests)
npm run build            # the production build
./e2e/run-all.sh         # 24 e2e legs against the dev server (E2E_BASE overrides the port)
```

## Embedding

```ts
import { mount } from '@primmel/editor';

mount('#app', {
  initialText,          // the .prl text to open (optional)
  brand: { name, sub, logoUrl },  // the consumer's wordmark (optional)
  readOnly: true,       // the viewer mode (optional)
});
```

`readOnly: true` mounts the **viewer**: the store refuses every
mutation (commands, code-editor writes, format, undo/redo) and the
editing chrome (palette, New/Save/Import, inspector editing) hides;
the tree, canvas, code view, mapping lenses, diff view and validation
badge stay. Pages whose canvas components carry no authored layout get
an in-memory `autoLayout` pass on load — never persisted back. The dev
harness previews it at `http://localhost:5173/?readonly`.

## The architecture, in one paragraph

The AST is the single source of truth (`stores/model.ts`). Every edit
is a typed **Command** (`src/lib/commands.ts` — apply + revert; undo/
redo is exact, never a re-derive). Tree, canvas, code, inspector,
mapper, diff are **projections** of that one store. The **kernel**
(`@primmel/primmel`, the local `primmel-ts` package) owns ALL
semantics — parsing, serialization, the coverage calculus, model-diff,
the type vocabulary; the Studio bridges, never reimplements. Program
layers plug in through the **plugin registry** (`src/plugins/`) — the
OIML SMART layer is the first; a second 〈scope〉 SMART plugs the same
way. The kernel never names a program.

## The feature map (TODO.editor/)

| Area | Where | What it does |
|---|---|---|
| model core | `src/stores/model.ts`, `src/lib/commands.ts` | the AST + the command layer (undo/redo, dirty discipline) |
| canvas | `src/components/ProcessCanvas.vue`, `src/lib/render.ts`, `src/lib/edges.ts` | drag/connect/pages, the connection discipline, select mode, tints, badges |
| palette | `src/components/PalettePanel.vue`, `src/lib/factory.ts` | create elements (+ the program section from plugins) |
| inspectors | `src/components/inspectors/`, `src/components/fields/` | per-type property editors (process, approval, event, gateway, subprocess, dataclass, registry, enum) |
| subprocess pages | `src/lib/pages.ts`, `src/components/PageTree.vue` | the page hierarchy, breadcrumbs, rename, orphan audit |
| mapper | `src/components/mapper/`, `src/lib/mapper.ts` | REF⇄IMP pairs over the v3 MapProfile (multi-target, meta dialog, party lists) |
| coverage | `src/lib/coverage.ts` | the KERNEL's calculus as canvas tints + tooltips + the C23 conflict marker |
| multi-reference | `src/lib/multi-map.ts`, `src/components/mapper/ProfileSwitcher.vue` | the lens per reference namespace; the seed with the review list |
| document mapping | `src/lib/document-model.ts`, `src/components/mapper/DocumentView.vue` | Metanorma XML → clauses/paragraphs/statements with URNs; map statements like elements |
| automap | `src/lib/automap.ts`, `src/components/mapper/AutoMapPanel.vue` | ranked suggestions (name + structure), confirm with provenance, kernel closure proposals |
| model-diff | `src/lib/diff-view.ts`, `src/components/diff/DiffView.vue` | the kernel's diffStandards with facet before/after + the status-tinted canvas |
| simulation | `src/lib/simulator.ts`, `src/components/simulation/SimulationPanel.vue` | the token walk with registers + conditions; ephemeral, never model content |
| comments | `src/lib/comments.ts`, `src/components/comments/CommentPanel.vue` | threaded review notes (the kernel's `comment` construct) with the canvas badge |
| measurements | `src/lib/measurement.ts`, `src/components/measurement/MeasurementPanel.vue` | the validate_measurement facet as value rows with verdicts + the result formatter |
| legacy import | `src/lib/mmel-import.ts`, `src/components/ImportPanel.vue` | the v1/v2 .mmel corpus home (PAS2060/ISO 27001 proven) with the honest report |
| OIML layer | `src/plugins/oiml/` | the program palettes (requirement/test/form/instrument) + the certificate preview |
| save | `src/lib/save.ts`, `src/components/SavePanel.vue` | review-before-commit diff, download or write-to-file (.bak), dirty discipline |

## The dev/e2e hook

In dev builds the stores sit on `window.__stores` (`model`, `ui`,
`mapping`, `diff`) — the e2e probes read the AST directly instead of
spelunking the DOM. Never in production builds.

## The MMEL lineage

The Studio ports the Paneron MMEL extension's feature set (the
extension zip of 28 Jan 2022) onto the Primmel v3 kernel. The legacy
.mmel corpus (PAS2060, ISO 27001 plugins, the Demo models) parses
natively — Primmel v3 is the descendant; the import panel reports the
two canonical renames (`measurement` → `variable`, `subprocess` →
`canvas` page blocks) and anything with no v3 home.
