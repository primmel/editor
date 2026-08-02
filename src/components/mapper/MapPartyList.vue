<script setup lang="ts">
// ─────────────────────────────────────────────────────────────────────
// A party list (TODO.editor/07) — one side's mapped/unmapped elements
// (the MMEL's findImpMapPartners / findRefMapPartners over the v3
// profile). Click a mapped row to edit the pair; click an unmapped
// row to start a pick.
// ─────────────────────────────────────────────────────────────────────
import { computed } from 'vue';
import type { MapProfile, Standard } from '@primmel/primmel';
import {
  mappableIds, mappedSourceIds, mappedTargetIds,
  pairsOf, sourcesTargeting, splitTargetRef,
} from '../../lib/mapper';
import { useModelStore } from '../../stores/model';

const props = defineProps<{
  side: 'source' | 'target';
  model: Standard;
  profile: MapProfile | null;
}>();

const emit = defineEmits<{
  (e: 'pick', id: string): void;
  (e: 'editPair', impId: string, refId: string): void;
}>();

const modelStore = useModelStore();

interface Row {
  id: string;
  mapped: boolean;
  partners: string[];
}

const rows = computed<Row[]>(() => {
  void modelStore.version;
  const ids = mappableIds(props.model);
  if (props.side === 'source') {
    const mapped = mappedSourceIds(props.profile);
    return ids.map(id => ({
      id,
      mapped: mapped.has(id),
      partners: pairsOf(props.profile, id)
        .map(p => splitTargetRef(p.target)?.id ?? p.target),
    }));
  }
  const mapped = mappedTargetIds(props.profile);
  return ids.map(id => ({
    id,
    mapped: mapped.has(id),
    partners: sourcesTargeting(props.profile, id),
  }));
});

const mappedRows = computed(() => rows.value.filter(r => r.mapped));
const unmappedRows = computed(() => rows.value.filter(r => !r.mapped));

function onRow(row: Row) {
  if (!row.mapped) {
    emit('pick', row.id);
    return;
  }
  const partner = row.partners[0];
  if (!partner) return;
  if (props.side === 'source') emit('editPair', row.id, partner);
  else emit('editPair', partner, row.id);
}
</script>

<template>
  <div class="party-list" :data-testid="`party-${side}`">
    <div class="party-section">
      <div class="party-header">mapped ({{ mappedRows.length }})</div>
      <button
        v-for="row in mappedRows"
        :key="row.id"
        type="button"
        class="party-row mapped"
        :data-testid="`party-${side}-mapped-${row.id}`"
        :title="row.partners.join(', ')"
        @click="onRow(row)"
      >
        <span class="party-id">{{ row.id }}</span>
        <span class="party-partners">⇒ {{ row.partners.join(', ') }}</span>
      </button>
    </div>
    <div class="party-section">
      <div class="party-header">unmapped ({{ unmappedRows.length }})</div>
      <button
        v-for="row in unmappedRows"
        :key="row.id"
        type="button"
        class="party-row unmapped"
        :data-testid="`party-${side}-unmapped-${row.id}`"
        @click="onRow(row)"
      >
        <span class="party-id">{{ row.id }}</span>
      </button>
    </div>
  </div>
</template>

<style scoped>
.party-list {
  flex: 1;
  overflow-y: auto;
  padding: 0.3rem;
}
.party-header {
  font-family: var(--font-mono);
  font-size: 0.58rem;
  text-transform: uppercase;
  letter-spacing: 0.1em;
  color: var(--text-faint);
  padding: 0.3rem 0.4rem 0.2rem;
}
.party-row {
  display: flex;
  align-items: baseline;
  gap: 0.4rem;
  width: 100%;
  text-align: left;
  padding: 0.18rem 0.45rem;
  background: none;
  border: 1px solid transparent;
  border-radius: var(--radius-sm);
  cursor: pointer;
  font-family: var(--font-mono);
  font-size: 0.7rem;
  color: var(--text-muted);
}
.party-row:hover { background: var(--bg-elevated); color: var(--text); }
.party-row.mapped .party-id { color: var(--sage); }
.party-row.unmapped { opacity: 0.65; }
.party-partners {
  font-size: 0.62rem;
  color: var(--text-faint);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
</style>
