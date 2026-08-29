<script setup lang="ts">
// ─────────────────────────────────────────────────────────────────────
// A source-reference list editor (TODO.editor wave 03, window 2) — the
// repeated `source { doc … clause … }` blocks (the requirement family's
// provenance idiom): doc + clause per row, add/remove per row.
// ─────────────────────────────────────────────────────────────────────
import type { Standard } from '@primmel/primmel';

type SourceRef = NonNullable<Standard['formulasUsed'][number]['sourceRefs']>[number];

const props = defineProps<{
  items: SourceRef[];
  testidPrefix?: string;
}>();

const emit = defineEmits<{
  (e: 'update', items: SourceRef[]): void;
}>();

function patch(index: number, field: 'doc' | 'clause', e: Event) {
  emit('update', props.items.map((s, i) => i === index ? { ...s, [field]: (e.target as HTMLInputElement).value } : s));
}

function add() {
  emit('update', [...props.items, { doc: '', clause: '' }]);
}

function remove(index: number) {
  emit('update', props.items.filter((_, i) => i !== index));
}

const tid = (suffix: string, index: number) =>
  props.testidPrefix ? `${props.testidPrefix}-${suffix}-${index}` : undefined;
</script>

<template>
  <div class="source-list">
    <ul v-if="items.length" class="source-rows">
      <li v-for="(s, i) in items" :key="i" class="source-row">
        <input class="source-input mono" :value="s.doc" placeholder="doc (urn:…)" :data-testid="tid('doc', i)" @change="patch(i, 'doc', $event)" />
        <input class="source-input source-clause mono" :value="s.clause" placeholder="clause" :data-testid="tid('clause', i)" @change="patch(i, 'clause', $event)" />
        <button type="button" class="source-remove" title="remove" :data-testid="tid('remove', i)" @click="remove(i)">✕</button>
      </li>
    </ul>
    <button type="button" class="source-add" :data-testid="testidPrefix ? `${testidPrefix}-add` : undefined" @click="add">+ source</button>
  </div>
</template>

<style scoped>
.source-rows { list-style: none; margin: 0 0 0.3rem; padding: 0; }
.source-row { display: grid; grid-template-columns: minmax(0, 1.6fr) minmax(0, 1fr) 18px; gap: 0.25rem; align-items: center; margin-bottom: 0.25rem; }
.source-input {
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
.source-add {
  border: 1px solid var(--border); background: var(--bg-elevated); color: var(--accent);
  border-radius: var(--radius-sm); cursor: pointer; font-size: 0.68rem; padding: 0.2rem 0.6rem;
}
.source-remove { border: none; background: none; color: var(--text-faint); cursor: pointer; font-size: 0.65rem; padding: 0.1rem 0.25rem; }
.source-remove:hover { color: #b85555; }
</style>
