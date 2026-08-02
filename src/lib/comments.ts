// ─────────────────────────────────────────────────────────────────────
// The comment threads (TODO.editor/14) — thread queries over the
// kernel's `comment` constructs + the command factories (add, reply,
// resolve, delete). Comments are authoring scratch: they carry author
// + timestamp provenance, and delete really deletes (the subtree —
// a root's replies go with it, never orphaned).
// ─────────────────────────────────────────────────────────────────────

import type { Comment, Standard } from '@primmel/primmel';
import { createInList, deleteInList, mintId, updateElement, type Command } from './commands';

/** The thread for one element, ordered: roots first (by timestamp),
 *  each followed by its replies. */
export function threadFor(model: Standard, elementId: string): Comment[] {
  const mine = model.comments
    .filter(c => c.on === elementId)
    .sort((a, b) => a.timestamp.localeCompare(b.timestamp) || a.id.localeCompare(b.id));
  const out: Comment[] = [];
  const repliesOf = (id: string) => mine.filter(c => c.replyTo === id);
  for (const root of mine.filter(c => c.replyTo === null)) {
    out.push(root, ...repliesOf(root.id));
  }
  // Orphaned replies (their root was deleted outside the command) — still shown.
  for (const c of mine) {
    if (c.replyTo !== null && !mine.some(r => r.id === c.replyTo)) out.push(c);
  }
  return out;
}

/** The unresolved count for one element (the canvas badge). */
export function unresolvedCount(model: Standard, elementId: string): number {
  return model.comments.filter(c => c.on === elementId && !c.resolved).length;
}

/** Element id → unresolved count (the badge map, zero-count elements
 *  omitted). */
export function unresolvedByElement(model: Standard): Map<string, number> {
  const out = new Map<string, number>();
  for (const c of model.comments) {
    if (c.resolved) continue;
    out.set(c.on, (out.get(c.on) ?? 0) + 1);
  }
  return out;
}

/** Add a thread-root comment on an element. */
export function addComment(elementId: string, text: string, author: string, timestamp = new Date().toISOString()): Command {
  return {
    label: `comment on ${elementId}`,
    apply(ast) {
      const id = mintId(ast, 'C');
      const comment: Comment = { id, on: elementId, author, timestamp, text, replyTo: null, resolved: false };
      createInList((a: Standard) => a.comments, comment).apply(ast);
    },
    revert(ast) {
      // The minted id re-derives (no new comments can exist between
      // apply and revert for the same command in the history stack).
      const mine = ast.comments.filter(c => c.on === elementId && c.text === text && c.replyTo === null);
      const last = mine[mine.length - 1];
      if (last) deleteInList((a: Standard) => a.comments, last.id).apply(ast);
    },
  };
}

/** Reply to a comment. */
export function replyComment(parentId: string, text: string, author: string, timestamp = new Date().toISOString()): Command {
  return {
    label: `reply to ${parentId}`,
    apply(ast) {
      const parent = ast.comments.find(c => c.id === parentId);
      if (!parent) throw new Error(`unknown comment ${parentId}`);
      const id = mintId(ast, 'C');
      const comment: Comment = { id, on: parent.on, author, timestamp, text, replyTo: parentId, resolved: false };
      createInList((a: Standard) => a.comments, comment).apply(ast);
    },
    revert(ast) {
      const mine = ast.comments.filter(c => c.replyTo === parentId && c.text === text);
      const last = mine[mine.length - 1];
      if (last) deleteInList((a: Standard) => a.comments, last.id).apply(ast);
    },
  };
}

/** Resolve / unresolve. */
export function setResolved(id: string, resolved: boolean): Command {
  return updateElement((a: Standard) => a.comments, id, { resolved }, `${resolved ? 'resolve' : 'unresolve'} ${id}`);
}

/** Delete a comment and its reply subtree (replies are never
 *  orphaned). */
export function deleteComment(id: string): Command {
  let captured: { index: number; comment: Comment }[] = [];
  return {
    label: `delete comment ${id}`,
    apply(ast) {
      captured = [];
      const doomed = new Set<string>([id]);
      let grew = true;
      while (grew) {
        grew = false;
        for (const c of ast.comments) {
          if (c.replyTo && doomed.has(c.replyTo) && !doomed.has(c.id)) {
            doomed.add(c.id);
            grew = true;
          }
        }
      }
      for (let i = ast.comments.length - 1; i >= 0; i--) {
        const c = ast.comments[i]!;
        if (doomed.has(c.id)) {
          captured.unshift({ index: i, comment: c });
          ast.comments.splice(i, 1);
        }
      }
    },
    revert(ast) {
      for (const { index, comment } of captured) {
        ast.comments.splice(Math.min(index, ast.comments.length), 0, comment);
      }
      captured = [];
    },
  };
}
