// ─────────────────────────────────────────────────────────────────────
// The command layer (TODO.editor/01) — every mutation of the model
// AST is a typed command with apply + revert (the undo/redo is exact,
// never a re-derive). Tree, canvas, code, and inspector are
// projections of one store; edits ONLY through here.
// ─────────────────────────────────────────────────────────────────────

import type {
  Approval,
  DataAttribute,
  DataClass,
  EventNode,
  Gateway,
  Metadata,
  Process,
  Standard,
} from '@primmel/primmel';

// The flow shapes (Subprocess/Edge) aren't in the package's public
// exports — declared structurally here (the kernel's flow.d.ts is the
// contract; these mirror it exactly).
export interface SubprocessComponent {
  name: string;
  element: { id: string } | null;
  x: number;
  y: number;
}
export interface Edge {
  id: string;
  from: SubprocessComponent | null;
  to: SubprocessComponent | null;
  description: string;
  condition: string;
}
export interface Subprocess {
  id: string;
  childs: SubprocessComponent[];
  edges: Edge[];
  data: SubprocessComponent[];
}

export interface Command {
  /** Human label for the history list. */
  label: string;
  apply(ast: Standard): void;
  revert(ast: Standard): void;
}

// ── Element lookup (the union of all canvas-placeable kinds) ────────

export type ElementKind =
  | 'process'
  | 'approval'
  | 'dataclass'
  | 'event'
  | 'gateway'
  | 'subprocess';

export type ElementOf<K extends ElementKind> = K extends 'process'
  ? Process
  : K extends 'approval'
    ? Approval
    : K extends 'dataclass'
      ? DataClass
      : K extends 'event'
        ? EventNode
        : K extends 'gateway'
          ? Gateway
          : Subprocess;

export interface ElementRef {
  kind: ElementKind;
  id: string;
}

/** Find any element by id across the AST's element lists. */
export function findElement(ast: Standard, id: string): ElementRef | null {
  if (ast.processes.some(p => p.id === id)) return { kind: 'process', id };
  if (ast.approvals.some(a => a.id === id)) return { kind: 'approval', id };
  if (ast.dataclasses.some(d => d.id === id)) return { kind: 'dataclass', id };
  if (ast.events.some(e => e.id === id)) return { kind: 'event', id };
  if (ast.gateways.some(g => g.id === id)) return { kind: 'gateway', id };
  if (ast.pages.some(p => p.id === id)) return { kind: 'subprocess', id };
  return null;
}

function listFor(ast: Standard, kind: ElementKind): Array<{ id: string }> {
  switch (kind) {
    case 'process': return ast.processes;
    case 'approval': return ast.approvals;
    case 'dataclass': return ast.dataclasses;
    case 'event': return ast.events;
    case 'gateway': return ast.gateways;
    case 'subprocess': return ast.pages;
  }
}

/** Mint the smallest free `{prefix}{n}` id in the package. */
export function mintId(ast: Standard, prefix: string): string {
  const taken = new Set<string>();
  for (const list of [ast.processes, ast.approvals, ast.dataclasses, ast.events, ast.gateways, ast.pages, ast.regs, ast.enums, ast.variables]) {
    for (const x of list) taken.add((x as { id: string }).id);
  }
  for (let n = 1; ; n++) {
    const id = `${prefix}${n}`;
    if (!taken.has(id)) return id;
  }
}

// ── The page an edge lives on ('root' = the root canvas) ────────────
// The root's CONTENT lives in `pages` (resolved, full); `standard.root`
// is the id marker + raw form (empty direct lists).

function pageOf(ast: Standard, pageId: string): Subprocess {
  const id = pageId === 'root' ? ast.root?.id : pageId;
  if (pageId === 'root' && !ast.root) throw new Error('the model has no root canvas');
  const page = ast.pages.find(p => p.id === id);
  if (!page) throw new Error(`unknown subprocess page ${id}`);
  return page;
}

/** An edge's endpoint ids. Resolved edges carry SubprocessComponent
 *  endpoints (name + element.id); the raw form carries `_relations`. */
function edgeEnds(e: Edge): { from?: string; to?: string } {
  const rel = (e as unknown as { _relations?: { from?: string; to?: string } })._relations;
  const comFrom = e.from as { name?: string; element?: { id?: string } | null } | null;
  const comTo = e.to as { name?: string; element?: { id?: string } | null } | null;
  return {
    from: comFrom?.element?.id ?? comFrom?.name ?? rel?.from,
    to: comTo?.element?.id ?? comTo?.name ?? rel?.to,
  };
}

// ── createElement ───────────────────────────────────────────────────

const ELEMENT_DEFAULTS: Record<ElementKind, (id: string) => Process | Approval | DataClass | EventNode | Gateway | Subprocess> = {
  process: id => ({
    id, name: '', modality: 'SHALL', actor: null, output: [], input: [],
    provision: [], provisionRefs: [], page: null, measure: [], parent: '', children: [],
    signature: null, invariants: [], activityKinds: [], segregation: [],
    preconditions: [], executor: '', registers: [], state: '', instances: null,
    childComposition: 'all', does: null, source: null,
  }),
  approval: id => ({ id, name: '', modality: 'SHALL', actor: null, approver: null, records: [], ref: [] }),
  dataclass: id => ({ id, attributes: [] }),
  event: id => ({ id, eventType: 'start' }),
  gateway: id => ({ id, gatewayType: 'exclusive_gateway', label: '' }),
  subprocess: id => ({ id, childs: [], edges: [], data: [] }),
};

export function createElement(
  kind: ElementKind,
  id: string,
  position?: { x: number; y: number },
  pageId = 'root',
): Command {
  return {
    label: `create ${kind} ${id}`,
    apply(ast) {
      const list = listFor(ast, kind);
      if (list.some(x => x.id === id)) throw new Error(`duplicate id ${id}`);
      list.push(ELEMENT_DEFAULTS[kind](id) as never);
      if (kind !== 'subprocess' && position) {
        pageOf(ast, pageId).childs.push({ name: id, element: { id }, x: position.x, y: position.y });
      }
    },
    revert(ast) {
      const list = listFor(ast, kind);
      const i = list.findIndex(x => x.id === id);
      if (i >= 0) list.splice(i, 1);
      // Placements + edges referencing the element vanish with it.
      for (const page of [ast.root, ...ast.pages].filter(Boolean) as Subprocess[]) {
        page.childs = page.childs.filter(c => c.name !== id);
        page.edges = page.edges.filter(e => {
          const ends = edgeEnds(e);
          return ends.from !== id && ends.to !== id;
        });
      }
    },
  };
}

// ── deleteElement ───────────────────────────────────────────────────

export function deleteElement(kind: ElementKind, id: string): Command {
  let captured: { element: unknown; placements: Array<{ pageId: string; index: number; child: unknown }>; edges: Array<{ pageId: string; index: number; edge: Edge }> };
  return {
    label: `delete ${kind} ${id}`,
    apply(ast) {
      const list = listFor(ast, kind);
      const i = list.findIndex(x => x.id === id);
      if (i < 0) throw new Error(`unknown ${kind} ${id}`);
      captured = { element: list[i], placements: [], edges: [] };
      list.splice(i, 1);
      for (const page of [ast.root, ...ast.pages].filter(Boolean) as Subprocess[]) {
        page.childs = page.childs.filter(c => {
          if (c.name === id) {
            captured.placements.push({ pageId: page.id, index: page.childs.indexOf(c), child: c });
            return false;
          }
          return true;
        });
        page.edges = page.edges.filter(e => {
          const ends = edgeEnds(e);
          if (ends.from === id || ends.to === id) {
            captured.edges.push({ pageId: page.id, index: page.edges.indexOf(e), edge: e });
            return false;
          }
          return true;
        });
      }
    },
    revert(ast) {
      listFor(ast, kind).push(captured.element as never);
      for (const p of captured.placements) {
        const page = p.pageId === 'root' ? ast.root! : ast.pages.find(pg => pg.id === p.pageId)!;
        page.childs.splice(Math.min(p.index, page.childs.length), 0, p.child as never);
      }
      for (const e of captured.edges) {
        const page = e.pageId === 'root' ? ast.root! : ast.pages.find(pg => pg.id === e.pageId)!;
        page.edges.splice(Math.min(e.index, page.edges.length), 0, e.edge);
      }
    },
  };
}

// ── updateElement (shallow patch with before-capture) ───────────────

export function updateElement<T extends { id: string }>(
  listOf: (ast: Standard) => T[],
  id: string,
  patch: Partial<T>,
  label?: string,
): Command {
  let before: Partial<T>;
  return {
    label: label ?? `update ${id}`,
    apply(ast) {
      const el = listOf(ast).find(x => x.id === id);
      if (!el) throw new Error(`unknown element ${id}`);
      before = Object.fromEntries(Object.keys(patch).map(k => [k, (el as unknown as Record<string, unknown>)[k]])) as Partial<T>;
      Object.assign(el, patch);
    },
    revert(ast) {
      const el = listOf(ast).find(x => x.id === id);
      if (!el) return;
      Object.assign(el, before);
    },
  };
}

// ── Edges ───────────────────────────────────────────────────────────

export function createEdge(
  pageId: string,
  edgeId: string,
  fromId: string,
  toId: string,
  opts: { condition?: string; description?: string } = {},
): Command {
  return {
    label: `connect ${fromId} → ${toId}`,
    apply(ast) {
      const page = pageOf(ast, pageId);
      if (page.edges.some(e => e.id === edgeId)) throw new Error(`duplicate edge id ${edgeId}`);
      if (!page.childs.some(c => c.name === fromId)) throw new Error(`from ${fromId} is not on page ${pageId}`);
      if (!page.childs.some(c => c.name === toId)) throw new Error(`to ${toId} is not on page ${pageId}`);
      page.edges.push({
        id: edgeId,
        from: { name: fromId, element: { id: fromId }, x: 0, y: 0 },
        to: { name: toId, element: { id: toId }, x: 0, y: 0 },
        description: opts.description ?? '',
        condition: opts.condition ?? '',
      });
    },
    revert(ast) {
      const page = pageOf(ast, pageId);
      page.edges = page.edges.filter(e => e.id !== edgeId);
    },
  };
}

export function removeEdge(pageId: string, edgeId: string): Command {
  let captured: { index: number; edge: Edge };
  return {
    label: `remove edge ${edgeId}`,
    apply(ast) {
      const page = pageOf(ast, pageId);
      const index = page.edges.findIndex(e => e.id === edgeId);
      if (index < 0) throw new Error(`unknown edge ${edgeId}`);
      captured = { index, edge: page.edges[index]! };
      page.edges.splice(index, 1);
    },
    revert(ast) {
      const page = pageOf(ast, pageId);
      page.edges.splice(Math.min(captured.index, page.edges.length), 0, captured.edge);
    },
  };
}

// ── Data axis ───────────────────────────────────────────────────────

export function updateAttribute(
  classId: string,
  attrId: string,
  patch: Partial<DataAttribute>,
): Command {
  let before: Partial<DataAttribute>;
  return {
    label: `update attribute ${classId}.${attrId}`,
    apply(ast) {
      const cls = ast.dataclasses.find(d => d.id === classId);
      if (!cls) throw new Error(`unknown dataclass ${classId}`);
      const attr = cls.attributes.find(a => a.id === attrId);
      if (!attr) throw new Error(`unknown attribute ${classId}.${attrId}`);
      before = Object.fromEntries(Object.keys(patch).map(k => [k, (attr as unknown as Record<string, unknown>)[k]])) as Partial<DataAttribute>;
      Object.assign(attr, patch);
    },
    revert(ast) {
      const cls = ast.dataclasses.find(d => d.id === classId);
      const attr = cls?.attributes.find(a => a.id === attrId);
      if (attr) Object.assign(attr, before);
    },
  };
}

export function addAttribute(classId: string, attr: DataAttribute): Command {
  return {
    label: `add attribute ${classId}.${attr.id}`,
    apply(ast) {
      const cls = ast.dataclasses.find(d => d.id === classId);
      if (!cls) throw new Error(`unknown dataclass ${classId}`);
      if (cls.attributes.some(a => a.id === attr.id)) throw new Error(`duplicate attribute ${attr.id}`);
      cls.attributes.push(attr);
    },
    revert(ast) {
      const cls = ast.dataclasses.find(d => d.id === classId);
      if (cls) cls.attributes = cls.attributes.filter(a => a.id !== attr.id);
    },
  };
}

export function removeAttribute(classId: string, attrId: string): Command {
  let captured: { index: number; attr: DataAttribute };
  return {
    label: `remove attribute ${classId}.${attrId}`,
    apply(ast) {
      const cls = ast.dataclasses.find(d => d.id === classId);
      if (!cls) throw new Error(`unknown dataclass ${classId}`);
      const index = cls.attributes.findIndex(a => a.id === attrId);
      if (index < 0) throw new Error(`unknown attribute ${attrId}`);
      captured = { index, attr: cls.attributes[index]! };
      cls.attributes.splice(index, 1);
    },
    revert(ast) {
      const cls = ast.dataclasses.find(d => d.id === classId);
      if (cls) cls.attributes.splice(Math.min(captured.index, cls.attributes.length), 0, captured.attr);
    },
  };
}

// ── List reorder (enum values, attributes, provisions…) ─────────────

export function reorderList<T extends { id: string }>(
  listOf: (ast: Standard) => T[],
  fromIndex: number,
  toIndex: number,
  label?: string,
): Command {
  return {
    label: label ?? `reorder ${fromIndex} → ${toIndex}`,
    apply(ast) {
      const list = listOf(ast);
      const [item] = list.splice(fromIndex, 1);
      if (item === undefined) throw new Error(`no element at index ${fromIndex}`);
      list.splice(toIndex, 0, item);
    },
    revert(ast) {
      const list = listOf(ast);
      const [item] = list.splice(toIndex, 1);
      if (item === undefined) return;
      list.splice(fromIndex, 0, item);
    },
  };
}

// ── Generic list CRUD (enums, registries, enum values…) ─────────────
// For element kinds with no canvas placement: push/remove by id with
// before-capture, so undo restores the exact slot.

export function createInList<T extends { id: string }>(
  listOf: (ast: Standard) => T[],
  element: T,
  label?: string,
): Command {
  return {
    label: label ?? `create ${element.id}`,
    apply(ast) {
      const list = listOf(ast);
      if (list.some(x => x.id === element.id)) throw new Error(`duplicate id ${element.id}`);
      list.push(element);
    },
    revert(ast) {
      const list = listOf(ast);
      const i = list.findIndex(x => x.id === element.id);
      if (i >= 0) list.splice(i, 1);
    },
  };
}

export function deleteInList<T extends { id: string }>(
  listOf: (ast: Standard) => T[],
  id: string,
  label?: string,
): Command {
  let captured: { index: number; element: T };
  return {
    label: label ?? `delete ${id}`,
    apply(ast) {
      const list = listOf(ast);
      const index = list.findIndex(x => x.id === id);
      if (index < 0) throw new Error(`unknown element ${id}`);
      captured = { index, element: list[index]! };
      list.splice(index, 1);
    },
    revert(ast) {
      const list = listOf(ast);
      list.splice(Math.min(captured.index, list.length), 0, captured.element);
    },
  };
}

// ── Metadata ────────────────────────────────────────────────────────

export function updateMeta(patch: Partial<Metadata>): Command {
  let before: Partial<Metadata>;
  return {
    label: 'update metadata',
    apply(ast) {
      before = Object.fromEntries(Object.keys(patch).map(k => [k, (ast.meta as unknown as Record<string, unknown>)[k]]) as never);
      Object.assign(ast.meta, patch);
    },
    revert(ast) {
      Object.assign(ast.meta, before);
    },
  };
}

// ── Mapping pairs (the v3 MapProfile) ───────────────────────────────

export function createMappingPair(
  namespace: string,
  sourceId: string,
  target: string,
  meta: { description?: string; justification?: string; coverage?: '' | 'full' | 'minimal' | 'partial' | 'none' } = {},
): Command {
  const pair = { target, description: meta.description ?? '', justification: meta.justification ?? '', coverage: meta.coverage ?? '' as const };
  return {
    label: `map ${sourceId} ⇒ ${target}`,
    apply(ast) {
      const profile = ast.mapProfiles.find(p => p.namespace === namespace)
        ?? (() => { const p = { namespace, description: '', mappings: {} as Record<string, typeof pair[]>, coverage: {} }; ast.mapProfiles.push(p); return p; })();
      (profile.mappings[sourceId] ??= []).push(pair);
    },
    revert(ast) {
      const profile = ast.mapProfiles.find(p => p.namespace === namespace);
      if (!profile) return;
      const list = profile.mappings[sourceId] ?? [];
      const i = list.findIndex(p => p.target === target && p.description === pair.description);
      if (i >= 0) list.splice(i, 1);
      if (list.length === 0) delete profile.mappings[sourceId];
    },
  };
}

export function deleteMappingPair(namespace: string, sourceId: string, target: string): Command {
  let captured: { index: number; pair: { target: string; description: string; justification: string; coverage: '' | 'full' | 'minimal' | 'partial' | 'none' } };
  return {
    label: `unmap ${sourceId} ⇒ ${target}`,
    apply(ast) {
      const profile = ast.mapProfiles.find(p => p.namespace === namespace);
      const list = profile?.mappings[sourceId];
      if (!list) throw new Error(`no mappings for ${sourceId} in ${namespace}`);
      const index = list.findIndex(p => p.target === target);
      if (index < 0) throw new Error(`no mapping ${sourceId} ⇒ ${target}`);
      captured = { index, pair: list[index]! };
      list.splice(index, 1);
    },
    revert(ast) {
      const profile = ast.mapProfiles.find(p => p.namespace === namespace);
      if (!profile) return;
      (profile.mappings[sourceId] ??= []).splice(Math.min(captured.index, (profile.mappings[sourceId] ?? []).length), 0, captured.pair);
    },
  };
}

export function updateMappingMeta(
  namespace: string,
  sourceId: string,
  target: string,
  patch: { description?: string; justification?: string; coverage?: '' | 'full' | 'minimal' | 'partial' | 'none' },
): Command {
  let before: typeof patch;
  return {
    label: `update mapping ${sourceId} ⇒ ${target}`,
    apply(ast) {
      const pair = ast.mapProfiles.find(p => p.namespace === namespace)?.mappings[sourceId]?.find(p => p.target === target);
      if (!pair) throw new Error(`no mapping ${sourceId} ⇒ ${target}`);
      before = Object.fromEntries(Object.keys(patch).map(k => [k, (pair as unknown as Record<string, unknown>)[k]]) as never);
      Object.assign(pair, patch);
    },
    revert(ast) {
      const pair = ast.mapProfiles.find(p => p.namespace === namespace)?.mappings[sourceId]?.find(p => p.target === target);
      if (pair) Object.assign(pair, before);
    },
  };
}

// ── Canvas component position (the drag commit, TODO.editor/02) ─────

export function updateComponentPosition(
  pageId: string,
  elementId: string,
  x: number,
  y: number,
): Command {
  let before: { x: number; y: number };
  return {
    label: `move ${elementId} to (${Math.round(x)}, ${Math.round(y)})`,
    apply(ast) {
      const page = pageOf(ast, pageId);
      const comp = page.childs.find(c => c.name === elementId);
      if (!comp) throw new Error(`component ${elementId} is not on page ${pageId}`);
      before = { x: comp.x, y: comp.y };
      comp.x = Math.round(x);
      comp.y = Math.round(y);
    },
    revert(ast) {
      const page = pageOf(ast, pageId);
      const comp = page.childs.find(c => c.name === elementId);
      if (comp) { comp.x = before.x; comp.y = before.y; }
    },
  };
}

/** The root page id (the root canvas's content page — `standard.root`
 *  is only the marker). */
export function rootPageId(ast: Standard): string | null {
  return ast.root?.id ?? null;
}

// ── Subprocess pages (TODO.editor/06) ───────────────────────────────

/** Create a fresh page and link it as `processId`'s subprocess page —
 *  one command, one undo unit (the palette's drill-down path). */
export function createPageForProcess(processId: string): Command {
  let mintedId: string | null = null;
  return {
    label: `create page for ${processId}`,
    apply(ast) {
      const proc = ast.processes.find(p => p.id === processId);
      if (!proc) throw new Error(`unknown process ${processId}`);
      if (proc.page) throw new Error(`${processId} already has a page`);
      if (mintedId === null) mintedId = mintId(ast, 'Page');
      if (ast.pages.some(p => p.id === mintedId)) throw new Error(`duplicate page ${mintedId}`);
      const page = { id: mintedId, childs: [], edges: [], data: [] } as never;
      ast.pages.push(page);
      (proc as { page: unknown }).page = ast.pages.find(p => p.id === mintedId);
    },
    revert(ast) {
      const proc = ast.processes.find(p => p.id === processId);
      if (proc) (proc as { page: unknown }).page = null;
      if (mintedId !== null) {
        const i = ast.pages.findIndex(p => p.id === mintedId);
        if (i >= 0) ast.pages.splice(i, 1);
      }
    },
  };
}

/** Link a process to an existing page (or unlink with null). */
export function linkProcessToPage(processId: string, pageId: string | null): Command {
  let before: unknown;
  return {
    label: pageId ? `link ${processId} → page ${pageId}` : `unlink ${processId}`,
    apply(ast) {
      const proc = ast.processes.find(p => p.id === processId);
      if (!proc) throw new Error(`unknown process ${processId}`);
      const page = pageId ? ast.pages.find(p => p.id === pageId) : null;
      if (pageId && !page) throw new Error(`unknown page ${pageId}`);
      before = (proc as { page: unknown }).page;
      (proc as { page: unknown }).page = page ?? null;
    },
    revert(ast) {
      const proc = ast.processes.find(p => p.id === processId);
      if (proc) (proc as { page: unknown }).page = before;
    },
  };
}

/** Rename a page: the id, every process's `page` copy (the resolver
 *  strips `_relations` — a process holds a COPY of its page, identity
 *  is by id, so both sides move), plus every placement and edge
 *  endpoint that names it (a subprocess node's placement name IS its
 *  page id). */
export function renamePage(oldId: string, newId: string): Command {
  const clean = newId.trim();
  return {
    label: `rename page ${oldId} → ${clean}`,
    apply(ast) {
      if (!clean) throw new Error('the page id cannot be empty');
      if (clean === oldId) return;
      const page = ast.pages.find(p => p.id === oldId);
      if (!page) throw new Error(`unknown page ${oldId}`);
      if (findElement(ast, clean) || ast.regs.some(r => r.id === clean) || ast.enums.some(e => e.id === clean)) {
        throw new Error(`id ${clean} is already taken`);
      }
      page.id = clean;
      for (const proc of ast.processes) {
        const linked = (proc as { page?: { id?: string } | null }).page;
        if (linked?.id === oldId) linked.id = clean;
      }
      for (const host of ast.pages) {
        for (const comp of [...(host.childs ?? []), ...(host.data ?? [])]) {
          if (comp.name === oldId) {
            comp.name = clean;
            if (comp.element) comp.element = { id: clean };
          }
        }
        for (const e of host.edges ?? []) {
          const ends = [
            e.from as { name?: string; element?: { id: string } | null } | null,
            e.to as { name?: string; element?: { id: string } | null } | null,
          ];
          for (const end of ends) {
            if (end?.name === oldId) {
              end.name = clean;
              if (end.element) end.element = { id: clean };
            }
          }
        }
      }
    },
    revert(ast) {
      const page = ast.pages.find(p => p.id === clean);
      if (!page) return;
      page.id = oldId;
      for (const proc of ast.processes) {
        const linked = (proc as { page?: { id?: string } | null }).page;
        if (linked?.id === clean) linked.id = oldId;
      }
      for (const host of ast.pages) {
        for (const comp of [...(host.childs ?? []), ...(host.data ?? [])]) {
          if (comp.name === clean) {
            comp.name = oldId;
            if (comp.element) comp.element = { id: oldId };
          }
        }
        for (const e of host.edges ?? []) {
          const ends = [
            e.from as { name?: string; element?: { id: string } | null } | null,
            e.to as { name?: string; element?: { id: string } | null } | null,
          ];
          for (const end of ends) {
            if (end?.name === clean) {
              end.name = oldId;
              if (end.element) end.element = { id: oldId };
            }
          }
        }
      }
    },
  };
}
