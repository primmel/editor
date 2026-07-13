# Primmel Editor

Browser-based model editor/viewer for the Primmel modelling language.
Successor to the Paneron SMART extension.

## Stack

- Vue 3 + Pinia (state management)
- Vite 8 (build tool)
- Tailwind 4 (styling)
- @primmel/primmel (parser)
- Monaco Editor (planned — code editing with syntax highlighting)

## Architecture

See TODO.migrate/03-build-primmel-editor.md in primmel.github.io for
the full component breakdown.

## Dev

```bash
npm install
npm run dev    # http://localhost:5173
npm run build  # → dist/
```

## Deployment

Static site — no server. Deploy to GitHub Pages or any static host.
