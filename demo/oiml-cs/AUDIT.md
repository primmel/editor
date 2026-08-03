# The OIML-CS authoring audit — what the Studio edits, what stays open

This is the honest ledger of the OIML-CS deep audit's authoring side
(TODO.editor/40): what the Studio now authors for the cs.prl class of
packages, and the gaps that remain open — named, never hidden.

## Authored (delivered)

- **Requirement constructs in the tree.** The ModelTree lists the
  requirement classes and the requirements (and the conformance
  tests alongside them) — previously invisible, palette-created only.
  Both select.
- **The requirement inspector** (the OIML plugin, through the
  registry's `inspectors` slot — the kernel carries no OIML branch):
  name, statement, guidance, obligation, the source facet (doc +
  clause — the provenance editor), the acceptance criteria as the raw
  block, the verification method. Edits land through the command path
  with undo; the byte-stability test proves a model survives
  edit → dump → re-parse unchanged except the edit, and the revert
  chain restores the byte-exact baseline.
- **The conformance-test inspector**: name, type, kind, guidance, the
  reference (clause provenance), obligation + note, the acceptance
  block (type, description, pass-if).
- **The package manifest panel**: a `package.primmel`-carrying model
  renders its id/kind/uses/requires/provides read-only, with the
  composed-package note (the oiml-cs uses chain: the scheme package
  layers the ISO/IEC 17xxx packages; each Recommendation layers
  oiml-cs in turn).
- **The aliasing rule, documented in code**: the serializer walks
  `sourceRefs`, whose first entry *aliases* `source` on load. Any
  edit to a source facet must patch both, keeping the alias — the
  inspector does, and the unit test pins the behavior.

## Open (the gaps, named)

- **Structured acceptance-criteria editing.** The block is raw text
  today (verbatim YAML-ish content). A structured editor — typed
  threshold/qualitative items, per-item descriptions, the pass-if
  expression with OCL assist — is future work. The raw editor keeps
  every byte; nothing is lost in the meantime.
- **The participant-registry model.** The OIML-CS participant registry
  (IAs, TLs, MTLs, Utilizers with their scopes and Declaration
  entries — the app-side runtime registry) is not yet a Studio
  construct. The scheme model references participant competence; the
  registry itself is edited elsewhere.
- **The scheme-governance modules.** The governance document modules
  (PD-01 appeals, PD-06 certificate use, PD-07 transitions, PD-08
  Declarations, PD-09 Utilizers/Associates, CID-01 clarifications,
  OD-01/OD-02 rules) parse through the mirror path (the corpus matrix
  pins them) but have no dedicated authoring inspectors — they are
  document content, not model constructs, today.
- **Requirement-class inspector.** The class node lists and selects;
  its inspector is the kernel fallback (name/title/description/subject
  are not yet editable in the plugin surface).

Each open item is a candidate wave item; none blocks the authoring of
the 34 scheme requirements end to end.
