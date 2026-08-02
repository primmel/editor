<script setup lang="ts">
// ─────────────────────────────────────────────────────────────────────
// A multi-pick list editor (TODO.editor/04) — the model's own
// provisions/vars/registries as options; add from the picker, remove
// per row. The list is the patch (before-captured by the command).
// ─────────────────────────────────────────────────────────────────────
import { computed, ref } from 'vue';

const props = defineProps<{
  /** The current id list (the element's facet). */
  items: string[];
  /** All selectable ids. */
  options: string[];
  /** Row label renderer (id → display). */
  labelOf?: (id: string) => string;
  placeholder?: string;
}>();

const emit = defineEmits<{
  (e: 'update', items: string[]): void;
}>();

const pickerValue = ref('');
const remaining = computed(() => props.options.filter(o => !props.items.includes(o)));

function display(id: string): string {
  return props.labelOf ? props.labelOf(id) : id;
}

function add() {
  if (!pickerValue.value) return;
  emit('update', [...props.items, pickerValue.value]);
  pickerValue.value = '';
}

function remove(id: string) {
  emit('update', props.items.filter(i => i !== id));
}
</script>

<template>
  <div class="picker-list">
    <ul v-if="items.length" class="picker-rows">
      <li v-for="id in items" :key="id" class="picker-row">
        <span class="picker-row-label">{{ display(id) }}</span>
        <button type="button" class="picker-remove" :data-testid="`picker-remove-${id}`" @click="remove(id)">✕</button>
      </li>
    </ul>
    <p v-else class="picker-empty">none</p>
    <div class="picker-add">
      <select v-model="pickerValue" class="picker-select" :data-testid="`picker-select-${placeholder ?? 'list'}`">
        <option value="">{{ placeholder ?? 'add…' }}</option>
        <option v-for="o in remaining" :key="o" :value="o">{{ display(o) }}</option>
      </select>
      <button type="button" class="picker-add-btn" :disabled="!pickerValue" @click="add">+</button>
    </div>
  </div>
</template>

<style scoped>
.picker-rows {
  list-style: none;
  margin: 0 0 0.3rem;
  padding: 0;
}
.picker-row {
  display: flex;
  align-items: center;
  gap: 0.4rem;
  padding: 0.15rem 0.3rem;
  border-radius: var(--radius-sm);
  font-family: var(--font-mono);
  font-size: 0.72rem;
}
.picker-row:hover { background: var(--bg-elevated); }
.picker-row-label { flex: 1; color: var(--text); }
.picker-remove {
  border: none;
  background: none;
  color: var(--text-faint);
  cursor: pointer;
  font-size: 0.65rem;
  padding: 0.1rem 0.25rem;
}
.picker-remove:hover { color: #b85555; }
.picker-empty {
  font-size: 0.7rem;
  color: var(--text-faint);
  font-style: italic;
  margin: 0.2rem 0;
}
.picker-add { display: flex; gap: 0.3rem; }
.picker-select {
  flex: 1;
  padding: 0.25rem 0.4rem;
  border: 1px solid var(--border);
  border-radius: var(--radius-sm);
  background: var(--bg);
  color: var(--text);
  font-size: 0.72rem;
}
.picker-add-btn {
  width: 26px;
  border: 1px solid var(--border);
  background: var(--bg-elevated);
  color: var(--accent);
  border-radius: var(--radius-sm);
  cursor: pointer;
}
.picker-add-btn:disabled { opacity: 0.4; cursor: default; }
</style>
