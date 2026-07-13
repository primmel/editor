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
  gap: 0.25rem;
  padding: 0.5rem;
  border-bottom: 1px solid #e0e0e0;
}
.filter-bar button {
  flex: 1;
  padding: 0.25rem;
  border: 1px solid #ddd;
  background: #fff;
  border-radius: 3px;
  cursor: pointer;
  font-size: 0.72rem;
  color: #666;
}
.filter-bar button.active {
  background: var(--accent, #4a6fa5);
  color: #fff;
  border-color: var(--accent, #4a6fa5);
}
.provision-list { flex: 1; overflow-y: auto; padding: 0.25rem; }
.provision-item {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.3rem 0.5rem;
  cursor: pointer;
  border-radius: 3px;
  font-size: 0.8rem;
}
.provision-item:hover { background: #e8e8e8; }
.provision-item.selected { background: var(--accent, #4a6fa5); color: #fff; }
.modality {
  font-weight: 700;
  font-size: 0.7rem;
  min-width: 3rem;
}
.prov-id { font-family: 'SF Mono', Menlo, monospace; font-size: 0.78rem; }
.empty { color: #aaa; font-size: 0.85rem; padding: 1rem; text-align: center; }
</style>
