<script setup lang="ts">
// ─────────────────────────────────────────────────────────────────────
// The dataclass inspector (TODO.editor/05) — the HAS axis: class-level
// facets (store, extends, description) and the attribute list, each
// edit a command.
// ─────────────────────────────────────────────────────────────────────
import { computed } from 'vue';
import type { DataAttribute, DataClass, Standard } from '@primmel/primmel';
import {
  addAttribute,
  removeAttribute,
  reorderList,
  updateAttribute,
  updateElement,
} from '../../lib/commands';
import { useModelStore } from '../../stores/model';
import InspectorField from '../fields/InspectorField.vue';
import AttributeList from '../fields/AttributeList.vue';

const props = defineProps<{ model: Standard; classId: string }>();
const modelStore = useModelStore();

const cls = computed(() => { void modelStore.version; return props.model.dataclasses.find(d => d.id === props.classId); });
const classOptions = computed(() => { void modelStore.version; return props.model.dataclasses.map(d => d.id); });
const referenceOptions = computed(() => { void modelStore.version; return props.model.references.map(r => r.id); });

function patch(p: Partial<DataClass>) {
  modelStore.execute(
    updateElement((a: Standard) => a.dataclasses, props.classId, p),
  );
}

/** The extends select as a writable computed (same v-model race
 *  discipline as the other dynamic-option selects; the get reads
 *  version DIRECTLY — `cls` is identity-stable under in-place edits). */
const extendsSelection = computed<string>({
  get: () => {
    void modelStore.version;
    return cls.value?.extends ?? '';
  },
  set: (v) => patch({ extends: v || undefined }),
});

/** The attribute rows as a FRESH array per version (the identity-stable
 *  `cls.attributes` array is mutated in place by the commands — a
 *  chained computed would never re-fire). */
const attrs = computed(() => {
  void modelStore.version;
  return [...(cls.value?.attributes ?? [])];
});

function onAdd(id: string) {
  const attr: DataAttribute = {
    id, type: '', modality: '', cardinality: '', definition: '', ref: [], satisfy: [],
  };
  modelStore.execute(addAttribute(props.classId, attr));
}

function onMove(fromIndex: number, toIndex: number) {
  modelStore.execute(reorderList(
    (a: Standard) => a.dataclasses.find(d => d.id === props.classId)!.attributes,
    fromIndex,
    toIndex,
  ));
}

function onPatch(attrId: string, patch: Partial<DataAttribute>) {
  modelStore.execute(updateAttribute(props.classId, attrId, patch));
}

function onRefs(attrId: string, ids: string[]) {
  const refs = ids
    .map(id => props.model.references.find(r => r.id === id))
    .filter((r): r is NonNullable<typeof r> => !!r);
  modelStore.execute(updateAttribute(props.classId, attrId, { ref: refs }));
}
</script>

<template>
  <div v-if="cls" class="dataclass-inspector" data-testid="dataclass-inspector">
    <InspectorField label="id">
      <code class="readonly-id">{{ cls.id }}</code>
    </InspectorField>

    <InspectorField label="store" hint="persistent store name (storable classes)">
      <input
        class="text-input"
        :value="cls.store ?? ''"
        data-testid="dataclass-store"
        @change="patch({ store: ($event.target as HTMLInputElement).value || undefined })"
      />
    </InspectorField>

    <InspectorField label="extends" hint="inherit fields from a parent class">
      <select
        v-model="extendsSelection"
        class="select-input"
        data-testid="dataclass-extends"
      >
        <option value="">— none —</option>
        <option v-for="c in classOptions.filter(o => o !== cls?.id)" :key="c" :value="c">{{ c }}</option>
      </select>
    </InspectorField>

    <InspectorField label="description">
      <textarea
        class="text-area"
        :value="cls.description ?? ''"
        rows="2"
        data-testid="dataclass-description"
        @change="patch({ description: ($event.target as HTMLTextAreaElement).value || undefined })"
      />
    </InspectorField>

    <InspectorField :label="`attributes (${cls.attributes.length})`">
      <AttributeList
        :attributes="attrs"
        :class-options="classOptions"
        :reference-options="referenceOptions"
        @add="onAdd"
        @remove="modelStore.execute(removeAttribute(props.classId, $event))"
        @move="onMove"
        @patch="onPatch"
        @patch-refs="onRefs"
      />
    </InspectorField>
  </div>
</template>

<style scoped>
.readonly-id {
  font-family: var(--font-mono);
  font-size: 0.75rem;
  color: var(--text-muted);
}
.text-input, .select-input, .text-area {
  width: 100%;
  padding: 0.3rem 0.45rem;
  border: 1px solid var(--border);
  border-radius: var(--radius-sm);
  background: var(--bg);
  color: var(--text);
  font-size: 0.78rem;
}
.text-area { resize: vertical; font-family: inherit; }
</style>
