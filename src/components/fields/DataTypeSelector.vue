<script setup lang="ts">
// ─────────────────────────────────────────────────────────────────────
// The datatype selector (TODO.editor/05) — the vocabulary is the
// kernel's (type-expr.ts), never a local list: primitives +
// QuantityValue + reference(Class) composite; anything else
// (map<K,V>, legacy free-form) falls back to a custom text row.
// ─────────────────────────────────────────────────────────────────────
import { computed } from 'vue';
import { PRIMITIVE_TYPES, parseTypeExpression } from '@primmel/primmel';

const props = defineProps<{
  modelValue: string;
  /** Dataclass ids for reference(…) targets. */
  classOptions: string[];
}>();

const emit = defineEmits<{
  (e: 'update', type: string): void;
}>();

const QUANTITY = 'QuantityValue';
const REF = '__reference__';
const CUSTOM = '__custom__';

const parsed = computed(() => parseTypeExpression(props.modelValue));

const selectValue = computed(() => {
  const p = parsed.value;
  if (!p) return props.modelValue === '' ? '' : CUSTOM;
  switch (p.kind) {
    case 'primitive': return p.name;
    case 'quantity': return QUANTITY;
    case 'reference': return REF;
    case 'map': return CUSTOM;
  }
});

const refTarget = computed(() =>
  parsed.value?.kind === 'reference' ? parsed.value.target : '');

function onSelect(e: Event) {
  const v = (e.target as HTMLSelectElement).value;
  if (v === REF) {
    emit('update', `reference(${props.classOptions[0] ?? 'Class'})`);
  } else if (v === CUSTOM) {
    // Keep the current text so the user edits it in the custom row.
    if (parsed.value) emit('update', props.modelValue);
  } else {
    emit('update', v);
  }
}

function onRefTarget(e: Event) {
  emit('update', `reference(${(e.target as HTMLSelectElement).value})`);
}

function onCustom(e: Event) {
  emit('update', (e.target as HTMLInputElement).value);
}
</script>

<template>
  <div class="datatype-selector">
    <select
      class="select-input"
      :value="selectValue"
      data-testid="datatype-select"
      @change="onSelect"
    >
      <option value="">— untyped —</option>
      <option v-for="t in PRIMITIVE_TYPES" :key="t" :value="t">{{ t }}</option>
      <option :value="QUANTITY">QuantityValue</option>
      <option :value="REF">reference(…)</option>
      <option :value="CUSTOM">custom…</option>
    </select>
    <select
      v-if="selectValue === REF"
      class="select-input ref-target"
      :value="refTarget"
      data-testid="datatype-ref-target"
      @change="onRefTarget"
    >
      <option v-for="c in classOptions" :key="c" :value="c">{{ c }}</option>
    </select>
    <input
      v-if="selectValue === CUSTOM"
      class="text-input custom-type"
      :value="modelValue"
      placeholder="e.g. map<string, integer>"
      data-testid="datatype-custom"
      @change="onCustom"
    />
  </div>
</template>

<style scoped>
.datatype-selector { display: flex; gap: 0.3rem; }
.select-input, .text-input {
  flex: 1;
  min-width: 0;
  padding: 0.25rem 0.4rem;
  border: 1px solid var(--border);
  border-radius: var(--radius-sm);
  background: var(--bg);
  color: var(--text);
  font-size: 0.72rem;
}
</style>
