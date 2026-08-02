# OIML R 7 — Clinical thermometers (the tutorial model)

The second OIML Recommendation modelled end to end in Primmel — the
worked tutorial for "how to model a Recommendation with Primmel
Studio", paired with the smart-r60 classroom as the dual demo (two
instruments, one methodology).

**The instrument:** OIML R 7 (1979) — *Clinical thermometers
(mercury-in-glass, with maximum device)*.

## What's here

- `model.prl` — the complete package, kernel-validated with zero
  issues:
  - **the subject** `ClinicalThermometer` — the IS/HAS/DOES anatomy
    (identity + design parameters incl. the MPE table; exhibited
    attributes + the error-of-indication characteristic; the three
    behaviors);
  - **5 requirements** — every normative clause with its clause URN
    (`source: { doc: urn:oiml:pub:r:7:1979, clause: "…" }`);
  - **4 conformance tests** — the A.3 bath comparison, the A.4
    maximum-device test, the A.5 coloration test, and the visual
    examination, each with preconditions, procedures, and acceptance
    criteria;
  - **the test-report form** — the evidence skeleton;
  - **the verification workflow** — a simulatable process with two
    gates: the clause-8 ambient-validity gate (15–30 °C) and the
    MPE gate (+0.1/−0.15 °C);
  - **the doc map** (`map_profile urn:oiml:pub:r:7:1979`) — the model
    mapped back onto the document's statements, the provenance made
    visible.
- `document.presentation.xml` — the source document (Metanorma
  presentation form), vendored so the doc map and the tests resolve
  against the real text.

## Drive it in the Studio

```bash
cd ~/src/primmel/editor && npm run dev   # :5173
```

1. **Open** `demo/r7-clinical-thermometer/model.prl` (Code tab → Open).
   The OIML program layer activates (the Program palette + the
   Certificate preview appear).
2. **Certificate preview** (topbar) — the subject rendered as a
   certificate: design parameters with the MPE table, attributes,
   promises.
3. **Mapping view → load document** — open `document.presentation.xml`.
   The statements show mapped (9 of them) and the overlay edges link
   the canvas processes to their document sentences.
4. **Simulate** (right panel) — set `ambient_temperature` to 22 and
   `error_of_indication` to 0.05 and Continue: the conforming run
   walks all ten steps to the verdict. Set 35 °C ambient and the
   run aborts before the error determination (clause 8 validity).
   Set the error to 0.2 and the run routes to the fail path.

## The proofs

```bash
cd ~/src/primmel/editor
npx vitest run src/lib/__tests__/r7-tutorial.test.ts   # 6 tests
npx tsx e2e/r7-smoke.ts                                 # the live loop
```

- the package loads (strict), validates clean, and dumps byte-stable;
- every doc-map target resolves against the parsed document
  (the anchor sentences pin to the right texts);
- the workflow simulates the conforming, the invalid-ambient, and
  the out-of-MPE paths.

## The honest caveats (part of the tutorial)

- The document's statement ids (`s5.p1`, `s14.p1.s2`, …) are ORDINAL
  — the R 7 presentation XML carries no clause numbers in its titles,
  so the ids are document-order ordinals. The SEMANTIC clause numbers
  (5.1, 6.1, 7.1.1, 8, A.3–A.5) live in the model's `source { clause }`
  facets, which is where provenance belongs.
- The requirements/conformance tests are not canvas nodes (the canvas
  is the process layer); their doc-map edges exist in the profile but
  only the two process-ended pairs draw overlay edges.

## The dual demo

| | smart-r60 classroom | this tutorial |
|---|---|---|
| instrument | OIML R 60 load cells | OIML R 7 clinical thermometers |
| teaches | the methodology, six progressive levels, with a live twin simulator | applying the methodology yourself — from the document to a validated model in the Studio |
| tool | the classroom viewer | Primmel Studio (this repo) |

Read r60 to learn the method; build R 7 to prove you can use it.
