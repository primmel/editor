<script setup lang="ts">
// ─────────────────────────────────────────────────────────────────────
// The quantity-register inspector (TODO.editor wave 03, window 2) — the
// typed unit/quantity-kind registry: kinds (the dimension vector over
// the SI base dimensions + the SI coherent unit) and units (symbol,
// kind, the SI conversion factor/offset). The factor dumps only when
// ≠ 1, the offset only when ≠ 0 (the kernel's compact form).
// ─────────────────────────────────────────────────────────────────────
import { computed, ref } from 'vue';
import type { Standard } from '@primmel/primmel';
import { updateConstruct } from '../../lib/commands';
import type { QuantityRegister } from '../../lib/factory';
import { useModelStore } from '../../stores/model';
import InspectorField from '../fields/InspectorField.vue';
import KeyValueListEdit from '../fields/KeyValueListEdit.vue';

type QuantityKindDef = QuantityRegister['kinds'][number];
type UnitDef = QuantityRegister['units'][number];

const props = defineProps<{ model: Standard; elementId: string }>();
const modelStore = useModelStore();

const listOf = (a: Standard) => a.quantityRegisters;
const register = computed(() => { void modelStore.version; return props.model.quantityRegisters.find(q => q.id === props.elementId); });

const kinds = computed(() => { void modelStore.version; return (register.value?.kinds ?? []).map(k => ({ ...k })); });
const units = computed(() => { void modelStore.version; return (register.value?.units ?? []).map(u => ({ ...u })); });

function patch(field: keyof QuantityRegister, value: unknown, label?: string) {
  modelStore.execute(updateConstruct(listOf, props.elementId, { [field]: value } as Partial<QuantityRegister>, label ?? `edit quantity register ${props.elementId}`));
}

// ── kinds ────────────────────────────────────────────────────────────
function patchKind(index: number, field: keyof QuantityKindDef, value: unknown) {
  patch('kinds', kinds.value.map((k, i) => i === index ? { ...k, [field]: value } : k), `edit kind ${props.elementId}[${index}]`);
}

function patchKindDimensions(index: number, entries: [string, string][]) {
  // The dimension vector: SI base-dimension symbol → exponent. A
  // non-numeric exponent drops the entry (the kernel's vector is
  // numbers only).
  const dimensions: Record<string, number> = {};
  for (const [k, v] of entries) {
    const n = Number(v);
    if (k && Number.isFinite(n) && n !== 0) dimensions[k] = n;
  }
  patchKind(index, 'dimensions', dimensions);
}

const draftKindId = ref('');
function addKind() {
  const id = draftKindId.value.trim();
  if (!id || !register.value || kinds.value.some(k => k.id === id)) return;
  patch('kinds', [...kinds.value, { id, dimensions: {}, siUnit: '', description: '' }], `add kind ${id}`);
  draftKindId.value = '';
}

function removeKind(index: number) {
  patch('kinds', kinds.value.filter((_, i) => i !== index), `remove kind ${kinds.value[index]?.id ?? index}`);
}

// ── units ────────────────────────────────────────────────────────────
function patchUnit(index: number, field: keyof UnitDef, e: Event) {
  const raw = (e.target as HTMLInputElement).value;
  const value = field === 'factorToSI' || field === 'offsetToSI' ? (Number(raw) || (field === 'factorToSI' ? 1 : 0)) : raw;
  patch('units', units.value.map((u, i) => i === index ? { ...u, [field]: value } : u), `edit unit ${props.elementId}[${index}]`);
}

const draftUnitId = ref('');
function addUnit() {
  const id = draftUnitId.value.trim();
  if (!id || !register.value || units.value.some(u => u.id === id)) return;
  patch('units', [...units.value, { id, symbol: '', label: '', kind: kinds.value[0]?.id ?? '', factorToSI: 1, offsetToSI: 0, definition: '' }], `add unit ${id}`);
  draftUnitId.value = '';
}

function removeUnit(index: number) {
  patch('units', units.value.filter((_, i) => i !== index), `remove unit ${units.value[index]?.id ?? index}`);
}
</script>

<template>
  <div v-if="register" class="quantity-register-inspector" data-testid="quantity-register-inspector">
    <InspectorField label="id">
      <code class="readonly-id">{{ register.id }}</code>
    </InspectorField>

    <InspectorField :label="`quantity kinds (${kinds.length})`" hint="the comparison-coherence units — the dimension vector over the SI base dimensions + the SI coherent unit">
      <ul v-if="kinds.length" class="entry-rows">
        <li v-for="(k, i) in kinds" :key="i" class="entry-row" :data-testid="`qr-kind-${k.id}`">
          <div class="entry-line">
            <code class="entry-id">{{ k.id }}</code>
            <button type="button" class="row-remove" title="remove kind" :data-testid="`qr-kind-remove-${k.id}`" @click="removeKind(i)">✕</button>
          </div>
          <div class="entry-pair">
            <input class="text-input mono" :value="k.siUnit" placeholder="SI unit (e.g. kg)" :data-testid="`qr-kind-siunit-${k.id}`" @change="patchKind(i, 'siUnit', ($event.target as HTMLInputElement).value)" />
            <input class="text-input" :value="k.description" placeholder="description" :data-testid="`qr-kind-desc-${k.id}`" @change="patchKind(i, 'description', ($event.target as HTMLInputElement).value)" />
          </div>
          <KeyValueListEdit
            :entries="Object.entries(k.dimensions).map(([d, n]) => [d, String(n)] as [string, string])"
            key-placeholder="M | L | T | I | Θ | N | J"
            value-placeholder="exponent"
            :testid-prefix="`qr-kind-dim-${k.id}`"
            @update="patchKindDimensions(i, $event)"
          />
        </li>
      </ul>
      <div class="entry-add">
        <input v-model="draftKindId" class="text-input mono" placeholder="kind id (e.g. mass)…" data-testid="qr-kind-add" @keyup.enter="addKind" />
        <button type="button" :disabled="!draftKindId.trim()" data-testid="qr-kind-add-btn" @click="addKind">+</button>
      </div>
    </InspectorField>

    <InspectorField :label="`units (${units.length})`" hint="factor/offset to the kind's SI coherent unit (1 / 0 elide from the dump)">
      <ul v-if="units.length" class="entry-rows">
        <li v-for="(u, i) in units" :key="i" class="entry-row" :data-testid="`qr-unit-${u.id}`">
          <div class="entry-line">
            <code class="entry-id">{{ u.id }}</code>
            <button type="button" class="row-remove" title="remove unit" :data-testid="`qr-unit-remove-${u.id}`" @click="removeUnit(i)">✕</button>
          </div>
          <div class="entry-pair">
            <input class="text-input mono" :value="u.symbol" placeholder="symbol" :data-testid="`qr-unit-symbol-${u.id}`" @change="patchUnit(i, 'symbol', $event)" />
            <input class="text-input" :value="u.label" placeholder="label" :data-testid="`qr-unit-label-${u.id}`" @change="patchUnit(i, 'label', $event)" />
          </div>
          <div class="entry-pair">
            <select class="text-input" :value="u.kind" :data-testid="`qr-unit-kind-${u.id}`" @change="patchUnit(i, 'kind', $event)">
              <option value="">— kind —</option>
              <option v-for="k in kinds" :key="k.id" :value="k.id">{{ k.id }}</option>
            </select>
            <input class="text-input" :value="u.definition" placeholder="definition" :data-testid="`qr-unit-def-${u.id}`" @change="patchUnit(i, 'definition', $event)" />
          </div>
          <div class="entry-pair">
            <input class="text-input mono" :value="String(u.factorToSI)" placeholder="factor to SI (1)" :data-testid="`qr-unit-factor-${u.id}`" @change="patchUnit(i, 'factorToSI', $event)" />
            <input class="text-input mono" :value="String(u.offsetToSI)" placeholder="offset to SI (0)" :data-testid="`qr-unit-offset-${u.id}`" @change="patchUnit(i, 'offsetToSI', $event)" />
          </div>
        </li>
      </ul>
      <div class="entry-add">
        <input v-model="draftUnitId" class="text-input mono" placeholder="unit id (e.g. kg)…" data-testid="qr-unit-add" @keyup.enter="addUnit" />
        <button type="button" :disabled="!draftUnitId.trim()" data-testid="qr-unit-add-btn" @click="addUnit">+</button>
      </div>
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
