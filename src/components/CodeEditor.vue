<script setup lang="ts">
import { ref, onMounted, onBeforeUnmount, watch } from 'vue';
import type * as Monaco from 'monaco-editor';
import editorWorker from 'monaco-editor/esm/vs/editor/editor.worker?worker';
import { validate } from '@primmel/primmel';
import { useModelStore } from '../stores/model';
import { primmelLanguageDefinition } from '../lib/monaco-language';
import {
  completionContext, completionItemsFor,
  markerFromParseError, markersFromIssues,
} from '../lib/monaco-prl';

const model = useModelStore();
const containerRef = ref<HTMLElement | null>(null);
let editor: Monaco.editor.IStandaloneCodeEditor | null = null;
let monacoInstance: typeof Monaco | null = null;

onMounted(async () => {
  if (!containerRef.value) return;

  monacoInstance = await import('monaco-editor');

  // The real worker (the editor's own — the PRL mode needs no language
  // worker; monarch tokenizes in-page).
  self.MonacoEnvironment = {
    getWorker: () => new editorWorker(),
  };

  monacoInstance.languages.register({ id: 'primmel' });
  monacoInstance.languages.setMonarchTokensProvider('primmel', primmelLanguageDefinition);

  // Completion from the live AST (the model's own vocabulary).
  monacoInstance.languages.registerCompletionItemProvider('primmel', {
    provideCompletionItems(textModel, position) {
      const textBefore = textModel.getValueInRange({
        startLineNumber: 1,
        startColumn: 1,
        endLineNumber: position.lineNumber,
        endColumn: position.column,
      });
      const context = completionContext(textBefore);
      const ast = model.standard;
      if (!ast) return { suggestions: [] };
      const word = textModel.getWordUntilPosition(position);
      const range = {
        startLineNumber: position.lineNumber,
        endLineNumber: position.lineNumber,
        startColumn: word.startColumn,
        endColumn: word.endColumn,
      };
      const kindMap = {
        id: monacoInstance!.languages.CompletionItemKind.Reference,
        keyword: monacoInstance!.languages.CompletionItemKind.Keyword,
        type: monacoInstance!.languages.CompletionItemKind.TypeParameter,
      } as const;
      return {
        suggestions: completionItemsFor(context, ast).map(item => ({
          label: item.label,
          kind: kindMap[item.kind],
          detail: item.detail,
          insertText: item.label,
          range,
        })),
      };
    },
  });

  monacoInstance.editor.defineTheme('primmel-atelier', {
    base: 'vs-dark',
    inherit: true,
    rules: [
      { token: 'keyword', foreground: 'd49442', fontStyle: 'bold' },
      { token: 'string', foreground: '7a9e5e' },
      { token: 'number', foreground: 'c47550' },
      { token: 'comment', foreground: '524838', fontStyle: 'italic' },
      { token: 'type', foreground: 'b85555' },
      { token: 'identifier', foreground: 'e9e0d2' },
      { token: 'tag', foreground: '8a7e5e' },
    ],
    colors: {
      'editor.background': '#1c1814',
      'editor.foreground': '#e9e0d2',
      'editorLineNumber.foreground': '#524838',
      'editorLineNumber.activeForeground': '#d49442',
      'editor.selectionBackground': '#d4944233',
      'editor.lineHighlightBackground': '#252019',
      'editor.lineHighlightBorder': '#00000000',
      'editorCursor.foreground': '#d49442',
      'editorIndentGuide.background': '#2a2520',
      'editorIndentGuide.activeBackground': '#3a322a',
      'editorGutter.background': '#1c1814',
      'editorError.foreground': '#b85555',
      'editorWarning.foreground': '#d49442',
      'scrollbarSlider.background': '#3a322a55',
      'scrollbarSlider.hoverBackground': '#4a403688',
    },
  });

  editor = monacoInstance.editor.create(containerRef.value, {
    value: model.rawText,
    language: 'primmel',
    theme: 'primmel-atelier',
    // The viewer mounts the code VIEW: the text is read-only (the store
    // refuses setText too — one flag, two doors).
    readOnly: model.readOnly,
    fontFamily: "'SF Mono', Menlo, 'JetBrains Mono', monospace",
    fontSize: 13,
    lineHeight: 1.7 * 13,
    minimap: { enabled: false },
    scrollBeyondLastLine: false,
    automaticLayout: true,
    tabSize: 2,
    wordWrap: 'on',
    padding: { top: 12, bottom: 12 },
    lineNumbers: 'on',
    renderWhitespace: 'selection',
    smoothScrolling: true,
  });

  editor.onDidChangeModelContent(() => {
    const value = editor!.getValue();
    if (value !== model.rawText) {
      model.setText(value);
    }
  });

  refreshMarkers();

  // Dev/e2e hook: the Monaco instance (probes drive cursor/suggest
  // deterministically). Never in production builds.
  if (import.meta.env.DEV) {
    (window as unknown as { __editor: unknown }).__editor = editor;
  }
});

/** The markers: the parse error when broken, else the kernel's
 *  validation issues on the parsed model. */
function refreshMarkers() {
  if (!editor || !monacoInstance) return;
  const textModel = editor.getModel();
  if (!textModel) return;

  if (model.parseError) {
    const m = markerFromParseError(model.parseError);
    monacoInstance.editor.setModelMarkers(textModel, 'primmel', [
      { ...m, severity: monacoInstance.MarkerSeverity.Error },
    ]);
    return;
  }
  const issues = model.standard ? validate(model.standard) : [];
  monacoInstance.editor.setModelMarkers(
    textModel,
    'primmel',
    markersFromIssues(issues).map(m => ({
      ...m,
      severity: m.severity === 'error'
        ? monacoInstance!.MarkerSeverity.Error
        : m.severity === 'warning'
          ? monacoInstance!.MarkerSeverity.Warning
          : monacoInstance!.MarkerSeverity.Info,
    })),
  );
}

watch(() => [model.parseError, model.version], refreshMarkers);

watch(() => model.rawText, (newText) => {
  if (editor && newText !== editor.getValue()) {
    // The single-writer discipline: an AST-side edit re-renders the
    // text byte-clean; the cursor survives where it still fits.
    const position = editor.getPosition();
    editor.setValue(newText);
    if (position) {
      editor.setPosition(position);
      editor.revealPositionInCenterIfOutsideViewport(position);
    }
  }
});

onBeforeUnmount(() => {
  editor?.dispose();
});

let fileHandle: FileSystemFileHandle | null = null;
const fileName = ref('model.prl');

function openFile() {
  if ('showOpenFilePicker' in window) {
    openNative();
  } else {
    openFallback();
  }
}

async function openNative() {
  try {
    if (!window.showOpenFilePicker) throw new Error('unsupported');
    const [handle] = await window.showOpenFilePicker({
      types: [{
        description: 'Primmel model',
        accept: { 'text/plain': ['.prl', '.mmel', '.txt'] },
      }],
    });
    fileHandle = handle;
    fileName.value = handle.name;
    const file = await handle.getFile();
    const text = await file.text();
    model.loadFile(text);
  } catch (e) {
    if ((e as Error).name !== 'AbortError') {
      openFallback();
    }
  }
}

function openFallback() {
  const input = document.createElement('input');
  input.type = 'file';
  input.accept = '.prl,.mmel,.txt';
  input.onchange = () => {
    const file = input.files?.[0];
    if (!file) return;
    fileName.value = file.name;
    const reader = new FileReader();
    reader.onload = () => model.loadFile(reader.result as string);
    reader.readAsText(file);
  };
  input.click();
}

async function saveFile() {
  if (fileHandle && 'createWritable' in fileHandle) {
    try {
      const writable = await fileHandle.createWritable();
      await writable.write(model.rawText);
      await writable.close();
      return;
    } catch { /* fall through to download */ }
  }
  download();
}

function download() {
  const blob = new Blob([model.rawText], { type: 'text/plain' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = fileName.value;
  a.click();
}

function onDrop(e: DragEvent) {
  e.preventDefault();
  if (model.readOnly) return; // the viewer never loads files
  const file = e.dataTransfer?.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = () => model.loadFile(reader.result as string);
  reader.readAsText(file);
}
</script>

<template>
  <div class="code-editor" @drop="onDrop" @dragover.prevent>
    <div class="editor-header">
      <span class="filename">{{ fileName }}</span>
      <div class="editor-actions" v-if="!model.readOnly">
        <button class="action-btn" @click="openFile">Open</button>
        <button class="action-btn save" @click="saveFile" title="Save (native file picker)">Save</button>
        <button class="action-btn" @click="model.format()">Format</button>
      </div>
    </div>
    <div ref="containerRef" class="monaco-container"></div>
    <div v-if="model.parseError" class="error-bar">
      <span class="error-icon">!</span>
      {{ model.parseError }}
    </div>
    <div v-else-if="model.model" class="success-bar">
      <span class="success-dot"></span>
      {{ model.model.processes?.length ?? 0 }} processes · {{ model.model.provisions?.length ?? 0 }} provisions · {{ model.model.pages?.length ?? 0 }} canvases
    </div>
  </div>
</template>

<style scoped>
.code-editor {
  display: flex;
  flex-direction: column;
  height: 100%;
  overflow: hidden;
  background: var(--bg-surface);
}
.editor-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0.4rem 0.75rem;
  background: var(--bg-elevated);
  border-bottom: 1px solid var(--border);
  flex-shrink: 0;
}
.filename {
  font-family: var(--font-mono);
  font-size: 0.75rem;
  color: var(--text-muted);
}
.editor-actions { display: flex; gap: 0.3rem; }
.action-btn {
  padding: 0.25rem 0.65rem;
  border: 1px solid var(--border);
  background: var(--bg-surface);
  color: var(--text-soft);
  border-radius: var(--radius-sm);
  cursor: pointer;
  font-family: var(--font-body);
  font-size: 0.72rem;
  font-weight: 500;
  transition: var(--transition);
}
.action-btn:hover { background: var(--bg-hover); color: var(--text); border-color: var(--border-strong); }
.action-btn.save {
  color: var(--accent);
  border-color: var(--accent-glow);
}
.action-btn.save:hover {
  background: var(--accent-soft);
  border-color: var(--accent);
}
.monaco-container {
  flex: 1;
  min-height: 0;
}
.error-bar {
  padding: 0.5rem 0.75rem;
  background: var(--burgundy-soft);
  color: var(--burgundy);
  font-family: var(--font-mono);
  font-size: 0.72rem;
  border-top: 1px solid var(--burgundy);
  display: flex;
  align-items: center;
  gap: 0.5rem;
  flex-shrink: 0;
}
.error-icon {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 16px;
  height: 16px;
  border-radius: 50%;
  background: var(--burgundy);
  color: var(--bg);
  font-weight: 700;
  font-size: 0.65rem;
  flex-shrink: 0;
}
.success-bar {
  padding: 0.4rem 0.75rem;
  background: var(--sage-soft);
  color: var(--sage);
  font-family: var(--font-mono);
  font-size: 0.68rem;
  border-top: 1px solid var(--sage);
  display: flex;
  align-items: center;
  gap: 0.5rem;
  flex-shrink: 0;
}
.success-dot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: var(--sage);
  box-shadow: 0 0 6px var(--sage);
}
</style>
