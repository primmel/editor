<script setup lang="ts">
// ─────────────────────────────────────────────────────────────────────
// The artifact-definition inspector (TODO.editor wave 03, window 2) —
// a required OUTPUT of the subject (IS): the content contract (named,
// typed fields + structure + media refinements), the produced-when
// rule (per measurement | per interval | on event), the retention, and
// the provenance (the source/sourceRefs alias discipline — the dump
// folds to ref derives-from).
// ─────────────────────────────────────────────────────────────────────
import { computed, ref } from 'vue';
import type { Standard } from '@primmel/primmel';
import { updateConstruct } from '../../lib/commands';
import { useModelStore } from '../../stores/model';
import InspectorField from '../fields/InspectorField.vue';
import StringListEdit from '../fields/StringListEdit.vue';

type ArtifactDefinition = Standard['artifactDefinitions'][number];
type ArtifactField = ArtifactDefinition['contentContract']['fields'][number];
type ArtifactMedia = ArtifactDefinition['contentContract']['media'][number];
type ProducedWhen = ArtifactDefinition['producedWhen'];

const props = defineProps<{ model: Standard; elementId: string }>();
const modelStore = useModelStore();

const listOf = (a: Standard) => a.artifactDefinitions;
const definition = computed(() => { void modelStore.version; return props.model.artifactDefinitions.find(d => d.id === props.elementId); });

const fields = computed(() => { void modelStore.version; return (definition.value?.contentContract.fields ?? []).map(f => ({ ...f })); });
const media = computed(() => { void modelStore.version; return (definition.value?.contentContract.media ?? []).map(m => ({ ...m })); });

function patch(field: keyof ArtifactDefinition, value: unknown, label?: string) {
  modelStore.execute(updateConstruct(listOf, props.elementId, { [field]: value } as Partial<ArtifactDefinition>, label ?? `edit artifact definition ${props.elementId}`));
}

function patchScalar(field: 'name' | 'description' | 'retention', e: Event) {
  patch(field, (e.target as HTMLInputElement | HTMLTextAreaElement).value);
}

function patchSource(field: 'doc' | 'clause', e: Event) {
  const d = definition.value;
  if (!d) return;
  const source = { doc: d.source?.doc ?? '', clause: d.source?.clause ?? '', [field]: (e.target as HTMLInputElement).value };
  // The dump walks `sourceRefs` (whose [0] ALIASES `source` on load) —
  // patch both in ONE command, keeping the alias.
  modelStore.execute(updateConstruct(listOf, props.elementId, { source, sourceRefs: [source] }, `edit artifact definition ${props.elementId} source`));
}

function patchContract(field: 'fields' | 'structure' | 'media', value: unknown, label: string) {
  const d = definition.value;
  if (!d) return;
  patch('contentContract', { ...d.contentContract, [field]: value }, label);
}

// ── contract fields ──────────────────────────────────────────────────
function patchField(index: number, field: keyof ArtifactField, value: unknown) {
  patchContract('fields', fields.value.map((f, i) => i === index ? { ...f, [field]: value } : f), `edit contract field ${props.elementId}[${index}]`);
}

const draftFieldName = ref('');
function addField() {
  const name = draftFieldName.value.trim();
  if (!name || !definition.value || fields.value.some(f => f.name === name)) return;
  patchContract('fields', [...fields.value, { name, type: '', optional: false, description: '' }], `add contract field ${name}`);
  draftFieldName.value = '';
}

function removeField(index: number) {
  patchContract('fields', fields.value.filter((_, i) => i !== index), `remove contract field ${fields.value[index]?.name ?? index}`);
}

// ── media refinements ────────────────────────────────────────────────
function patchMedia(index: number, field: keyof ArtifactMedia, value: unknown) {
  patchContract('media', media.value.map((m, i) => i === index ? { ...m, [field]: value } : m), `edit media ${props.elementId}[${index}]`);
}

const draftMediaField = ref('');
function addMedia() {
  const field = draftMediaField.value.trim();
  if (!field || !definition.value || media.value.some(m => m.field === field)) return;
  patchContract('media', [...media.value, { field, kinds: [], role: '' }], `add media ${field}`);
  draftMediaField.value = '';
}

function removeMedia(index: number) {
  patchContract('media', media.value.filter((_, i) => i !== index), `remove media ${media.value[index]?.field ?? index}`);
}

// ── produced_when ────────────────────────────────────────────────────
function patchProducedWhen(kind: string) {
  const next: ProducedWhen = { kind };
  if (kind === 'per_interval') next.interval = definition.value?.producedWhen.interval ?? '';
  if (kind === 'on_event') next.event = definition.value?.producedWhen.event ?? '';
  patch('producedWhen', next, `edit artifact definition ${props.elementId} produced_when`);
}

function patchProducedWhenDetail(field: 'interval' | 'event', e: Event) {
  const pw = definition.value?.producedWhen;
  if (!pw) return;
  patch('producedWhen', { ...pw, [field]: (e.target as HTMLInputElement).value }, `edit artifact definition ${props.elementId} produced_when`);
}
</script>

<template>
  <div v-if="definition" class="artifact-definition-inspector" data-testid="artifact-definition-inspector">
    <InspectorField label="id">
      <code class="readonly-id">{{ definition.id }}</code>
    </InspectorField>

    <InspectorField label="name" required :missing="!definition.name">
      <input class="text-input" :value="definition.name" data-testid="adef-name" @change="patchScalar('name', $event)" />
    </InspectorField>

    <InspectorField label="description">
      <textarea class="text-input" rows="2" :value="definition.description" data-testid="adef-description" @change="patchScalar('description', $event)" />
    </InspectorField>

    <InspectorField :label="`contract fields (${fields.length})`" hint="name : type [optional] — the content contract (C45: every field typed)">
      <ul v-if="fields.length" class="entry-rows">
        <li v-for="(f, i) in fields" :key="i" class="entry-row" :data-testid="`adef-field-${f.name}`">
          <div class="entry-line">
            <code class="entry-id">{{ f.name }}</code>
            <label class="optional-flag"><input type="checkbox" :checked="f.optional" :data-testid="`adef-field-optional-${f.name}`" @change="patchField(i, 'optional', ($event.target as HTMLInputElement).checked)" /> optional</label>
            <button type="button" class="row-remove" title="remove field" :data-testid="`adef-field-remove-${f.name}`" @click="removeField(i)">✕</button>
          </div>
          <div class="entry-pair">
            <input class="text-input mono" :value="f.type" placeholder="type (quantity kind | data type | media | structure)" :data-testid="`adef-field-type-${f.name}`" @change="patchField(i, 'type', ($event.target as HTMLInputElement).value)" />
            <input class="text-input" :value="f.description" placeholder="description" :data-testid="`adef-field-desc-${f.name}`" @change="patchField(i, 'description', ($event.target as HTMLInputElement).value)" />
          </div>
        </li>
      </ul>
      <div class="entry-add">
        <input v-model="draftFieldName" class="text-input mono" placeholder="field name…" data-testid="adef-field-add" @keyup.enter="addField" />
        <button type="button" :disabled="!draftFieldName.trim()" data-testid="adef-field-add-btn" @click="addField">+</button>
      </div>
    </InspectorField>

    <InspectorField label="structure" hint="the container/structure description ('' = unstructured)">
      <input class="text-input" :value="definition.contentContract.structure" data-testid="adef-structure" @change="patchContract('structure', ($event.target as HTMLInputElement).value, `edit artifact definition ${props.elementId} structure`)" />
    </InspectorField>

    <InspectorField :label="`media (${media.length})`" hint="the media refinements of media-typed fields">
      <ul v-if="media.length" class="entry-rows">
        <li v-for="(m, i) in media" :key="i" class="entry-row" :data-testid="`adef-media-${m.field}`">
          <div class="entry-line">
            <code class="entry-id">{{ m.field }}</code>
            <button type="button" class="row-remove" title="remove media" :data-testid="`adef-media-remove-${m.field}`" @click="removeMedia(i)">✕</button>
          </div>
          <StringListEdit :items="[...m.kinds]" placeholder="add a kind (jpeg, mp4…)…" @update="(items) => patchMedia(i, 'kinds', items)" />
          <input class="text-input" :value="m.role" placeholder="role (what the media shows)" :data-testid="`adef-media-role-${m.field}`" @change="patchMedia(i, 'role', ($event.target as HTMLInputElement).value)" />
        </li>
      </ul>
      <div class="entry-add">
        <input v-model="draftMediaField" class="text-input mono" placeholder="field to refine…" data-testid="adef-media-add" @keyup.enter="addMedia" />
        <button type="button" :disabled="!draftMediaField.trim()" data-testid="adef-media-add-btn" @click="addMedia">+</button>
      </div>
    </InspectorField>

    <InspectorField label="produced when" hint="when the instrument must produce the artifact">
      <div class="produced-row">
        <select class="text-input" :value="definition.producedWhen.kind" data-testid="adef-produced-kind" @change="patchProducedWhen(($event.target as HTMLSelectElement).value)">
          <option value="">—</option>
          <option value="per_measurement">per_measurement</option>
          <option value="per_interval">per_interval</option>
          <option value="on_event">on_event</option>
        </select>
        <input v-if="definition.producedWhen.kind === 'per_interval'" class="text-input mono" :value="definition.producedWhen.interval ?? ''" placeholder="ISO-8601 duration (P1D)" data-testid="adef-produced-interval" @change="patchProducedWhenDetail('interval', $event)" />
        <input v-if="definition.producedWhen.kind === 'on_event'" class="text-input mono" :value="definition.producedWhen.event ?? ''" placeholder="event name" data-testid="adef-produced-event" @change="patchProducedWhenDetail('event', $event)" />
      </div>
    </InspectorField>

    <InspectorField label="retention">
      <input class="text-input" :value="definition.retention" data-testid="adef-retention" @change="patchScalar('retention', $event)" />
    </InspectorField>

    <InspectorField :label="`references (${definition.referenceIds.length})`">
      <StringListEdit :items="[...definition.referenceIds]" placeholder="add a reference id…" @update="(items) => patch('referenceIds', items, `edit artifact definition ${props.elementId} references`)" />
    </InspectorField>

    <InspectorField label="source document">
      <input class="text-input mono" :value="definition.source?.doc ?? ''" data-testid="adef-source-doc" @change="patchSource('doc', $event)" />
    </InspectorField>

    <InspectorField label="source clause">
      <input class="text-input mono" :value="definition.source?.clause ?? ''" data-testid="adef-source-clause" @change="patchSource('clause', $event)" />
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
.entry-rows { list-style: none; margin: 0 0 0.4rem; padding: 0; }
.entry-row {
  border: 1px solid var(--border-soft);
  border-radius: var(--radius-sm);
  padding: 0.3rem 0.4rem;
  margin-bottom: 0.3rem;
  display: grid;
  gap: 0.25rem;
}
.entry-line { display: flex; align-items: center; gap: 0.3rem; }
.entry-id { font-family: var(--font-mono); font-size: 0.72rem; flex: 1; }
.entry-pair { display: grid; grid-template-columns: 1fr 1fr; gap: 0.3rem; }
.entry-add { display: flex; gap: 0.3rem; }
.entry-add button {
  width: 26px; border: 1px solid var(--border); background: var(--bg-elevated); color: var(--accent);
  border-radius: var(--radius-sm); cursor: pointer;
}
.entry-add button:disabled { opacity: 0.4; cursor: default; }
.row-remove { border: none; background: none; color: var(--text-faint); cursor: pointer; font-size: 0.65rem; padding: 0.1rem 0.25rem; }
.row-remove:hover { color: #b85555; }
.optional-flag { display: flex; align-items: center; gap: 0.25rem; font-size: 0.65rem; color: var(--text-muted); white-space: nowrap; }
.produced-row { display: grid; grid-template-columns: 1fr 1fr; gap: 0.3rem; }
</style>
