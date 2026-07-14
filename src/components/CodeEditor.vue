<script setup lang="ts">
import { ref, onMounted, onBeforeUnmount, watch } from 'vue';
import type * as Monaco from 'monaco-editor';
import { useModelStore } from '../stores/model';
import { primmelLanguageDefinition } from '../lib/monaco-language';

const model = useModelStore();
const containerRef = ref<HTMLElement | null>(null);
let editor: Monaco.editor.IStandaloneCodeEditor | null = null;
let monacoInstance: typeof Monaco | null = null;

onMounted(async () => {
  if (!containerRef.value) return;

  monacoInstance = await import('monaco-editor');

  self.MonacoEnvironment = {
    getWorker: () => new Worker('data:text/javascript;base64,cGljbw=='),
  };

  monacoInstance.languages.register({ id: 'primmel' });
  monacoInstance.languages.setMonarchTokensProvider('primmel', primmelLanguageDefinition);

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
});

watch(() => model.parseError, (error) => {
  if (!editor || !monacoInstance) return;
  const modelUri = editor.getModel()?.uri;
  if (!modelUri) return;

  if (error) {
    const lineMatch = error.match(/line\s+(\d+)/i);
    const line = lineMatch ? parseInt(lineMatch[1], 10) : 1;
    monacoInstance.editor.setModelMarkers(editor.getModel()!, 'primmel', [{
      startLineNumber: line,
      startColumn: 1,
      endLineNumber: line,
      endColumn: 1000,
      message: error,
      severity: monacoInstance.MarkerSeverity.Error,
    }]);
  } else {
    monacoInstance.editor.setModelMarkers(editor.getModel()!, 'primmel', []);
  }
});

watch(() => model.rawText, (newText) => {
  if (editor && newText !== editor.getValue()) {
    editor.setValue(newText);
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
    const [handle] = await (window as any).showOpenFilePicker({
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
      <div class="editor-actions">
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
