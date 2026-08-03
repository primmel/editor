# 40 — The OIML-CS authoring audit (the plugin gaps)

**Wave:** oiml-cs · **Depends on:** 17, 39 · **Priority:** P1

## Goal

The authoring side of the deep audit: what the Studio needs to AUTHOR
and EDIT OIML-CS scheme content (the cs.prl class of packages) —
delivered as OCP extensions of the OIML plugin, never kernel branches.

## Spec

- **Requirement classes in the tree**: the ModelTree gains the
  requirement-class group (`requirementClasses` — currently invisible)
  and the requirements group (currently invisible too — requirements
  are palette-created but not listed). Both selectable.
- **The requirement inspector** (OIML plugin inspector, the registry's
  `inspectors` slot finally consumed): name, statement, guidance,
  obligation, the source facet (doc + clause — the provenance editor),
  acceptance_criteria as the raw block (the YAML-ish content, verbatim
  text with the note that the structured editor is future work),
  verification method. Same for the conformance-test inspector.
- **The package manifest panel**: for a `package.primmel`-carrying
  model — the manifest's id/kind/uses/requires/provides rendered
  (read-only), with the composed-package note (the oiml-cs uses chain).
- **The audit document** (`demo/oiml-cs/AUDIT.md`): the authoring
  gaps that remain honestly open (structured acceptance_criteria
  editing, the participant-registry model, the scheme governance
  modules — named, never hidden).

## Homes

1. `src/components/ModelTree.vue` (the two groups).
2. `src/plugins/oiml/` — RequirementInspector.vue,
   ConformanceTestInspector.vue, PackageManifestPanel.vue.
3. `demo/oiml-cs/AUDIT.md` + the tests.

## Acceptance

- Requirement classes and requirements show in the tree and select.
- The requirement inspector edits every provenance facet; the test
  round-trips through the dump (cs.prl stays byte-stable through the
  command path).
- The manifest panel renders the oiml-cs manifest.
- Gates green.
