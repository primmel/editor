<script setup lang="ts">
// ─────────────────────────────────────────────────────────────────────
// The mapping-diff panel (G3) — what a REFERENCE UPDATE does to the
// implementation's maps: load the old and the new edition, read the
// pair dispositions (retained / broken / retarget suggestion) and the
// computed coverage delta. Read-only; the retarget apply is the pair
// dialog's ordinary command.
// ─────────────────────────────────────────────────────────────────────
import { computed, ref } from 'vue';
import { load, type Standard } from '@primmel/primmel';
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
.mdiff-empty { opacity: 0.6; font-size: 0.7rem; }
</style>
