<script setup lang="ts">
// ─────────────────────────────────────────────────────────────────────
// The dataspace inspector (TODO.editor wave 03, window 2) — the
// governance declaration: participant classes, artifact classes (with
// their content element + the per-class policy override), the policy
// register + the standing default policy, the trust anchors (the
// trust_ref: org + optional key id — addressing only, never key
// material), the explicit compatibility register, and the governance
// citations (the source fold).
// ─────────────────────────────────────────────────────────────────────
import { computed, ref } from 'vue';
import type { Standard } from '@primmel/primmel';
import { updateConstruct } from '../../lib/commands';
import { useModelStore } from '../../stores/model';
import InspectorField from '../fields/InspectorField.vue';
import StringListEdit from '../fields/StringListEdit.vue';

type Dataspace = Standard['dataspaces'][number];
type ParticipantClass = Dataspace['participantClasses'][number];
type ArtifactClass = Dataspace['artifactClasses'][number];
type TrustAnchor = Dataspace['trustAnchors'][number];

const props = defineProps<{ model: Standard; elementId: string }>();
const modelStore = useModelStore();

const listOf = (a: Standard) => a.dataspaces;
const dataspace = computed(() => { void modelStore.version; return props.model.dataspaces.find(d => d.id === props.elementId); });

const participantClasses = computed(() => { void modelStore.version; return (dataspace.value?.participantClasses ?? []).map(c => ({ ...c })); });
const artifactClasses = computed(() => { void modelStore.version; return (dataspace.value?.artifactClasses ?? []).map(c => ({ ...c })); });
const trustAnchors = computed(() => { void modelStore.version; return (dataspace.value?.trustAnchors ?? []).map(t => ({ ...t })); });

function patch(field: keyof Dataspace, value: unknown, label?: string) {
  modelStore.execute(updateConstruct(listOf, props.elementId, { [field]: value } as Partial<Dataspace>, label ?? `edit dataspace ${props.elementId}`));
}

function patchSource(field: 'doc' | 'clause', e: Event) {
  const d = dataspace.value;
  if (!d) return;
  const source = { doc: d.source?.doc ?? '', clause: d.source?.clause ?? '', [field]: (e.target as HTMLInputElement).value };
  // The dump walks `sourceRefs` (whose [0] ALIASES `source` on load) —
  // patch both in ONE command, keeping the alias.
  modelStore.execute(updateConstruct(listOf, props.elementId, { source, sourceRefs: [source] }, `edit dataspace ${props.elementId} source`));
}

/** The id-labelled class rows (participant + artifact classes share the id/label/definition core). */
function makeClassOps<T extends ParticipantClass | ArtifactClass>(field: 'participantClasses' | 'artifactClasses', list: () => T[], label: string) {
  const draftId = ref('');
  return {
    draftId,
    patchRow: (index: number, f: keyof T, e: Event) =>
      patch(field, list().map((c, i) => i === index ? { ...c, [f]: (e.target as HTMLInputElement).value } : c), `edit ${label} ${props.elementId}[${index}]`),
    add: (make: (id: string) => T) => {
      const id = draftId.value.trim();
      if (!id || list().some(c => c.id === id)) return;
      patch(field, [...list(), make(id)], `add ${label} ${id}`);
      draftId.value = '';
    },
    remove: (index: number) =>
      patch(field, list().filter((_, i) => i !== index), `remove ${label} ${list()[index]?.id ?? index}`),
  };
}

const participants = makeClassOps<ParticipantClass>('participantClasses', () => participantClasses.value, 'participant class');
const artifacts = makeClassOps<ArtifactClass>('artifactClasses', () => artifactClasses.value, 'artifact class');

function patchAnchor(index: number, field: keyof TrustAnchor, value: unknown) {
  patch('trustAnchors', trustAnchors.value.map((t, i) => i === index ? { ...t, [field]: value } : t), `edit trust anchor ${props.elementId}[${index}]`);
}

function patchAnchorTrustRef(index: number, field: 'org' | 'kid', e: Event) {
  const t = trustAnchors.value[index];
  if (!t) return;
  const trustRef = { org: t.trustRef?.org ?? '', kid: t.trustRef?.kid ?? '', [field]: (e.target as HTMLInputElement).value };
  patchAnchor(index, 'trustRef', trustRef);
}

const draftAnchorId = ref('');
function addAnchor() {
  const id = draftAnchorId.value.trim();
  if (!id || !dataspace.value || trustAnchors.value.some(t => t.id === id)) return;
  patch('trustAnchors', [...trustAnchors.value, { id, trustRef: null, role: '', description: '' }], `add trust anchor ${id}`);
  draftAnchorId.value = '';
}

function removeAnchor(index: number) {
  patch('trustAnchors', trustAnchors.value.filter((_, i) => i !== index), `remove trust anchor ${trustAnchors.value[index]?.id ?? index}`);
}
</script>

<template>
  <div v-if="dataspace" class="dataspace-inspector" data-testid="dataspace-inspector">
    <InspectorField label="id">
      <code class="readonly-id">{{ dataspace.id }}</code>
    </InspectorField>

    <InspectorField label="name" required :missing="!dataspace.name">
      <input class="text-input" :value="dataspace.name" data-testid="ds-name" @change="(e) => patch('name', (e.target as HTMLInputElement).value)" />
    </InspectorField>

    <InspectorField label="description">
      <textarea class="text-input" rows="2" :value="dataspace.description" data-testid="ds-description" @change="(e) => patch('description', (e.target as HTMLTextAreaElement).value)" />
    </InspectorField>

    <InspectorField :label="`participant classes (${participantClasses.length})`">
      <ul v-if="participantClasses.length" class="entry-rows">
        <li v-for="(c, i) in participantClasses" :key="i" class="entry-row" :data-testid="`ds-participant-${c.id}`">
          <div class="entry-line">
            <code class="entry-id">{{ c.id }}</code>
            <button type="button" class="row-remove" title="remove class" :data-testid="`ds-participant-remove-${c.id}`" @click="participants.remove(i)">✕</button>
          </div>
          <div class="entry-pair">
            <input class="text-input" :value="c.label" placeholder="label" :data-testid="`ds-participant-label-${c.id}`" @change="participants.patchRow(i, 'label', $event)" />
            <input class="text-input" :value="c.description" placeholder="description" :data-testid="`ds-participant-desc-${c.id}`" @change="participants.patchRow(i, 'description', $event)" />
          </div>
        </li>
      </ul>
      <div class="entry-add">
        <input v-model="participants.draftId.value" class="text-input mono" placeholder="class id…" data-testid="ds-participant-add" @keyup.enter="participants.add((id) => ({ id, label: '', description: '' }))" />
        <button type="button" :disabled="!participants.draftId.value.trim()" data-testid="ds-participant-add-btn" @click="participants.add((id) => ({ id, label: '', description: '' }))">+</button>
      </div>
    </InspectorField>

    <InspectorField :label="`artifact classes (${artifactClasses.length})`" hint="element = the artifact definition / form / data class defining the content; policy = the per-class override">
      <ul v-if="artifactClasses.length" class="entry-rows">
        <li v-for="(c, i) in artifactClasses" :key="i" class="entry-row" :data-testid="`ds-artifact-${c.id}`">
          <div class="entry-line">
            <code class="entry-id">{{ c.id }}</code>
            <button type="button" class="row-remove" title="remove class" :data-testid="`ds-artifact-remove-${c.id}`" @click="artifacts.remove(i)">✕</button>
          </div>
          <div class="entry-pair">
            <input class="text-input" :value="c.label" placeholder="label" :data-testid="`ds-artifact-label-${c.id}`" @change="artifacts.patchRow(i, 'label', $event)" />
            <input class="text-input" :value="c.description" placeholder="description" :data-testid="`ds-artifact-desc-${c.id}`" @change="artifacts.patchRow(i, 'description', $event)" />
          </div>
          <div class="entry-pair">
            <input class="text-input mono" :value="c.element" placeholder="element id" :data-testid="`ds-artifact-element-${c.id}`" @change="artifacts.patchRow(i, 'element', $event)" />
            <input class="text-input mono" :value="c.policy" placeholder="policy override" :data-testid="`ds-artifact-policy-${c.id}`" @change="artifacts.patchRow(i, 'policy', $event)" />
          </div>
        </li>
      </ul>
      <div class="entry-add">
        <input v-model="artifacts.draftId.value" class="text-input mono" placeholder="class id…" data-testid="ds-artifact-add" @keyup.enter="artifacts.add((id) => ({ id, label: '', description: '', element: '', policy: '' }))" />
        <button type="button" :disabled="!artifacts.draftId.value.trim()" data-testid="ds-artifact-add-btn" @click="artifacts.add((id) => ({ id, label: '', description: '', element: '', policy: '' }))">+</button>
      </div>
    </InspectorField>

    <InspectorField :label="`policies (${dataspace.policies.length})`" hint="the policy register — the policy sets this dataspace carries">
      <StringListEdit :items="[...dataspace.policies]" placeholder="add a policy id…" @update="(items) => patch('policies', items, `edit dataspace ${props.elementId} policies`)" />
    </InspectorField>

    <InspectorField label="default policy" hint="the standing policy every artifact class inherits">
      <input class="text-input mono" :value="dataspace.defaultPolicy" data-testid="ds-default-policy" @change="(e) => patch('defaultPolicy', (e.target as HTMLInputElement).value)" />
    </InspectorField>

    <InspectorField :label="`trust anchors (${trustAnchors.length})`" hint="trust_ref <org> [key <kid>] — addressing only, never key material (C105: an anchor without its reference anchors nothing)">
      <ul v-if="trustAnchors.length" class="entry-rows">
        <li v-for="(t, i) in trustAnchors" :key="i" class="entry-row" :data-testid="`ds-anchor-${t.id}`">
          <div class="entry-line">
            <code class="entry-id">{{ t.id }}</code>
            <button type="button" class="row-remove" title="remove anchor" :data-testid="`ds-anchor-remove-${t.id}`" @click="removeAnchor(i)">✕</button>
          </div>
          <div class="entry-pair">
            <input class="text-input mono" :value="t.trustRef?.org ?? ''" placeholder="org (trust registry id)" :data-testid="`ds-anchor-org-${t.id}`" @change="patchAnchorTrustRef(i, 'org', $event)" />
            <input class="text-input mono" :value="t.trustRef?.kid ?? ''" placeholder="key id (optional)" :data-testid="`ds-anchor-kid-${t.id}`" @change="patchAnchorTrustRef(i, 'kid', $event)" />
          </div>
          <div class="entry-pair">
            <input class="text-input mono" :value="t.role" placeholder="role (registry, issuer, notary…)" :data-testid="`ds-anchor-role-${t.id}`" @change="patchAnchor(i, 'role', ($event.target as HTMLInputElement).value)" />
            <input class="text-input" :value="t.description" placeholder="description" :data-testid="`ds-anchor-desc-${t.id}`" @change="patchAnchor(i, 'description', ($event.target as HTMLInputElement).value)" />
          </div>
        </li>
      </ul>
      <div class="entry-add">
        <input v-model="draftAnchorId" class="text-input mono" placeholder="anchor id…" data-testid="ds-anchor-add" @keyup.enter="addAnchor" />
        <button type="button" :disabled="!draftAnchorId.trim()" data-testid="ds-anchor-add-btn" @click="addAnchor">+</button>
      </div>
    </InspectorField>

    <InspectorField :label="`compatible with (${dataspace.compatibleWith.length})`" hint="explicit, never inferred">
      <StringListEdit :items="[...dataspace.compatibleWith]" placeholder="add a dataspace id…" @update="(items) => patch('compatibleWith', items, `edit dataspace ${props.elementId} compatible_with`)" />
    </InspectorField>

    <InspectorField label="source document" hint="the governance citation (C106 warns when absent)">
      <input class="text-input mono" :value="dataspace.source?.doc ?? ''" data-testid="ds-source-doc" @change="patchSource('doc', $event)" />
    </InspectorField>

    <InspectorField label="source clause">
      <input class="text-input mono" :value="dataspace.source?.clause ?? ''" data-testid="ds-source-clause" @change="patchSource('clause', $event)" />
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
</style>
