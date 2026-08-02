<script setup lang="ts">
// ─────────────────────────────────────────────────────────────────────
// A string-list editor (TODO.editor/04) — measurement lists, notes,
// any free-text facet list: add per row, remove per row.
// ─────────────────────────────────────────────────────────────────────
import { ref } from 'vue';

const props = defineProps<{
  items: string[];
  placeholder?: string;
}>();

const emit = defineEmits<{
  (e: 'update', items: string[]): void;
}>();

const draft = ref('');

function add() {
  const v = draft.value.trim();
  if (!v) return;
  emit('update', [...props.items, v]);
  draft.value = '';
}

function remove(i: number) {
  emit('update', props.items.filter((_, idx) => idx !== i));
}
</script>

<template>
  <div class="string-list">
    <ul v-if="items.length" class="string-rows">
      <li v-for="(item, i) in items" :key="i" class="string-row">
        <span class="string-row-text">{{ item }}</span>
        <button type="button" class="string-remove" @click="remove(i)">✕</button>
      </li>
    </ul>
    <div class="string-add">
      <input
        v-model="draft"
        class="string-input"
        :placeholder="placeholder ?? 'add…'"
        @keyup.enter="add"
      />
      <button type="button" class="string-add-btn" :disabled="!draft.trim()" @click="add">+</button>
    </div>
  </div>
</template>

<style scoped>
.string-rows {
  list-style: none;
  margin: 0 0 0.3rem;
  padding: 0;
}
.string-row {
  display: flex;
  align-items: center;
  gap: 0.4rem;
  padding: 0.15rem 0.3rem;
  border-radius: var(--radius-sm);
  font-size: 0.72rem;
}
.string-row:hover { background: var(--bg-elevated); }
.string-row-text { flex: 1; color: var(--text); word-break: break-word; }
.string-remove {
  border: none;
  background: none;
  color: var(--text-faint);
  cursor: pointer;
  font-size: 0.65rem;
  padding: 0.1rem 0.25rem;
}
.string-remove:hover { color: #b85555; }
.string-add { display: flex; gap: 0.3rem; }
.string-input {
  flex: 1;
  padding: 0.25rem 0.4rem;
  border: 1px solid var(--border);
  border-radius: var(--radius-sm);
  background: var(--bg);
  color: var(--text);
  font-size: 0.72rem;
}
.string-add-btn {
  width: 26px;
  border: 1px solid var(--border);
  background: var(--bg-elevated);
  color: var(--accent);
  border-radius: var(--radius-sm);
  cursor: pointer;
}
.string-add-btn:disabled { opacity: 0.4; cursor: default; }
</style>
