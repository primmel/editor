// ─────────────────────────────────────────────────────────────────────
// The PRL language service (TODO.editor/20) — the pure helpers behind
// the Monaco surface: completion contexts (which vocabulary fills the
// slot), completion items from the live AST, and validation markers
// from the kernel. Monaco itself stays in the component; these are
// the testable semantics.
// ─────────────────────────────────────────────────────────────────────

import { PRIMITIVE_TYPES, type Standard, type ValidationIssue } from '@primmel/primmel';

export type CompletionContext =
  | { kind: 'role' }             // after `actor`
  | { kind: 'provision' }        // inside validate_provision { … }
  | { kind: 'registry' }         // inside output { … } / reference_data_registry { … }
  | { kind: 'page' }             // after `subprocess` / `canvas`
  | { kind: 'dataclass' }        // after `data_class`
  | { kind: 'reference' }        // inside a reference { … } block
  | { kind: 'datatype' }         // after an attribute's `:` or `type`
  | { kind: 'keyword' }          // top-level / block heads
  | { kind: 'none' };

/** The top-level construct keywords (the block heads) — the legacy set
 *  plus the full v3 vocabulary the tree now authors (wave 03). */
export const CONSTRUCT_KEYWORDS = [
  'role', 'provision', 'process', 'approval', 'class', 'enum',
  'data_registry', 'variable', 'measurement',
  'start_event', 'end_event', 'timer_event', 'signal_event',
  'exclusive_gateway', 'parallel_gateway', 'canvas', 'subprocess',
  'reference', 'note', 'table', 'figure', 'link', 'comment',
  'map_profile', 'view_profile', 'term', 'requirement',
  'conformance_test', 'conformance_class', 'form', 'subform',
  'subject', 'instrument', 'state_machine', 'calculation', 'symbol',
  'verdict', 'behavior', 'capability', 'condition_set',
  'test_sequence', 'test_point_set', 'constraint', 'reference_material',
  'quantity_register', 'dual', 'instance', 'artifact_definition',
  'artifact_instance', 'attribute_definition', 'monitor', 'passport',
  'connector_profile', 'invariant', 'formulas_used', 'text',
  'dataspace', 'policy', 'activity_archetype', 'competence_kind',
  'predicate', 'discrepancy_record',
];

/** Detect the completion context from the text before the cursor
 *  (the current line's prefix plus a look-back for the enclosing
 *  block head — block bodies complete from the block's vocabulary). */
export function completionContext(textBefore: string): CompletionContext {
  const line = textBefore.split('\n').pop() ?? '';

  // The immediate-prefix contexts (this line).
  if (/(^|\s)actor\s+[A-Za-z0-9_]*$/.test(line)) return { kind: 'role' };
  if (/(^|\s)(subprocess|canvas)\s+[A-Za-z0-9_]*$/.test(line)) return { kind: 'page' };
  if (/(^|\s)data_class\s+[A-Za-z0-9_]*$/.test(line)) return { kind: 'dataclass' };
  if (/:\s*[A-Za-z0-9_(]*$/.test(line) && /^\s*[A-Za-z_][A-Za-z0-9_]*\s*:/.test(line)) {
    return { kind: 'datatype' };
  }
  if (/(^|\s)type\s+[A-Za-z0-9_(]*$/.test(line)) return { kind: 'datatype' };

  // The enclosing-block contexts (look back for the nearest unclosed
  // block head).
  const stack: string[] = [];
  for (const raw of textBefore.split('\n')) {
    const l = raw.trim();
    const head = /^([a-z_][a-z_0-9]*)\s*(\{|$)/.exec(l);
    if (head && l.endsWith('{')) stack.push(head[1]!);
    else if (l === '}') stack.pop();
  }
  const enclosing = stack[stack.length - 1];
  switch (enclosing) {
    case 'validate_provision': return { kind: 'provision' };
    case 'output':
    case 'reference_data_registry':
    case 'input': return { kind: 'registry' };
    case 'reference': return { kind: 'reference' };
    default: break;
  }

  // A line starting a construct (top level or inside a process body).
  if (/^\s*[a-z_]*$/.test(line)) return { kind: 'keyword' };
  return { kind: 'none' };
}

export interface CompletionItem {
  label: string;
  kind: 'id' | 'keyword' | 'type';
  detail?: string;
}

/** The completion items for a context, drawn from the live AST. */
export function completionItemsFor(context: CompletionContext, ast: Standard): CompletionItem[] {
  switch (context.kind) {
    case 'role':
      return ast.roles.map(r => ({ label: r.id, kind: 'id', detail: r.name }));
    case 'provision':
      // validate_provision binds provisions on legacy models and
      // requirement ids on v3 packages (audit G6) — complete both.
      return [
        ...ast.provisions.map(p => ({ label: p.id, kind: 'id' as const, detail: `provision ${p.modality}` })),
        ...ast.requirements.map(r => ({ label: r.id, kind: 'id' as const, detail: `requirement ${r.name || ''}`.trim() })),
      ];
    case 'registry':
      return ast.regs.map(r => ({ label: r.id, kind: 'id', detail: r.title }));
    case 'page':
      return ast.pages.map(p => ({ label: p.id, kind: 'id' }));
    case 'dataclass':
      return ast.dataclasses.map(d => ({ label: d.id, kind: 'id' }));
    case 'reference':
      return ast.references.map(r => ({ label: r.id, kind: 'id', detail: r.document }));
    case 'datatype':
      return [
        ...PRIMITIVE_TYPES.map(t => ({ label: t, kind: 'type' as const })),
        { label: 'QuantityValue', kind: 'type' },
        ...ast.dataclasses.map(d => ({ label: `reference(${d.id})`, kind: 'type' as const })),
        ...ast.enums.map(e => ({ label: e.id, kind: 'type' as const })),
      ];
    case 'keyword':
      return CONSTRUCT_KEYWORDS.map(k => ({ label: k, kind: 'keyword' }));
    case 'none':
      return [];
  }
}

export interface MarkerData {
  startLineNumber: number;
  startColumn: number;
  endLineNumber: number;
  endColumn: number;
  message: string;
  severity: 'error' | 'warning' | 'info';
}

/** The kernel's validation issues as Monaco markers. */
export function markersFromIssues(issues: ValidationIssue[]): MarkerData[] {
  return issues.map(issue => {
    const line = issue.position?.line ?? 1;
    const col = issue.position?.col ?? 1;
    return {
      startLineNumber: line,
      startColumn: col,
      endLineNumber: line,
      endColumn: col + 80,
      message: `[${issue.code}] ${issue.message}`,
      severity: issue.severity,
    };
  });
}

/** A parse error's marker (the strict parse throws with a `line N`
 *  in the message — line 1 when it doesn't). */
export function markerFromParseError(message: string): MarkerData {
  const lineMatch = /line\s+(\d+)/i.exec(message);
  const line = lineMatch ? parseInt(lineMatch[1]!, 10) : 1;
  return {
    startLineNumber: line,
    startColumn: 1,
    endLineNumber: line,
    endColumn: 1000,
    message,
    severity: 'error',
  };
}
