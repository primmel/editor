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
