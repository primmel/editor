<script setup lang="ts">
// ─────────────────────────────────────────────────────────────────────
// The enum inspector (TODO.editor/05) — the enum's value list: each
// value's id + definition, add/remove/reorder.
// ─────────────────────────────────────────────────────────────────────
import { computed, ref } from 'vue';
import type { EnumValue, Standard } from '@primmel/primmel';
import {
  createInList,
  deleteInList,
  reorderList,
  updateElement,
} from '../../lib/commands';
import { useModelStore } from '../../stores/model';
import InspectorField from '../fields/InspectorField.vue';

const props = defineProps<{ model: Standard; enumId: string }>();
const modelStore = useModelStore();

const en = computed(() => props.model.enums.find(e => e.id === props.enumId));
const valuesOf = (a: Standard) => a.enums.find(e => e.id === props.enumId)!.values;

const draftId = ref('');
const draftValue = ref('');

function add() {
  const id = draftId.value.trim();
  if (!id || !en.value) return;
  const value: EnumValue = { id, value: draftValue.value.trim() };
  modelStore.execute(createInList(valuesOf, value, `add enum value ${props.enumId}.${id}`));
  draftId.value = '';
  draftValue.value = '';
}

function onValueText(v: EnumValue, e: Event) {
  modelStore.execute(
    updateElement(valuesOf, v.id, { value: (e.target as HTMLInputElement).value }),
  );
}
</script>

<template>
  <div v-if="en" class="enum-inspector" data-testid="enum-inspector">
    <InspectorField label="id">
      <code class="readonly-id">{{ en.id }}</code>
    </InspectorField>

    <InspectorField :label="`values (${en.values.length})`">
      <ul v-if="en.values.length" class="enum-rows">
        <li v-for="(v, i) in en.values" :key="v.id" class="enum-row">
          <code class="enum-id">{{ v.id }}</code>
          <input
            class="text-input"
            :value="v.value"
            placeholder="definition"
            :data-testid="`enum-value-${v.id}`"
            @change="onValueText(v, $event)"
          />
          <button
            type="button"
            :disabled="i === 0"
            title="move up"
            :data-testid="`enum-up-${v.id}`"
            @click="modelStore.execute(reorderList(valuesOf, i, i - 1))"
          >↑</button>
          <button
            type="button"
            :disabled="i === en.values.length - 1"
            title="move down"
            :data-testid="`enum-down-${v.id}`"
            @click="modelStore.execute(reorderList(valuesOf, i, i + 1))"
          >↓</button>
          <button
            type="button"
            class="row-remove"
            title="remove value"
            :data-testid="`enum-remove-${v.id}`"
            @click="modelStore.execute(deleteInList(valuesOf, v.id, `remove enum value ${en.id}.${v.id}`))"
          >✕</button>
        </li>
      </ul>
      <p v-else class="enum-empty">no values</p>

      <div class="enum-add">
        <input
          v-model="draftId"
          class="text-input id-input"
          placeholder="value id…"
          data-testid="enum-add-id"
          @keyup.enter="add"
        />
        <input
          v-model="draftValue"
          class="text-input"
          placeholder="definition…"
          data-testid="enum-add-value"
          @keyup.enter="add"
        />
        <button type="button" :disabled="!draftId.trim()" data-testid="enum-add-btn" @click="add">+</button>
      </div>
    </InspectorField>
  </div>
</template>

<style scoped>
.readonly-id {
  font-family: var(--font-mono);
  font-size: 0.75rem;
  color: var(--text-muted);
}
.enum-rows {
  list-style: none;
  margin: 0 0 0.4rem;
  padding: 0;
}
.enum-row {
  display: grid;
  grid-template-columns: 5.5rem 1fr 18px 18px 18px;
  align-items: center;
  gap: 0.25rem;
  margin-bottom: 0.25rem;
}
.enum-id {
  font-family: var(--font-mono);
  font-size: 0.7rem;
  color: var(--accent);
  overflow: hidden;
  text-overflow: ellipsis;
}
.enum-row button {
  border: 1px solid var(--border);
  background: var(--bg);
  color: var(--text-muted);
  border-radius: var(--radius-sm);
  cursor: pointer;
  font-size: 0.6rem;
  width: 18px;
  height: 18px;
  line-height: 1;
  padding: 0;
}
.enum-row button:disabled { opacity: 0.3; cursor: default; }
.enum-row .row-remove:hover { color: #b85555; border-color: #b85555; }
.enum-empty {
  font-size: 0.7rem;
  color: var(--text-faint);
  font-style: italic;
  margin: 0.2rem 0;
}
.enum-add {
  display: grid;
  grid-template-columns: 5.5rem 1fr 26px;
  gap: 0.25rem;
}
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
.enum-add button {
  border: 1px solid var(--border);
  background: var(--bg-elevated);
  color: var(--accent);
  border-radius: var(--radius-sm);
  cursor: pointer;
}
.enum-add button:disabled { opacity: 0.4; cursor: default; }
</style>
