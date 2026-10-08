<script setup lang="ts">
// ─────────────────────────────────────────────────────────────────────
// The repo map (G2) — the workspace's mapping inventory strip: every
// registered reference (plus any profile whose ref is closed) with its
// pair count and coverage over the implementation. A row click sets
// the lens. MAPPED OR NOT: a registered reference with zero pairs is
// inventory, not absence.
// ─────────────────────────────────────────────────────────────────────
import { computed } from 'vue';
import type { Standard } from '@primmel/primmel';
import { repoMap } from '../../lib/repo-map';
import { useModelStore } from '../../stores/model';
import { useMappingStore } from '../../stores/mapping';

const props = defineProps<{ implementationModel: Standard }>();
const modelStore = useModelStore();
const mapping = useMappingStore();

const rows = computed(() => {
  void modelStore.version;
  return repoMap(props.implementationModel, mapping.namespaces);
});

function open(ns: string) {
  if (mapping.namespaces.includes(ns)) mapping.activate(ns);
}
</script>

<template>
  <div class="repo-map" data-testid="repo-map">
    <span class="repo-map-label">repo map</span>
    <button
      v-for="r in rows"
      :key="r.namespace"
      type="button"
      class="repo-map-row"
      :data-testid="`repo-map-${r.namespace}`"
      :title="`${r.pairs} pairs · ${r.mappedSources}/${r.mappableSources} implementation elements mapped`"
      @click="open(r.namespace)"
    >
      <span class="repo-map-ns">{{ r.namespace }}</span>
      <span class="repo-map-counts">{{ r.pairs }} pairs · {{ r.mappedSources }}/{{ r.mappableSources }}</span>
    </button>
    <span v-if="!rows.length" class="repo-map-empty">no references registered</span>
  </div>
</template>

<style scoped>
.repo-map {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  flex-wrap: wrap;
  margin-bottom: 0.4rem;
}
.repo-map-label {
  font-size: 0.62rem;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  opacity: 0.6;
}
.repo-map-row {
  display: inline-flex;
  gap: 0.45rem;
  align-items: baseline;
  border: 1px solid var(--border, #ccc);
  border-radius: var(--radius-sm, 4px);
  background: transparent;
  padding: 0.15rem 0.5rem;
  cursor: pointer;
  font-size: 0.68rem;
}
.repo-map-row:hover { border-color: var(--sage, #7a9a7a); }
.repo-map-ns { font-family: monospace; }
.repo-map-counts { opacity: 0.65; font-size: 0.62rem; }
.repo-map-empty { font-size: 0.68rem; opacity: 0.55; }
</style>
