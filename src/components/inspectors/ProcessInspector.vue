<script setup lang="ts">
// ─────────────────────────────────────────────────────────────────────
// The process inspector (TODO.editor/04) — every facet of a process,
// each edit a command: name, actor, modality, validate_provision,
// output/input (reference_data_registry), measurements.
// ─────────────────────────────────────────────────────────────────────
import { computed } from 'vue';
import type { Process, Standard } from '@primmel/primmel';
import { createPageForProcess, linkProcessToPage, updateElement } from '../../lib/commands';
import { useModelStore } from '../../stores/model';
import { useUiStore } from '../../stores/ui';
import InspectorField from '../fields/InspectorField.vue';
import PickerListEdit from '../fields/PickerListEdit.vue';
import StringListEdit from '../fields/StringListEdit.vue';

const props = defineProps<{ model: Standard; processId: string }>();
const modelStore = useModelStore();
const ui = useUiStore();

const process = computed<Process | undefined>(() => {
  void modelStore.version; // commands mutate in place — re-derive per version
  return props.model.processes.find(p => p.id === props.processId);
});

const roleOptions = computed(() => { void modelStore.version; return props.model.roles.map(r => ({ id: r.id, label: r.name || r.id })); });
// validate_provision binds provisions on legacy models and REQUIREMENT
// ids on v3 packages (the kernel's own note: OIML SMART points the facet
// at /req/* ids, which the provision resolver cannot see — provisionRefs
// is the lossless carrier). The picker offers the union (audit G6).
const provisionOptions = computed(() => {
  void modelStore.version;
  const ids = new Set<string>([...props.model.provisions.map(p => p.id), ...props.model.requirements.map(r => r.id)]);
  return [...ids];
});
const provisionLabel = (id: string) => {
  void modelStore.version;
  const req = props.model.requirements.find(r => r.id === id);
  return req ? `${id} — ${req.name || 'requirement'}` : id;
};
const registryOptions = computed(() => { void modelStore.version; return props.model.regs.map(r => r.id); });
const pageOptions = computed(() => {
  void modelStore.version;
  return props.model.pages.filter(p => p.id !== props.model.root?.id).map(p => p.id);
});

// DERIVED-PRIMITIVE RULE: a computed chained off `process` (identity-
// stable — commands mutate the AST in place) never re-fires. Read
// modelStore.version DIRECTLY in every derived-primitive computed.
const processPageId = computed(() => {
  void modelStore.version;
  return (process.value?.page as { id?: string } | null)?.id ?? '';
});

/** The page select as a writable computed (v-model sets the value
 *  AFTER the options patch — a `:value` binding races the freshly
 *  created option and the browser resets the select to ''). */
const pageSelection = computed<string>({
  get: () => processPageId.value,
  set: (id) => modelStore.execute(linkProcessToPage(props.processId, id || null)),
});

function onNewPage() {
  modelStore.execute(createPageForProcess(props.processId));
}

function patch(p: Partial<Process>) {
  modelStore.execute(
    updateElement((a: Standard) => a.processes, props.processId, p),
  );
}

function onName(e: Event) {
  patch({ name: (e.target as HTMLInputElement).value });
}

function onActor(e: Event) {
  const id = (e.target as HTMLSelectElement).value;
  const role = props.model.roles.find(r => r.id === id) ?? null;
  patch({ actor: role });
}

function onModality(e: Event) {
  patch({ modality: (e.target as HTMLSelectElement).value });
}

function onProvisions(ids: string[]) {
  // The authored form is provisionRefs (the dump's source); `provision`
  // resolves at load — write both so the in-memory AST stays coherent.
  patch({
    provisionRefs: ids,
    provision: ids
      .map(id => props.model.provisions.find(p => p.id === id))
      .filter((p): p is NonNullable<typeof p> => !!p),
  });
}

function onOutput(ids: string[]) {
  patch({
    output: ids.map(id => props.model.regs.find(r => r.id === id)).filter((r): r is NonNullable<typeof r> => !!r),
  });
}

function onInput(ids: string[]) {
  patch({
    input: ids.map(id => props.model.regs.find(r => r.id === id)).filter((r): r is NonNullable<typeof r> => !!r),
  });
}

function onMeasure(items: string[]) {
  patch({ measure: items });
}
</script>

<template>
  <div v-if="process" class="process-inspector" data-testid="process-inspector">
    <InspectorField label="id">
      <code class="readonly-id">{{ process.id }}</code>
    </InspectorField>

    <InspectorField label="name" required :missing="!process.name.trim()">
      <input
        class="text-input"
        :value="process.name"
        placeholder="Process name"
        data-testid="inspector-name"
        @change="onName"
      />
    </InspectorField>

    <InspectorField label="actor" required :missing="!process.actor">
      <select class="select-input" :value="process.actor?.id ?? ''" data-testid="inspector-actor" @change="onActor">
        <option value="">— select role —</option>
        <option v-for="r in roleOptions" :key="r.id" :value="r.id">{{ r.label }}</option>
      </select>
    </InspectorField>

    <InspectorField label="modality">
      <select class="select-input" :value="process.modality" data-testid="inspector-modality" @change="onModality">
        <option value="SHALL">SHALL</option>
        <option value="SHOULD">SHOULD</option>
        <option value="MAY">MAY</option>
      </select>
    </InspectorField>

    <InspectorField label="subprocess page" hint="the drill-down canvas this process owns">
      <div class="page-row">
        <select
          v-model="pageSelection"
          class="select-input"
          data-testid="inspector-page"
        >
          <option value="">— none —</option>
          <option v-for="p in pageOptions" :key="p" :value="p">{{ p }}</option>
        </select>
        <button
          v-if="!processPageId"
          type="button"
          class="page-action"
          title="create a page for this process"
          data-testid="inspector-new-page"
          @click="onNewPage"
        >+ page</button>
        <button
          v-else
          type="button"
          class="page-action"
          title="open the page"
          data-testid="inspector-open-page"
          @click="ui.setCanvas(processPageId)"
        >open →</button>
      </div>
    </InspectorField>

    <InspectorField label="validate_provision" hint="provisions on legacy models; requirement ids on v3 packages (the kernel resolves provisions only — provisionRefs is the lossless carrier)">
      <PickerListEdit
        :items="process.provisionRefs"
        :options="provisionOptions"
        :label-of="provisionLabel"
        placeholder="add provision…"
        @update="onProvisions"
      />
    </InspectorField>

    <InspectorField label="output (reference_data_registry)">
      <PickerListEdit
        :items="process.output.map(r => r.id)"
        :options="registryOptions"
        placeholder="add output…"
        @update="onOutput"
      />
    </InspectorField>

    <InspectorField label="input (reference_data_registry)">
      <PickerListEdit
        :items="process.input.map(r => r.id)"
        :options="registryOptions"
        placeholder="add input…"
        @update="onInput"
      />
    </InspectorField>

    <InspectorField label="validate_measurement">
      <StringListEdit
        :items="process.measure"
        placeholder="measurement id…"
        @update="onMeasure"
      />
    </InspectorField>
  </div>
</template>

<style scoped>
.process-inspector { padding: 0.25rem 0; }
.readonly-id {
  font-family: var(--font-mono);
  font-size: 0.75rem;
  color: var(--text-muted);
}
.text-input, .select-input {
  width: 100%;
  padding: 0.3rem 0.45rem;
  border: 1px solid var(--border);
  border-radius: var(--radius-sm);
  background: var(--bg);
  color: var(--text);
  font-size: 0.78rem;
}
.text-input:focus, .select-input:focus {
  outline: none;
  border-color: var(--accent);
}
.page-row { display: flex; gap: 0.3rem; }
.page-action {
  border: 1px solid var(--border);
  background: var(--bg-elevated);
  color: var(--accent);
  border-radius: var(--radius-sm);
  cursor: pointer;
  font-size: 0.68rem;
  padding: 0 0.5rem;
  white-space: nowrap;
}
</style>
