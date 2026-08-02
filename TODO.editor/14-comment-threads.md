# 14 — Element comment threads ✅ DONE (a04762d)

**Wave:** advanced · **Depends on:** 01 · **Priority:** P2

## Goal

The MMEL extension's comments: threaded notes on any element (add,
reply, resolve, delete) — persisted as PRL comments on the model,
with the resolved state visible on the canvas badge.

## Spec

- `src/lib/comments.ts`: the comment model (PRL `comment` constructs:
  text, author, timestamp, parent element, optional parent comment,
  resolved flag) + the thread queries (by element, unresolved count).
- `components/comments/CommentPanel.vue`: per selected element —
  the thread, add/reply, resolve/unresolve toggle, delete; the
  canvas's comment badge with the unresolved count.
- **Audit posture**: comments carry author + timestamp (the session
  user); deletes are real deletes (comments are authoring scratch,
  not certification evidence — the honest note in the UI).

## Homes

1. `src/lib/comments.ts` (+ thread tests).
2. `src/components/comments/CommentPanel.vue` + the badge.

## Acceptance

- Add a thread of 3 comments on a process (one reply); resolve one;
  the badge counts unresolved correctly; the model serializes with
  the comments.
- Delete removes from the AST; undo restores.
- Gates green.
