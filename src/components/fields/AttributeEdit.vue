<script setup lang="ts">
// ─────────────────────────────────────────────────────────────────────
// One attribute's editor (TODO.editor/05) — id, datatype (the kernel's
// vocabulary), cardinality, modality, definition, unit, required,
// enum_values (inline enums), satisfy, references. Emits patches; the
// parent inspector turns them into commands.
// ─────────────────────────────────────────────────────────────────────
import type { DataAttribute } from '@primmel/primmel';
import DataTypeSelector from './DataTypeSelector.vue';
import CardinalityEdit from './CardinalityEdit.vue';
import StringListEdit from './StringListEdit.vue';
import PickerListEdit from './PickerListEdit.vue';

const props = defineProps<{
  attr: DataAttribute;
  /** Dataclass ids (reference(…) targets). */
  classOptions: string[];
  /** Reference ids (the document-reference picker). */
  referenceOptions: string[];
}>();

const emit = defineEmits<{
  (e: 'patch', patch: Partial<DataAttribute>): void;
  /** Reference id list — the parent resolves Reference objects (the
   *  document/clause data lives on model.references, not here). */
  (e: 'patchRefs', ids: string[]): void;
}>();

function onText(key: 'definition' | 'unit' | 'defaultValue', e: Event) {
  emit('patch', { [key]: (e.target as HTMLInputElement).value });
}
</script>

<template>
  <div class="attribute-edit" :data-testid="`attribute-${attr.id}`">
    <div class="attr-head">
      <code class="attr-id">{{ attr.id }}</code>
      <label class="attr-required">
        <input
          type="checkbox"
          :checked="attr.required ?? false"
          @change="emit('patch', { required: ($event.target as HTMLInputElement).checked })"
        />
        required
      </label>
    </div>

    <div class="attr-grid">
      <span class="attr-label">type</span>
      <DataTypeSelector
        :model-value="attr.type"
        :class-options="classOptions"
        @update="emit('patch', { type: $event })"
      />
      <span class="attr-label">card.</span>
      <CardinalityEdit
        :model-value="attr.cardinality"
        @update="emit('patch', { cardinality: $event })"
      />
    </div>

    <div class="attr-grid">
      <span class="attr-label">modality</span>
      <select
        class="select-input"
        :value="attr.modality"
        @change="emit('patch', { modality: ($event.target as HTMLSelectElement).value })"
      >
        <option value="">—</option>
        <option value="SHALL">SHALL</option>
        <option value="SHOULD">SHOULD</option>
        <option value="MAY">MAY</option>
      </select>
      <span class="attr-label">unit</span>
      <input
        class="text-input"
        :value="attr.unit ?? ''"
        placeholder="e.g. kg"
        @change="onText('unit', $event)"
      />
    </div>

    <input
      class="text-input attr-definition"
      :value="attr.definition"
      placeholder="definition"
      :data-testid="`attr-definition-${attr.id}`"
      @change="onText('definition', $event)"
    />

    <div v-if="attr.type === 'enum'" class="attr-block">
      <span class="attr-label">enum values</span>
      <StringListEdit
        :items="attr.enumValues ?? []"
        placeholder="add value…"
        @update="emit('patch', { enumValues: $event })"
      />
    </div>

    <details class="attr-more">
      <summary>more</summary>
      <div class="attr-block">
        <span class="attr-label">default</span>
        <input
          class="text-input"
          :value="attr.defaultValue ?? ''"
          @change="onText('defaultValue', $event)"
        />
      </div>
      <div class="attr-block">
        <span class="attr-label">satisfy</span>
        <StringListEdit
          :items="attr.satisfy"
          placeholder="provision id…"
          @update="emit('patch', { satisfy: $event })"
        />
      </div>
      <div class="attr-block">
        <span class="attr-label">references</span>
        <PickerListEdit
          :items="attr.ref.map(r => r.id)"
          :options="referenceOptions"
          placeholder="add reference…"
          @update="emit('patchRefs', $event)"
        />
      </div>
    </details>
  </div>
</template>

<style scoped>
.attribute-edit {
  border: 1px solid var(--border);
  border-radius: var(--radius-sm);
  padding: 0.45rem 0.5rem;
  margin-bottom: 0.4rem;
  background: var(--bg-elevated);
}
.attr-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 0.35rem;
}
.attr-id {
  font-family: var(--font-mono);
  font-size: 0.75rem;
  color: var(--accent);
  font-weight: 500;
}
.attr-required {
  display: flex;
  align-items: center;
  gap: 0.25rem;
  font-size: 0.62rem;
  color: var(--text-muted);
}
.attr-grid {
  display: grid;
  grid-template-columns: 3.2rem 1fr 2.4rem auto;
  align-items: center;
  gap: 0.3rem;
  margin-bottom: 0.3rem;
}
.attr-label {
  font-size: 0.62rem;
  color: var(--text-muted);
  font-weight: 600;
}
.attr-definition { width: 100%; }
.attr-block { margin-top: 0.35rem; }
.attr-more { margin-top: 0.3rem; }
.attr-more summary {
  font-size: 0.62rem;
  color: var(--text-faint);
  cursor: pointer;
}
.text-input, .select-input {
  width: 100%;
  min-width: 0;
  padding: 0.25rem 0.4rem;
  border: 1px solid var(--border);
  border-radius: var(--radius-sm);
  background: var(--bg);
  color: var(--text);
  font-size: 0.72rem;
}
</style>
