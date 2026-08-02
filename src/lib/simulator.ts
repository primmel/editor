// ─────────────────────────────────────────────────────────────────────
// The process simulator (TODO.editor/13) — the canvas-flow stepper:
// a token walks the active page's nodes (start event → processes →
// gateways → end events; a subprocess node descends), exclusive
// gateways branch on their edge conditions over the registers, and
// the trajectory records every stop.
//
// The honest wall: a run is EPHEMERAL. Register values never write
// back into the model — simulation is a teaching surface.
// ─────────────────────────────────────────────────────────────────────

import type { Standard } from '@primmel/primmel';
import type { Subprocess } from './commands';
import { edgeEnds } from './edges';

// ── The condition evaluator ──────────────────────────────────────────
// A small safe expression language over the registers: identifiers,
// numbers, 'strings', true/false, comparisons, &&, ||, !, parens.
// NO eval — recursive descent only.

type Token =
  | { kind: 'num'; value: number }
  | { kind: 'str'; value: string }
  | { kind: 'bool'; value: boolean }
  | { kind: 'ident'; value: string }
  | { kind: 'op'; value: string }
  | { kind: 'lparen' }
  | { kind: 'rparen' };

function tokenize(src: string): Token[] {
  const out: Token[] = [];
  let i = 0;
  while (i < src.length) {
    const c = src[i]!;
    if (/\s/.test(c)) {
      i++;
      continue;
    }
    if (c === '(') {
      out.push({ kind: 'lparen' });
      i++;
    } else if (c === ')') {
      out.push({ kind: 'rparen' });
      i++;
    } else if (/[0-9]/.test(c) || (c === '-' && /[0-9]/.test(src[i + 1] ?? ''))) {
      const m = /^-?\d+(?:\.\d+)?/.exec(src.slice(i))!;
      out.push({ kind: 'num', value: parseFloat(m[0]) });
      i += m[0].length;
    } else if (c === '"' || c === "'") {
      const end = src.indexOf(c, i + 1);
      if (end < 0) throw new Error('unterminated string');
      out.push({ kind: 'str', value: src.slice(i + 1, end) });
      i = end + 1;
    } else if (/[A-Za-z_#]/.test(c)) {
      const m = /^[A-Za-z_#][A-Za-z0-9_.#-]*/.exec(src.slice(i))!;
      const word = m[0];
      if (word === 'true' || word === 'false') {
        out.push({ kind: 'bool', value: word === 'true' });
      } else if (word === 'and' || word === '&&') {
        out.push({ kind: 'op', value: '&&' });
      } else if (word === 'or' || word === '||') {
        out.push({ kind: 'op', value: '||' });
      } else if (word === 'not') {
        out.push({ kind: 'op', value: '!' });
      } else {
        out.push({ kind: 'ident', value: word });
      }
      i += word.length;
    } else {
      const two = src.slice(i, i + 2);
      if (['>=', '<=', '==', '!=', '<>', '&&', '||'].includes(two)) {
        out.push({ kind: 'op', value: two === '<>' ? '!=' : two });
        i += 2;
      } else if (['>', '<', '=', '!', '+', '-', '*', '/'].includes(c)) {
        out.push({ kind: 'op', value: c === '=' ? '==' : c });
        i++;
      } else {
        throw new Error(`unexpected character '${c}'`);
      }
    }
  }
  return out;
}

type Value = number | string | boolean;

/** Evaluate a condition expression over the registers. Unknown
 *  identifiers read as empty string (they compare false against
 *  numbers). Throws on malformed input. */
export function evaluateCondition(src: string, registers: Record<string, string>): boolean {
  const tokens = tokenize(src);
  let pos = 0;

  const peek = () => tokens[pos];
  const eat = () => tokens[pos++];

  function parseOr(): Value {
    let left = parseAnd();
    while (peek()?.kind === 'op' && (peek() as { value: string }).value === '||') {
      eat();
      const right = parseAnd();
      left = Boolean(left) || Boolean(right);
    }
    return left;
  }

  function parseAnd(): Value {
    let left = parseNot();
    while (peek()?.kind === 'op' && (peek() as { value: string }).value === '&&') {
      eat();
      const right = parseNot();
      left = Boolean(left) && Boolean(right);
    }
    return left;
  }

  function parseNot(): Value {
    if (peek()?.kind === 'op' && (peek() as { value: string }).value === '!') {
      eat();
      return !parseNot();
    }
    return parseCompare();
  }

  function parseCompare(): Value {
    const left = parsePrimary();
    const t = peek();
    if (t?.kind === 'op' && ['>=', '<=', '==', '!=', '>', '<'].includes((t as { value: string }).value)) {
      const op = (eat() as { value: string }).value;
      const right = parsePrimary();
      return compare(op, left, right);
    }
    return left;
  }

  function parsePrimary(): Value {
    const t = eat();
    if (!t) throw new Error('unexpected end of expression');
    switch (t.kind) {
      case 'num': return t.value;
      case 'str': return t.value;
      case 'bool': return t.value;
      case 'ident': {
        const raw = registers[t.value] ?? '';
        const num = Number(raw);
        return raw !== '' && !Number.isNaN(num) ? num : raw;
      }
      case 'lparen': {
        const v = parseOr();
        if (peek()?.kind !== 'rparen') throw new Error('missing closing paren');
        eat();
        return v;
      }
      default:
        throw new Error(`unexpected token in expression`);
    }
  }

  function compare(op: string, left: Value, right: Value): boolean {
    if (typeof left === 'number' && typeof right === 'number') {
      switch (op) {
        case '>': return left > right;
        case '<': return left < right;
        case '>=': return left >= right;
        case '<=': return left <= right;
        case '==': return left === right;
        case '!=': return left !== right;
      }
    }
    const ls = String(left);
    const rs = String(right);
    switch (op) {
      case '==': return ls === rs;
      case '!=': return ls !== rs;
      case '>': return ls > rs;
      case '<': return ls < rs;
      case '>=': return ls >= rs;
      case '<=': return ls <= rs;
    }
    return false;
  }

  const result = parseOr();
  if (pos < tokens.length) throw new Error('trailing tokens in expression');
  return Boolean(result);
}

// ── The stepper ──────────────────────────────────────────────────────

export type NodeKind = 'start' | 'end' | 'process' | 'gateway-x' | 'gateway-p' | 'subprocess' | 'data';

export interface TrajectoryEntry {
  seq: number;
  pageId: string;
  nodeId: string;
  kind: NodeKind;
  note: string;
}

export interface SimState {
  /** The page stack (descend/ascend). */
  stack: { pageId: string; nodeId: string }[];
  current: { pageId: string; nodeId: string } | null;
  registers: Record<string, string>;
  trajectory: TrajectoryEntry[];
  done: boolean;
  /** Set when a gateway evaluates no true branch and has no default —
   *  the run waits for a register edit (the panel shows it). */
  blocked: string | null;
  /** The token just ascended from a subprocess page: the subprocess
   *  node it sits on is COMPLETE — the next step follows its outgoing
   *  edges, never descends again. */
  returned?: boolean;
}

function pageOf(model: Standard, pageId: string): Subprocess {
  const page = model.pages.find(p => p.id === pageId);
  if (!page) throw new Error(`unknown page ${pageId}`);
  return page;
}

/** The node kind for the simulator (the model lookup, not render). */
export function simNodeKind(model: Standard, nodeId: string): NodeKind {
  const event = model.events.find(e => e.id === nodeId);
  if (event) return event.eventType === 'start' ? 'start' : 'end';
  const gateway = model.gateways.find(g => g.id === nodeId);
  if (gateway) return gateway.gatewayType === 'parallel_gateway' ? 'gateway-p' : 'gateway-x';
  if (model.dataclasses.some(d => d.id === nodeId) || model.regs.some(r => r.id === nodeId)) return 'data';
  if (model.pages.some(p => p.id === nodeId)) return 'subprocess';
  return 'process';
}

function outgoing(page: Subprocess, nodeId: string): { to: string; condition: string; id: string }[] {
  return (page.edges ?? [])
    .map(e => ({ ends: edgeEnds(e), condition: e.condition ?? '', id: e.id }))
    .filter(e => e.ends.from === nodeId)
    .map(e => ({ to: e.ends.to!, condition: e.condition, id: e.id }));
}

/** Start a run on the root page (or a given page): the token sits on
 *  the first start event. Registers seed from the model's variables
 *  (empty strings — the panel edits them). */
export function createRun(model: Standard, opts: { pageId?: string; registers?: Record<string, string> } = {}): SimState {
  const pageId = opts.pageId ?? model.root?.id ?? model.pages[0]?.id;
  if (!pageId) throw new Error('the model has no pages');
  const page = pageOf(model, pageId);
  const start = (page.childs ?? []).map(c => c.name).find(n => simNodeKind(model, n) === 'start');
  const registers: Record<string, string> = {};
  for (const v of model.variables) registers[v.id] = '';
  Object.assign(registers, opts.registers ?? {});
  const state: SimState = {
    stack: [],
    current: start ? { pageId, nodeId: start } : null,
    registers,
    trajectory: [],
    done: false,
    blocked: null,
  };
  if (start) {
    state.trajectory.push({ seq: 1, pageId, nodeId: start, kind: 'start', note: 'run starts' });
  } else {
    state.done = true;
    state.blocked = 'no start event on the page';
  }
  return state;
}

/** Advance one node. At an exclusive gateway: the first outgoing edge
 *  whose condition evaluates true wins; an unconditioned edge is the
 *  default; none → blocked (edit a register and step again). A
 *  parallel gateway passes through ALL outgoing edges in order (the
 *  linearized teaching walk). A subprocess node descends; an end
 *  event ascends (or completes at the root). */
export function step(model: Standard, state: SimState): SimState {
  if (state.done || !state.current) return state;
  const { pageId, nodeId } = state.current;
  const page = pageOf(model, pageId);
  const kind = simNodeKind(model, nodeId);
  const next: SimState = { ...state, trajectory: [...state.trajectory], stack: [...state.stack], registers: { ...state.registers } };
  next.blocked = null;

  if (kind === 'end') {
    const caller = next.stack.pop();
    if (!caller) {
      next.done = true;
      next.current = null;
      next.trajectory.push({ seq: next.trajectory.length + 1, pageId, nodeId, kind, note: 'run completes' });
      return next;
    }
    next.current = caller;
    // The caller's subprocess node is now complete — the next step
    // continues along its outgoing edges (never re-descends).
    next.returned = true;
    next.trajectory.push({ seq: next.trajectory.length + 1, pageId, nodeId, kind, note: `return to ${caller.nodeId}` });
    return next;
  }

  if (kind === 'subprocess' && !state.returned) {
    const sub = pageOf(model, nodeId);
    const start = (sub.childs ?? []).map(c => c.name).find(n => simNodeKind(model, n) === 'start');
    next.stack.push({ pageId, nodeId });
    if (!start) {
      next.blocked = `page ${nodeId} has no start event`;
      return next;
    }
    next.returned = false;
    next.current = { pageId: nodeId, nodeId: start };
    next.trajectory.push({ seq: next.trajectory.length + 1, pageId: nodeId, nodeId: start, kind: 'start', note: `descend into ${nodeId}` });
    return next;
  }

  const outs = outgoing(page, nodeId);
  if (outs.length === 0) {
    next.done = true;
    next.current = null;
    next.trajectory.push({ seq: next.trajectory.length + 1, pageId, nodeId, kind, note: 'run ends (no outgoing edge)' });
    return next;
  }

  let chosen: { to: string; condition: string; id: string } | null = null;
  let note = '';
  if (kind === 'gateway-x') {
    const conditioned = outs.filter(o => o.condition.trim() !== '');
    for (const o of conditioned) {
      let ok = false;
      try {
        ok = evaluateCondition(o.condition, state.registers);
      } catch {
        ok = false;
      }
      if (ok) {
        chosen = o;
        note = `[${o.condition}] is true`;
        break;
      }
    }
    if (!chosen) {
      const fallback = outs.find(o => o.condition.trim() === '');
      if (fallback) {
        chosen = fallback;
        note = 'default branch';
      } else {
        next.blocked = `no branch of ${nodeId} is true — edit a register and step again`;
        return next;
      }
    }
  } else if (kind === 'gateway-p') {
    // The linearized walk: follow each branch in order — the first
    // this step, the rest queued on the stack.
    const [first, ...rest] = outs;
    chosen = first!;
    note = rest.length > 0 ? `parallel: ${rest.length + 1} branches, walked in order` : '';
    for (const o of rest.reverse()) {
      next.stack.push({ pageId, nodeId: o.to });
    }
  } else {
    chosen = outs[0]!;
  }

  const targetKind = simNodeKind(model, chosen.to);
  next.returned = false;
  next.current = { pageId, nodeId: chosen.to };
  next.trajectory.push({
    seq: next.trajectory.length + 1,
    pageId,
    nodeId: chosen.to,
    kind: targetKind,
    note,
  });
  // An end event completes in the SAME step — arriving is finishing.
  if (targetKind === 'end') {
    const caller = next.stack.pop();
    if (!caller) {
      next.done = true;
      next.current = null;
      next.trajectory.push({ seq: next.trajectory.length + 1, pageId, nodeId: chosen.to, kind: 'end', note: 'run completes' });
    } else {
      next.current = caller;
      next.returned = true;
      next.trajectory.push({ seq: next.trajectory.length + 1, pageId, nodeId: chosen.to, kind: 'end', note: `return to ${caller.nodeId}` });
    }
  }
  return next;
}

/** Reset to the initial state, keeping the register edits or
 *  restoring the empty registers (the honest wall: either way, the
 *  MODEL never changes). */
export function resetRun(model: Standard, opts: { pageId?: string; keepRegisters?: Record<string, string> } = {}): SimState {
  return createRun(model, { pageId: opts.pageId, registers: opts.keepRegisters });
}
