<script setup lang="ts">
// ─────────────────────────────────────────────────────────────────────
// A key→value map editor (TODO.editor wave 03) — the subject anatomy's
// Record<string, string> facets (is.metadata / provenance /
// design_parameters / designed_conditions, has.attributes). Keys are
// fixed once added (rename = remove + add — the map identity is the
// key); values edit in place.
// ─────────────────────────────────────────────────────────────────────
import { ref } from 'vue';

const props = defineProps<{
  entries: [string, string][];
  keyPlaceholder?: string;
  valuePlaceholder?: string;
  testidPrefix?: string;
}>();

const emit = defineEmits<{
  (e: 'update', entries: [string, string][]): void;
}>();

const draftKey = ref('');
const draftValue = ref('');

function add() {
  const k = draftKey.value.trim();
  if (!k || props.entries.some(([key]) => key === k)) return;
  emit('update', [...props.entries, [k, draftValue.value.trim()]]);
  draftKey.value = '';
  draftValue.value = '';
}

function remove(i: number) {
  emit('update', props.entries.filter((_, idx) => idx !== i));
}

function patchValue(i: number, e: Event) {
  emit('update', props.entries.map(([k, v], idx) => idx === i ? [k, (e.target as HTMLInputElement).value] : [k, v]));
}

const tid = (suffix: string, key?: string) =>
  props.testidPrefix ? `${props.testidPrefix}-${suffix}${key !== undefined ? `-${key}` : ''}` : undefined;
</script>

<template>
  <div class="kv-list">
    <ul v-if="entries.length" class="kv-rows">
      <li v-for="([k, v], i) in entries" :key="k" class="kv-row">
        <code class="kv-key" :title="k">{{ k }}</code>
        <input class="kv-input" :value="v" :placeholder="valuePlaceholder ?? 'value'" :data-testid="tid('value', k)" @change="patchValue(i, $event)" />
        <button type="button" class="kv-remove" title="remove" :data-testid="tid('remove', k)" @click="remove(i)">✕</button>
      </li>
    </ul>
    <div class="kv-add">
      <input v-model="draftKey" class="kv-input kv-key-input" :placeholder="keyPlaceholder ?? 'key…'" :data-testid="tid('add-key')" @keyup.enter="add" />
      <input v-model="draftValue" class="kv-input" :placeholder="valuePlaceholder ?? 'value…'" :data-testid="tid('add-value')" @keyup.enter="add" />
      <button type="button" class="kv-add-btn" :disabled="!draftKey.trim()" :data-testid="tid('add-btn')" @click="add">+</button>
    </div>
  </div>
</template>

<style scoped>
.kv-rows { list-style: none; margin: 0 0 0.3rem; padding: 0; }
.kv-row { display: grid; grid-template-columns: 7rem 1fr 18px; gap: 0.25rem; align-items: center; margin-bottom: 0.25rem; }
.kv-key {
  font-family: var(--font-mono);
  font-size: 0.7rem;
  color: var(--accent);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.kv-input {
  width: 100%;
  min-width: 0;
  padding: 0.25rem 0.4rem;
  border: 1px solid var(--border);
  border-radius: var(--radius-sm);
  background: var(--bg);
  color: var(--text);
  font-size: 0.72rem;
}
.kv-remove { border: none; background: none; color: var(--text-faint); cursor: pointer; font-size: 0.65rem; padding: 0.1rem 0.25rem; }
.kv-remove:hover { color: #b85555; }
.kv-add { display: grid; grid-template-columns: 7rem 1fr 26px; gap: 0.25rem; }
.kv-add-btn {
  border: 1px solid var(--border);
  background: var(--bg-elevated);
  color: var(--accent);
  border-radius: var(--radius-sm);
  cursor: pointer;
}
.kv-add-btn:disabled { opacity: 0.4; cursor: default; }
</style>
