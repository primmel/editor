// ─────────────────────────────────────────────────────────────────────
// The element factory (TODO.editor/03) — the palette's creation
// commands: id minting, default facets per kind, event subtypes, and
// the create command with its undo (delete the minted element and
// everything attached).
// ─────────────────────────────────────────────────────────────────────

import type { Standard } from '@primmel/primmel';
import { createElement, mintId, updateElement, type Command, type ElementKind } from './commands';

export interface PaletteKind {
  kind: ElementKind;
  /** Event subtype when kind === 'event'. */
  eventType?: 'start' | 'end' | 'signalcatch' | 'timer';
  label: string;
  /** The id prefix the mint uses (P1, DC1, Start1…). */
  idPrefix: string;
}

/** The palette — every PRL element kind (the Studio kernel's set;
 *  program palettes extend via the plugin registry, TODO.editor/17). */
export const PALETTE: PaletteKind[] = [
  { kind: 'process', label: 'Process', idPrefix: 'P' },
  { kind: 'approval', label: 'Approval', idPrefix: 'A' },
  { kind: 'dataclass', label: 'Data class', idPrefix: 'DC' },
  { kind: 'event', eventType: 'start', label: 'Start event', idPrefix: 'Start' },
  { kind: 'event', eventType: 'end', label: 'End event', idPrefix: 'Done' },
  { kind: 'event', eventType: 'timer', label: 'Timer event', idPrefix: 'T' },
  { kind: 'event', eventType: 'signalcatch', label: 'Signal event', idPrefix: 'Sig' },
  { kind: 'gateway', label: 'Exclusive gateway', idPrefix: 'X' },
  { kind: 'subprocess', label: 'Subprocess page', idPrefix: 'Page' },
];

/** The create command for a palette drop: the minted id, the defaults,
 *  the event subtype when applicable, the canvas placement. */
export function createFromPalette(
  ast: Standard,
  entry: PaletteKind,
  position?: { x: number; y: number },
  pageId = 'root',
): Command {
  const id = mintId(ast, entry.idPrefix);
  const create = createElement(entry.kind, id, position, pageId);
  const subtype = entry.eventType && entry.eventType !== 'start'
    ? updateElement((a: Standard) => a.events as Array<{ id: string; eventType: string }>, id, { eventType: entry.eventType })
    : null;
  return {
    label: `create ${entry.label.toLowerCase()} ${id}`,
    apply(ast) {
      create.apply(ast);
      subtype?.apply(ast);
    },
    revert(ast) {
      subtype?.revert(ast);
      create.revert(ast);
    },
  };
}

/** The id a palette create will mint (the palette shows it as a hint). */
export function previewId(ast: Standard, entry: PaletteKind): string {
  return mintId(ast, entry.idPrefix);
}

// ── The v3 construct defaults (TODO.editor wave 03) ─────────────────
// The non-canvas kernel constructs' creation defaults, one factory per
// kind, used by the tree's in-place create. The types derive from the
// kernel's public `Standard` (the collections ARE the public API — the
// kernel index does not name every construct type); the required facets
// mirror the parse defaults (the round-trip tests pin this) and every
// optional facet starts absent, never as an empty marker.

export type Term = Standard['terms'][number];
export type Constraint = Standard['constraints'][number];
export type Calculation = Standard['calculations'][number];
export type Table = Standard['tables'][number];
export type StateMachine = Standard['stateMachines'][number];
export type TestSequence = Standard['testSequences'][number];
export type TestPointSet = Standard['testPointSets'][number];
export type Subject = Standard['subjects'][number];
export type Behavior = Standard['behaviors'][number];
export type Capability = Standard['capabilities'][number];
export type ConditionSet = Standard['conditionSets'][number];
export type Verdict = Standard['verdicts'][number];
export type ReferenceMaterial = Standard['referenceMaterials'][number];
export type Symbol = Standard['symbols'][number];
export type AttributeDefinition = Standard['attributeDefinitions'][number];
export type QuantityRegister = Standard['quantityRegisters'][number];
export type Dual = Standard['duals'][number];
export type Instrument = Standard['instruments'][number];
export type ConformanceClass = Standard['conformanceClasses'][number];
export type Instance = Standard['instances'][number];
export type ArtifactDefinition = Standard['artifactDefinitions'][number];
export type ArtifactInstance = Standard['artifactInstances'][number];
export type ConnectorProfile = Standard['connectorProfiles'][number];
export type Monitor = Standard['monitors'][number];
export type Passport = Standard['passports'][number];
export type Invariant = Standard['invariants'][number];
export type FormulasUsed = Standard['formulasUsed'][number];
export type TextContent = Standard['texts'][number];
export type ActivityArchetype = Standard['activityArchetypes'][number];
export type CompetenceKind = Standard['competenceKinds'][number];
export type RefPredicate = Standard['predicates'][number];
export type DiscrepancyRecord = Standard['discrepancyRecords'][number];
export function newTerm(id: string): Term {
  return { id, label: '', definition: '', symbolId: '', referenceIds: [], ref: [] };
}

export function newConstraint(id: string): Constraint {
  return {
    id,
    stereotype: 'inv',
    name: '',
    check: '',
    violationMeaning: '',
    onViolation: 'invalid',
    source: null,
  };
}

export function newCalculation(id: string): Calculation {
  return {
    id,
    name: '',
    description: '',
    inputs: [],
    output: { type: 'number', unit: '' },
    expression: '',
    ref: [],
  };
}

export function newTable(id: string): Table {
  return {
    id,
    title: '',
    description: '',
    columns: '',
    display: '',
    data: [],
    domain: null,
  };
}

export function newStateMachine(entityName: string): StateMachine {
  // The skeleton carries one state the initial marker points at: the
  // kernel's dump writes `initial <name>` unconditionally, and an empty
  // marker would dump `initial ` — text that does not reparse (a kernel
  // dump gap; the seeded skeleton never authors it).
  return {
    entityName,
    kind: 'lifecycle',
    initialState: 'initial',
    states: [{ name: 'initial' }],
    transitions: [],
    referenceIds: [],
  };
}

export function newTestSequence(id: string): TestSequence {
  return {
    id,
    name: '',
    description: '',
    steps: [],
    sampleApplicability: '',
    sourceRefs: [],
  };
}

export function newTestPointSet(id: string): TestPointSet {
  return {
    id,
    description: '',
    source: null,
    cardinality: {},
    repetitionsPerPoint: null,
    points: [],
  };
}

export function newSubject(id: string): Subject {
  return {
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
  };
}

export function newBehavior(id: string): Behavior {
  return {
    id,
    kind: '',
    stimulus: '',
    response: '',
    source: null,
    verifiedBy: [],
    referenceIds: [],
  };
}

export function newCapability(id: string): Capability {
  return {
    id,
    label: '',
    description: '',
    abstract: false,
    extends: [],
    requires: [],
    hasParameters: [],
    satisfiesRequirements: [],
    verifiedByTests: [],
    referenceIds: [],
  };
}

export function newConditionSet(id: string): ConditionSet {
  return {
    id,
    role: '',
    entries: [],
    referenceIds: [],
  };
}

export function newVerdict(id: string): Verdict {
  return {
    id,
    quantityKind: '',
    unit: '',
    derive: '',
    inputs: [],
    seriesReduction: null,
    source: null,
  };
}

export function newSymbol(id: string): Symbol {
  return {
    id,
    name: '',
    definition: '',
    type: 'number',
    unit: '1',
    latex: '',
    values: [],
    series: null,
    kind: '',
    quantityKind: '',
    origin: '',
    legacyId: '',
    attribute: '',
    calculation: '',
    profile: '',
    sourceRef: null,
    formula: null,
    notes: [],
    ref: [],
  };
}

export function newAttributeDefinition(id: string): AttributeDefinition {
  return {
    id,
    symbol: '',
    name: '',
    definition: '',
    source: null,
    quantityKind: '',
    unit: '',
    valueType: '',
    origin: '',
    scope: '',
    category: '',
    isDimension: null,
    enumRef: '',
    irdi: '',
    derived: '',
    referenceIds: [],
  };
}

export function newQuantityRegister(id: string): QuantityRegister {
  return { id, kinds: [], units: [], referenceIds: [] };
}

export function newDual(id: string): Dual {
  return { id, attribute: '', referenceIds: [] };
}

export function newReferenceMaterial(id: string): ReferenceMaterial {
  return { id, kind: '', name: '', definition: '', source: null, identityFields: [], constraints: [] };
}

export function newInstrument(id: string): Instrument {
  return {
    id,
    extends: '',
    definition: '',
    variants: [],
    dimensions: [],
    perChannel: '',
    familyCriteria: [],
    familyDefaultDimensions: [],
    familyDefaultParameters: [],
    modelGroup: null,
    referenceIds: [],
    measurand: null,
    components: [],
    structure: [],
    source: null,
  };
}

export function newConformanceClass(id: string): ConformanceClass {
  return {
    id,
    name: '',
    title: '',
    description: '',
    target: '',
    subject: '',
    applicability: [],
    guidance: '',
    dependencies: [],
    referenceIds: [],
  };
}

export function newInstance(id: string): Instance {
  return {
    id,
    of: '',
    level: '',
    model: '',
    group: '',
    family: '',
    definitionVersions: {},
    has: { attributes: {}, dimensions: {}, testContext: {} },
    referenceIds: [],
  };
}

export function newArtifactDefinition(id: string): ArtifactDefinition {
  return {
    id,
    name: '',
    description: '',
    contentContract: { fields: [], structure: '', media: [] },
    producedWhen: { kind: '' },
    retention: '',
    source: null,
    referenceIds: [],
  };
}

export function newArtifactInstance(id: string): ArtifactInstance {
  return { id, of: '', producedAt: '', by: '', content: {}, links: [], referenceIds: [] };
}

export function newConnectorProfile(id: string): ConnectorProfile {
  return { id, protocol: '', description: '', referenceIds: [] };
}

export function newMonitor(id: string): Monitor {
  return {
    id,
    over: [],
    triggers: [],
    evaluate: {
      requirements: { kind: '', expression: '', refs: [] },
      promises: { kind: '', expression: '', refs: [] },
    },
    emit: [],
    escalate: [],
    referenceIds: [],
  };
}

export function newPassport(id: string): Passport {
  return { id, upi: { pattern: '', level: '' }, carriers: [], entries: [], referenceIds: [] };
}

export function newInvariant(id: string): Invariant {
  return { id, name: '', statement: '', severity: '', appliesTo: [], source: '', enforcement: { aspirational: false, claims: [] } };
}

export function newFormulasUsed(id: string): FormulasUsed {
  return { id, name: '', description: '', formulas: [], sourceRefs: [] };
}

export function newTextContent(id: string): TextContent {
  return { id, entries: [] };
}

export function newActivityArchetype(id: string): ActivityArchetype {
  return { id, label: '', clause: '', definition: '', parent: '' };
}

export function newCompetenceKind(id: string): CompetenceKind {
  return { id, label: '', definition: '', source: null, methodStandards: [] };
}

export function newPredicate(id: string): RefPredicate {
  return { id, kind: '', description: '', subjectKinds: [], targetKinds: [], resolution: '', inverse: '', transitive: false, symmetric: false };
}

export function newDiscrepancyRecord(id: string): DiscrepancyRecord {
  return { id, status: '', summary: '', sources: [], resolution: '', governing: '', rationale: '' };
}
