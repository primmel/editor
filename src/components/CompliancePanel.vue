<script setup lang="ts">
import { computed, ref } from 'vue';
import type { Standard } from '@primmel/primmel';
import { useUiStore } from '../stores/ui';

const props = defineProps<{ model: Standard }>();
const ui = useUiStore();

const filter = ref<'all' | 'SHALL' | 'SHOULD' | 'MAY'>('all');

const filtered = computed(() => {
  if (filter.value === 'all') return props.model.provisions;
  return props.model.provisions.filter((p) => p.modality === filter.value);
});

const modalityColor: Record<string, string> = {
  SHALL: '#dc3545',
  SHOULD: '#ffc107',
  MAY: '#28a745',
};

function selectProvision(id: string) {
  ui.select(id, 'provision');
}
</script>

<template>
  <div class="compliance">
    <div class="filter-bar">
      <button
        v-for="f in ['all', 'SHALL', 'SHOULD', 'MAY']"
        :key="f"
        :class="{ active: filter === f }"
        @click="filter = f as typeof filter"
      >{{ f }}</button>
    </div>
    <div class="provision-list">
      <div
        v-for="prov in filtered"
        :key="prov.id"
        class="provision-item"
        :class="{ selected: ui.isSelected(prov.id) }"
        @click="selectProvision(prov.id)"
      >
        <span class="modality" :style="{ color: modalityColor[prov.modality] ?? '#888' }">
          {{ prov.modality }}
        </span>
        <code class="prov-id">{{ prov.id }}</code>
      </div>
    </div>
    <div v-if="filtered.length === 0" class="empty">No provisions</div>
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
.provision-item.selected .prov-id { color: var(--accent-hover); }
.empty {
  color: var(--text-muted);
  font-size: 0.85rem;
  padding: 2rem 1rem;
  text-align: center;
  font-style: italic;
}
</style>
