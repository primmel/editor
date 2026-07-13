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

  monacoInstance.editor.defineTheme('primmel-light', {
    base: 'vs',
    inherit: true,
    rules: [
      { token: 'keyword', foreground: '4a6fa5', fontStyle: 'bold' },
      { token: 'string', foreground: '22863a' },
      { token: 'number', foreground: '005cc5' },
      { token: 'comment', foreground: '6a737d', fontStyle: 'italic' },
      { token: 'type', foreground: '6f42c1' },
      { token: 'identifier', foreground: '24292e' },
    ],
    colors: {
      'editor.background': '#ffffff',
      'editorLineNumber.foreground': '#b0b0b0',
      'editor.selectionBackground': '#e7f0ff',
      'editor.lineHighlightBackground': '#f6f8fa',
      'editorCursor.foreground': '#4a6fa5',
    },
  });

  editor = monacoInstance.editor.create(containerRef.value, {
    value: model.rawText,
    language: 'primmel',
    theme: 'primmel-light',
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

function openFile() {
  const input = document.createElement('input');
  input.type = 'file';
  input.accept = '.prl,.mmel,.txt';
  input.onchange = () => {
    const file = input.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => model.loadFile(reader.result as string);
    reader.readAsText(file);
  };
  input.click();
}

function download() {
  const blob = new Blob([model.rawText], { type: 'text/plain' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = 'model.prl';
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
      <span class="filename">model.prl</span>
      <div class="editor-actions">
        <button class="action-btn" @click="openFile">Open</button>
        <button class="action-btn" @click="model.format()">Format</button>
        <button class="action-btn" @click="download">Download</button>
      </div>
    </div>
    <div ref="containerRef" class="monaco-container"></div>
    <div v-if="model.parseError" class="error-bar">
      {{ model.parseError }}
    </div>
    <div v-else-if="model.model" class="success-bar">
      Parsed: {{ model.model.processes?.length ?? 0 }} processes,
      {{ model.model.provisions?.length ?? 0 }} provisions,
      {{ model.model.pages?.length ?? 0 }} canvases
    </div>
  </div>
</template>

<style scoped>
.code-editor {
  display: flex;
  flex-direction: column;
  height: 100%;
  overflow: hidden;
}
.editor-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0.4rem 0.75rem;
  background: #f5f5f5;
  border-bottom: 1px solid #e0e0e0;
  flex-shrink: 0;
}
.filename {
  font-family: 'SF Mono', Menlo, monospace;
  font-size: 0.78rem;
  color: #888;
}
.editor-actions { display: flex; gap: 0.25rem; }
.action-btn {
  padding: 0.2rem 0.6rem;
  border: 1px solid #ccc;
  background: #fff;
  border-radius: 3px;
  cursor: pointer;
  font-size: 0.75rem;
  color: #555;
}
.action-btn:hover { background: #e8e8e8; }
.monaco-container {
  flex: 1;
  min-height: 0;
}
.error-bar {
  padding: 0.4rem 0.75rem;
  background: #fee;
  color: #c00;
  font-family: 'SF Mono', Menlo, monospace;
  font-size: 0.75rem;
  border-top: 1px solid #fcc;
  flex-shrink: 0;
}
.success-bar {
  padding: 0.3rem 0.75rem;
  background: #f0fdf4;
  color: #166534;
  font-size: 0.72rem;
  border-top: 1px solid #bbf7d0;
  flex-shrink: 0;
}
</style>
