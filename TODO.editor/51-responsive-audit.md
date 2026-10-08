# 51 — The responsive audit (the browser + mobile pass, 2026-10-08)

The owner's directive: a deep audit of the applications — read every
TODO* file, ensure everything works in a browser AND on responsive
mobile, finish the work.

## What the audit found

1. **Every recorded TODO item has landed** — zero open checkboxes
   across all 45 TODO.editor files (00–41 are closed work records with
   their landing commits; 41's gap register holds the demo-deferred
   waves G4 + G7–G11 + G11's doc import, named in
   50-demo-plan-2026-10-13.md; 50 is complete early). AUDIT.md and
   VALIDATION.md carry no open items.
2. **The app works in a browser — proven by the standing suite.** All
   20+ e2e legs (each a real-browser probe) passed on the frozen tree,
   plus the demo rehearsal's zero-page-error golden walk.
3. **The app has NO responsive layer at all: zero `@media` queries in
   the entire codebase.** The shell is a fixed `260px 1fr 300px`
   three-column grid; the topbar nav is a flat row; the canvas and
   dialogs assume desktop pointer + width. On a 390px phone the
   experience is broken by construction.

## The plan (the responsive layer, in landing order)

| # | Item | What | Verify |
|---|---|---|---|
| R1 | **The shell collapses** | ≤1024px: the workspace becomes one column — the canvas full-viewport; the left/right panels become slide-over DRAWERS (fixed overlays, off-canvas by default) with two toolbar toggles; the grid goes `1fr` | mobile e2e: the drawers open/close, the canvas visible |
| R2 | **The topbar scrolls** | the nav groups get horizontal overflow-x with no wrap breakage; the brand row stays fixed | mobile e2e: every tab reachable |
| R3 | **Dialogs fit** | the overlays (save, import, pair dialog, comments) cap at `min(480px, 100vw - 16px)` | mobile e2e: the save panel opens fully |
| R4 | **The canvas pans on touch** | the SVG viewport's pointer handlers already use pointer events — verify pinch/drag at minimum drags; a two-finger zoom is the stretch | manual + screenshot |
| R5 | **The demo legs hold at mobile width** | twin-smoke + workspace-data-smoke + the rehearsal run at 390×844 (puppeteer `setViewport`), not just 1400×950 | the legs pass twice: desktop + mobile |
| R6 | **The demo plan updates** | the Monday demo notes the responsive story (the studio on a phone) | — |

## The laws held during the pass

- CSS-only where possible (media queries + the existing ui store; no
  second mobile codebase).
- The desktop layout byte-identical at ≥1025px (the media queries only
  ADD behavior below the breakpoint).
- Every change rides the local gates (audit-typing, vue-tsc, vitest)
  and the browser legs; the mobile probe is a NEW standing leg.
