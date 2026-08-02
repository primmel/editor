<script setup lang="ts">
// ─────────────────────────────────────────────────────────────────────
// The mapping-pair dialog (TODO.editor/07) — create or edit one
// pair's meta: description ("how the fulfilment works"),
// justification ("why the claim holds"), coverage (the v3 per-pair
// level). Emits intent only; the parent runs the commands.
// ─────────────────────────────────────────────────────────────────────
import { ref, watch } from 'vue';

const props = defineProps<{
  impId: string;
  refId: string;
  /** Editing an existing pair (null = creating). */
  existing?: { description: string; justification: string; coverage: '' | 'full' | 'minimal' | 'partial' | 'none' } | null;
}>();

const emit = defineEmits<{
  (e: 'confirm', meta: { description: string; justification: string; coverage: '' | 'full' | 'minimal' | 'partial' | 'none' }): void;
  (e: 'delete'): void;
  (e: 'cancel'): void;
}>();

const description = ref('');
const justification = ref('');
const coverage = ref<'' | 'full' | 'minimal' | 'partial' | 'none'>('');

watch(
  () => props.existing,
  (ex) => {
    description.value = ex?.description ?? '';
    justification.value = ex?.justification ?? '';
    coverage.value = ex?.coverage ?? '';
  },
  { immediate: true },
);

function confirm() {
  emit('confirm', {
    description: description.value,
    justification: justification.value,
    coverage: coverage.value,
  });
}
</script>

<template>
  <div class="dialog-backdrop" data-testid="pair-dialog" @click.self="emit('cancel')">
    <div class="dialog">
      <div class="dialog-title">
        <code>{{ impId }}</code>
        <span class="dialog-arrow">⇒</span>
        <code>{{ refId }}</code>
      </div>

      <label class="dialog-field">
        <span>description — how the fulfilment works</span>
        <textarea v-model="description" rows="3" data-testid="pair-description" />
      </label>

      <label class="dialog-field">
        <span>justification — why the claim holds</span>
        <textarea v-model="justification" rows="3" data-testid="pair-justification" />
      </label>

      <label class="dialog-field">
        <span>coverage</span>
        <select v-model="coverage" data-testid="pair-coverage">
          <option value="">— undeclared —</option>
          <option value="full">full</option>
          <option value="minimal">minimal</option>
          <option value="partial">partial</option>
          <option value="none">none</option>
        </select>
      </label>

      <div class="dialog-actions">
        <button
          v-if="existing"
          type="button"
          class="dialog-btn danger"
          data-testid="pair-delete"
          @click="emit('delete')"
        >delete</button>
        <span class="dialog-spacer" />
        <button type="button" class="dialog-btn" data-testid="pair-cancel" @click="emit('cancel')">cancel</button>
        <button type="button" class="dialog-btn primary" data-testid="pair-confirm" @click="confirm">
          {{ existing ? 'update' : 'map' }}
        </button>
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
  width: 26rem;
  background: var(--bg-surface);
  border: 1px solid var(--border);
  border-radius: var(--radius);
  padding: 1rem;
  box-shadow: 0 12px 40px rgba(0, 0, 0, 0.4);
}
.dialog-title {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  font-family: var(--font-mono);
  font-size: 0.8rem;
  margin-bottom: 0.75rem;
}
.dialog-arrow { color: var(--accent); }
.dialog-field {
  display: block;
  margin-bottom: 0.6rem;
}
.dialog-field span {
  display: block;
  font-size: 0.66rem;
  color: var(--text-muted);
  margin-bottom: 0.2rem;
}
.dialog-field textarea, .dialog-field select {
  width: 100%;
  padding: 0.35rem 0.45rem;
  border: 1px solid var(--border);
  border-radius: var(--radius-sm);
  background: var(--bg);
  color: var(--text);
  font-size: 0.76rem;
  font-family: inherit;
  resize: vertical;
}
.dialog-actions {
  display: flex;
  gap: 0.4rem;
  align-items: center;
}
.dialog-spacer { flex: 1; }
.dialog-btn {
  padding: 0.3rem 0.8rem;
  border: 1px solid var(--border);
  background: var(--bg-elevated);
  color: var(--text);
  border-radius: var(--radius-sm);
  cursor: pointer;
  font-size: 0.74rem;
}
.dialog-btn.primary {
  border-color: var(--accent);
  color: var(--accent);
}
.dialog-btn.danger {
  border-color: #b85555;
  color: #b85555;
}
</style>
