# 02 — The canvas engine: drag, connect, pages

**Wave:** foundation · **Depends on:** 01 · **Priority:** P0

## Goal

The process canvas as the MMEL extension had it: nodes dragged from
the palette or within the canvas, edges connected by dragging
port-to-port, subprocess pages navigable — all editing through the
command layer, layout assisted but user-positionable.

## Spec

- **The canvas** (`components/ProcessCanvas.vue`, extended from the
  existing SVG pan/zoom): node drag (pointer events → position
  command), edge creation (drag from node edge anchor → target),
  edge selection + condition editing, subprocess navigation
  (double-click enters, breadcrumb back), data-link rendering
  (data nodes ↔ process nodes, dashed).
- **Layout**: the existing BFS auto-layout (`lib/layout.ts`) as the
  initial arrangement + "auto-arrange" action; user positions persist
  on the nodes (the AST's layout facet if present, else canvas-local
  state keyed by element id).
- **The node shapes**: per element kind (process box, approval
  diamond-ish, dataclass cylinder-ish, registry, events (start/end/
  timer/signal circles), gates, subprocess (framed page)) — one
  component per kind in `components/canvas/`, SVG, house palette.
- **Performance**: virtualized rendering at ≥500 nodes (SVG group
  culling outside the viewport); no full re-render per pointermove
  (drag state in local refs, one command on release).

## Homes

1. `src/components/ProcessCanvas.vue` — the shell.
2. `src/components/canvas/{ProcessNode,ApprovalNode,DataClassNode,
   RegistryNode,EventNode,GateNode,SubprocessNode,EdgePath}.vue`.
3. `src/lib/edges.ts` — the edge/connect logic (pure, tested).
4. `src/lib/layout.ts` — the arrangement (extended, tested).

## Acceptance

- Create an edge by dragging port-to-port (command recorded, AST
  gains the edge with its condition).
- Move a node (position persists across reloads of the same session).
- Enter/exit a subprocess page (breadcrumb correct).
- 500-node model pans/zooms at 60fps (the viewport cull).
- Gates green + a canvas interaction test (jsdom events → commands).
