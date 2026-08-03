# 30 — The Studio user guide (the audience manual) ✅ DONE (107eaa4)

**Wave:** docs · **Depends on:** all product items · **Priority:** P0

## Goal

The Studio's own heavy documentation, organized by audience with
instructions for every surface — the gap between "the features exist"
and "a person can learn to use them without reading code". Every page
is honest to the shipped app (the e2e legs prove the flows the pages
describe) and every diagram is an SVG in the repo.

## Spec — `docs/` in this repo:

- `docs/README.md` — the audience map: who are you? (first-timer /
  modeller / compliance engineer / OIML author / auditor / migrator /
  developer / educator) → your page and your first hour.
- `docs/quickstart.md` — the first 15 minutes: boot, the four
  projections, create → edit → save (the capability walk in prose).
- `docs/the-workspace.md` — every surface with its rules: the topbar
  (views, validation badge, New/Save/Import), the palette, the model
  tree, the page tree, the canvas (drag/connect/refusals/tabs/
  breadcrumbs/tints/badges), the inspectors, the code editor
  (completion + markers), comments, measurements, simulation,
  validation.
- `docs/modelling.md` — the authoring doctrine: models (blank /
  reference / implementation), processes and facets, data registers
  and dataclasses (the HAS axis, the data section), subprocess pages,
  variables and measurements.
- `docs/mapping.md` — the mapping doctrine: the MapProfile shape,
  pairs with meta, multi-target, the KERNEL coverage calculus (the
  four levels, the tints, aggregation, the C23 conflict), the
  multi-reference lens + seeding, automap (suggestions + provenance),
  document mapping with clause URNs.
- `docs/review-and-save.md` — the model-diff view, the save preview
  (review-before-commit, download vs write + .bak), the dirty
  discipline, comments, the validation surface.
- `docs/importing-legacy.md` — the MMEL import: what converts (the
  ten-file corpus proven), the renames (measurement/subprocess/view),
  the v2 comment forms, the report, the after-import checks.
- `docs/authoring-oiml.md` — the Recommendation author's guide:
  subject anatomy (IS/HAS/DOES with the R 7 tables), requirements
  with clause URNs, conformance tests + forms, the doc map, the
  certificate preview — deepening the R 7 tutorial into a manual.
- `docs/glossary.md` — the terms: Primmel vs MMEL spellings,
  IS-HAS-DOES, MapProfile, coverage levels, SSOT, the ephemeral
  stores.
- `docs/diagrams/*.svg` — the workspace layout, the four projections
  (command loop), the mapping overlay (two canvases + edges), the
  audience flow (who uses what), the mapping lifecycle
  (suggest → confirm → coverage).

## Homes

1. `docs/` (this repo) + the diagrams.
2. A link check: every command and testid named in the guide exists
   in the shipped app (grep-verified in the docs test).

## Acceptance

- The guide builds as plain markdown; every surface named exists
  (a test greps the guide against the app's testids/routes).
- The diagrams render (SVG well-formed, referenced).
- Gates green.
