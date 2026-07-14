<script setup lang="ts">
import { ref, computed } from 'vue';
import { load } from '@primmel/primmel';
import type { Standard } from '@primmel/primmel';

const props = defineProps<{ implementationModel: Standard }>();

const referenceRaw = ref<string>('');
const referenceModel = ref<Standard | null>(null);
const mappings = ref<Map<string, Set<string>>>(new Map());
const selectedRef = ref<string | null>(null);
const selectedImpl = ref<string | null>(null);

const refParseError = ref<string | null>(null);

function loadReference() {
  const input = document.createElement('input');
  input.type = 'file';
  input.accept = '.prl,.mmel,.txt';
  input.onchange = () => {
    const file = input.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      referenceRaw.value = reader.result as string;
      try {
        referenceModel.value = load(referenceRaw.value);
        refParseError.value = null;
      } catch (e) {
        refParseError.value = (e as Error).message;
        referenceModel.value = null;
      }
    };
    reader.readAsText(file);
  };
  input.click();
}

const refProcesses = computed(() => referenceModel.value?.processes ?? []);
const implProcesses = computed(() => props.implementationModel.processes);

const mappedImplForRef = computed(() => {
  const set = mappings.value.get(selectedRef.value ?? '');
  return set ? Array.from(set) : [];
});

const unmappedRefProcesses = computed(() => {
  if (!referenceModel.value) return [];
  return referenceModel.value.processes.filter(p => !mappings.value.has(p.id) || mappings.value.get(p.id)!.size === 0);
});

const mappingLines = computed(() => {
  const lines: { from: { y: number }; to: { y: number }; refId: string }[] = [];
  const refList = refProcesses.value;
  const implList = implProcesses.value;
  for (const [refId, implSet] of mappings.value) {
    const refIdx = refList.findIndex(p => p.id === refId);
    if (refIdx < 0) continue;
    for (const implId of implSet) {
      const implIdx = implList.findIndex(p => p.id === implId);
      if (implIdx < 0) continue;
      lines.push({
        from: { y: 28 + refIdx * 30 },
        to: { y: 28 + implIdx * 30 },
        refId,
      });
    }
  }
  return lines;
});

function onRefClick(id: string) {
  selectedRef.value = id;
  if (selectedImpl.value) {
    addMapping(id, selectedImpl.value);
    selectedRef.value = null;
    selectedImpl.value = null;
  }
}

function onImplClick(id: string) {
  selectedImpl.value = id;
  if (selectedRef.value) {
    addMapping(selectedRef.value, id);
    selectedRef.value = null;
    selectedImpl.value = null;
  }
}

function addMapping(refId: string, implId: string) {
  if (!mappings.value.has(refId)) mappings.value.set(refId, new Set());
  mappings.value.get(refId)!.add(implId);
}

function removeMapping(refId: string, implId: string) {
  mappings.value.get(refId)?.delete(implId);
  if (mappings.value.get(refId)?.size === 0) mappings.value.delete(refId);
}

type MappingEntry = { description: string; justification: string };
type MappingTarget = Record<string, MappingEntry>;
type NamespaceMap = { id: string; mappings: Record<string, MappingTarget> };

function exportPrm() {
  const mapSet: Record<string, NamespaceMap> = {};
  const refNamespace = referenceModel.value?.meta?.namespace ?? 'REFERENCE';
  mapSet[refNamespace] = {
    id: refNamespace,
    mappings: {},
  };
  for (const [refId, implSet] of mappings.value) {
    mapSet[refNamespace].mappings[refId] = {};
    for (const implId of implSet) {
      mapSet[refNamespace].mappings[refId][implId] = { description: '', justification: '' };
    }
  }
  const result = {
    '@context': 'https://bsi-ribose-smart.org',
    '@type': 'MMEL_MAP',
    id: '',
    mapSet,
  };
  const blob = new Blob([JSON.stringify(result, null, 2)], { type: 'application/json' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = 'mapping.prm';
  a.click();
}

const coveragePct = computed(() => {
  if (refProcesses.value.length === 0) return 0;
  const mapped = refProcesses.value.filter(p => mappings.value.has(p.id) && mappings.value.get(p.id)!.size > 0).length;
  return Math.round((mapped / refProcesses.value.length) * 100);
});
</script>

<template>
  <div class="mapping-view">
    <div class="map-toolbar">
      <button class="map-btn" @click="loadReference">
        {{ referenceModel ? 'Change reference' : 'Load reference model' }}
      </button>
      <button class="map-btn save" @click="exportPrm" :disabled="mappings.size === 0">Export .prm</button>
      <span class="coverage" v-if="referenceModel">{{ coveragePct }}% coverage</span>
    </div>

    <div v-if="refParseError" class="map-error">{{ refParseError }}</div>

    <div class="map-content" v-if="referenceModel">
      <div class="map-col">
        <div class="col-header">Reference ({{ refProcesses.length }})</div>
        <div class="col-list">
          <button
            v-for="p in refProcesses"
            :key="p.id"
            class="map-item ref"
            :class="{
              selected: selectedRef === p.id,
              mapped: mappings.has(p.id) && mappings.get(p.id)!.size > 0,
              unmapped: !mappings.has(p.id) || mappings.get(p.id)!.size === 0,
            }"
            @click="onRefClick(p.id)"
            :title="p.name"
          >
            {{ p.id }}
          </button>
        </div>
      </div>

      <svg class="map-canvas" :height="Math.max(refProcesses.length, implProcesses.length) * 30 + 40">
        <line
          v-for="(line, i) in mappingLines"
          :key="i"
          :x1="0" :y1="line.from.y"
          :x2="300" :y2="line.to.y"
          stroke="var(--accent)"
          stroke-width="1.5"
          opacity="0.4"
          @click="removeMapping(line.refId, implProcesses[mappingLines.indexOf(line) % implProcesses.length]?.id)"
        />
      </svg>

      <div class="map-col">
        <div class="col-header">Implementation ({{ implProcesses.length }})</div>
        <div class="col-list">
          <button
            v-for="p in implProcesses"
            :key="p.id"
            class="map-item impl"
            :class="{ selected: selectedImpl === p.id }"
            @click="onImplClick(p.id)"
            :title="p.name"
          >
            {{ p.id }}
          </button>
        </div>
      </div>
    </div>

    <div class="map-hint" v-if="referenceModel && mappings.size === 0">
      Click a reference element, then click an implementation element to create a mapping.
    </div>

    <div class="map-empty" v-if="!referenceModel">
      <p>Load a reference model (.prl) to start mapping.</p>
      <p class="hint">The reference is the standard being adopted. The implementation is your current model.</p>
    </div>
  </div>
</template>

<style scoped>
.mapping-view { height: 100%; display: flex; flex-direction: column; overflow: hidden; }
.map-toolbar {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.5rem 0.75rem;
  border-bottom: 1px solid var(--border);
}
.map-btn {
  padding: 0.25rem 0.65rem;
  background: var(--bg-elevated);
  border: 1px solid var(--border);
  color: var(--text-soft);
  border-radius: var(--radius-sm);
  cursor: pointer;
  font-family: var(--font-body);
  font-size: 0.72rem;
}
.map-btn:hover { border-color: var(--accent); color: var(--accent); }
.map-btn.save { color: var(--accent); border-color: var(--accent-glow); }
.map-btn:disabled { opacity: 0.4; cursor: not-allowed; }
.coverage {
  font-family: var(--font-mono);
  font-size: 0.68rem;
  color: var(--text-muted);
  margin-left: auto;
}
.map-error {
  padding: 0.4rem 0.75rem;
  background: var(--burgundy-soft);
  color: var(--burgundy);
  font-family: var(--font-mono);
  font-size: 0.72rem;
}
.map-content {
  flex: 1;
  display: grid;
  grid-template-columns: 1fr 300px 1fr;
  overflow: hidden;
}
.map-col { display: flex; flex-direction: column; overflow: hidden; border-right: 1px solid var(--border); }
.map-col:last-child { border-right: none; border-left: 1px solid var(--border); }
.col-header {
  padding: 0.5rem 0.65rem;
  font-family: var(--font-mono);
  font-size: 0.6rem;
  text-transform: uppercase;
  letter-spacing: 0.12em;
  color: var(--text-faint);
  border-bottom: 1px solid var(--border);
}
.col-list { flex: 1; overflow-y: auto; padding: 0.3rem; }
.map-item {
  display: block;
  width: 100%;
  text-align: left;
  padding: 0.25rem 0.5rem;
  background: none;
  border: 1px solid transparent;
  border-radius: var(--radius-sm);
  cursor: pointer;
  font-family: var(--font-mono);
  font-size: 0.72rem;
  color: var(--text-muted);
  margin-bottom: 1px;
  transition: var(--transition);
}
.map-item:hover { background: var(--bg-elevated); color: var(--text-soft); }
.map-item.selected { border-color: var(--accent); color: var(--accent); }
.map-item.ref.mapped { color: var(--sage); }
.map-item.ref.unmapped { opacity: 0.5; }
.map-canvas {
  background: var(--bg);
  background-image: radial-gradient(circle, var(--text-faint) 0.5px, transparent 0.5px);
  background-size: 16px 16px;
  overflow: hidden;
}
.map-hint {
  padding: 0.5rem 0.75rem;
  font-size: 0.78rem;
  color: var(--text-muted);
  font-style: italic;
  border-top: 1px solid var(--border);
}
.map-empty {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  color: var(--text-muted);
  text-align: center;
  padding: 2rem;
}
.map-empty p { font-size: 0.9rem; margin-bottom: 0.5rem; }
.map-empty .hint { font-size: 0.78rem; font-style: italic; }
</style>
