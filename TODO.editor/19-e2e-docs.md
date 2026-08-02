# 19 — e2e + the docs set ✅ DONE (cebf38f)

**Wave:** polish · **Depends on:** the waves it covers · **Priority:** P1

## Goal

The Studio is provable and documented: the e2e legs for each wave
(drive the app through the MMEL extension's core workflows), and the
documentation (the Studio chapter in the architecture site, the
README, the AGENTS entry, the federation volume link).

## Spec

- **e2e** (`e2e/` in this repo — the puppeteer harness like the
  smart repo's):
  1. create a process on the canvas, edit its facets, serialize —
     the PRL text contains them.
  2. map a REF and an IMP model with coverage overlay visible.
  3. import the PAS2060 legacy file — the model renders.
  4. the OIML layer: open R 60, the certificate preview shows.
- **Docs**:
  - `docs/architecture/21-primmel-studio.md` (the smart repo) — the
    Studio chapter (what it is, the four projections, the plugin
    seam, the MMEL lineage).
  - This repo's `README.md` — the feature map + the gates.
  - `CLAUDE.md` — the agent entry (updated with the final structure).
  - The federation link from primmel-smart-docs (the primmel volume
    gains the Studio note).

## Homes

1. `e2e/` (this repo) — the four legs.
2. `~/src/oimlsmart/smart/docs/architecture/21-primmel-studio.md`.
3. `README.md`, `CLAUDE.md` (this repo).

## Acceptance

- The four e2e legs green against `npm run dev`.
- The docs build everywhere; the freshness gates pass.
- All item files in TODO.editor carry their ✅ + commit ids.
