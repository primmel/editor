# 26 — The R 7 tutorial model (Clinical thermometers, in Primmel) ✅ DONE (910f889)

**Wave:** program · **Depends on:** 17 · **Priority:** P0

## Goal

The second OIML Recommendation modelled end to end — **OIML R 7
(1979): Clinical thermometers (mercury-in-glass, with maximum
device)** from `~/src/mn/mn-samples-oiml/sources/r007-e79/` — as the
worked tutorial for "how to model a Recommendation in Primmel": a
complete, kernel-validated `.prl` package, authored WITH the Studio
(dogfooded: every construct editable in the UI), paired with the
smart-r60 classroom as the dual demo (two instruments, one
methodology).

## Spec — `demo/r7-clinical-thermometer/model.prl` (this repo):

- **The subject** `ClinicalThermometer` — the IS/HAS/DOES anatomy
  from the document: IS identity (mercury-in-glass, solid stem,
  maximum device, scale range 35–42 °C) + design parameters
  (MPE table per range); HAS attributes (graduation & numbering,
  inscriptions, space for stamping) + characteristics (error of
  indication); DOES behaviors (indicate temperature, hold the
  maximum reading, be verified at scale points).
- **Requirements** (the normative clauses with clause-URN provenance,
  `source: { doc: urn:oiml:pub:r:7:1979, clause: "…" }`): MPE limits
  (+0.1/−0.15 °C class shapes from the document's actual table),
  construction, graduation, inscriptions, the maximum device.
- **Conformance tests**: determination of errors of indication (the
  scale-point procedure), the maximum-device test, the coloration
  test, the materials test — each with acceptance criteria citing the
  MPE table.
- **Forms**: the test-report skeleton (the error table per scale
  point + the maximum-device verdict).
- **The process/canvas layer**: the verification workflow as a
  process model (receive → visual examination → error determination
  → maximum-device test → verdict), simulatable (13's stepper).
- **Validation**: the kernel's `validate` is clean; the OIML plugin's
  certificate preview renders the subject; the document mapping
  maps the model to the R 7 presentation XML's statements (the
  provenance made visible — a `map_profile urn:oiml:pub:r:7:1979`).

## Homes

1. `demo/r7-clinical-thermometer/model.prl` (+ `README.md`).
2. `src/lib/__tests__/r7-tutorial.test.ts` (the package validates;
   the doc-map profile's targets resolve against the parsed document).

## Acceptance

- The package loads (strict), validates clean, simulates to a verdict
  in the Studio's stepper, previews as a certificate.
- The doc-map: ≥10 statement pairs resolve against the parsed R 7
  presentation XML (the document-model lib from 10).
- Gates green.
