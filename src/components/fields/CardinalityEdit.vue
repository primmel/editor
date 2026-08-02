<script setup lang="ts">
// ─────────────────────────────────────────────────────────────────────
// The cardinality editor (TODO.editor/05) — the bracket content as the
// kernel stores it (`''` = exactly one, omitted; `0..1`, `1..*` …).
// The preset datalist lives once in AttributeList (ids are document-
// wide); free `[n..m]` stays typable.
// ─────────────────────────────────────────────────────────────────────
defineProps<{ modelValue: string }>();

const emit = defineEmits<{
  (e: 'update', cardinality: string): void;
}>();

function onInput(e: Event) {
  emit('update', (e.target as HTMLInputElement).value.trim());
}
</script>

<template>
  <input
    class="cardinality-input"
    :value="modelValue"
    list="cardinality-presets"
    placeholder="1..1"
    data-testid="cardinality-input"
    @change="onInput"
  />
</template>

<style scoped>
.cardinality-input {
  width: 5.5rem;
  padding: 0.25rem 0.4rem;
  border: 1px solid var(--border);
  border-radius: var(--radius-sm);
  background: var(--bg);
  color: var(--text);
  font-size: 0.72rem;
  font-family: var(--font-mono);
}
</style>
