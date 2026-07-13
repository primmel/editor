<script setup lang="ts">
import { computed } from 'vue';
import { useModelStore } from '../stores/model';

const model = useModelStore();

const errorLine = computed(() => {
  if (!model.parseError) return null;
  const match = model.parseError.match(/line\s+(\d+)/i);
  return match ? parseInt(match[1], 10) : null;
});

function onDrop(e: DragEvent) {
  e.preventDefault();
  const file = e.dataTransfer?.files[0];
  if (file) readFile(file);
}

function onDragOver(e: DragEvent) {
  e.preventDefault();
}

function openFile() {
  const input = document.createElement('input');
  input.type = 'file';
  input.accept = '.prl,.mmel,.txt';
  input.onchange = () => {
    const file = input.files?.[0];
    if (file) readFile(file);
  };
  input.click();
}

function readFile(file: File) {
  const reader = new FileReader();
  reader.onload = () => {
    model.loadFile(reader.result as string);
  };
  reader.readAsText(file);
}

function download() {
  const blob = new Blob([model.rawText], { type: 'text/plain' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = 'model.prl';
  a.click();
}

function onKeydown(e: KeyboardEvent) {
  if (e.key === 'Tab') {
    e.preventDefault();
    const target = e.target as HTMLTextAreaElement;
    const start = target.selectionStart;
    const end = target.selectionEnd;
    const newText = target.value.substring(0, start) + '  ' + target.value.substring(end);
    model.setText(newText);
    nextTick(() => {
      target.selectionStart = target.selectionEnd = start + 2;
    });
  }
}

import { nextTick } from 'vue';
</script>

<template>
  <div
    class="code-editor"
    @drop="onDrop"
    @dragover="onDragOver"
  >
    <div class="editor-header">
      <span class="filename">model.prl</span>
      <div class="editor-actions">
        <button class="action-btn" @click="openFile" title="Open .prl file">Open</button>
        <button class="action-btn" @click="model.format()" title="Format (normalize)">Format</button>
        <button class="action-btn" @click="download" title="Download">Download</button>
      </div>
    </div>
    <textarea
      :value="model.rawText"
      @input="model.setText(($event.target as HTMLTextAreaElement).value)"
      @keydown="onKeydown"
      class="code-textarea"
      spellcheck="false"
      placeholder="Drop a .prl file here, or start typing..."
    ></textarea>
    <div v-if="model.parseError" class="error-bar">
      <span class="error-icon">!</span>
      {{ model.parseError }}
    </div>
    <div v-else-if="model.model" class="success-bar">
      Parsed: {{ model.model.processes?.length ?? 0 }} processes, {{ model.model.provisions?.length ?? 0 }} provisions, {{ model.model.pages?.length ?? 0 }} canvases
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
.code-textarea {
  flex: 1;
  border: none;
  padding: 0.75rem;
  font-family: 'SF Mono', Menlo, monospace;
  font-size: 0.82rem;
  line-height: 1.7;
  resize: none;
  outline: none;
  background: #fff;
  color: #222;
  tab-size: 2;
}
.error-bar {
  padding: 0.4rem 0.75rem;
  background: #fee;
  color: #c00;
  font-family: 'SF Mono', Menlo, monospace;
  font-size: 0.75rem;
  border-top: 1px solid #fcc;
  display: flex;
  align-items: center;
  gap: 0.5rem;
}
.error-icon {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 18px;
  height: 18px;
  border-radius: 50%;
  background: #c00;
  color: #fff;
  font-weight: 700;
  font-size: 0.7rem;
}
.success-bar {
  padding: 0.3rem 0.75rem;
  background: #f0fdf4;
  color: #166534;
  font-size: 0.72rem;
  border-top: 1px solid #bbf7d0;
}
</style>
