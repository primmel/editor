<script setup lang="ts">
// ─────────────────────────────────────────────────────────────────────
// The save panel (TODO.editor/18) — the review-before-commit: the
// change preview against the loaded original (the kernel's diff),
// then the write — browser download always, direct write when the dev
// server's save API answers. The SSOT regen note surfaces for
// primmel-packages paths.
// ─────────────────────────────────────────────────────────────────────
import { computed, onMounted, ref } from 'vue';
import type { Standard } from '@primmel/primmel';
import {
  downloadText, serializeForSave, suggestedFileName,
  writeApiAvailable, writeToFile,
} from '../lib/save';
import { DIFF_TINTS, type DiffStatus } from '../lib/diff-view';
import { validationSummary } from '../lib/validation';
import { useModelStore } from '../stores/model';

const props = defineProps<{ model: Standard }>();
const emit = defineEmits<{ (e: 'close'): void }>();
const modelStore = useModelStore();

const fileName = ref(suggestedFileName(props.model));
const writePath = ref('');
const apiAvailable = ref(false);
const saved = ref<'download' | 'write' | null>(null);
const writeError = ref('');

onMounted(async () => {
  apiAvailable.value = await writeApiAvailable();
});

const preview = computed(() => serializeForSave(props.model, modelStore.loadedText));
const STATUS_ORDER: DiffStatus[] = ['added', 'removed', 'changed', 'moved'];

/** The validation line in the review (TODO.editor/29) — the commit
 *  decision includes the kernel's verdict. */
const validation = computed(() => {
  void modelStore.version;
  const s = validationSummary(props.model);
  if (s.errors === 0 && s.warnings === 0) return { clean: true, text: '' };
  const parts: string[] = [];
  if (s.errors > 0) parts.push(`${s.errors} error${s.errors === 1 ? '' : 's'}`);
  if (s.warnings > 0) parts.push(`${s.warnings} warning${s.warnings === 1 ? '' : 's'}`);
  return { clean: false, text: `the model has ${parts.join(' and ')} (see the Validate tab)` };
});

function doDownload() {
  downloadText(fileName.value, preview.value.text);
  modelStore.markSaved();
  saved.value = 'download';
}

async function doWrite() {
  writeError.value = '';
  try {
    await writeToFile(writePath.value, preview.value.text);
    modelStore.markSaved();
    saved.value = 'write';
  } catch (e) {
    writeError.value = (e as Error).message;
  }
}

const ssotNote = computed(() =>
  writePath.value.includes('primmel-packages')
    ? 'authored package saved — regenerate the downstream trees with `npm run gen:data` in the app (the drift gate depends on it)'
    : '');
</script>

<template>
  <div class="dialog-backdrop" data-testid="save-panel" @click.self="emit('close')">
    <div class="dialog">
      <div class="dialog-title">save — review the change</div>

      <div class="save-validation" data-testid="save-validation">
        <span v-if="validation.clean" class="val-line clean">✓ the model validates clean</span>
        <span v-else class="val-line issues">⚠ {{ validation.text }}</span>
      </div>

      <div class="save-diff" v-if="preview.diff">
        <div class="diff-counts">
          <span
            v-for="status in STATUS_ORDER"
            :key="status"
            class="diff-count"
            :style="{ color: DIFF_TINTS[status] }"
            :data-testid="`save-count-${status}`"
          >{{ status }} {{ preview.diff.byStatus[status].length }}</span>
          <span v-if="preview.diff.mappings.added.length || preview.diff.mappings.removed.length" class="diff-count">
            mappings +{{ preview.diff.mappings.added.length }} −{{ preview.diff.mappings.removed.length }}
          </span>
        </div>
        <div v-if="preview.diff.rows.length === 0" class="save-identical">no changes since load</div>
        <div v-else class="save-rows">
          <div
            v-for="row in preview.diff.rows.slice(0, 40)"
            :key="row.key"
            class="save-row"
          >
            <span class="save-dot" :style="{ background: DIFF_TINTS[row.status] }" />
            <span class="save-row-text">{{ row.kind }} {{ row.id }} — {{ row.status }}</span>
          </div>
          <div v-if="preview.diff.rows.length > 40" class="save-more">
            …and {{ preview.diff.rows.length - 40 }} more
          </div>
        </div>
      </div>

      <div class="save-actions">
        <label class="save-field">
          <span>file name</span>
          <input v-model="fileName" class="save-input" data-testid="save-filename" />
        </label>
        <button type="button" class="save-btn" data-testid="save-download" @click="doDownload">
          download .prl
        </button>

        <template v-if="apiAvailable">
          <label class="save-field">
            <span>write path (project-relative)</span>
            <input v-model="writePath" class="save-input" placeholder="primmel-packages/…/model.prl" data-testid="save-path" />
          </label>
          <button
            type="button"
            class="save-btn primary"
            :disabled="!writePath.trim()"
            data-testid="save-write"
            @click="doWrite"
          >write to file (.bak kept)</button>
        </template>

        <div v-if="writeError" class="save-error" data-testid="save-error">{{ writeError }}</div>
        <div v-if="saved" class="save-done" data-testid="save-done">
          saved ({{ saved === 'write' ? 'written to file' : 'downloaded' }}) — the dirty flag is clear
        </div>
        <div v-if="ssotNote" class="save-ssot" data-testid="save-ssot">{{ ssotNote }}</div>
      </div>

      <div class="save-actions">
        <button type="button" class="save-btn" data-testid="save-close" @click="emit('close')">close</button>
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
  width: 32rem;
  max-height: 80vh;
  overflow-y: auto;
  background: var(--bg-surface);
  border: 1px solid var(--border);
  border-radius: var(--radius);
  padding: 1rem;
  box-shadow: 0 12px 40px rgba(0, 0, 0, 0.4);
}
.dialog-title { font-size: 0.85rem; font-weight: 600; margin-bottom: 0.6rem; }
.save-diff { margin-bottom: 0.7rem; }
.diff-counts {
  display: flex;
  gap: 0.8rem;
  font-family: var(--font-mono);
  font-size: 0.68rem;
  margin-bottom: 0.4rem;
}
.save-identical {
  color: var(--text-faint);
  font-style: italic;
  font-size: 0.74rem;
}
.save-rows { max-height: 220px; overflow-y: auto; }
.save-row {
  display: flex;
  align-items: center;
  gap: 0.4rem;
  padding: 0.12rem 0;
  font-size: 0.72rem;
}
.save-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  flex-shrink: 0;
}
.save-row-text { font-family: var(--font-mono); color: var(--text); }
.save-more { font-size: 0.66rem; color: var(--text-faint); font-style: italic; }
.save-actions {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
  margin-top: 0.5rem;
}
.save-field span {
  display: block;
  font-size: 0.62rem;
  color: var(--text-muted);
  margin-bottom: 0.15rem;
}
.save-input {
  width: 100%;
  padding: 0.3rem 0.45rem;
  border: 1px solid var(--border);
  border-radius: var(--radius-sm);
  background: var(--bg);
  color: var(--text);
  font-size: 0.76rem;
  font-family: var(--font-mono);
}
.save-btn {
  padding: 0.32rem 0.8rem;
  border: 1px solid var(--border);
  background: var(--bg-elevated);
  color: var(--text);
  border-radius: var(--radius-sm);
  cursor: pointer;
  font-size: 0.74rem;
  align-self: flex-start;
}
.save-btn.primary { border-color: var(--accent); color: var(--accent); }
.save-btn:disabled { opacity: 0.4; cursor: default; }
.save-error { color: #b85555; font-size: 0.72rem; }
.save-done { color: var(--sage); font-size: 0.72rem; }
.save-ssot {
  font-size: 0.68rem;
  color: #d49442;
  border: 1px dashed #d49442;
  border-radius: var(--radius-sm);
  padding: 0.35rem 0.5rem;
}
.save-validation { margin-bottom: 0.5rem; }
.val-line { font-size: 0.72rem; font-family: var(--font-mono); }
.val-line.clean { color: var(--sage); }
.val-line.issues { color: #d49442; }
</style>
