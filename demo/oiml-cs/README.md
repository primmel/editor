# The OIML-CS demo — the certification scheme, modelled

This demo shows the OIML Certification System (OIML-CS) as Primmel
models: the scheme's process requirements with their provenance made
visible, and the type evaluation workflow as a simulatable process.

## The files

- **`model.prl`** — the scheme model: the 34 OIML-CS process
  requirements (`/req/cs/…`), vendored verbatim from the OIML SMART
  single source of truth
  (`smart/primmel-packages/oiml-cs/specification/requirements/cs.prl`),
  plus a `map_profile "urn:oiml:pub:cs:pd-05:2024"` that maps every
  requirement onto the PD-05 statement(s) it comes from — 47 pairs,
  every target resolving against the real document.
- **`oiml-cs-pd-05.mirror.json`** — OIML-CS PD-05:2024 (*Operational
  procedures for the OIML-CS*) as a Metanorma Mirror document: the
  mapping target. Open it in the mapping view and the statements the
  requirements map to are highlighted.
- **`certification.prl`** — the certification workflow: the seven
  stages of the OIML-CS chain (application → acceptance → testing →
  test report → evaluation report → certificate → BIML registration)
  as a simulatable process with four roles (Applicant, Issuing
  Authority, Test Laboratory, BIML). Every step names the scheme
  provisions it realizes (`validate_provision`).
- **`package.primmel`** — the oiml-cs package manifest (vendored from
  the SSOT): open it and the plugin's Package manifest panel renders
  the id/kind/uses/requires/provides — the composition chain in one
  view.
- **`AUDIT.md`** — the authoring audit: what the Studio edits for the
  cs.prl class of packages, and the gaps that stay honestly open.

## Walk it

1. Open `certification.prl`, switch to the simulation panel, start a
   run, set the registers:
   - `application_complete = 1`, `tests_passed = 1`,
     `evaluation_approved = 1` — the conforming path: the application
     is reviewed and accepted, the samples tested, the test report and
     evaluation report compiled, the certificate issued and registered
     at the BIML.
   - `application_complete = 0` — the Issuing Authority requests the
     missing information (PD-05 4.2.1).
   - `tests_passed = 0` — the applicant is informed of the reasons in
     writing; no certificate (PD-05 4.6.1).
2. Open `model.prl`, switch to the mapping view, load
   `oiml-cs-pd-05.mirror.json` — each requirement's statement of
   provenance lights up on the document.
3. Stay on `model.prl` in the model view: the tree lists the
   requirement class and all 34 requirements; selecting one opens the
   requirement inspector — name, statement, obligation, the source
   facet (the provenance), the acceptance criteria, the verification
   method, all editable with undo. Open `package.primmel` and the
   Package manifest panel shows the composition chain.

## The provisions web

The workflow's steps and the scheme's requirements are two views of
one chain: `SubmitApplication` realizes `/req/cs/application-contents`
(PD-05 4.1.2), `AcceptApplication` realizes the fee, time and
sample-count provisions (4.2.6–4.2.9), and so on through
`RegisterCertificate` realizing the BIML registration provisions
(clause 6). The unit tests assert every step names its provisions and
every provision id exists in the scheme model — the two files cannot
drift apart silently.
