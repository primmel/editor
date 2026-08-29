# AGENTS.md — Primmel Studio

Guidance for agent sessions working in this repository.

**What this is:** Primmel Studio — the authoring tool for the Primmel
modelling language (PRL v3): the full port of the Paneron MMEL
Editor/Viewer/Mapper onto the Primmel v3 kernel, with OIML SMART as
its first program layer. Vue 3 + Vite + Pinia, TypeScript throughout.

**The docs map:** the audience manual is [`docs/`](docs/README.md)
(quickstart → workspace → modelling → mapping → review → importing →
authoring OIML → glossary, with 15 teaching SVGs). The laws and the
gotchas are in [CLAUDE.md](CLAUDE.md). The capability contract is
[TODO.editor/VALIDATION.md](TODO.editor/VALIDATION.md); the audit
report is [TODO.editor/AUDIT.md](TODO.editor/AUDIT.md). The work
program's history is `TODO.editor/00–36` (all landed).

## Command gates (all must stay green)

```
cd ~/src/primmel/editor && npx vue-tsc --noEmit
cd ~/src/primmel/editor && npx vitest run           # 228 tests
cd ~/src/primmel/editor && npm run build            # typing gate + vue-tsc + vite build
cd ~/src/primmel/editor && ./e2e/run-all.sh         # 25 legs, needs npm run dev on :5173
```

## The laws

1. **The AST is the single source of truth** (`stores/model.ts`).
   Every mutation is a typed **Command** (`src/lib/commands.ts`,
   apply + revert) through `modelStore.execute`. Undo/redo is exact.
2. **The kernel owns the semantics.** Parsing, serialization, the
   coverage calculus, model-diff, the type vocabulary — import from
   `@primmel/primmel`, never reimplement. Bridges live in `src/lib/`.
   The kernel is the PUBLISHED package (`^1.8.0`, the package-load API:
   `loadPackageWithProvenance` + `groupBySourceFile`).
3. **Programs plug in, they don't branch the kernel.** The registry
   (`src/plugins/`) carries program conveniences; `activePlugins(model)`
   decides.
4. **Projections, one store.** Computeds that read the AST key on
   `modelStore.version` (commands mutate in place); computeds that
   derive PRIMITIVES from the AST read version DIRECTLY (chained off
   an identity-stable computed they never re-fire).
5. **Ephemeral stays ephemeral.** Simulation registers, measurement
   run values, mapping rejections — their own stores, never the AST.
6. **No `as never` / `as unknown` for kernel shapes** — the fix is
   always the type export upstream; the typing gate
   (`scripts/audit-typing.mjs`, R1–R6) runs in the build and also
   covers: no lazy `any`, no duck-typing dispatch, module boundaries
   only, no require-style loads, one home per seam.
7. **The viewport cull is the frame budget** — render work is bounded
   by what's visible; scorer work is budgeted by a cheap pre-score.

## Layout

```
src/
├── stores/        model (AST+history, the package session), ui, mapping, diff, simulation, measurement
├── lib/           pure logic: commands, render, layout, edges, pages, factory,
│                  mapper, multi-map, coverage, automap, diff-view, simulator,
│                  comments, measurement, document-model, mmel-import, save,
│                  package (the package-API bridge), package-save (the per-file
│                  write plan), monaco-language, monaco-prl, templates,
│                  validation (+ __tests__)
├── components/    ProcessCanvas, ModelTree, PageTree, PalettePanel, CodeEditor,
│                  ElementInspector + inspectors/ + fields/, mapper/, diff/,
│                  simulation/, comments/, measurement/, validation/,
│                  ImportPanel, SavePanel, NewModelDialog, OpenPackageDialog
├── plugins/       the registry (types, index) + oiml/ (the first program)
└── App.vue        the workspace shell + the dev/e2e window.__stores hook
demo/              the R 7 tutorial model (the dual demo with smart-r60)
docs/              the user guide + diagrams
e2e/               the puppeteer legs + run-all.sh
scripts/           audit-typing.mjs (the typing gate), save-api-guard.ts,
                   package-api-guard.ts + package-open.ts (the package API)
```

## The dev/e2e hook

In dev builds the stores sit on `window.__stores` (`model`, `ui`,
`mapping`, `diff`) and the Monaco instance on `window.__editor` — the
e2e probes read the AST directly instead of spelunking the DOM. Never
in production builds. Corpus texts travel from node in the probes —
fetching fixtures through the dev server can reload the page
mid-evaluate.

## Rules of engagement

- Run the gates before declaring a change done.
- Do not commit or perform other git mutations unless explicitly asked.
- The kernel is upstream: type gaps are fixed in `primmel-ts`
  (export the type), never worked around in the editor.
