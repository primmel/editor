// ─────────────────────────────────────────────────────────────────────
// TODO.editor/14 — the comment threads' proofs:
//   - a thread of three (one a reply) with one resolved: the badge
//     counts unresolved correctly; the model serializes with the
//     comments;
//   - delete removes the subtree from the AST; undo restores it;
//   - the thread query orders roots then replies.
// ─────────────────────────────────────────────────────────────────────

import { describe, it, expect } from 'vitest';
import { dump, load, type Standard } from '@primmel/primmel';
import {
  addComment, deleteComment, replyComment, setResolved,
  threadFor, unresolvedByElement, unresolvedCount,
} from '../comments';

const TEXT = `root Root

version "v1.0.0-dev1"

metadata {
  title "T"
  schema "Primmel 0.1"
  namespace "N"
}

role r1 { name "R1" }

process P1 {
  name "P one"
  actor r1
}

process P2 {
  name "P two"
  actor r1
}

canvas Root {
  elements {
    P1 { x 0 y 0 }
    P2 { x 0 y 100 }
  }
  process_flow {
  }
}`;

function fresh(): Standard {
  return load(TEXT);
}

describe('14 — the thread', () => {
  it('three comments (one reply), one resolved: counts + serialization', () => {
    const ast = fresh();
    addComment('P1', 'first review note', 'operator', '2026-08-02T01:00:00Z').apply(ast);
    addComment('P1', 'second note', 'operator', '2026-08-02T02:00:00Z').apply(ast);
    replyComment('C1', 'a reply to the first', 'operator', '2026-08-02T03:00:00Z').apply(ast);
    setResolved('C2', true).apply(ast);

    // The thread orders roots (by time) then replies.
    const thread = threadFor(ast, 'P1');
    expect(thread.map(c => c.id)).toEqual(['C1', 'C3', 'C2']);
    expect(thread[1]!.replyTo).toBe('C1');

    // The badge: C1 + C3 unresolved (C2 resolved).
    expect(unresolvedCount(ast, 'P1')).toBe(2);
    expect(unresolvedCount(ast, 'P2')).toBe(0);
    expect(unresolvedByElement(ast).get('P1')).toBe(2);

    // The model serializes with the comments; the round trip keeps them.
    const text = dump(ast);
    expect(text).toContain('comment C1 {');
    expect(text).toContain('reply_to C1');
    expect(text).toContain('resolved true');
    const reparsed = load(text, { strict: true });
    expect(threadFor(reparsed, 'P1').map(c => c.id)).toEqual(['C1', 'C3', 'C2']);
    expect(unresolvedCount(reparsed, 'P1')).toBe(2);
  });

  it('delete removes the subtree; undo restores it', () => {
    const ast = fresh();
    addComment('P1', 'root note', 'operator', '2026-08-02T01:00:00Z').apply(ast);
    replyComment('C1', 'reply one', 'operator', '2026-08-02T02:00:00Z').apply(ast);
    replyComment('C1', 'reply two', 'operator', '2026-08-02T03:00:00Z').apply(ast);
    addComment('P1', 'independent', 'operator', '2026-08-02T04:00:00Z').apply(ast);
    const before = JSON.parse(JSON.stringify(ast));

    // Deleting C1 takes its replies; C4 (independent) survives.
    const del = deleteComment('C1');
    del.apply(ast);
    expect(ast.comments.map(c => c.id)).toEqual(['C4']);
    del.revert(ast);
    expect(JSON.parse(JSON.stringify(ast))).toEqual(before);
  });

  it('resolve toggles back and forth (unresolve restores the count)', () => {
    const ast = fresh();
    addComment('P1', 'note', 'operator', '2026-08-02T01:00:00Z').apply(ast);
    const cmd = setResolved('C1', true);
    cmd.apply(ast);
    expect(unresolvedCount(ast, 'P1')).toBe(0);
    cmd.revert(ast);
    expect(unresolvedCount(ast, 'P1')).toBe(1);
  });
});
