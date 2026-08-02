# From the PDF to a live Primmel model — the R 7 tutorial

An afternoon with OIML R 7 (1979) and Primmel Studio. By the end you
will have a kernel-validated model of a real OIML Recommendation —
subject, requirements, tests, workflow, evidence, and the doc map back
to the source text — and you will have touched every major surface of
the Studio. This is the companion to the smart-r60 classroom: r60
teaches the methodology; here you APPLY it.

**What you need:** Primmel Studio running (`cd ~/src/primmel/editor &&
npm run dev` → http://localhost:5173) and this directory
(`demo/r7-clinical-thermometer/`).

---

## Step 0 — read the document like a modeller (10 minutes)

Open `document.presentation.xml` (or the R 7 PDF). Read only for
structure, the way a certifier reads:

- **What is the instrument?** A mercury-in-glass clinical thermometer
  with a maximum device, two types (solid-stem, enclosed-scale) —
  clauses 1–4.
- **What must be TRUE of it?** The normative clauses: construction
  (5), graduation (6), inscriptions (7), the maximum permissible
  errors (8: **+0.1 / −0.15 °C**, valid at ambient 15–30 °C).
- **How do you CHECK it?** The annex A tests: A.3 the bath comparison,
  A.4 the maximum-device test, A.5 the coloration test.
- **What is the verdict path?** Metrological controls + certificates
  (clause 11).

That four-part read — instrument / truths / checks / verdict — IS the
IS-HAS-DOES anatomy plus its secondary models (requirements, tests,
forms). You will now say each part in Primmel.

## Step 1 — boot the Studio and open the model (5 minutes)

Code tab → Open → `demo/r7-clinical-thermometer/model.prl`.

Three things happen that are worth noticing, because they are the
system working as designed:

1. The model parses strict and the stats bar updates (1 subject, 5
   requirements… wait — the stats bar shows processes/provisions/
   canvases; the full inventory is in the Model Tree on the left).
2. The **OIML program layer activates**: a "Program" section appears
   in the palette (Requirement / Conformance test / Form /
   Instrument), and the topbar gains **Certificate preview**. The
   Studio recognized OIML-CS content through the plugin's `matches`
   — no `if (program === 'oiml')` anywhere.
3. The canvas shows the verification workflow (the process layer).

## Step 2 — the subject anatomy (15 minutes)

The tree's Data section lists `ClinicalThermometer`. Read it in the
code view (tree → Code) — or click through:

- **IS** — identity: name, intended use, the two types; provenance:
  the Recommendation and its scope; design parameters: the MPE table
  (+0.1/−0.15 °C, the ambient validity range, the scale spacing
  minimums). IS is what individuates the instrument — lose it and the
  instrument stops being THIS instrument.
- **HAS** — exhibition: graduation & numbering, inscriptions,
  construction integrity, space for stamping; the characteristic
  `error_of_indication` (what a test will measure).
- **DOES** — behavior: `IndicateTemperature`, `HoldMaximumReading`
  (the maximum device), `BeVerifiedAtScalePoints`.

**Certificate preview** (topbar) renders exactly these facets as a
certificate — the defining-data table a real certificate carries.
This is the first "secondary view" of the primary model: the
certificate is a RENDERING of the subject, not a separate artifact.

## Step 3 — requirements with provenance (15 minutes)

The tree lists five requirements. Each carries its clause URN:

```
requirement REQ-MPE {
  name "Maximum permissible errors"
  statement "… within +0.1 °C and −0.15 °C …"
  source { doc "urn:oiml:pub:r:7:1979" clause "8" }
}
```

The discipline: **a requirement is a constraint on the subject's
IS/HAS/DOES**, and its `source` names the exact clause it came from.
Nothing is free-floating — provenance is a first-class facet, which
is what makes the model auditable. Edit one in the code view (change
"+0.1" to "+0.2" and watch the validation surface notice nothing —
the number is data, not schema — then change `clause "8"` to a
malformed line and watch the parse error marker appear inline).

## Step 4 — conformance tests and the acceptance shape (15 minutes)

Four tests: the visual examination, the A.3 error determination, the
A.4 maximum-device test, the A.5 coloration test. Read CT-ErrorDetermination:

- `preconditions` — what must hold BEFORE the test means anything
  (stirred bath, calibrated standard, ambient in range) — clause 8's
  own validity condition, repeated as a test precondition.
- `procedure` — the five numbered steps (immerse, read, compute,
  repeat, cool and read again).
- `acceptance_pass_if` — the decision rule in one sentence.

The doctrine again: **a test is a process that interrogates the
subject's IS/HAS/DOES to produce evidence.** The form (TestReportR7)
is the evidence skeleton — the table the lab fills in. Forms are
secondary models too: evidence, never new semantics.

## Step 5 — the workflow, simulated (20 minutes)

Switch to the Simulate panel. The workflow on the Root canvas:

```
Receive → Visual examination → [ambient in 15–30 °C?] → Error determination
       → [error within MPE?] → Maximum-device test → Coloration test → Verdict
```

Set the registers and Continue:

| ambient_temperature | error_of_indication | the walk |
|---|---|---|
| 22 | 0.05 | all ten steps to the verdict (conform) |
| 35 | 0.05 | aborts before the error determination (clause 8 validity) |
| 22 | 0.2 | routes to the fail path (out of MPE) |

The gates read the document's own conditions verbatim:
`ambient_temperature >= 15 and ambient_temperature <= 30` (clause 8),
`error_of_indication >= -0.15 and error_of_indication <= 0.1` (the
MPE). The trajectory log records every stop — that is the shape of
evidence a test run produces later.

The wall, always stated: the run is ephemeral. Register values never
write back into the model.

## Step 6 — the doc map (15 minutes)

Mapping view → **load document** → open `document.presentation.xml`.

The left pane becomes the R 7 document: its 21 top-level clauses as
collapsible sections, every paragraph split into individually
addressable statements. The mapped ones are already highlighted —
the model's `map_profile "urn:oiml:pub:r:7:1979"` maps ten pairs
back onto the document's sentences (the MPE requirement onto the
clause-8 sentence, the error-determination test onto the A.3
procedure sentences, …).

Click any statement, then a canvas process — the pair dialog opens,
and the new pair lands in the same profile with your description and
justification. That is **provenance made bidirectional**: the model
points at the document (source facets) AND the document points at
the model (the map profile). An auditor can walk either direction.

**The honest caveat** (say it when you teach this): the statement ids
(`s5.p1`, `s14.p1.s2`) are ordinal — R 7's presentation XML carries
no clause numbers in its titles, so the ids are document-order
ordinals. The SEMANTIC numbers (5.1, 6.1, 7.1.1, 8, A.3–A.5) live in
the model's `source { clause }` facets — which is where semantic
provenance belongs.

## Step 7 — review and save (10 minutes)

Make one edit of your own (rename a process, or add a sixth
requirement from clause 9 — space for stamping). Then:

1. **Diff view** — load the original `model.prl` as the other
   version. Your edit appears with its facet-level before/after —
   the kernel's model-diff, nothing more, nothing less.
2. **Save** (Ctrl+S) — the review shows the same change summary
   before anything is written. Download, or write to a path with a
   `.bak` kept.

The loop is complete: document → model → validation → simulation →
provenance → review → save.

---

## The dual demo, side by side

| | smart-r60 classroom | this tutorial |
|---|---|---|
| instrument | OIML R 60 load cells | OIML R 7 clinical thermometers |
| you learn | the methodology — six levels, live twin | applying it — document to validated model |
| the tool | the classroom viewer | Primmel Studio |
| the proof | the twin flips a verdict | `npx vitest run src/lib/__tests__/r7-tutorial.test.ts` |

Do r60 first if the methodology is new to you. Then build another
Recommendation yourself — R 49 (water meters), R 76 (non-automatic
weighing) — following the same seven steps.
