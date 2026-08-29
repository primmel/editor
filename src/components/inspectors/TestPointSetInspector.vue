<script setup lang="ts">
// ─────────────────────────────────────────────────────────────────────
// The test point set inspector (TODO.editor wave 03) — the named,
// shared test-point sets: the per-profile cardinality rules, the
// repetitions per point, and the points (fraction of range + anchor +
// offset), with the clause provenance.
// ─────────────────────────────────────────────────────────────────────
import { computed, ref } from 'vue';
import type { Standard } from '@primmel/primmel';
import { updateConstruct } from '../../lib/commands';
import type { TestPointSet } from '../../lib/factory';
import { useModelStore } from '../../stores/model';
import InspectorField from '../fields/InspectorField.vue';

type TestPoint = TestPointSet['points'][number];

const props = defineProps<{ model: Standard; elementId: string }>();
const modelStore = useModelStore();

const listOf = (a: Standard) => a.testPointSets;
const tps = computed(() => { void modelStore.version; return props.model.testPointSets.find(t => t.id === props.elementId); });

const points = computed(() => { void modelStore.version; return (tps.value?.points ?? []).map(p => ({ ...p })); });
/** The cardinality record as row triples (profile, minPoints, rule). */
const cardinalityRows = computed(() => {
  void modelStore.version;
  return Object.entries(tps.value?.cardinality ?? {}).map(([profile, c]) => ({ profile, minPoints: c.minPoints, rule: c.rule }));
});

function patch(field: keyof TestPointSet, value: unknown, label?: string) {
  modelStore.execute(updateConstruct(listOf, props.elementId, { [field]: value } as Partial<TestPointSet>, label ?? `edit test point set ${props.elementId}`));
}

function patchCardinality(rows: { profile: string; minPoints: number | null; rule: string }[], label: string) {
  const cardinality: TestPointSet['cardinality'] = {};
  for (const r of rows) cardinality[r.profile] = { minPoints: r.minPoints, rule: r.rule };
  patch('cardinality', cardinality, label);
}

function patchCardinalityRow(index: number, field: 'profile' | 'minPoints' | 'rule', e: Event) {
  const rows = cardinalityRows.value.map((r, i) => {
    if (i !== index) return r;
    if (field === 'minPoints') {
      const raw = (e.target as HTMLInputElement).value;
      return { ...r, minPoints: raw === '' ? null : Number(raw) };
    }
    return { ...r, [field]: (e.target as HTMLInputElement).value };
  });
  patchCardinality(rows, `edit test point set ${props.elementId} cardinality`);
}

const draftProfile = ref('');
function addCardinality() {
  const profile = draftProfile.value.trim();
  if (!profile || cardinalityRows.value.some(r => r.profile === profile)) return;
  patchCardinality([...cardinalityRows.value, { profile, minPoints: null, rule: '' }], `add test point set ${props.elementId} cardinality ${profile}`);
  draftProfile.value = '';
}

function removeCardinality(index: number) {
  patchCardinality(cardinalityRows.value.filter((_, i) => i !== index), `remove test point set ${props.elementId} cardinality ${cardinalityRows.value[index]?.profile ?? index}`);
}

function patchPoint(index: number, field: keyof TestPoint, e: Event) {
  const raw = (e.target as HTMLInputElement).value;
  const value = field === 'fraction' ? (raw === '' ? null : Number(raw)) : raw;
  const next = points.value.map((p, i) => i === index ? { ...p, [field]: value } : p);
  patch('points', next, `edit test point set ${props.elementId} point ${points.value[index]?.id ?? index}`);
}

const draftPoint = ref('');
function addPoint() {
  const id = draftPoint.value.trim();
  if (!id || points.value.some(p => p.id === id)) return;
  patch('points', [...points.value, { id, fraction: null, anchor: '', offset: '' }], `add test point set ${props.elementId} point ${id}`);
  draftPoint.value = '';
}

function removePoint(index: number) {
  patch('points', points.value.filter((_, i) => i !== index), `remove test point set ${props.elementId} point ${points.value[index]?.id ?? index}`);
}

function patchSource(field: 'doc' | 'clause', e: Event) {
  if (!tps.value) return;
  const source = { doc: tps.value.source?.doc ?? '', clause: tps.value.source?.clause ?? '', [field]: (e.target as HTMLInputElement).value };
  // The serializer walks `sourceRefs` (whose [0] ALIASES `source` on
  // load) — patch both, keeping the alias intact.
  modelStore.execute(updateConstruct(listOf, props.elementId, { source, sourceRefs: [source] }, `edit test point set ${props.elementId} source`));
}
</script>

<template>
  <div v-if="tps" class="test-point-set-inspector" data-testid="test-point-set-inspector">
    <InspectorField label="id">
      <code class="readonly-id">{{ tps.id }}</code>
    </InspectorField>

    <InspectorField label="description">
      <textarea class="text-input" rows="3" :value="tps.description" data-testid="tps-description" @change="patch('description', ($event.target as HTMLTextAreaElement).value)" />
    </InspectorField>

    <InspectorField label="repetitions per point">
      <input
        class="text-input mono reps"
        type="number"
        min="1"
        :value="tps.repetitionsPerPoint ?? ''"
        data-testid="tps-repetitions"
        @change="patch('repetitionsPerPoint', ($event.target as HTMLInputElement).value === '' ? null : Number(($event.target as HTMLInputElement).value))"
      />
    </InspectorField>

    <InspectorField :label="`cardinality (${cardinalityRows.length})`" hint="the min-points rule per calibration profile">
      <ul v-if="cardinalityRows.length" class="card-rows">
        <li v-for="(r, i) in cardinalityRows" :key="r.profile" class="card-row" :data-testid="`tps-card-${r.profile}`">
          <code class="card-profile">{{ r.profile }}</code>
          <input class="text-input mono" type="number" min="1" :value="r.minPoints ?? ''" placeholder="min" title="min_points" :data-testid="`tps-card-min-${r.profile}`" @change="patchCardinalityRow(i, 'minPoints', $event)" />
          <input class="text-input" :value="r.rule" placeholder="rule" :data-testid="`tps-card-rule-${r.profile}`" @change="patchCardinalityRow(i, 'rule', $event)" />
          <button type="button" class="row-remove" title="remove profile" :data-testid="`tps-card-remove-${r.profile}`" @click="removeCardinality(i)">✕</button>
        </li>
      </ul>
      <div class="card-add">
        <input v-model="draftProfile" class="text-input mono" placeholder="profile (linear, nonlinear…)…" data-testid="tps-card-add" @keyup.enter="addCardinality" />
        <button type="button" :disabled="!draftProfile.trim()" data-testid="tps-card-add-btn" @click="addCardinality">+</button>
      </div>
    </InspectorField>

    <InspectorField :label="`points (${points.length})`" hint="fraction of range + anchor + the human offset rule">
      <ul v-if="points.length" class="point-rows">
        <li v-for="(p, i) in points" :key="p.id" class="point-row" :data-testid="`tps-point-${p.id}`">
          <div class="point-head">
            <code class="point-id">{{ p.id }}</code>
            <input class="text-input mono" type="number" step="0.05" min="0" max="1" :value="p.fraction ?? ''" placeholder="fraction" :data-testid="`tps-point-fraction-${p.id}`" @change="patchPoint(i, 'fraction', $event)" />
            <button type="button" class="row-remove" title="remove point" :data-testid="`tps-point-remove-${p.id}`" @click="removePoint(i)">✕</button>
          </div>
          <div class="point-grid">
            <input class="text-input mono" :value="p.anchor" placeholder="anchor (range_min, range_mid…)" :data-testid="`tps-point-anchor-${p.id}`" @change="patchPoint(i, 'anchor', $event)" />
            <input class="text-input" :value="p.offset" placeholder="offset (+10 % of range)" :data-testid="`tps-point-offset-${p.id}`" @change="patchPoint(i, 'offset', $event)" />
          </div>
        </li>
      </ul>
      <div class="card-add">
        <input v-model="draftPoint" class="text-input mono" placeholder="point id…" data-testid="tps-point-add" @keyup.enter="addPoint" />
        <button type="button" :disabled="!draftPoint.trim()" data-testid="tps-point-add-btn" @click="addPoint">+</button>
      </div>
    </InspectorField>

    <InspectorField label="source document" hint="the provenance facet — e.g. urn:oiml:pub:r:144-2:2013">
      <input class="text-input mono" :value="tps.source?.doc ?? ''" data-testid="tps-source-doc" @change="patchSource('doc', $event)" />
    </InspectorField>

    <InspectorField label="source clause">
      <input class="text-input mono" :value="tps.source?.clause ?? ''" data-testid="tps-source-clause" @change="patchSource('clause', $event)" />
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
.reps { max-width: 6rem; }
.card-rows, .point-rows { list-style: none; margin: 0 0 0.4rem; padding: 0; }
.card-row { display: grid; grid-template-columns: 5rem 3.5rem 1fr 18px; gap: 0.25rem; align-items: center; margin-bottom: 0.25rem; }
.card-profile, .point-id { font-family: var(--font-mono); font-size: 0.7rem; color: var(--accent); }
.point-row {
  border: 1px solid var(--border-soft);
  border-radius: var(--radius-sm);
  padding: 0.3rem 0.4rem;
  margin-bottom: 0.3rem;
  display: grid;
  gap: 0.25rem;
}
.point-head { display: grid; grid-template-columns: 1fr 5rem 18px; gap: 0.3rem; align-items: center; }
.point-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 0.3rem; }
.card-add { display: flex; gap: 0.3rem; }
.card-add button {
  width: 26px; border: 1px solid var(--border); background: var(--bg-elevated); color: var(--accent);
  border-radius: var(--radius-sm); cursor: pointer;
}
.card-add button:disabled { opacity: 0.4; cursor: default; }
.row-remove { border: none; background: none; color: var(--text-faint); cursor: pointer; font-size: 0.65rem; padding: 0.1rem 0.25rem; }
.row-remove:hover { color: #b85555; }
</style>
