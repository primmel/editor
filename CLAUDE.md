# Primmel Editor

Browser-based model editor/viewer for the Primmel modelling language.
Successor to the Paneron SMART extension. Runs entirely in the browser —
no server, no Electron.

## Stack

- Vue 3 + Pinia (state management)
- Vite 8 (build tool)
- Tailwind 4 (styling)
- @primmel/primmel@^1.3.0 (parser, browser-compatible)
- Monaco Editor (installed, integration planned)

## Architecture

```
src/
├── stores/
│   ├── model.ts          Model state: rawText → parsed Standard, parseError
│   └── ui.ts             UI state: selection, active canvas, zoom/pan, panels
├── components/
│   ├── ModelTree.vue     Left: tree of all model elements by type
│   ├── ProcessCanvas.vue Center: SVG diagram (pan/zoom, node rendering)
│   ├── CodeEditor.vue    Left (tab): .prl text editor + file open/download
│   ├── ElementInspector.vue Right: properties of selected element
│   └── CompliancePanel.vue  Right (tab): provisions with modality filter
├── lib/
│   ├── render.ts         Model → RenderNode/RenderEdge (SVG primitives)
│   └── layout.ts         Auto-layout (BFS level assignment)
└── App.vue               Three-panel layout with tabbed left/right
```

### State flow

```
rawText (model store)
  → load() from @primmel/primmel
  → Standard (resolved model)
  → ProcessCanvas renders active Subprocess as SVG
  → ModelTree renders element lists
  → ElementInspector shows selected element props
  → CompliancePanel lists provisions
```

### Key types from @primmel/primmel

- `Standard` — the top-level model (roles, processes, provisions, pages, events, gateways, etc.)
- `Standard['pages'][number]` — a canvas (was called Subprocess; internally still Subprocess)
- `SubprocessComponent` — { name, element: { id } | null, x, y }
- `EventNode` — eventType: 'start' | 'end' | 'signalcatch' | 'timer'
- `Gateway` — gatewayType: 'exclusive_gateway' | 'parallel_gateway'

## Dev

```bash
npm install
npm run dev    # auto port (usually 5173)
npm run build  # → dist/
npm run preview
```

## Vite alias note

The parser's `exports.browser` in 1.3.0 points to a `dist-browser/` that
isn't in the npm tarball. We alias `@primmel/primmel` to `dist/index.js`
in `vite.config.ts`. This works because `load()` and `dump()` are pure
JS (no Node APIs). Once 1.3.1 ships with the browser bundle included,
the alias can be removed.

## Deployment

Static site — no server. Deploy to GitHub Pages or any static host.
Can be embedded in primmel.org via iframe.
