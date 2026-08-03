# The quickstart — your first 15 minutes

You will create a model, edit it on the canvas and in the inspector,
draw a second model, map them, and save — touching every projection of
the Studio once. Follow it live, then read [the
workspace](the-workspace.md) for the rules per surface.

## 1 · Boot

```bash
cd ~/src/primmel/editor
npm install
npm run dev        # → http://localhost:5173
```

The Studio opens on a small sample (a manufacturing pipeline) so the
canvas is never empty. The topbar shows the model stats (processes,
provisions, canvases) and the **validation badge** — the kernel's
verdict on the current model, always visible: green ✓ clean, amber
warnings, red errors.

## 2 · Create your own model (2 minutes)

Topbar **New** (or Ctrl+N). Three kinds:

- **Blank** — the minimal working model.
- **Reference** — the standard you comply with (a normative skeleton).
- **Implementation** — your operations that comply (it carries a
  note pointing at the Mapping view).

Pick **Implementation**, title `Acme Lab`, namespace `AcmeLab` →
**create**. The workspace boots your model: one role, one process
(`FirstProcess`), a start/end flow on the canvas.

## 3 · Edit on the canvas (3 minutes)

- **Add a process**: click **Process** in the palette (left, "click to
  add at center") — `P1` lands on the canvas.
- **Name it**: click the node; the inspector (right) opens — set name
  `Verify the sample`, actor `AcmeLab`, modality SHALL.
- **Connect**: shift+drag from `FirstProcess` to `P1` — an edge
  appears. Try shift+dragging the same pair again: the canvas refuses
  out loud ("already connected"). Cross-page and self-loop edges
  refuse the same way.
- **Move**: drag the nodes anywhere; the position commits as a command.

## 4 · Edit in the inspector (2 minutes)

Select `FirstProcess`. The inspector is the facet editor — name,
actor, modality, validate_provision, output/input registries,
measurements, and the **subprocess page** field. Every edit is a
command (undoable with the store's history).

## 5 · The text projection (2 minutes)

Left panel → **Code** tab. The Monaco editor shows your model as PRL
text — completion after `actor ` lists your roles; a syntax error
marks inline with the kernel's message. Type a new process block; it
appears in tree and canvas the moment it parses. The AST and the text
are two projections of one truth — canvas edits rewrite the text
byte-clean; text edits re-parse into the AST.

## 6 · Map onto a reference (3 minutes)

Create a second model (New → Reference, `WalkRef`, then switch back
is not needed — read on): the Mapping view keeps **your current model
as the implementation** and loads any `.prl` as the reference.

Topbar → **Mapping** → **load reference model** → pick any reference
`.prl` (or your saved WalkRef). Now:

1. Click an element in the REF pane, then its partner in the IMP pane.
2. The pair dialog opens — write the description (how the fulfilment
   works) and justification (why the claim holds); confirm.
3. The overlay edge draws between the panes, and the **coverage
   tints** appear: the REF node glows green (covered), your IMP node
   glows green (mapped), unmapped REF nodes stay slate.

The numbers are the kernel's own coverage calculus — never a Studio
recomputation. If you assert a coverage level the calculus disagrees
with, the node shows the red **C23 conflict** marker with both values.

## 7 · Save (1 minute)

Ctrl+S (or topbar **Save**). The review shows the change preview —
added / removed / changed / moved per element, facet-level
before/after, computed by the kernel's model-diff against the loaded
original. Then **download .prl**, or (in the dev server) **write to
file** with a `.bak` backup. The dirty dot on the Save button clears —
your working point is now the baseline for the next diff.

## What's next

- [the workspace](the-workspace.md) — every surface with its rules.
- [modelling](modelling.md) — the authoring doctrine (data registers,
  subprocess pages, measurements).
- [mapping](mapping.md) — the full mapping doctrine (multi-target, the
  lens, automap, documents).
