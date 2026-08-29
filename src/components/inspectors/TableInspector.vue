<script setup lang="ts">
// ─────────────────────────────────────────────────────────────────────
// The table inspector (TODO.editor wave 03) — the lookup-table surface:
// title/description, the typed column declarations (name : type unit),
// and the data grid (the string matrix — the kernel stringifies every
// cell on parse; the dump quotes them back). The profile bindings,
// overrides, and domain blocks stay in the code view (summarized
// read-only here when present).
// ─────────────────────────────────────────────────────────────────────
import { computed, ref } from 'vue';
import type { Standard } from '@primmel/primmel';
import { updateConstruct } from '../../lib/commands';
import type { Table } from '../../lib/factory';
import { useModelStore } from '../../stores/model';
import InspectorField from '../fields/InspectorField.vue';

type TableColumnDef = NonNullable<Table['columnDefs']>[number];

const props = defineProps<{ model: Standard; elementId: string }>();
const modelStore = useModelStore();

const listOf = (a: Standard) => a.tables;
const table = computed(() => { void modelStore.version; return props.model.tables.find(t => t.id === props.elementId); });

/** Fresh arrays per version (in-place mutation never re-fires). */
const columnDefs = computed(() => { void modelStore.version; return [...(table.value?.columnDefs ?? [])]; });
const rows = computed(() => { void modelStore.version; return (table.value?.data ?? []).map(r => [...r]); });

const colCount = computed(() => Math.max(columnDefs.value.length, ...rows.value.map(r => r.length), 0));

function patch(field: keyof Table, e: Event) {
  if (!table.value) return;
  modelStore.execute(
    updateConstruct(listOf, props.elementId, { [field]: (e.target as HTMLInputElement | HTMLTextAreaElement).value }, `edit table ${props.elementId}`),
  );
}

function patchColumns(next: TableColumnDef[], label: string) {
  modelStore.execute(updateConstruct(listOf, props.elementId, { columnDefs: next }, label));
}

function patchColumn(index: number, field: keyof TableColumnDef, e: Event) {
  const next = columnDefs.value.map((c, i) => i === index ? { ...c, [field]: (e.target as HTMLInputElement | HTMLSelectElement).value } : c);
  patchColumns(next, `edit table ${props.elementId} column ${columnDefs.value[index]?.name ?? index}`);
}

const draftColumn = ref('');
function addColumn() {
  const name = draftColumn.value.trim();
  if (!name || !table.value || columnDefs.value.some(c => c.name === name)) return;
  patchColumns([...columnDefs.value, { name, type: 'string', unit: '' }], `add table ${props.elementId} column ${name}`);
  // The rows gain an empty cell so the grid stays rectangular.
  if (rows.value.length > 0) {
    modelStore.execute(updateConstruct(listOf, props.elementId, { data: rows.value.map(r => [...r, '']) }, `extend table ${props.elementId} rows`));
  }
  draftColumn.value = '';
}

function removeColumn(index: number) {
  const name = columnDefs.value[index]?.name ?? index;
  patchColumns(columnDefs.value.filter((_, i) => i !== index), `remove table ${props.elementId} column ${name}`);
  if (rows.value.some(r => r.length > index)) {
    modelStore.execute(updateConstruct(listOf, props.elementId, { data: rows.value.map(r => r.filter((_, i) => i !== index)) }, `shrink table ${props.elementId} rows`));
  }
}

function patchData(next: string[][], label: string) {
  modelStore.execute(updateConstruct(listOf, props.elementId, { data: next }, label));
}

function patchCell(row: number, col: number, e: Event) {
  const next = rows.value.map((r, ri) => ri === row ? r.map((c, ci) => ci === col ? (e.target as HTMLInputElement).value : c) : r);
  patchData(next, `edit table ${props.elementId} cell ${row},${col}`);
}

function addRow() {
  patchData([...rows.value, Array.from({ length: colCount.value }, () => '')], `add table ${props.elementId} row`);
}

function removeRow(index: number) {
  patchData(rows.value.filter((_, i) => i !== index), `remove table ${props.elementId} row ${index}`);
}
</script>

<template>
  <div v-if="table" class="table-inspector" data-testid="table-inspector">
    <InspectorField label="id">
      <code class="readonly-id">{{ table.id }}</code>
    </InspectorField>

    <InspectorField label="title">
      <input class="text-input" :value="table.title" data-testid="table-title" @change="patch('title', $event)" />
    </InspectorField>

    <InspectorField label="description">
      <textarea class="text-input" rows="2" :value="table.description" data-testid="table-description" @change="patch('description', $event)" />
    </InspectorField>

    <InspectorField :label="`columns (${columnDefs.length})`">
      <ul v-if="columnDefs.length" class="column-rows">
        <li v-for="(c, i) in columnDefs" :key="i" class="column-row">
          <code class="column-name">{{ c.name }}</code>
          <select class="text-input column-type" :value="c.type" :data-testid="`table-col-type-${c.name}`" @change="patchColumn(i, 'type', $event)">
            <option value="string">string</option>
            <option value="number">number</option>
            <option value="integer">integer</option>
            <option value="boolean">boolean</option>
          </select>
          <input class="text-input mono column-unit" :value="c.unit" placeholder="unit" :data-testid="`table-col-unit-${c.name}`" @change="patchColumn(i, 'unit', $event)" />
          <button type="button" class="row-remove" title="remove column" :data-testid="`table-col-remove-${c.name}`" @click="removeColumn(i)">✕</button>
        </li>
      </ul>
      <div class="column-add">
        <input v-model="draftColumn" class="text-input mono" placeholder="column name…" data-testid="table-col-add" @keyup.enter="addColumn" />
        <button type="button" :disabled="!draftColumn.trim()" data-testid="table-col-add-btn" @click="addColumn">+</button>
      </div>
    </InspectorField>

    <InspectorField :label="`data (${rows.length} rows)`">
      <div v-if="rows.length" class="data-grid" :style="{ gridTemplateColumns: `repeat(${colCount}, minmax(2.5rem, 1fr)) auto` }">
        <template v-for="(row, ri) in rows" :key="ri">
          <input
            v-for="(cell, ci) in row"
            :key="ci"
            class="text-input mono data-cell"
            :value="cell"
            :data-testid="`table-cell-${ri}-${ci}`"
            @change="patchCell(ri, ci, $event)"
          />
          <button type="button" class="row-remove" title="remove row" :data-testid="`table-row-remove-${ri}`" @click="removeRow(ri)">✕</button>
        </template>
      </div>
      <p v-else class="data-empty">no rows</p>
      <button type="button" class="row-add" data-testid="table-row-add" @click="addRow">+ row</button>
    </InspectorField>

    <InspectorField v-if="table.profileDefs?.length || table.profiles" label="profiles" hint="dimension → per-value bindings — edited in the code view">
      <code class="readonly-id" data-testid="table-profiles">{{ (table.profileDefs ?? []).map(p => p.name).join(', ') || Object.keys(table.profiles ?? {}).join(', ') }}</code>
    </InspectorField>
  </div>
</template>

<style scoped>
.readonly-id {
  font-family: var(--font-mono);
  font-size: 0.75rem;
  color: var(--text-muted);
  word-break: break-all;
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
.mono { font-family: var(--font-mono); }
.column-rows { list-style: none; margin: 0 0 0.4rem; padding: 0; }
.column-row { display: grid; grid-template-columns: 1fr 5rem 4rem 18px; gap: 0.25rem; align-items: center; margin-bottom: 0.25rem; }
.column-name { font-family: var(--font-mono); font-size: 0.7rem; color: var(--accent); overflow: hidden; text-overflow: ellipsis; }
.column-add { display: flex; gap: 0.3rem; }
.column-add button {
  width: 26px; border: 1px solid var(--border); background: var(--bg-elevated); color: var(--accent);
  border-radius: var(--radius-sm); cursor: pointer;
}
.column-add button:disabled { opacity: 0.4; cursor: default; }
.row-remove { border: none; background: none; color: var(--text-faint); cursor: pointer; font-size: 0.65rem; padding: 0.1rem 0.25rem; }
.row-remove:hover { color: #b85555; }
.data-grid { display: grid; gap: 2px; margin-bottom: 0.35rem; }
.data-cell { font-size: 0.68rem; padding: 0.15rem 0.3rem; }
.data-empty { font-size: 0.7rem; color: var(--text-faint); font-style: italic; margin: 0.2rem 0; }
.row-add {
  border: 1px solid var(--border); background: var(--bg-elevated); color: var(--accent);
  border-radius: var(--radius-sm); cursor: pointer; font-size: 0.68rem; padding: 0.2rem 0.6rem;
}
</style>
