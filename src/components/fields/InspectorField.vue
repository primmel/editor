<script setup lang="ts">
// ─────────────────────────────────────────────────────────────────────
// The inspector field kit (TODO.editor/04) — shared field chrome:
// label + required flag + the slotted control.
// ─────────────────────────────────────────────────────────────────────
defineProps<{
  label: string;
  required?: boolean;
  missing?: boolean;
  hint?: string;
}>();
</script>

<template>
  <label class="field" :class="{ missing: required && missing }">
    <span class="field-label">
      {{ label }}
      <span v-if="required" class="field-required">*</span>
    </span>
    <slot />
    <span v-if="hint" class="field-hint">{{ hint }}</span>
    <span v-else-if="required && missing" class="field-missing">required</span>
  </label>
</template>

<style scoped>
.field {
  display: block;
  margin-bottom: 0.6rem;
}
.field-label {
  display: block;
  font-size: 0.68rem;
  font-weight: 600;
  color: var(--text-muted);
  margin-bottom: 0.2rem;
}
.field-required { color: #b85555; }
.field-hint {
  display: block;
  font-size: 0.62rem;
  color: var(--text-faint);
  margin-top: 0.15rem;
}
.field-missing {
  display: block;
  font-size: 0.62rem;
  color: #b85555;
  margin-top: 0.15rem;
}
.field.missing :slotted(input),
.field.missing :slotted(select),
.field.missing :slotted(textarea) {
  border-color: #b85555;
}
</style>
