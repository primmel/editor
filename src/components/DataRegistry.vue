<script setup lang="ts">
import { computed } from 'vue';
import type { Standard } from '@primmel/primmel';
import { useModelStore } from '../stores/model';
import { useRegistryStore } from '../stores/registry';
import * as yaml from 'js-yaml';

const props = defineProps<{ model: Standard }>();
const modelStore = useModelStore();
const registry = useRegistryStore();

const registries = computed(() => registry.registriesInModel(props.model));
const activeReg = computed(() => registry.activeStore());
const activeDataClass = computed(() => {
  const reg = registries.value.find(r => r.id === registry.activeRegistryId);
  return reg?.dataClass;
});

function selectReg(id: string) {
  registry.selectRegistry(id);
}

function selectRec(id: string) {
  registry.selectRecord(id);
}

function generateId(): string {
  return 'rec_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2, 6);
}

function addRecord() {
  if (!registry.activeRegistryId) return;
  const id = generateId();
  registry.addRecord(registry.activeRegistryId, {
    id,
    regid: registry.activeRegistryId,
    attributes: {},
  });
  registry.selectRecord(id);
}

function deleteRecord(id: string) {
  if (!registry.activeRegistryId) return;
  registry.deleteRecord(registry.activeRegistryId, id);
}

function updateField(field: string, value: unknown) {
  if (!registry.activeRegistryId || !registry.selectedRecord) return;
  const rec = registry.selectedRecord;
  registry.updateRecord(registry.activeRegistryId, rec.id, {
    attributes: { ...rec.attributes, [field]: value },
  });
}

function exportYaml() {
  const data: Record<string, unknown> = {};
  for (const [id, store] of registry.stores as Map<string, { name: string; records: unknown[] }>) {
    data[id] = store.records;
  }
  const blob = new Blob([yaml.dump(data)], { type: 'text/yaml' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = 'workspace.yaml';
  a.click();
}
</script>

<template>
  <div class="registry-panel">
    <div class="registry-sidebar">
      <div class="reg-header">
        <span class="reg-title">Registries</span>
        <button class="reg-export" @click="exportYaml" v-if="registries.length > 0" title="Export YAML">↓</button>
      </div>
      <div class="reg-list" v-if="registries.length > 0">
        <button
          v-for="reg in registries"
          :key="reg.id"
          class="reg-item"
          :class="{ active: registry.activeRegistryId === reg.id }"
          @click="selectReg(reg.id)"
        >
          <span class="reg-name">{{ reg.id }}</span>
          <span class="reg-count">{{ registry.stores.get(reg.id)?.records.length ?? 0 }}</span>
        </button>
      </div>
      <div v-else class="reg-empty">No registries in this model</div>
    </div>

    <div class="record-list" v-if="activeReg">
      <div class="records-header">
        <span class="records-title">{{ activeReg.name }}</span>
        <button class="add-btn" @click="addRecord">+ Add</button>
      </div>
      <div class="records">
        <div
          v-for="rec in activeReg.records"
          :key="rec.id"
          class="record-item"
          :class="{ selected: registry.selectedRecordId === rec.id }"
          @click="selectRec(rec.id)"
        >
          <span class="record-id">{{ rec.id }}</span>
          <button class="record-del" @click.stop="deleteRecord(rec.id)">×</button>
        </div>
        <div v-if="activeReg.records.length === 0" class="no-records">No records yet</div>
      </div>
    </div>

    <div class="record-form" v-if="registry.selectedRecord">
      <div class="form-header">
        <span class="form-title">{{ registry.selectedRecord.id }}</span>
      </div>
      <div class="form-body">
        <label class="form-field">
          <span class="field-label">id</span>
          <input class="field-input" :value="registry.selectedRecord.id" readonly />
        </label>
        <label class="form-field" v-for="(_, field) in registry.selectedRecord.attributes" :key="field">
          <span class="field-label">{{ field }}</span>
          <input
            class="field-input"
            :value="String(registry.selectedRecord.attributes[field] ?? '')"
            @input="updateField(field, ($event.target as HTMLInputElement).value)"
          />
        </label>
      </div>
    </div>
  </div>
</template>

<style scoped>
.registry-panel {
  display: grid;
  grid-template-columns: 140px 1fr 1fr;
  height: 100%;
  overflow: hidden;
}
.registry-sidebar {
  border-right: 1px solid var(--border);
  overflow-y: auto;
  background: var(--bg-surface);
}
.reg-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0.6rem 0.65rem 0.4rem;
}
.reg-title {
  font-family: var(--font-mono);
  font-size: 0.6rem;
  text-transform: uppercase;
  letter-spacing: 0.12em;
  color: var(--text-faint);
}
.reg-export {
  background: none;
  border: 1px solid var(--border);
  color: var(--text-muted);
  width: 22px;
  height: 22px;
  border-radius: 3px;
  cursor: pointer;
  font-size: 0.8rem;
}
.reg-export:hover { color: var(--accent); border-color: var(--accent); }
.reg-list { display: flex; flex-direction: column; gap: 1px; padding: 0 0.3rem; }
.reg-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0.3rem 0.5rem;
  background: none;
  border: none;
  border-radius: var(--radius-sm);
  cursor: pointer;
  font-family: var(--font-mono);
  font-size: 0.72rem;
  color: var(--text-muted);
  text-align: left;
  transition: var(--transition);
}
.reg-item:hover { background: var(--bg-elevated); color: var(--text-soft); }
.reg-item.active { background: var(--accent-soft); color: var(--accent); }
.reg-count {
  font-size: 0.62rem;
  opacity: 0.6;
}
.reg-empty {
  padding: 1rem 0.65rem;
  font-size: 0.78rem;
  color: var(--text-muted);
  font-style: italic;
}
.record-list {
  border-right: 1px solid var(--border);
  display: flex;
  flex-direction: column;
  overflow: hidden;
}
.records-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0.6rem 0.65rem;
  border-bottom: 1px solid var(--border);
}
.records-title {
  font-family: var(--font-mono);
  font-size: 0.72rem;
  color: var(--text);
}
.add-btn {
  padding: 0.15rem 0.5rem;
  background: var(--accent-soft);
  border: 1px solid var(--accent-glow);
  color: var(--accent);
  border-radius: var(--radius-sm);
  cursor: pointer;
  font-size: 0.68rem;
  font-family: var(--font-body);
}
.add-btn:hover { background: var(--accent); color: var(--bg); }
.records { flex: 1; overflow-y: auto; padding: 0.3rem; }
.record-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0.25rem 0.5rem;
  border-radius: var(--radius-sm);
  cursor: pointer;
  transition: var(--transition);
}
.record-item:hover { background: var(--bg-elevated); }
.record-item.selected { background: var(--accent-soft); }
.record-id { font-family: var(--font-mono); font-size: 0.72rem; color: var(--text-soft); }
.record-item.selected .record-id { color: var(--accent); }
.record-del {
  background: none;
  border: none;
  color: var(--text-faint);
  cursor: pointer;
  font-size: 0.9rem;
  width: 18px;
  height: 18px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 2px;
}
.record-del:hover { color: var(--burgundy); background: var(--burgundy-soft); }
.no-records {
  padding: 1rem;
  text-align: center;
  font-size: 0.78rem;
  color: var(--text-muted);
  font-style: italic;
}
.record-form {
  display: flex;
  flex-direction: column;
  overflow: hidden;
}
.form-header {
  padding: 0.6rem 0.65rem;
  border-bottom: 1px solid var(--border);
}
.form-title {
  font-family: var(--font-mono);
  font-size: 0.72rem;
  color: var(--accent);
}
.form-body {
  flex: 1;
  overflow-y: auto;
  padding: 0.6rem;
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}
.form-field {
  display: flex;
  flex-direction: column;
  gap: 0.2rem;
}
.field-label {
  font-family: var(--font-mono);
  font-size: 0.62rem;
  color: var(--text-muted);
  text-transform: lowercase;
}
.field-input {
  padding: 0.3rem 0.4rem;
  background: var(--bg-elevated);
  border: 1px solid var(--border);
  border-radius: var(--radius-sm);
  color: var(--text);
  font-family: var(--font-mono);
  font-size: 0.75rem;
  outline: none;
}
.field-input:focus { border-color: var(--accent); }
</style>
