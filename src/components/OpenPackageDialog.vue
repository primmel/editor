<script setup lang="ts">
// ─────────────────────────────────────────────────────────────────────
// The package-open dialog (TODO.editor wave 1) — open a v3 PACKAGE
// directory as the unit of work. The dev server runs the kernel's
// provenance load (fs-bound); the browser receives the merged dump,
// the file inventory, and the per-file provenance. Load advisories
// (composition notes, duplicate ids) surface, never block.
// ─────────────────────────────────────────────────────────────────────
import { onMounted, ref } from 'vue';
import { openPackageDir, type PackageOpenResult } from '../lib/package';
import { useModelStore } from '../stores/model';

const emit = defineEmits<{
  (e: 'close'): void;
}>();

const modelStore = useModelStore();

const dir = ref('');
const error = ref('');
const busy = ref(false);
const opened = ref<PackageOpenResult | null>(null);

const LAST_DIR_KEY = 'primmel.lastPackageDir';
onMounted(() => {
  dir.value = localStorage.getItem(LAST_DIR_KEY) ?? '';
});

async function doOpen() {
  error.value = '';
  busy.value = true;
  try {
    const result = await openPackageDir(dir.value.trim());
    modelStore.openPackage(result);
    if (modelStore.parseError) {
      error.value = modelStore.parseError;
      return;
    }
    localStorage.setItem(LAST_DIR_KEY, result.dir);
    opened.value = result;
  } catch (e) {
    error.value = (e as Error).message;
  } finally {
    busy.value = false;
  }
}
</script>

<template>
  <div class="dialog-backdrop" data-testid="package-dialog" @click.self="emit('close')">
    <div class="dialog">
      <div class="dialog-title">open package — the package is the unit of work</div>

      <template v-if="!opened">
        <label class="pkg-field">
          <span>package directory (absolute, or relative to the dev server)</span>
          <input
            v-model="dir"
            class="pkg-input"
            placeholder="…/primmel-packages/oiml-r60"
            data-testid="package-dir"
            @keyup.enter="doOpen"
          />
        </label>
        <div class="pkg-hint">
          the manifest (<code>package.primmel</code>) scopes the load; <code>uses</code> imports
          resolve against sibling directories (and PRIMMEL_PACKAGE_ROOTS)
        </div>

        <div v-if="error" class="pkg-error" data-testid="package-error">{{ error }}</div>

        <div class="pkg-actions">
          <button
            type="button"
            class="pkg-btn primary"
            :disabled="!dir.trim() || busy"
            data-testid="package-open-confirm"
            @click="doOpen"
          >{{ busy ? 'opening…' : 'open package' }}</button>
          <button type="button" class="pkg-btn" data-testid="package-close" @click="emit('close')">close</button>
        </div>
      </template>

      <template v-else>
        <div class="pkg-opened" data-testid="package-opened">
          <span class="pkg-id">{{ opened.id }}</span>
          <span class="pkg-title">{{ opened.title }}</span>
        </div>
        <div class="pkg-row">
          <span>{{ opened.files.length }} files</span>
          <span v-if="opened.imports.length">
            · imports {{ opened.imports.map(i => i.package).join(', ') }}
          </span>
        </div>

        <div v-if="opened.issues.length" class="pkg-section warning">
          <div class="pkg-label">load advisories (surfaced, not fatal)</div>
          <div class="pkg-row" v-for="(issue, i) in opened.issues" :key="i" data-testid="package-issue">
            <span class="pkg-issue">{{ issue }}</span>
          </div>
        </div>
        <div v-else class="pkg-clean" data-testid="package-clean">✓ no load advisories</div>

        <div class="pkg-actions">
          <button type="button" class="pkg-btn primary" data-testid="package-done" @click="emit('close')">done</button>
        </div>
      </template>
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
  width: 34rem;
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
.pkg-field span {
  display: block;
  font-size: 0.62rem;
  color: var(--text-muted);
  margin-bottom: 0.15rem;
}
.pkg-input {
  width: 100%;
  padding: 0.3rem 0.45rem;
  border: 1px solid var(--border);
  border-radius: var(--radius-sm);
  background: var(--bg);
  color: var(--text);
  font-size: 0.76rem;
  font-family: var(--font-mono);
}
.pkg-hint {
  font-size: 0.68rem;
  color: var(--text-faint);
  margin-top: 0.35rem;
}
.pkg-hint code { font-family: var(--font-mono); font-size: 0.64rem; }
.pkg-error {
  color: #b85555;
  font-size: 0.74rem;
  font-family: var(--font-mono);
  margin: 0.5rem 0;
  white-space: pre-wrap;
}
.pkg-actions {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  margin-top: 0.75rem;
}
.pkg-btn {
  padding: 0.3rem 0.8rem;
  border: 1px solid var(--border);
  background: var(--bg-elevated);
  color: var(--text);
  border-radius: var(--radius-sm);
  cursor: pointer;
  font-size: 0.74rem;
}
.pkg-btn.primary {
  border-color: var(--accent);
  color: var(--accent);
}
.pkg-btn:disabled { opacity: 0.4; cursor: default; }
.pkg-opened {
  display: flex;
  align-items: baseline;
  gap: 0.5rem;
  margin-bottom: 0.3rem;
}
.pkg-id {
  font-family: var(--font-mono);
  font-size: 0.85rem;
  font-weight: 600;
  color: var(--accent);
}
.pkg-title {
  font-size: 0.74rem;
  color: var(--text-muted);
}
.pkg-row {
  font-size: 0.74rem;
  color: var(--text-soft);
  font-family: var(--font-mono);
  padding: 0.1rem 0;
}
.pkg-section { margin: 0.6rem 0; }
.pkg-section.warning .pkg-label { color: #d49442; }
.pkg-label {
  font-family: var(--font-mono);
  font-size: 0.6rem;
  text-transform: uppercase;
  letter-spacing: 0.1em;
  color: var(--text-faint);
  margin-bottom: 0.2rem;
}
.pkg-issue {
  font-family: var(--font-mono);
  font-size: 0.7rem;
  color: var(--text-soft);
}
.pkg-clean {
  color: var(--sage);
  font-size: 0.72rem;
  margin-top: 0.5rem;
}
</style>
