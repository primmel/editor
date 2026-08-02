<script setup lang="ts">
// ─────────────────────────────────────────────────────────────────────
// The import panel (TODO.editor/15) — a legacy .mmel file → the
// honest report (constructs converted, renames applied, anything
// unknown) → import into the store (the working model is REPLACED —
// the migration, stated plainly).
// ─────────────────────────────────────────────────────────────────────
import { ref } from 'vue';
import { importLegacy, type ImportReport } from '../lib/mmel-import';
import { useModelStore } from '../stores/model';

const emit = defineEmits<{
  (e: 'close'): void;
}>();

const modelStore = useModelStore();

const fileName = ref('');
const report = ref<ImportReport | null>(null);
const canonical = ref('');
const error = ref('');
const imported = ref(false);

function pickFile() {
  const input = document.createElement('input');
  input.type = 'file';
  input.accept = '.mmel,.prl,.txt';
  input.onchange = () => {
    const file = input.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      error.value = '';
      imported.value = false;
      report.value = null;
      fileName.value = file.name;
      try {
        const result = importLegacy(reader.result as string);
        report.value = result.report;
        canonical.value = result.canonical;
      } catch (e) {
        error.value = (e as Error).message;
      }
    };
    reader.readAsText(file);
  };
  input.click();
}

function doImport() {
  modelStore.loadText(canonical.value);
  imported.value = true;
}
</script>

<template>
  <div class="dialog-backdrop" data-testid="import-panel" @click.self="emit('close')">
    <div class="dialog">
      <div class="dialog-title">import legacy model (.mmel)</div>

      <div class="import-actions">
        <button type="button" class="import-btn" data-testid="import-pick" @click="pickFile">choose file…</button>
        <span v-if="fileName" class="import-file">{{ fileName }}</span>
      </div>

      <div v-if="error" class="import-error" data-testid="import-error">{{ error }}</div>

      <template v-if="report">
        <div class="import-section">
          <div class="import-label">converted</div>
          <div class="import-row" v-for="c in report.constructs" :key="c.kind">
            <span class="import-kind">{{ c.kind }}</span>
            <span class="import-count">{{ c.count }}</span>
          </div>
        </div>

        <div v-if="report.renames.length" class="import-section">
          <div class="import-label">renamed (legacy → canonical)</div>
          <div class="import-row" v-for="r in report.renames" :key="r.from">
            <span class="import-kind">{{ r.from }} → {{ r.to }}</span>
            <span class="import-count">{{ r.count }}</span>
          </div>
        </div>

        <div v-if="report.unknownKeywords.length" class="import-section warning">
          <div class="import-label">no v3 home (NOT imported)</div>
          <div class="import-row" v-for="u in report.unknownKeywords" :key="u.keyword">
            <span class="import-kind">{{ u.keyword }}</span>
            <span class="import-count">{{ u.count }}</span>
          </div>
        </div>

        <div v-if="report.validationIssues.length" class="import-section warning">
          <div class="import-label">validation issues</div>
          <div class="import-row" v-for="(v, i) in report.validationIssues" :key="i">
            <span class="import-kind">{{ v }}</span>
          </div>
        </div>

        <div class="import-actions">
          <button
            type="button"
            class="import-btn primary"
            data-testid="import-confirm"
            @click="doImport"
          >import (replaces the working model)</button>
          <span v-if="imported" class="import-done" data-testid="import-done">imported ✓</span>
        </div>
      </template>

      <div class="import-actions">
        <button type="button" class="import-btn" data-testid="import-close" @click="emit('close')">close</button>
      </div>
    </div>
  </div>
</template>

<style scoped>
.dialog-backdrop {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.45);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 50;
}
.dialog {
  width: 30rem;
  max-height: 80vh;
  overflow-y: auto;
  background: var(--bg-surface);
  border: 1px solid var(--border);
  border-radius: var(--radius);
  padding: 1rem;
  box-shadow: 0 12px 40px rgba(0, 0, 0, 0.4);
}
.dialog-title {
  font-size: 0.85rem;
  font-weight: 600;
  margin-bottom: 0.75rem;
}
.import-actions {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  margin: 0.5rem 0;
}
.import-btn {
  padding: 0.3rem 0.8rem;
  border: 1px solid var(--border);
  background: var(--bg-elevated);
  color: var(--text);
  border-radius: var(--radius-sm);
  cursor: pointer;
  font-size: 0.74rem;
}
.import-btn.primary {
  border-color: var(--accent);
  color: var(--accent);
}
.import-file {
  font-family: var(--font-mono);
  font-size: 0.72rem;
  color: var(--text-muted);
}
.import-error {
  color: #b85555;
  font-size: 0.74rem;
  font-family: var(--font-mono);
  margin: 0.5rem 0;
  white-space: pre-wrap;
}
.import-section {
  margin: 0.6rem 0;
}
.import-section.warning .import-label { color: #d49442; }
.import-label {
  font-family: var(--font-mono);
  font-size: 0.6rem;
  text-transform: uppercase;
  letter-spacing: 0.1em;
  color: var(--text-faint);
  margin-bottom: 0.2rem;
}
.import-row {
  display: flex;
  justify-content: space-between;
  font-size: 0.74rem;
  padding: 0.1rem 0;
}
.import-kind { color: var(--text); font-family: var(--font-mono); }
.import-count { color: var(--text-muted); font-family: var(--font-mono); }
.import-done {
  color: var(--sage);
  font-size: 0.74rem;
}
</style>
