# Primmel Studio (editor)

The premier editing tool for the Primmel modelling language (PRL v3) —
the full port of the Paneron MMEL Editor/Viewer/Mapper onto the
Primmel v3 kernel. Runs in the browser; the dev server adds an
optional write API for direct SSOT saves.

The full feature map lives in `README.md`; the work program in
`TODO.editor/` (00–20, each file marked with its landing commit).

## Stack

- Vue 3 + Pinia + Vite, TypeScript throughout.
- `@primmel/primmel` — the published kernel (`^1.8.0`; the Studio tracks
  the v3 kernel: MapProfile, coverage, model-diff, type-expr, comments,
  the package-load API).
- Puppeteer + tsx for the e2e probes (`e2e/`).

## The laws (hold them or the app rots)

1. **The AST is the single source of truth** (`stores/model.ts`).
   Every mutation is a typed **Command** (`src/lib/commands.ts`,
   apply + revert) through `modelStore.execute`. Undo/redo is exact.
   No component writes the AST directly.
2. **The kernel owns the semantics.** Parsing, serialization, the
   coverage calculus, model-diff, the type vocabulary — import from
   `@primmel/primmel`, never reimplement. Bridges live in `src/lib/`
   (`coverage.ts`, `diff-view.ts`, `mapper.ts`, `multi-map.ts`).
3. **Programs plug in, they don't branch the kernel.** The registry
   (`src/plugins/`) carries program conveniences (the OIML SMART
   layer first). `activePlugins(model)` decides; the Studio kernel
   never names a program.
4. **Projections, one store.** Tree, canvas, code, inspector, mapper,
   diff render the same store. Computeds that read the AST key on
   `modelStore.version` (commands mutate in place); computeds that
   derive PRIMITIVES from the AST read `modelStore.version` DIRECTLY
   (chained off an identity-stable computed they never re-fire).
5. **Ephemeral stays ephemeral.** Simulation registers, measurement
   run values, mapping rejections live in their own stores — never
   the AST, never serialized.
6. **No `as never` / `as unknown` for kernel shapes.** The fix is
   ALWAYS the type export upstream (the kernel's public API is the
   only seam). Genuine runtime boundaries (the dev-only window hooks,
   the raw `_relations` parse lens) carry one comment saying so —
   everything else is a bug to fix, not a cast to write. The typing
   gate (`scripts/audit-typing.mjs`, R1–R6) runs in `npm run build`
   and also covers: no lazy `any`, no duck-typing dispatch, module
   boundaries only, no require-style loads, one home per seam.
7. **The viewport cull is the frame budget.** Render work is bounded
   by what's visible; scorer work is budgeted by a cheap pre-score
   (the automap's edit distance runs only for token-competitive
   candidates). The scale proof (`e2e/scale-smoke.ts`) holds the
   numbers.

## Layout

```
src/
├── stores/        model (AST+history), ui, mapping, diff, simulation, measurement
├── lib/           pure logic: commands, render, edges, pages, factory,
│                  mapper, multi-map, coverage, automap, diff-view,
│                  simulator, comments, measurement, document-model,
│                  mmel-import, save (+ __tests__ for all)
├── components/    ProcessCanvas, ModelTree, PageTree, PalettePanel,
│                  inspectors/, fields/, mapper/, diff/, simulation/,
│                  comments/, measurement/, ImportPanel, SavePanel
├── plugins/       the registry (types, index) + oiml/ (the first program)
└── App.vue        the workspace shell + the dev/e2e window.__stores hook
```

## The gates (run before declaring done)

```bash
npx vue-tsc --noEmit
npx vitest run
npm run build
./e2e/run-all.sh     # needs npm run dev on :5173
```

## Gotchas that bit us (don't relearn them)

- **`standard.root` is the id marker**, the root page's content lives
  in `pages`. `pageOf()` in commands.ts handles it.
- **Process `page` is a COPY** (the resolver strips `_relations`) —
  page identity is by id, never by object. `renamePage` updates both.
- **Vue's select race**: `:value` on a select patches before freshly
  created options exist → the browser resets to ''. Use `v-model`
  with a computed (it sets value after the full patch).
- **Canvas labels truncate** (`labelText` in ProcessCanvas) — e2e
  probes must match the truncated form or use `data-node-id`.
- **e2e + tsx**: named functions/methods inside `page.evaluate` get
  `__name()` injected — it doesn't exist in the browser. Pass the
  evaluate as a STRING for those.
- **Template literals eat `\s`/`\d`** in e2e regexes — write `\\s`.
- **The kernel's browser bundle** (`dist-browser/index.mjs`) has its
  OWN entry (`src/ser-des/index.ts`) — a runtime export missing there
  silently drops from the browser build. Rebuild both bundles.
