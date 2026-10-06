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
  /** The measurement-expression rename table (per pattern, with the
   *  corpus counts) — the MMEL v2 expression language → the canonical
   *  aggregators. */
  expressionRenames: { from: string; to: string; count: number }[];
  /** How many expression strings were rewritten. */
  translatedExpressions: number;
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
  'start', 'start_event', 'end', 'end_event', 'timer', 'timer_event',
  'signalcatch', 'signal_catch_event', 'signal_event',
  'canvas', 'subprocess', 'reference', 'note', 'table', 'figure', 'link',
  'comment', 'map_profile', 'view_profile', 'view', 'term', 'requirement',
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
  { from: 'view', to: 'view_profile' },
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
/**
 * The measurement-expression rename table (the MMEL v2 language →
 * the canonical form): bracket variables become identifiers, and the
 * postfix list operators become call-form aggregators over the run
 * scope's list payloads — `sum(X)`, `max(X)`, `min(X)`, `count(X)`,
 * `average(X)`. The kernel runtime evaluates the translated form
 * (the aggregators are runtime-native).
 */
export function translateMeasurementExpression(expr: string): {
  text: string;
  renames: { from: string; to: string; count: number }[];
} {
  const renames: { from: string; to: string; count: number }[] = [];
  let text = expr;
  const postfix =
    /\[([A-Za-z_][A-Za-z0-9_]*)\]\.(sum|max|min|count|average)\b/g;
  text = text.replace(postfix, (_m, id: string, op: string) => {
    renames.push({ from: `[${id}].${op}`, to: `${op}(${id})`, count: 1 });
    return `${op}(${id})`;
  });
  const brackets = /\[([A-Za-z_][A-Za-z0-9_]*)\]/g;
  text = text.replace(brackets, (_m, id: string) => {
    renames.push({ from: `[${id}]`, to: id, count: 1 });
    return id;
  });
  return { text, renames };
}

export function importLegacy(text: string): ImportResult {
  const standard = load(text, { strict: true });

  // The measurement expressions translate (the rename contract's
  // expression table): bracket variables + postfix list operators →
  // identifiers + call-form aggregators. Applied to process measures
  // and DERIVED variable definitions; the translation is reported.
  const expressionRenames: Record<string, number> = {};
  let translatedCount = 0;
  const translate = (expr: string): string => {
    const r = translateMeasurementExpression(expr);
    for (const rn of r.renames) {
      expressionRenames[`${rn.from}→${rn.to}`] =
        (expressionRenames[`${rn.from}→${rn.to}`] ?? 0) + 1;
    }
    if (r.text !== expr) translatedCount++;
    return r.text;
  };
  for (const p of standard.processes) {
    if (Array.isArray(p.measure)) {
      p.measure = p.measure.map(translate);
    }
  }
  for (const v of standard.variables) {
    if ((v.type ?? '') === 'DERIVED' && typeof v.definition === 'string') {
      v.definition = translate(v.definition);
    }
  }

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

  const expressionRenamesList = Object.entries(expressionRenames).map(
    ([k, count]) => {
      const [from, to] = k.split('→');
      return { from, to, count };
    },
  );

  return {
    standard,
    canonical,
    report: {
      constructs,
      renames,
      unknownKeywords,
      validationIssues,
      expressionRenames: expressionRenamesList,
      translatedExpressions: translatedCount,
    },
  };
}
