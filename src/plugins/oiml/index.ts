// ─────────────────────────────────────────────────────────────────────
// The OIML SMART plugin (TODO.editor/17) — the first program layer:
// the rec palettes (requirement / conformance test / form /
// instrument subject) and the certificate preview panel. Registered
// at boot when the Studio opens on OIML-CS content; the kernel never
// names it.
// ─────────────────────────────────────────────────────────────────────

import type { Standard } from '@primmel/primmel';
import { createInList, mintId, type Command } from '../../lib/commands';
import type { StudioPlugin } from '../types';
import CertificatePreview from './CertificatePreview.vue';
import RequirementInspector from './RequirementInspector.vue';
import ConformanceTestInspector from './ConformanceTestInspector.vue';
import FormInspector from './FormInspector.vue';
import PackageManifestPanel from './PackageManifestPanel.vue';

function mintAndCreate<T extends { id: string }>(
  prefix: string,
  listOf: (ast: Standard) => T[],
  defaults: (id: string) => T,
  label: string,
): (ast: Standard) => Command {
  return () => ({
    label: `${label}`,
    apply(ast) {
      const id = mintId(ast, prefix);
      createInList(listOf, defaults(id)).apply(ast);
    },
    revert(ast) {
      // Re-minting replays the same id (the list is back at its
      // pre-apply state in the undo stack).
      const id = mintId(ast, prefix);
      const list = listOf(ast);
      const i = list.findIndex(x => x.id === id);
      if (i >= 0) list.splice(i, 1);
    },
  });
}

export const oimlPlugin: StudioPlugin = {
  id: 'oiml-smart',

  matches: (model) =>
    model.requirements.length > 0
    || model.conformanceTests.length > 0
    || model.forms.length > 0
    || model.subjects.length > 0
    // A package model (the package.primmel form) activates the plugin
    // too — the manifest panel is its surface (TODO.editor/40).
    || !!model.packageManifest
    || /oiml/i.test(`${model.meta.namespace} ${model.meta.schema} ${model.meta.title}`),

  palettes: [
    {
      label: 'Requirement',
      glyph: 'R',
      create: mintAndCreate('Req', (a: Standard) => a.requirements, (id) => ({
        id,
        name: '',
        statement: '',
        guidance: '',
        bindsTo: [],
        limit: null,
        applicability: [],
        channel: '',
        subjects: [],
        parameters: [],
        obligation: 'shall',
        acceptanceCriteria: '',
        verificationMethod: '',
        dependencies: [],
        sourceDiscrepancy: null,
        source: null,
        referenceIds: [],
      }), 'create requirement'),
    },
    {
      label: 'Conformance test',
      glyph: 'CT',
      create: mintAndCreate('CT', (a: Standard) => a.conformanceTests, (id) => ({
        id,
        name: '',
        type: '',
        guidance: '',
        reference: '',
        targets: [],
        bindsTo: [],
        applicability: [],
        procedure: [],
        measurements: [],
        kind: '',
        obligation: '',
        obligationNote: '',
        testSubject: {},
        variables: [],
        observables: [],
        conditionsToEnforce: [],
        preconditions: [],
        referenceMaterials: [],
        requiredCompetence: [],
        acceptanceCriteria: [],
        acceptanceCriteriaType: '',
        acceptanceCriteriaDescription: '',
        acceptancePassIf: '',
        design: null,
        acceptance: null,
        dependencies: [],
        instances: null,
        inheritsFrom: '',
        resultForms: [],
        derivedValues: [],
        sourceDiscrepancy: null,
      }), 'create conformance test'),
    },
    {
      label: 'Form',
      glyph: 'F',
      create: mintAndCreate('Form', (a: Standard) => a.forms, (id) => ({
        id,
        name: '',
        description: '',
        dataClassId: '',
        headerFormId: '',
        conformanceProcessId: '',
        section: '',
        requirements: [],
        formNotes: [],
        scope: '',
        formReferences: [],
        calculationContext: null,
        formInstances: [],
        formConstraints: [],
        applicability: [],
        fields: [],
        passFail: null,
        referenceIds: [],
        ref: [],
      }), 'create form'),
    },
    {
      label: 'Instrument',
      glyph: 'MI',
      create: mintAndCreate('MI', (a: Standard) => a.subjects, (id) => ({
        id,
        extends: '',
        is: {
          metadata: {},
          provenance: {},
          structure: [],
          designParameters: {},
          designedConditions: {},
          promises: [],
          artifacts: [],
          endpoints: [],
        },
        has: {
          attributes: {},
          dimensions: {},
          state: '',
          characteristics: {},
          environmentalContext: [],
          artifactInstances: [],
          serves: [],
        },
        does: { behaviors: [] },
        referenceIds: [],
        misplacedAspects: [],
      }), 'create instrument subject'),
    },
  ],

  panels: [
    {
      id: 'certificate-preview',
      label: 'Certificate preview',
      component: CertificatePreview,
    },
    {
      id: 'package-manifest',
      label: 'Package manifest',
      component: PackageManifestPanel,
    },
  ],

  // The program constructs' inspectors (TODO.editor/40) — the
  // ElementInspector's plugin slot: a requirement or conformance test
  // selected in the tree opens these, never a kernel branch.
  inspectors: [
    { type: 'requirement', component: RequirementInspector },
    { type: 'conformanceTest', component: ConformanceTestInspector },
    { type: 'form', component: FormInspector },
  ],
};
