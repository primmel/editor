<script setup lang="ts">
// ─────────────────────────────────────────────────────────────────────
// The mapping-diff panel (G3) — what a REFERENCE UPDATE does to the
// implementation's maps: load the old and the new edition, read the
// pair dispositions (retained / broken / retarget suggestion) and the
// computed coverage delta. Read-only; the retarget apply is the pair
// dialog's ordinary command.
// ─────────────────────────────────────────────────────────────────────
import { computed, ref } from 'vue';
import { load, loadPrm, type PrmFile, type Standard } from '@primmel/primmel';
import { editionProfileDiff, type EditionNamespaceDelta } from '../../lib/edition-map-diff';
import { mappingDiff, type MappingDiff } from '../../lib/mapping-diff';
import { useModelStore } from '../../stores/model';

const props = defineProps<{ implementationModel: Standard }>();
const modelStore = useModelStore();

const oldText = ref('');
const newText = ref('');
const namespace = ref('');
const diff = ref<MappingDiff | null>(null);
const error = ref('');

const impNamespaces = computed(() => {
  void modelStore.version;
  return [...new Set(props.implementationModel.mapProfiles.map((p) => p.namespace))];
});

function runDiff() {
  error.value = '';
  diff.value = null;
  try {
    const oldRef = load(oldText.value, { strict: true });
    const newRef = load(newText.value, { strict: true });
    const ns = namespace.value || impNamespaces.value[0] || newRef.meta?.namespace?.trim() || '';
    if (!ns) throw new Error('no namespace to diff — the profile declares none');
    diff.value = mappingDiff(props.implementationModel, oldRef, newRef, ns);
  } catch (e) {
    error.value = (e as Error).message;
  }
}

/** G15 — the edition-crossed profiles: the 13485 fixture's story. */
const editionOld = ref<PrmFile | null>(null);
const editionNew = ref<PrmFile | null>(null);
const editionDeltas = ref<EditionNamespaceDelta[] | null>(null);
const editionError = ref('');

async function pickPrm(which: 'old' | 'new') {
  const input = document.createElement('input');
  input.type = 'file';
  input.accept = '.map,.json,.prm';
  input.onchange = async () => {
    const f = input.files?.[0];
    if (!f) return;
    try {
      const prm = loadPrm(await f.text());
      if (which === 'old') editionOld.value = prm;
      else editionNew.value = prm;
      editionDeltas.value = null;
      editionError.value = '';
    } catch (e) {
      editionError.value = (e as Error).message;
    }
  };
  input.click();
}

function runEditionDiff() {
  if (!editionOld.value || !editionNew.value) return;
  editionDeltas.value = editionProfileDiff(editionOld.value, editionNew.value);
}

async function pick(which: 'old' | 'new') {
  const input = document.createElement('input');
  input.type = 'file';
  input.accept = '.prl,.mmel';
  input.onchange = async () => {
    const f = input.files?.[0];
    if (!f) return;
    const text = await f.text();
    if (which === 'old') oldText.value = text;
    else newText.value = text;
  };
  input.click();
}
</script>

<template>
  <div class="mdiff" data-testid="mapping-diff-panel">
    <div class="mdiff-row">
      <button type="button" class="mdiff-btn" data-testid="mdiff-pick-old" @click="pick('old')">
        {{ oldText ? 'old edition loaded ✓' : 'load the old edition' }}
      </button>
      <button type="button" class="mdiff-btn" data-testid="mdiff-pick-new" @click="pick('new')">
        {{ newText ? 'new edition loaded ✓' : 'load the new edition' }}
      </button>
      <select v-model="namespace" class="mdiff-ns" data-testid="mdiff-ns">
        <option value="" disabled>namespace…</option>
        <option v-for="ns in impNamespaces" :key="ns" :value="ns">{{ ns }}</option>
      </select>
      <button type="button" class="mdiff-btn primary" :disabled="!oldText || !newText" data-testid="mdiff-run" @click="runDiff">
        diff the update
      </button>
    </div>
    <div v-if="error" class="mdiff-error" data-testid="mdiff-error">{{ error }}</div>

    <div class="mdiff-editions">
      <span class="mdiff-editions-label">edition-crossed profiles (G15 — the 13485 story)</span>
      <button type="button" class="mdiff-btn" data-testid="editions-pick-old" @click="pickPrm('old')">
        {{ editionOld ? '2016 loaded ✓' : 'load the old .prm/.map' }}
      </button>
      <button type="button" class="mdiff-btn" data-testid="editions-pick-new" @click="pickPrm('new')">
        {{ editionNew ? '2021 loaded ✓' : 'load the new .prm/.map' }}
      </button>
      <button
        type="button"
        class="mdiff-btn"
        :disabled="!editionOld || !editionNew"
        data-testid="editions-run"
        @click="runEditionDiff"
      >diff the editions</button>
      <div v-if="editionError" class="mdiff-error" data-testid="editions-error">{{ editionError }}</div>
      <template v-if="editionDeltas">
        <div
          v-for="d in editionDeltas"
          :key="d.namespace"
          class="mdiff-edition-ns"
          :data-testid="`editions-ns-${d.namespace}`"
        >
          <code>{{ d.namespace }}</code>
          <span class="mdiff-stat ok">{{ d.carried.length }} carried</span>
          <span class="mdiff-stat add">+{{ d.added.length }}</span>
          <span class="mdiff-stat drop">−{{ d.dropped.length }}</span>
          <div v-for="p in d.dropped.slice(0, 5)" :key="`d-${p.source}-${p.target}`" class="mdiff-pair dropped">
            <code>{{ p.source }}</code> ⇒ <code>{{ p.target }}</code>
          </div>
        </div>
      </template>
    </div>

    <template v-if="diff">
      <div class="mdiff-coverage" data-testid="mdiff-coverage">
        <span>coverage {{ diff.namespace }}:</span>
        <span>full {{ diff.coverage.before.full }} → {{ diff.coverage.after.full }}</span>
        <span>minimal {{ diff.coverage.before.minimal }} → {{ diff.coverage.after.minimal }}</span>
        <span>partial {{ diff.coverage.before.partial }} → {{ diff.coverage.after.partial }}</span>
        <span>none {{ diff.coverage.before.none }} → {{ diff.coverage.after.none }}</span>
      </div>
      <div
        v-for="p in diff.pairs"
        :key="`${p.source}-${p.targetId}`"
        class="mdiff-pair"
        :class="p.status"
        :data-testid="`mdiff-pair-${p.source}`"
      >
        <code>{{ p.source }}</code> ⇒ <code>{{ p.targetId }}</code>
        <span class="mdiff-status">{{ p.status }}</span>
        <span v-if="p.suggestedTarget" class="mdiff-suggest">
          → retarget to <code>{{ p.suggestedTarget }}</code>
        </span>
      </div>
      <div v-if="!diff.pairs.length" class="mdiff-empty">no pairs under this namespace</div>
    </template>
  </div>
</template>

<style scoped>
.mdiff { padding: 0.5rem; font-size: 0.75rem; }
.mdiff-row { display: flex; gap: 0.4rem; flex-wrap: wrap; align-items: center; }
.mdiff-btn { cursor: pointer; font-size: 0.7rem; }
.mdiff-btn.primary { font-weight: 600; }
.mdiff-ns { font-size: 0.7rem; }
.mdiff-error { color: #b91c1c; margin-top: 0.4rem; font-size: 0.7rem; }
.mdiff-coverage { display: flex; gap: 0.7rem; flex-wrap: wrap; margin: 0.5rem 0; font-family: monospace; font-size: 0.68rem; }
.mdiff-pair { padding: 0.15rem 0; border-bottom: 1px dotted rgba(128,128,128,0.25); }
.mdiff-pair.broken .mdiff-status { color: #b91c1c; font-weight: 700; }
.mdiff-pair.retarget .mdiff-status { color: #b45309; font-weight: 700; }
.mdiff-pair.retained .mdiff-status { color: var(--sage, #7a9a7a); }
.mdiff-status { margin-left: 0.4rem; font-size: 0.66rem; }
.mdiff-suggest { margin-left: 0.4rem; font-size: 0.66rem; opacity: 0.8; }
.mdiff-editions { border-top: 1px dotted var(--border-soft); margin-top: 0.5rem; padding-top: 0.4rem; display: flex; flex-wrap: wrap; gap: 0.35rem; align-items: center; }
.mdiff-editions-label { font-size: 0.6rem; text-transform: uppercase; letter-spacing: 0.08em; opacity: 0.6; width: 100%; }
.mdiff-edition-ns { width: 100%; font-size: 0.68rem; padding: 0.15rem 0; }
.mdiff-stat { font-family: var(--font-mono); font-size: 0.64rem; margin-left: 0.5rem; }
.mdiff-stat.ok { color: var(--sage, #7a9a7a); }
.mdiff-stat.add { color: var(--accent); }
.mdiff-stat.drop { color: #b91c1c; }
.mdiff-empty { opacity: 0.6; font-size: 0.7rem; }
</style>
