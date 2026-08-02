<script setup lang="ts">
// ─────────────────────────────────────────────────────────────────────
// The attribute list (TODO.editor/05) — add (minted id), remove,
// reorder (up/down), per-row AttributeEdit. Pure presentation: every
// intent is an event; the inspector owns the commands.
// ─────────────────────────────────────────────────────────────────────
import { ref } from 'vue';
import type { DataAttribute } from '@primmel/primmel';
import AttributeEdit from './AttributeEdit.vue';

const props = defineProps<{
  attributes: DataAttribute[];
  classOptions: string[];
  referenceOptions: string[];
}>();

const emit = defineEmits<{
  (e: 'add', id: string): void;
  (e: 'remove', id: string): void;
  (e: 'move', fromIndex: number, toIndex: number): void;
  (e: 'patch', id: string, patch: Partial<DataAttribute>): void;
  (e: 'patchRefs', id: string, ids: string[]): void;
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
  <div class="attribute-list">
    <datalist id="cardinality-presets">
      <option value="0..1" />
      <option value="1..1" />
      <option value="0..*" />
      <option value="1..*" />
    </datalist>

    <div v-for="(attr, i) in attributes" :key="attr.id" class="attribute-row">
      <AttributeEdit
        :attr="attr"
        :class-options="classOptions"
        :reference-options="referenceOptions"
        @patch="emit('patch', attr.id, $event)"
        @patch-refs="emit('patchRefs', attr.id, $event)"
      />
      <div class="row-actions">
        <button
          type="button"
          :disabled="i === 0"
          title="move up"
          :data-testid="`attr-up-${attr.id}`"
          @click="emit('move', i, i - 1)"
        >↑</button>
        <button
          type="button"
          :disabled="i === attributes.length - 1"
          title="move down"
          :data-testid="`attr-down-${attr.id}`"
          @click="emit('move', i, i + 1)"
        >↓</button>
        <button
          type="button"
          class="row-remove"
          title="remove attribute"
          :data-testid="`attr-remove-${attr.id}`"
          @click="emit('remove', attr.id)"
        >✕</button>
      </div>
    </div>

    <div class="attribute-add">
      <input
        v-model="draft"
        class="text-input"
        placeholder="new attribute id…"
        data-testid="attr-add-input"
        @keyup.enter="add"
      />
      <button type="button" :disabled="!draft.trim()" data-testid="attr-add-btn" @click="add">+</button>
    </div>
  </div>
</template>

<style scoped>
.attribute-row { position: relative; }
.row-actions {
  position: absolute;
  top: 0.3rem;
  right: 0.4rem;
  display: flex;
  gap: 0.15rem;
}
.row-actions button {
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
.row-actions button:disabled { opacity: 0.3; cursor: default; }
.row-actions .row-remove:hover { color: #b85555; border-color: #b85555; }
.attribute-add {
  display: flex;
  gap: 0.3rem;
  margin-top: 0.4rem;
}
.text-input {
  flex: 1;
  padding: 0.25rem 0.4rem;
  border: 1px solid var(--border);
  border-radius: var(--radius-sm);
  background: var(--bg);
  color: var(--text);
  font-size: 0.72rem;
}
.attribute-add button {
  width: 26px;
  border: 1px solid var(--border);
  background: var(--bg-elevated);
  color: var(--accent);
  border-radius: var(--radius-sm);
  cursor: pointer;
}
.attribute-add button:disabled { opacity: 0.4; cursor: default; }
</style>
