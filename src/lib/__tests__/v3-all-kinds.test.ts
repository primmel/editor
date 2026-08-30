// ─────────────────────────────────────────────────────────────────────
// TODO.editor wave 03 — the all-kinds scratch-package sweep (the wave
// gate): author EVERY construct kind the editor surfaces on one scratch
// model, then the kernel's dump → strict reparse → validate chain
// accepts the result without hand-edits. Factories where the editor has
// one (the tree's `+`), the palette's inline shapes for the program
// kinds, minimal parse-default shapes for the rest. A kind that fails
// here has no honest authoring path — the gate is the point.
// ─────────────────────────────────────────────────────────────────────

import { describe, it, expect } from 'vitest';
import { dump, load, validate } from '@primmel/primmel';
import type { Standard } from '@primmel/primmel';
import {
  createConstruct,
  createElement,
  createInList,
  type Command,
} from '../commands';
import { CONSTRUCT_FIELDS } from '../package-save';
import {
  newActivityArchetype,
  newArtifactDefinition,
  newArtifactInstance,
  newAttributeDefinition,
  newBehavior,
  newCalculation,
  newCapability,
  newCompetenceKind,
  newConditionSet,
  newConformanceClass,
  newConnectorProfile,
  newConstraint,
  newDataspace,
  newDiscrepancyRecord,
  newDual,
  newFormulasUsed,
  newInstance,
  newInstrument,
  newInvariant,
  newMonitor,
  newPassport,
  newPolicy,
  newPredicate,
  newQuantityRegister,
  newReferenceMaterial,
  newStateMachine,
  newSubject,
  newSymbol,
  newTable,
  newTerm,
  newTestPointSet,
  newTestSequence,
  newTextContent,
  newVerdict,
} from '../factory';

interface SweepEntry {
  /** The Standard collection the construct lands in. */
  field: keyof Standard;
  /** The id the sweep authors. */
  id: string;
  make: () => Command;
}

/** The full sweep table — one entry per authorable construct kind. */
const SWEEP: SweepEntry[] = [
  // ── the v3 wave-03 surfaces (the factories) ─────────────────────
  { field: 'terms', id: 'term-1', make: () => createConstruct(a => a.terms, newTerm('term-1')) },
  { field: 'symbols', id: 'sym-1', make: () => createConstruct(a => a.symbols, newSymbol('sym-1')) },
  { field: 'constraints', id: 'c-1', make: () => createConstruct(a => a.constraints, newConstraint('c-1')) },
  { field: 'calculations', id: 'calc-1', make: () => createConstruct(a => a.calculations, newCalculation('calc-1')) },
  { field: 'tables', id: 'tbl-1', make: () => createConstruct(a => a.tables, newTable('tbl-1')) },
  { field: 'stateMachines', id: 'Machine1', make: () => createConstruct(a => a.stateMachines, newStateMachine('Machine1')) },
  { field: 'testSequences', id: 'seq-1', make: () => createConstruct(a => a.testSequences, newTestSequence('seq-1')) },
  { field: 'testPointSets', id: 'tps-1', make: () => createConstruct(a => a.testPointSets, newTestPointSet('tps-1')) },
  { field: 'subjects', id: 'Subject1', make: () => createConstruct(a => a.subjects, newSubject('Subject1')) },
  { field: 'attributeDefinitions', id: 'attr-1', make: () => createConstruct(a => a.attributeDefinitions, newAttributeDefinition('attr-1')) },
  { field: 'instruments', id: 'Instrument1', make: () => createConstruct(a => a.instruments, newInstrument('Instrument1')) },
  { field: 'behaviors', id: 'b-1', make: () => createConstruct(a => a.behaviors, newBehavior('b-1')) },
  { field: 'capabilities', id: 'cap-1', make: () => createConstruct(a => a.capabilities, newCapability('cap-1')) },
  { field: 'conditionSets', id: 'cs-1', make: () => createConstruct(a => a.conditionSets, newConditionSet('cs-1')) },
  { field: 'verdicts', id: 'v-1', make: () => createConstruct(a => a.verdicts, newVerdict('v-1')) },
  { field: 'quantityRegisters', id: 'qr-1', make: () => createConstruct(a => a.quantityRegisters, newQuantityRegister('qr-1')) },
  { field: 'duals', id: 'd-1', make: () => createConstruct(a => a.duals, newDual('d-1')) },
  { field: 'referenceMaterials', id: 'rm-1', make: () => createConstruct(a => a.referenceMaterials, newReferenceMaterial('rm-1')) },
  { field: 'conformanceClasses', id: '/conf/cc-1', make: () => createConstruct(a => a.conformanceClasses, newConformanceClass('/conf/cc-1')) },
  { field: 'instances', id: 'inst-1', make: () => createConstruct(a => a.instances, newInstance('inst-1')) },
  { field: 'artifactDefinitions', id: 'ad-1', make: () => createConstruct(a => a.artifactDefinitions, newArtifactDefinition('ad-1')) },
  { field: 'artifactInstances', id: 'ai-1', make: () => createConstruct(a => a.artifactInstances, newArtifactInstance('ai-1')) },
  { field: 'connectorProfiles', id: 'cp-1', make: () => createConstruct(a => a.connectorProfiles, newConnectorProfile('cp-1')) },
  { field: 'monitors', id: 'mon-1', make: () => createConstruct(a => a.monitors, newMonitor('mon-1')) },
  { field: 'passports', id: 'pp-1', make: () => createConstruct(a => a.passports, newPassport('pp-1')) },
  { field: 'invariants', id: 'INV-1', make: () => createConstruct(a => a.invariants, newInvariant('INV-1')) },
  { field: 'formulasUsed', id: '/conf/fu-1', make: () => createConstruct(a => a.formulasUsed, newFormulasUsed('/conf/fu-1')) },
  { field: 'texts', id: 'term-1.label', make: () => createConstruct(a => a.texts, newTextContent('term-1.label')) },
  { field: 'activityArchetypes', id: 'aa-1', make: () => createConstruct(a => a.activityArchetypes, newActivityArchetype('aa-1')) },
  { field: 'competenceKinds', id: 'ck-1', make: () => createConstruct(a => a.competenceKinds, newCompetenceKind('ck-1')) },
  { field: 'predicates', id: 'pred-1', make: () => createConstruct(a => a.predicates, newPredicate('pred-1')) },
  { field: 'discrepancyRecords', id: 'dr-1', make: () => createConstruct(a => a.discrepancyRecords, newDiscrepancyRecord('dr-1')) },
  { field: 'dataspaces', id: 'ds-1', make: () => createConstruct(a => a.dataspaces, newDataspace('ds-1')) },
  { field: 'policies', id: 'pol-1', make: () => createConstruct(a => a.policies, newPolicy('pol-1')) },
  // ── the program kinds (the OIML palette's inline shapes) ────────
  {
    field: 'requirements', id: '/req/r-1',
    make: () => createConstruct(a => a.requirements, {
      id: '/req/r-1', name: '', statement: '', guidance: '', bindsTo: [], limit: null, applicability: [],
      channel: '', subjects: [], parameters: [], obligation: 'shall', acceptanceCriteria: '',
      verificationMethod: '', dependencies: [], sourceDiscrepancy: null, source: null, referenceIds: [],
    }),
  },
  {
    field: 'requirementClasses', id: '/req/class-1',
    make: () => createConstruct(a => a.requirementClasses, { id: '/req/class-1', name: '', subject: '', guidance: '', dependencies: [], referenceIds: [] }),
  },
  {
    field: 'conformanceTests', id: '/conf/t-1',
    make: () => createConstruct(a => a.conformanceTests, {
      id: '/conf/t-1', name: '', type: '', guidance: '', reference: '', targets: [], bindsTo: [],
      applicability: [], procedure: [], measurements: [], kind: '', obligation: '', obligationNote: '',
      testSubject: {}, variables: [], observables: [], conditionsToEnforce: [], preconditions: [],
      referenceMaterials: [], requiredCompetence: [], acceptanceCriteria: [], acceptanceCriteriaType: '',
      acceptanceCriteriaDescription: '', acceptancePassIf: '', design: null, acceptance: null,
      dependencies: [], instances: null, inheritsFrom: '', resultForms: [], derivedValues: [],
      sourceDiscrepancy: null,
    }),
  },
  {
    field: 'forms', id: 'form-1',
    make: () => createConstruct(a => a.forms, {
      id: 'form-1', name: '', description: '', dataClassId: '', headerFormId: '', conformanceProcessId: '',
      section: '', requirements: [], formNotes: [], scope: '', formReferences: [], calculationContext: null,
      formInstances: [], formConstraints: [], applicability: [], fields: [], passFail: null,
      referenceIds: [], ref: [],
    }),
  },
  {
    field: 'subforms', id: 'subform-1',
    make: () => createConstruct(a => a.subforms, { id: 'subform-1', description: '', shapeType: 'object', parameters: [], fields: [] }),
  },
  // ── the canvas-era kinds ────────────────────────────────────────
  { field: 'roles', id: 'role-1', make: () => createInList(a => a.roles, { id: 'role-1', name: '' }) },
  { field: 'provisions', id: 'prov-1', make: () => createConstruct(a => a.provisions, { id: 'prov-1', modality: 'SHALL', subject: new Map(), condition: '', ref: [] }) },
  { field: 'dataclasses', id: 'DC1', make: () => createElement('dataclass', 'DC1') },
  { field: 'enums', id: 'enum-1', make: () => createInList(a => a.enums, { id: 'enum-1', values: [] }) },
  { field: 'regs', id: 'reg-1', make: () => createInList(a => a.regs, { id: 'reg-1', title: '', data: null }) },
  { field: 'processes', id: 'P1', make: () => createElement('process', 'P1') },
  { field: 'approvals', id: 'A1', make: () => createElement('approval', 'A1') },
  { field: 'events', id: 'Start1', make: () => createElement('event', 'Start1') },
  { field: 'gateways', id: 'X1', make: () => createElement('gateway', 'X1') },
  { field: 'pages', id: 'Page1', make: () => createElement('subprocess', 'Page1') },
  // ── the remaining collections (minimal parse-default shapes) ────
  { field: 'references', id: 'ref-1', make: () => createConstruct(a => a.references, { id: 'ref-1', document: '', clause: '' }) }, // parse defaults
  { field: 'notes', id: 'note-1', make: () => createConstruct(a => a.notes, { id: 'note-1', type: 'NOTE', message: '', sourceDiscrepancy: null, ref: [] }) },
  { field: 'comments', id: 'comment-1', make: () => createConstruct(a => a.comments, { id: 'comment-1', on: '', author: '', timestamp: '', text: '', replyTo: null, resolved: false }) },
  { field: 'figures', id: 'fig-1', make: () => createConstruct(a => a.figures, { id: 'fig-1', title: '', src: '' }) },
  { field: 'links', id: 'link-1', make: () => createConstruct(a => a.links, { id: 'link-1', kind: 'URL', target: '', namespace: '' }) },
  { field: 'variables', id: 'var-1', make: () => createConstruct(a => a.variables, { id: 'var-1', type: '', definition: '', description: '' }) },
  { field: 'viewProfiles', id: 'vp-1', make: () => createConstruct(a => a.viewProfiles, { id: 'vp-1', description: '', roles: [], visibleElements: [], against: '' }) },
  {
    // The map profile's identity is its NAMESPACE, not an id — the save
    // layer's constructId (id | entityName) does not key it, so the sweep
    // authors it with a raw command (the push + splice revert by value).
    field: 'mapProfiles', id: 'urn:sweep:mp-1',
    make: (): Command => {
      const profile = { namespace: 'urn:sweep:mp-1', description: '', mappings: {} as Record<string, never[]>, coverage: {} };
      return {
        label: 'create map profile urn:sweep:mp-1',
        apply(ast) { if (!ast.mapProfiles.some(p => p.namespace === profile.namespace)) ast.mapProfiles.push(profile); },
        revert(ast) { const i = ast.mapProfiles.findIndex(p => p.namespace === profile.namespace); if (i >= 0) ast.mapProfiles.splice(i, 1); },
      };
    },
  },
];

describe('W3.2 the all-kinds scratch-package sweep (the wave gate)', () => {
  it('authors every construct kind on one scratch model; dump → strict reparse → validate accepts it', () => {
    const ast = load('', { strict: true });
    for (const entry of SWEEP) entry.make().apply(ast);
    // Every entry landed.
    for (const entry of SWEEP) {
      const list = ast[entry.field] as unknown[];
      expect(list.length, `${entry.field} holds its authored construct`).toBeGreaterThan(0);
    }
    const text = dump(ast);
    const reloaded = load(text, { strict: true });
    for (const entry of SWEEP) {
      const list = reloaded[entry.field] as Array<object>;
      // The identity rule per collection: id everywhere except the
      // entity-keyed state machines and the namespace-keyed map profiles.
      const ids = list.map(x =>
        ('id' in x ? (x as { id: string }).id
          : 'entityName' in x ? (x as { entityName?: string }).entityName
            : (x as { namespace?: string }).namespace));
      expect(ids, `${entry.field} re-parses ${entry.id}`).toContain(entry.id);
    }
    expect(validate(reloaded)).toEqual([]);
  });

  it('the sweep covers every authorable collection (the census is complete)', () => {
    // The sweep's fields ARE the save layer's construct census
    // (package-save.ts's CONSTRUCT_FIELDS) — set-equal, one entry each.
    const covered = SWEEP.map(e => e.field as string);
    expect(new Set(covered).size, 'no duplicate sweep entries').toBe(covered.length);
    expect([...covered].sort()).toEqual([...CONSTRUCT_FIELDS].sort());
  });
});
