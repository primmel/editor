// ─────────────────────────────────────────────────────────────────────
// The legacy .mmel import (TODO.editor/15) — the v1/v2 DSL corpus
// comes home. Primmel v3 IS the descendant: the kernel parses the
// legacy grammar natively (strict). The importer's job is the
// HONEST report: what converted, what the canonical form renames,
// and anything with no v3 home — named, never silently dropped.
// ─────────────────────────────────────────────────────────────────────

import { dump, load, validate, type Standard } from '@primmel/primmel';

export interface ImportReport {
  /** What the file declares (from the parsed AST). */
  constructs: { kind: string; count: number }[];
  /** Legacy spellings the canonical form renames (with counts). */
  renames: { from: string; to: string; count: number }[];
  /** Top-level keywords with no v3 home (never silently dropped). */
  unknownKeywords: { keyword: string; count: number }[];
  /** The kernel validator's issues on the converted model. */
  validationIssues: string[];
}

export interface ImportResult {
  standard: Standard;
  /** The canonical PRL (the serializer's form). */
  canonical: string;
  report: ImportReport;
}

/** The v3 top-level keyword vocabulary (the known homes). */
const KNOWN_KEYWORDS = new Set([
  'root', 'version', 'metadata', 'role', 'provision', 'process', 'approval',
  'class', 'enum', 'data_registry', 'variable', 'measurement',
  'exclusive_gateway', 'parallel_gateway',
  'start', 'start_event', 'end', 'end_event', 'timer', 'timer_event', 'signal_event',
  'canvas', 'subprocess', 'reference', 'note', 'table', 'figure', 'link',
  'comment', 'map_profile', 'view_profile', 'term', 'requirement',
  'requirement_class', 'conformance_test', 'conformance_class', 'form', 'subform',
  'symbol', 'calculation', 'state_machine', 'verdict', 'reference_material',
  'competence_kind', 'constraint', 'discrepancy_record', 'test_point_set',
  'subject', 'instrument', 'behavior', 'capability', 'condition_set',
  'attribute_definition', 'instance', 'artifact_definition', 'artifact_instance',
  'connector_profile', 'monitor', 'passport', 'invariant', 'test_sequence',
  'formulas_used', 'text', 'quantity_register', 'dual', 'activity_archetype',
  'package', 'use', 'include',
]);

/** The legacy spellings and their canonical forms. */
const RENAMES: { from: string; to: string }[] = [
  { from: 'measurement', to: 'variable' },
  { from: 'subprocess', to: 'canvas' },
];

/** The top-level keyword inventory of a source text: column-zero
 *  `keyword` tokens, with quoted-string contents and brace-nested
 *  content skipped (prose wraps at column zero are inside a quote —
 *  they are not keywords). */
export function keywordInventory(text: string): Map<string, number> {
  const out = new Map<string, number>();
  let inQuote = false;
  let depth = 0;
  for (const line of text.split(/\r?\n/)) {
    // Scan the line tracking quote state (escaped quotes don't toggle).
    let i = 0;
    let firstToken: string | null = null;
    if (depth === 0 && !inQuote) {
      const m = /^([a-z_][a-z_0-9]*)\b/.exec(line);
      if (m) firstToken = m[1];
    }
    for (; i < line.length; i++) {
      const c = line[i]!;
      if (c === '\\' && inQuote) {
        i++; // the escaped character never toggles
        continue;
      }
      if (c === '"') {
        inQuote = !inQuote;
      } else if (!inQuote) {
        if (c === '{') depth++;
        else if (c === '}') depth = Math.max(0, depth - 1);
      }
    }
    if (firstToken) out.set(firstToken, (out.get(firstToken) ?? 0) + 1);
  }
  return out;
}

/** Import a legacy .mmel text: strict-parse with the kernel, emit the
 *  canonical form, and report everything (converted, renamed,
 *  unknown, validation). Throws the parse error on a malformed file. */
export function importLegacy(text: string): ImportResult {
  const standard = load(text, { strict: true });
  const canonical = dump(standard);

  const constructs: { kind: string; count: number }[] = [];
  const lists: [string, unknown[]][] = [
    ['process', standard.processes],
    ['approval', standard.approvals],
    ['role', standard.roles],
    ['provision', standard.provisions],
    ['class', standard.dataclasses],
    ['enum', standard.enums],
    ['data_registry', standard.regs],
    ['variable', standard.variables],
    ['event', standard.events],
    ['gateway', standard.gateways],
    ['canvas', standard.pages],
    ['reference', standard.references],
    ['note', standard.notes],
    ['table', standard.tables],
    ['figure', standard.figures],
    ['link', standard.links],
    ['comment', standard.comments],
    ['map_profile', standard.mapProfiles],
  ];
  for (const [kind, list] of lists) {
    if (list.length > 0) constructs.push({ kind, count: list.length });
  }

  const inventory = keywordInventory(text);
  const renames = RENAMES
    .map(r => ({ ...r, count: inventory.get(r.from) ?? 0 }))
    .filter(r => r.count > 0);

  const unknownKeywords = [...inventory.entries()]
    .filter(([k]) => !KNOWN_KEYWORDS.has(k))
    .map(([keyword, count]) => ({ keyword, count }));

  const validationIssues = validate(standard).map(i => i.message);

  return { standard, canonical, report: { constructs, renames, unknownKeywords, validationIssues } };
}
