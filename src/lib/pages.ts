// ─────────────────────────────────────────────────────────────────────
// The page tree (TODO.editor/06) — pure: the subprocess-page hierarchy
// (root → linked pages → nested), the neighbor map (up/down), the
// breadcrumb path, and the orphan audit. No DOM, no commands.
//
// The linking rule: a process placed ON a page whose `page` facet is
// set makes that target page a CHILD of the host page. A subprocess
// node placed directly (the page-as-element) is a child too. Cycles
// are legal in the AST (A links B, B links A); every walk here is
// visited-set guarded.
// ─────────────────────────────────────────────────────────────────────

import type { Standard } from '@primmel/primmel';
import type { Subprocess } from './commands';

export interface PageNode {
  id: string;
  children: PageNode[];
}

/** The root page id (the root canvas's content page). */
export function rootId(ast: Standard): string | null {
  return ast.root?.id ?? null;
}

/** The page ids reachable DOWN from `pageId`: pages linked by the
 *  processes placed on it, plus subprocess pages placed directly. */
export function childPagesOf(ast: Standard, pageId: string): string[] {
  const page = ast.pages.find(p => p.id === pageId);
  if (!page) return [];
  const out: string[] = [];
  for (const comp of page.childs ?? []) {
    // A subprocess page placed as a node: the placement name IS the page.
    if (comp.name !== pageId && ast.pages.some(p => p.id === comp.name)) {
      if (!out.includes(comp.name)) out.push(comp.name);
      continue;
    }
    const proc = ast.processes.find(pr => pr.id === comp.name);
    const linked = (proc?.page as { id?: string } | null)?.id;
    if (linked && linked !== pageId && ast.pages.some(p => p.id === linked)) {
      if (!out.includes(linked)) out.push(linked);
    }
  }
  return out;
}

/** The page a given page descends FROM (BFS parent — the shortest
 *  path's predecessor; a page linked from two hosts reports the one
 *  nearest the root). Null for the root and for orphans. */
export function parentPageOf(ast: Standard, pageId: string): string | null {
  const root = rootId(ast);
  if (!root || pageId === root) return null;
  return bfsPath(ast, pageId)?.at(-2) ?? null;
}

/** The breadcrumb path root → … → pageId (BFS shortest, cycle-safe).
 *  Null when the page is unreachable from the root (orphan). */
export function pagePath(ast: Standard, pageId: string): string[] | null {
  return bfsPath(ast, pageId);
}

function bfsPath(ast: Standard, pageId: string): string[] | null {
  const root = rootId(ast);
  if (!root) return null;
  if (pageId === root) return [root];
  const prev = new Map<string, string | null>([[root, null]]);
  const queue = [root];
  while (queue.length > 0) {
    const cur = queue.shift()!;
    for (const next of childPagesOf(ast, cur)) {
      if (prev.has(next)) continue;
      prev.set(next, cur);
      if (next === pageId) {
        const path = [next];
        let p: string | null | undefined = cur;
        while (p) {
          path.unshift(p);
          p = prev.get(p);
        }
        return path;
      }
      queue.push(next);
    }
  }
  return null;
}

/** The full hierarchy from the root (cycle-safe: a page appears under
 *  its FIRST reachable parent only). */
export function buildPageTree(ast: Standard): PageNode | null {
  const root = rootId(ast);
  if (!root) return null;
  const seen = new Set<string>([root]);
  const build = (id: string): PageNode => {
    const children = childPagesOf(ast, id)
      .filter(c => !seen.has(c))
      .map(c => {
        seen.add(c);
        return build(c);
      });
    return { id, children };
  };
  return build(root);
}

/** The neighbor map (the MMEL's up/down navigation set): the parent
 *  page and the child pages of the current one. */
export function neighborsOf(ast: Standard, pageId: string): { up: string | null; down: string[] } {
  return { up: parentPageOf(ast, pageId), down: childPagesOf(ast, pageId) };
}

/** Pages unreachable from the root (legal, serializable, but dead
 *  weight until a process links them — the tree shows them apart). */
export function orphanPages(ast: Standard): string[] {
  const root = rootId(ast);
  if (!root) return ast.pages.map(p => p.id);
  const reachable = new Set<string>([root]);
  const queue = [root];
  while (queue.length > 0) {
    const cur = queue.shift()!;
    for (const next of childPagesOf(ast, cur)) {
      if (!reachable.has(next)) {
        reachable.add(next);
        queue.push(next);
      }
    }
  }
  return ast.pages.map(p => p.id).filter(id => !reachable.has(id));
}

/** Find a page by id (the root content page included). */
export function findPage(ast: Standard, pageId: string): Subprocess | null {
  return ast.pages.find(p => p.id === pageId) ?? null;
}
