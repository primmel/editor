# The validation close-out — the capability contract, proven

This document is the written proof that Primmel Studio achieves the
full capability contract: create new Primmel models (reference and
implementation), import the old MMEL corpus, do mappings with
coverage, navigate, create data registers and processes, drill in and
out, show diagrams, run execution, model a new OIML Recommendation as
the dual demo — and that validation is a surface, not a gate.

Every row names its proof. The proof commands are quoted verbatim;
the outputs are the recorded runs at the close-out commits (listed at
the end).

## The capability matrix

| # | The promise | The leg | The proof | Status |
|---|---|---|---|---|
| 1 | **Create new Primmel models** (blank / reference / implementation) | 22 + 25 leg 1–2 | `e2e/new-model-smoke.ts`, `e2e/capability-walk.ts` — three templates parse strict, boot the workspace, clean dirty flag | ✅ |
| 2 | **Import old MMEL models** | 15, 21, 24 | the ten-file corpus matrix — strict parse, pinned counts, clean validation, byte-stable dumps (`src/lib/__tests__/corpus-matrix.test.ts`) | ✅ 10/10 |
| 3 | **Do mappings** (with meta, multi-target, the overlay) | 07, 25 leg 6 | `e2e/mapper-smoke.ts` — click-pair → dialog → pair in the profile; multi-target list shape; overlay edge draws | ✅ |
| 4 | **Coverage** (the kernel's calculus, C23) | 08 | `e2e/coverage-smoke.ts` — tints match `computeCoverage` node-for-node (unit), the red conflict marker on a wrong assertion (live) | ✅ |
| 5 | **Multi-reference mapping** (the lens, seeding) | 09 | `e2e/multi-map-smoke.ts` — two lenses, swap, seed with the review list, cross-profile badges | ✅ |
| 6 | **Document mapping** (elements ↔ statements with URNs) | 10 | `e2e/document-smoke.ts` — Metanorma XML → statements, click-pair with URN targets, mapped highlights | ✅ |
| 7 | **Automap** (suggestions with provenance) | 11 | `e2e/automap-smoke.ts` — ranked suggestions, confirm lands with the honesty justification, reject never reappears | ✅ |
| 8 | **Navigate** (tree / pages / breadcrumbs / tabs) | 06, 25 leg 4–5 | `e2e/pages-smoke.ts` — create page from the inspector, descend, breadcrumb walks up, rename follows | ✅ |
| 9 | **Create data registers + dataclasses** | 05, 23, 25 leg 3 | `e2e/data-editors-smoke.ts`, `e2e/data-section-smoke.ts` — registry + dataclass + attributes; the data section placement, the data link | ✅ |
| 10 | **Create processes, drill in and out** | 03, 04, 06, 25 leg 4 | palette creates, inspector edits facets, `+ page` descends, breadcrumb returns | ✅ |
| 11 | **Show diagrams** | 02, 25 leg 5 | canvas nodes/edges render, page tabs switch, the truncation discipline documented | ✅ |
| 12 | **Run execution** (the simulation) | 13, 25 leg 7 | `e2e/simulation-smoke.ts` + the walk — token walks to completion; a gate branches on an edited register; a conditioned edge beats an earlier default from ANY node | ✅ |
| 13 | **Model a new OIML Recommendation** (R 7, Clinical thermometers) | 26 | `demo/r7-clinical-thermometer/` — subject, 5 requirements with clause URNs, 4 tests, the form, the gated workflow, the doc map; `r7-tutorial.test.ts` (6) + `e2e/r7-smoke.ts` (live: plugin, certificate with the MPE, doc map, full run) | ✅ |
| 14 | **The dual demo** (r60 classroom + R 7 tutorial) | 27 | `demo/r7-clinical-thermometer/TUTORIAL.md` + the federation learn volume Tier 5 (site builds, 97 pages) | ✅ |
| 15 | **Validation throughout** | 29 | the badge + the Validate tab + editor markers + import report + save review — `e2e/capability-walk.ts` leg 10 (flag a real kernel issue, clear on undo) | ✅ |
| 16 | **The model-diff view** | 12 | `e2e/diff-smoke.ts` — summary, facet before/after, mapping diff, status tints | ✅ |
| 17 | **Comments** | 14 | `e2e/comments-smoke.ts` — thread, badge counts, resolve, delete-subtree (the kernel's `comment` construct) | ✅ |
| 18 | **The measurement harness** | 16 | `e2e/measurement-smoke.ts` — rows from the facet, verdict chips, the formatted result | ✅ |
| 19 | **The OIML program layer (plugins)** | 17 | `e2e/plugin-smoke.ts` — no leak on plain models, palette + certificate preview on OIML models; a third plugin registers without touching the kernel (unit) | ✅ |
| 20 | **Save to SSOT with the change preview** | 18 | `e2e/save-smoke.ts` — dirty dot, diff preview (changed 1), write with .bak, dirty clears; the file parses back | ✅ |
| 21 | **The Monaco code editor** | 20 | `e2e/monaco-smoke.ts` — real worker, typed text parses into the AST, inline kernel markers, AST-driven completion, byte-clean re-render | ✅ |
| 22 | **The user guide + audience flow** | 30, 31 | `docs/` (9 pages + 15 diagrams, honesty-tested) — primmel.github.io/docs/studio (38 pages, links valid) — oimlsmart.github.io Guide 14/14 — federation platform ch.08 + learn Tier 5 | ✅ |

## The recorded runs (the close-out sweep)

```
== editor (primmel/editor @ the 28 commit) ==
npx vue-tsc --noEmit          → clean
npx vitest run                → Test Files 25 passed (25) · Tests 148 passed (148)
npm run build                 → ✓ built
./e2e/run-all.sh              → ALL E2E LEGS GREEN (22 legs + the 11-leg capability walk)

== kernel (primmel-ts) ==
yarn test                     → tests 1083 · pass 1083 · fail 0

== docs sites ==
primmel-smart-docs            → 97 pages built
primmel.github.io             → builds; all 38 pages' internal links valid
oimlsmart.github.io           → builds (Guide 14/14 included)
```

## The honest "not yet" list

What the validation surfaced as genuinely out of scope — with the
reasons, never hidden:

- **Form-field editing UI.** Forms are created and read; the form
  FIELD editor (the rc-style form builder) is not built. The form
  model round-trips through code; the dedicated builder belongs to a
  later wave with the OIML program layer's own roadmap.
- **Requirement/conformance-test inspectors.** They are created via
  the OIML palette and editable in code; dedicated facet inspectors
  (like the process/dataclass ones) are a natural plugin-panel
  extension, same registry, no kernel change.
- **Multi-file packages.** The Studio edits one `.prl` text at a
  time. Package manifests (`uses`/includes across files) load in the
  kernel; the multi-file workspace (a package explorer) is future
  work.
- **The MMEL review workflow.** The extension's change-requests /
  reviews / revisions system is covered by comments (authoring
  scratch) but not the formal review states. Deliberately deferred:
  the v3 doctrine wants review as a first-class model (proposals,
  not overlays), which deserves its own design.
- **Collaboration.** Single-user, local files (the honest browser
  posture). The dev server's write API is the only server surface.

## The commits (the close-out state)

- `primmel/editor` — the 28 commit (this file's parent).
- `primmel/primmel-ts` — the kernel through the legacy vocabulary +
  map_profile namespace + comment construct + metadata unescape.
- `oimlsmart/smart` — docs/architecture/21-primmel-studio.md.
- `oimlsmart/primmel-smart-docs` — platform ch.08 + learn Tier 5.
- `primmel/primmel.github.io` — docs/studio + audience mentions.
- `oimlsmart/oimlsmart.github.io` — Guide 14/14.
