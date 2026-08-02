<script setup lang="ts">
// ─────────────────────────────────────────────────────────────────────
// The new-model dialog (TODO.editor/22) — three templates with their
// doctrine one-liners; create boots the workspace through the store's
// normal load path.
// ─────────────────────────────────────────────────────────────────────
import { ref } from 'vue';
import { MODEL_KIND_LABELS, newModelTemplate, type ModelKind } from '../lib/templates';
import { useModelStore } from '../stores/model';

const emit = defineEmits<{ (e: 'close'): void }>();
const modelStore = useModelStore();

const kind = ref<ModelKind>('blank');
const title = ref('');
const namespace = ref('');

function create() {
  modelStore.loadText(newModelTemplate(kind.value, {
    title: title.value,
    namespace: namespace.value,
  }));
  emit('close');
}

const KINDS: ModelKind[] = ['blank', 'reference', 'implementation'];
</script>

<template>
  <div class="dialog-backdrop" data-testid="new-model-dialog" @click.self="emit('close')">
    <div class="dialog">
      <div class="dialog-title">new model</div>

      <div class="kind-cards">
        <button
          v-for="k in KINDS"
          :key="k"
          type="button"
          class="kind-card"
          :class="{ active: kind === k }"
          :data-testid="`kind-${k}`"
          @click="kind = k"
        >
          <span class="kind-title">{{ MODEL_KIND_LABELS[k].title }}</span>
          <span class="kind-doctrine">{{ MODEL_KIND_LABELS[k].doctrine }}</span>
        </button>
      </div>

      <label class="dialog-field">
        <span>title</span>
        <input v-model="title" class="dialog-input" placeholder="e.g. Clinical thermometers" data-testid="new-title" />
      </label>
      <label class="dialog-field">
        <span>namespace</span>
        <input v-model="namespace" class="dialog-input" placeholder="e.g. OIML.R7" data-testid="new-namespace" />
      </label>

      <div class="dialog-actions">
        <button type="button" class="dialog-btn" data-testid="new-cancel" @click="emit('close')">cancel</button>
        <button type="button" class="dialog-btn primary" data-testid="new-create" @click="create">create</button>
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
  background: var(--bg-surface);
  border: 1px solid var(--border);
  border-radius: var(--radius);
  padding: 1rem;
  box-shadow: 0 12px 40px rgba(0, 0, 0, 0.4);
}
.dialog-title { font-size: 0.85rem; font-weight: 600; margin-bottom: 0.75rem; }
.kind-cards {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 0.4rem;
  margin-bottom: 0.75rem;
}
.kind-card {
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
  padding: 0.5rem;
  border: 1px solid var(--border);
  border-radius: var(--radius-sm);
  background: var(--bg);
  cursor: pointer;
  text-align: left;
}
.kind-card.active {
  border-color: var(--accent);
  background: var(--accent-soft);
}
.kind-title { font-size: 0.72rem; font-weight: 600; color: var(--text); }
.kind-card.active .kind-title { color: var(--accent); }
.kind-doctrine { font-size: 0.6rem; color: var(--text-muted); line-height: 1.3; }
.dialog-field { display: block; margin-bottom: 0.5rem; }
.dialog-field span {
  display: block;
  font-size: 0.62rem;
  color: var(--text-muted);
  margin-bottom: 0.15rem;
}
.dialog-input {
  width: 100%;
  padding: 0.3rem 0.45rem;
  border: 1px solid var(--border);
  border-radius: var(--radius-sm);
  background: var(--bg);
  color: var(--text);
  font-size: 0.78rem;
}
.dialog-actions {
  display: flex;
  justify-content: flex-end;
  gap: 0.4rem;
  margin-top: 0.75rem;
}
.dialog-btn {
  padding: 0.3rem 0.8rem;
  border: 1px solid var(--border);
  background: var(--bg-elevated);
  color: var(--text);
  border-radius: var(--radius-sm);
  cursor: pointer;
  font-size: 0.74rem;
}
.dialog-btn.primary { border-color: var(--accent); color: var(--accent); }
</style>
