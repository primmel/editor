# 27 — The dual-demo tutorial (model YOUR Recommendation)

**Wave:** docs · **Depends on:** 26 · **Priority:** P1

## Goal

The teaching artifact that pairs with the smart-r60 classroom: a
guided tutorial — "from the PDF to a live Primmel model of OIML R 7
in one afternoon" — walking the full methodology with the Studio as
the tool, linked from the federation docs as the SECOND instrument
story (dual demo: load cells learned you the method; clinical
thermometers prove you can apply it).

## Spec

- `demo/r7-clinical-thermometer/TUTORIAL.md` (this repo): the
  walkthrough — read the document (the presentation XML), extract the
  anatomy (IS/HAS/DOES with the actual R 7 tables), declare
  requirements with clause-URN provenance, derive conformance tests,
  build the verification process, simulate it, map the model back to
  the document's statements, preview the certificate. Every step
  names the Studio surface it uses (palette/inspector/mapper/
  simulation/preview) — dogfooding as pedagogy.
- The README of `demo/` — the dual-demo index: r60 (the classroom,
  six levels, the twin simulator) vs R 7 (the modelling tutorial —
  the methodology applied), when to read which.
- The federation note: primmel-smart-docs `docs/learn/` (or the
  platform volume) gains the dual-demo page with the two stories and
  the Studio loop diagram (investigate the right home first — the
  learn volume exists for education).
- The smart repo's architecture index gains the cross-link row if
  the house style wants it (check 21's pattern).

## Homes

1. `demo/README.md`, `demo/r7-clinical-thermometer/TUTORIAL.md`.
2. primmel-smart-docs: the learn/platform page + sidebar entry.

## Acceptance

- The tutorial is reproducible: every command/steps it names exists
  in the shipped Studio (verified against the app).
- The docs sites build (smart architecture + primmel-smart-docs).
- Gates green.
