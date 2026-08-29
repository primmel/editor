<script setup lang="ts">
// ─────────────────────────────────────────────────────────────────────
// The compliance panel (TODO.editor wave 03, audit PROGRESS/39 G6) —
// reads the compliance surface (lib/compliance.ts): provisions for
// legacy models, the REAL requirements for v3 packages (a v3 package
// has 0 provisions; the pre-bridge panel showed an empty list on 180
// requirements). Selecting a requirement row opens its inspector.
// ─────────────────────────────────────────────────────────────────────
import { computed, ref, watch } from 'vue';
import type { Standard } from '@primmel/primmel';
import { complianceSurface } from '../lib/compliance';
import { useModelStore } from '../stores/model';
import { useUiStore } from '../stores/ui';

const props = defineProps<{ model: Standard }>();
const ui = useUiStore();
const modelStore = useModelStore();

const surface = computed(() => { void modelStore.version; return complianceSurface(props.model); });

const filter = ref<string>('all');
// A model swap (legacy ⇄ v3) resets the filter to a chip that exists.
watch(() => surface.value.kind, () => { filter.value = 'all'; });

const filtered = computed(() => {
  if (filter.value === 'all') return surface.value.rows;
  return surface.value.rows.filter((r) => r.modality === filter.value);
});

const modalityColor: Record<string, string> = {
  shall: '#dc3545',
  should: '#ffc107',
  may: '#28a745',
};

function chipColor(modality: string): string {
  return modalityColor[modality.toLowerCase()] ?? '#888';
}

function selectRow(id: string) {
  ui.select(id, surface.value.kind === 'requirements' ? 'requirement' : 'provision');
}
</script>

<template>
  <div class="compliance" :data-surface="surface.kind">
    <div class="filter-bar">
      <button
        v-for="f in surface.modalities"
        :key="f"
        :class="{ active: filter === f }"
        :data-testid="`compliance-filter-${f}`"
        @click="filter = f"
      >{{ f }}</button>
    </div>
    <div class="provision-list" data-testid="compliance-list">
      <div
        v-for="row in filtered"
        :key="row.id"
        class="provision-item"
        :class="{ selected: ui.isSelected(row.id) }"
        :data-testid="`compliance-row-${row.id}`"
        @click="selectRow(row.id)"
      >
        <span class="modality" :style="{ color: chipColor(row.modality) }">
          {{ row.modality }}
        </span>
        <code class="prov-id">{{ row.id }}</code>
        <span v-if="row.detail" class="row-detail">{{ row.detail }}</span>
      </div>
    </div>
    <div v-if="filtered.length === 0" class="empty">No {{ surface.label }}</div>
  </div>
</template>

<style scoped>
.compliance { height: 100%; display: flex; flex-direction: column; }
.filter-bar {
  display: flex;
  gap: 0.2rem;
  padding: 0.6rem 0.75rem;
  border-bottom: 1px solid var(--border);
}
.filter-bar button {
  flex: 1;
  padding: 0.25rem 0.5rem;
  border: 1px solid var(--border);
  background: var(--bg-elevated);
  color: var(--text-muted);
  border-radius: var(--radius-sm);
  cursor: pointer;
  font-family: var(--font-mono);
  font-size: 0.65rem;
  font-weight: 500;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  transition: var(--transition);
}
.filter-bar button:hover { color: var(--text-soft); border-color: var(--border-strong); }
.filter-bar button.active {
  background: var(--accent);
  color: var(--bg);
  border-color: var(--accent);
}
.provision-list { flex: 1; overflow-y: auto; padding: 0.5rem; }
.provision-item {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.3rem 0.5rem;
  cursor: pointer;
  border-radius: var(--radius-sm);
  border-left: 2px solid transparent;
  margin-bottom: 0.15rem;
  transition: var(--transition);
}
.provision-item:hover { background: var(--bg-elevated); }
.provision-item.selected {
  background: var(--accent-soft);
  border-left-color: var(--accent);
}
.modality {
  font-family: var(--font-mono);
  font-weight: 600;
  font-size: 0.6rem;
  min-width: 3rem;
  text-align: center;
  padding: 0.1rem 0.3rem;
  border-radius: 2px;
}
.prov-id {
  font-family: var(--font-mono);
  font-size: 0.75rem;
  color: var(--text-soft);
}
.row-detail {
  font-size: 0.68rem;
  color: var(--text-faint);
  font-style: italic;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.provision-item.selected .prov-id { color: var(--accent-hover); }
.empty {
  color: var(--text-muted);
  font-size: 0.85rem;
  padding: 2rem 1rem;
  text-align: center;
  font-style: italic;
}
</style>
