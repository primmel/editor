<script setup lang="ts">
// ─────────────────────────────────────────────────────────────────────
// A QuantityValue-map editor (TODO.editor wave 03, window 2) — the
// instance plane's value maps (instance has.attributes / test_context,
// artifact-instance content): key → { value, unit? , … }. Keys are
// fixed once added (rename = remove + add); value + unit edit in place;
// the kernel's value-token coercion applies (a numeric literal stays a
// number, anything else the string as written). Extra facets
// (uncertainty / tolerance / quantityKind) carry over on edit — an edit
// never strips them.
// ─────────────────────────────────────────────────────────────────────
import { ref } from 'vue';
import type { Standard } from '@primmel/primmel';

type InstanceValue = Standard['instances'][number]['has']['attributes'][string];

const props = defineProps<{
  entries: Record<string, InstanceValue>;
  testidPrefix?: string;
}>();

const emit = defineEmits<{
  (e: 'update', entries: Record<string, InstanceValue>): void;
}>();

const NUMERIC = /^-?\d+(\.\d+)?([eE][+-]?\d+)?$/;
const coerce = (raw: string): string | number => NUMERIC.test(raw.trim()) ? Number(raw.trim()) : raw;

const keys = () => Object.keys(props.entries);

const draftKey = ref('');
const draftValue = ref('');
const draftUnit = ref('');

function add() {
  const k = draftKey.value.trim();
  if (!k || k in props.entries) return;
  const entry: InstanceValue = { value: coerce(draftValue.value) };
  if (draftUnit.value.trim()) entry.unit = draftUnit.value.trim();
  emit('update', { ...props.entries, [k]: entry });
  draftKey.value = '';
  draftValue.value = '';
  draftUnit.value = '';
}

function remove(key: string) {
  const next = { ...props.entries };
  delete next[key];
  emit('update', next);
}

function patchField(key: string, field: 'value' | 'unit', e: Event) {
  const raw = (e.target as HTMLInputElement).value;
  const old = props.entries[key];
  if (!old) return;
  const next: InstanceValue = { ...old };
  if (field === 'value') next.value = coerce(raw);
  else if (raw.trim()) next.unit = raw.trim();
  else delete next.unit;
  emit('update', { ...props.entries, [key]: next });
}

const tid = (suffix: string, key?: string) =>
  props.testidPrefix ? `${props.testidPrefix}-${suffix}${key !== undefined ? `-${key}` : ''}` : undefined;
</script>

<template>
  <div class="qv-map">
    <ul v-if="keys().length" class="qv-rows">
      <li v-for="key in keys()" :key="key" class="qv-row">
        <code class="qv-key" :title="key">{{ key }}</code>
        <input class="qv-input mono" :value="String(entries[key]!.value)" placeholder="value" :data-testid="tid('value', key)" @change="patchField(key, 'value', $event)" />
        <input class="qv-input qv-unit mono" :value="entries[key]!.unit ?? ''" placeholder="unit" :data-testid="tid('unit', key)" @change="patchField(key, 'unit', $event)" />
        <span v-if="entries[key]!.uncertainty !== undefined || entries[key]!.tolerance !== undefined || entries[key]!.quantityKind !== undefined" class="qv-extra" title="uncertainty / tolerance / kind — edited in the code view">◈</span>
        <button type="button" class="qv-remove" title="remove" :data-testid="tid('remove', key)" @click="remove(key)">✕</button>
      </li>
    </ul>
    <div class="qv-add">
      <input v-model="draftKey" class="qv-input qv-key-input mono" placeholder="key…" :data-testid="tid('add-key')" @keyup.enter="add" />
      <input v-model="draftValue" class="qv-input mono" placeholder="value…" :data-testid="tid('add-value')" @keyup.enter="add" />
      <input v-model="draftUnit" class="qv-input qv-unit mono" placeholder="unit…" :data-testid="tid('add-unit')" @keyup.enter="add" />
      <button type="button" class="qv-add-btn" :disabled="!draftKey.trim()" :data-testid="tid('add-btn')" @click="add">+</button>
    </div>
  </div>
</template>

<style scoped>
.qv-rows { list-style: none; margin: 0 0 0.3rem; padding: 0; }
.qv-row { display: grid; grid-template-columns: minmax(0, 1.2fr) minmax(0, 1fr) minmax(0, 0.7fr) auto 18px; gap: 0.25rem; align-items: center; margin-bottom: 0.25rem; }
.qv-key { font-family: var(--font-mono); font-size: 0.7rem; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.qv-add { display: grid; grid-template-columns: minmax(0, 1.2fr) minmax(0, 1fr) minmax(0, 0.7fr) 26px; gap: 0.25rem; }
.qv-input {
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
.qv-add-btn {
  border: 1px solid var(--border); background: var(--bg-elevated); color: var(--accent);
  border-radius: var(--radius-sm); cursor: pointer;
}
.qv-add-btn:disabled { opacity: 0.4; cursor: default; }
.qv-remove { border: none; background: none; color: var(--text-faint); cursor: pointer; font-size: 0.65rem; padding: 0.1rem 0.25rem; }
.qv-remove:hover { color: #b85555; }
.qv-extra { font-size: 0.62rem; color: var(--text-faint); }
</style>
