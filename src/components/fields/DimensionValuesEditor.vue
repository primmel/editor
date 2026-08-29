<script setup lang="ts">
// ─────────────────────────────────────────────────────────────────────
// A dimension-value list editor (TODO.editor wave 03, window 2) — one
// classification dimension's values: id + label + description per
// value. The implies closure count and the payload marker summarize
// read-only (the payload's nested blocks stay in the code view).
// ─────────────────────────────────────────────────────────────────────
import { ref } from 'vue';
import type { Standard } from '@primmel/primmel';

type DimensionValue = Standard['instruments'][number]['dimensions'][number]['values'][number];

defineProps<{
  values: DimensionValue[];
  testidPrefix: string;
}>();

const emit = defineEmits<{
  (e: 'patch', valueIndex: number, field: 'label' | 'description', event: Event): void;
  (e: 'add', id: string): void;
  (e: 'remove', valueIndex: number): void;
}>();

const draft = ref('');

function add() {
  const id = draft.value.trim();
  if (!id) return;
  emit('add', id);
  draft.value = '';
}
</script>

<template>
  <div class="dim-values">
    <ul v-if="values.length" class="value-rows">
      <li v-for="(v, vi) in values" :key="v.id" class="value-row" :data-testid="`${testidPrefix}-value-${v.id}`">
        <div class="value-line">
          <code class="value-id">{{ v.id }}</code>
          <span v-if="v.implies.length" class="value-note" :title="`implies ${v.implies.join(' ')}`">⇒ {{ v.implies.length }}</span>
          <span v-if="Object.keys(v.payload).length" class="value-note" title="payload — edited in the code view">◈</span>
          <button type="button" class="row-remove" title="remove value" :data-testid="`${testidPrefix}-value-remove-${v.id}`" @click="emit('remove', vi)">✕</button>
        </div>
        <div class="value-pair">
          <input class="text-input" :value="v.label" placeholder="label" :data-testid="`${testidPrefix}-value-label-${v.id}`" @change="emit('patch', vi, 'label', $event)" />
          <input class="text-input" :value="v.description" placeholder="description" :data-testid="`${testidPrefix}-value-desc-${v.id}`" @change="emit('patch', vi, 'description', $event)" />
        </div>
      </li>
    </ul>
    <div class="value-add">
      <input v-model="draft" class="text-input mono" placeholder="value id…" :data-testid="`${testidPrefix}-value-add`" @keyup.enter="add" />
      <button type="button" :disabled="!draft.trim()" :data-testid="`${testidPrefix}-value-add-btn`" @click="add">+</button>
    </div>
  </div>
</template>

<style scoped>
.value-rows { list-style: none; margin: 0 0 0.3rem; padding: 0; }
.value-row {
  border: 1px solid var(--border-soft);
  border-radius: var(--radius-sm);
  padding: 0.25rem 0.35rem;
  margin-bottom: 0.25rem;
  display: grid;
  gap: 0.2rem;
}
.value-line { display: flex; align-items: center; gap: 0.3rem; }
.value-id { font-family: var(--font-mono); font-size: 0.7rem; flex: 1; }
.value-pair { display: grid; grid-template-columns: 1fr 1fr; gap: 0.3rem; }
.value-add { display: flex; gap: 0.3rem; }
.value-add button {
  width: 26px; border: 1px solid var(--border); background: var(--bg-elevated); color: var(--accent);
  border-radius: var(--radius-sm); cursor: pointer;
}
.value-add button:disabled { opacity: 0.4; cursor: default; }
.text-input {
  width: 100%;
  min-width: 0;
  padding: 0.25rem 0.4rem;
  border: 1px solid var(--border);
  border-radius: var(--radius-sm);
  background: var(--bg);
  color: var(--text);
  font-size: 0.72rem;
}
.mono { font-family: var(--font-mono); }
.row-remove { border: none; background: none; color: var(--text-faint); cursor: pointer; font-size: 0.65rem; padding: 0.1rem 0.25rem; }
.row-remove:hover { color: #b85555; }
.value-note { font-size: 0.62rem; color: var(--text-faint); }
</style>
