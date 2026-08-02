# 20 — The Monaco code editor (the PRL language mode)

**Wave:** polish · **Depends on:** 01 · **Priority:** P2

## Goal

The text projection of the model (Monaco, already a dependency): the
PRL language mode — syntax highlighting, completion from the model's
own vocabulary (roles, provisions, vars, enums, ids), validation
markers from the kernel, and two-way sync with the AST (text edits
parse into the store; AST edits re-render the text).

## Spec

- `src/lib/monaco-prl.ts`: the language mode — tokenizer for the PRL
  grammar (keywords, strings, ids, comments), completion items from
  the live AST (role ids after `actor`, provision ids after
  `validate_provision`, enum values after a typed field), and the
  validation markers (kernel `validate` → Monaco markers).
- `components/CodeEditor.vue`: the Monaco surface; edit → debounce →
  parse into the store (parse errors shown inline, the AST untouched
  until the text parses); AST edits elsewhere → the text re-renders
  (with the cursor preserved where possible).
- **The single-writer discipline**: text edits and canvas edits never
  race (the store serializes them; the text re-render is debounced
  and cursor-stable).

## Homes

1. `src/lib/monaco-prl.ts` (+ tokenizer/completion tests).
2. `components/CodeEditor.vue`.

## Acceptance

- Type a new process in text: it appears in tree/canvas after
  parse; a syntax error marks inline with the kernel's message.
- Completion after `actor` lists the model's roles.
- Canvas edit re-renders the text byte-clean; the cursor survives.
- Gates green.
