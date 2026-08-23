import { defineStore } from 'pinia';
import { computed, ref, shallowRef } from 'vue';
import { dump, load, type Standard } from '@primmel/primmel';
import type { Command } from '../lib/commands';
import { autoLayoutUnpositioned } from '../lib/layout';

// ─────────────────────────────────────────────────────────────────────
// The model store (TODO.editor/01) — the AST is the single source of
// truth. Every mutation is a Command (apply/revert) through
// `execute`; the raw text is a derived projection (serialize on
// demand). The version counter is the re-render signal (commands
// mutate in place; projections key on it).
// ─────────────────────────────────────────────────────────────────────

export const useModelStore = defineStore('model', () => {
  const standard = shallowRef<Standard | null>(null);
  const parseError = ref<string | null>(null);
  const version = ref(0);

  const history = ref<Command[]>([]);
  const cursor = ref(0);
  const savedCursor = ref(0);

  /** The viewer flag (Wave 4): when set by mount(), EVERY mutation path
   *  refuses — commands, the code editor's text writes, format, undo/redo.
   *  The tree, code view, canvas, mapper lenses, diff and validation stay
   *  readable; loading stays allowed (it is how the model arrives). */
  const readOnly = ref(false);
  function setReadOnly(on: boolean) {
    readOnly.value = on;
  }

  /** The text projection — derived; synced after every command and
   *  editable in the code editor. */
  const rawText = ref(SAMPLE_MODEL);

  /** The save baseline — the text as of the last load or save (the
   *  save preview diffs against THIS, not the live projection). */
  const loadedText = ref(SAMPLE_MODEL);

  const dirty = computed(() => cursor.value !== savedCursor.value);
  const canUndo = computed(() => cursor.value > 0);
  const canRedo = computed(() => cursor.value < history.value.length);

  /** The projection refresh — rawText shows the AST after commands. */
  function syncProjection() {
    if (standard.value) rawText.value = dump(standard.value);
  }

  function loadText(text: string) {
    try {
      standard.value = load(text, { strict: true });
      parseError.value = null;
      history.value = [];
      cursor.value = 0;
      savedCursor.value = 0;
      rawText.value = text;
      loadedText.value = text;
      // The viewer's layout pass: unpositioned pages get an in-memory
      // autoLayout so the canvas can draw them. Never persisted.
      if (readOnly.value && standard.value) autoLayoutUnpositioned(standard.value);
      version.value++;
    } catch (e) {
      parseError.value = (e as Error).message;
    }
  }

  function execute(command: Command) {
    if (readOnly.value || !standard.value) return;
    command.apply(standard.value);
    history.value.splice(cursor.value);
    history.value.push(command);
    cursor.value++;
    syncProjection();
    version.value++;
  }

  function undo() {
    if (readOnly.value || !standard.value || cursor.value <= 0) return;
    cursor.value--;
    history.value[cursor.value]!.revert(standard.value);
    syncProjection();
    version.value++;
  }

  function redo() {
    if (readOnly.value || !standard.value || cursor.value >= history.value.length) return;
    history.value[cursor.value]!.apply(standard.value);
    cursor.value++;
    syncProjection();
    version.value++;
  }

  function serialize(): string {
    return standard.value ? dump(standard.value) : rawText.value;
  }

  function markSaved() {
    savedCursor.value = cursor.value;
    // After a save the working text IS the new baseline.
    loadedText.value = rawText.value;
  }

  /** The code editor's write path: text → AST (parse errors surface,
   *  the AST stays until the text parses). Refused in the viewer. */
  function setText(text: string) {
    if (readOnly.value) return;
    rawText.value = text;
    try {
      const m = load(text, { strict: true });
      standard.value = m;
      parseError.value = null;
      history.value = [];
      cursor.value = 0;
      version.value++;
    } catch (e) {
      parseError.value = (e as Error).message;
    }
  }

  /** File-open path (CodeEditor): identical to setText. */
  function loadFile(content: string) {
    if (readOnly.value) return;
    setText(content);
  }

  function format() {
    if (readOnly.value || !standard.value) return;
    rawText.value = dump(standard.value);
  }

  /** Back-compat alias: the parsed AST (components migrating to the
   *  command-layer store read this; it is the same object as `standard`). */
  const model = computed(() => standard.value);

  // Boot parse — the sample document opens the workspace on first load.
  loadText(rawText.value);

  return {
    standard, model, parseError, version, rawText, loadedText,
    history, cursor, dirty, canUndo, canRedo,
    readOnly, setReadOnly,
    loadText, setText, loadFile, format, execute, undo, redo, serialize, markSaved,
  };
});

const SAMPLE_MODEL = `root Root

version "v1.0.0-dev1"

metadata {
  title "Manufacturing Pipeline"
  schema "Primmel 0.1"
  namespace "Manufacturing"
}

role Factory { name "Factory" }
role AssemblyLine { name "Assembly Line" }
role QA { name "Quality Assurance" }

start_event Start { }
end_event Done { }

process Manufacturing {
  name "Manufacture product"
  actor Factory

  process Assembly {
    name "Assemble components"
    actor AssemblyLine
  }

  process QualityControl {
    name "Inspect quality"
    actor QA
  }
}

canvas Root {
  elements {
    Start           { x 0 y 0 }
    Manufacturing   { x 0 y 100 }
    Done            { x 0 y 200 }
  }
  process_flow {
    E1 { from Start to Manufacturing }
    E2 { from Manufacturing to Done }
  }
}`;
