import { defineStore } from 'pinia';
import { ref, computed } from 'vue';
import * as yaml from 'js-yaml';
import type { Standard, DataClass, Registry } from '@primmel/primmel';

export interface RegistryRecord {
  id: string;
  regid: string;
  name?: string;
  attributes: Record<string, unknown>;
}

export interface RegistryStore {
  name: string;
  records: RegistryRecord[];
}

export const useRegistryStore = defineStore('registry', () => {
  const stores = ref<Map<string, RegistryStore>>(new Map());
  const activeRegistryId = ref<string | null>(null);
  const selectedRecordId = ref<string | null>(null);
  const dirHandle = ref<FileSystemDirectoryHandle | null>(null);

  function registriesInModel(model: Standard): { id: string; title: string; dataClass?: DataClass }[] {
    return model.regs.map((reg: Registry) => {
      const dataClass = reg.data ?? undefined;
      return { id: reg.id, title: reg.title ?? reg.id, dataClass };
    });
  }

  function activeStore(): RegistryStore | null {
    if (!activeRegistryId.value) return null;
    return stores.value.get(activeRegistryId.value) ?? null;
  }

  function loadFromYamlRegistry(registryId: string, records: RegistryRecord[]) {
    stores.value.set(registryId, { name: registryId, records });
    if (!activeRegistryId.value) activeRegistryId.value = registryId;
  }

  function selectRegistry(id: string) {
    activeRegistryId.value = id;
    selectedRecordId.value = null;
  }

  function selectRecord(id: string) {
    selectedRecordId.value = id;
  }

  function addRecord(registryId: string, record: RegistryRecord) {
    const store = stores.value.get(registryId);
    if (store) {
      store.records.push(record);
    }
  }

  function updateRecord(registryId: string, recordId: string, patch: Partial<RegistryRecord>) {
    const store = stores.value.get(registryId);
    if (!store) return;
    const idx = store.records.findIndex(r => r.id === recordId);
    if (idx >= 0) {
      store.records[idx] = { ...store.records[idx], ...patch };
    }
  }

  function deleteRecord(registryId: string, recordId: string) {
    const store = stores.value.get(registryId);
    if (!store) return;
    store.records = store.records.filter(r => r.id !== recordId);
    if (selectedRecordId.value === recordId) selectedRecordId.value = null;
  }

  async function saveToDirectory(directoryHandle: FileSystemDirectoryHandle) {
    dirHandle.value = directoryHandle;
    for (const [regId, store] of stores.value) {
      const regDir = await directoryHandle.getDirectoryHandle(regId, { create: true });
      for (const record of store.records) {
        const fileHandle = await regDir.getFileHandle(`${record.id}.yaml`, { create: true });
        const writable = await fileHandle.createWritable();
        await writable.write(yaml.dump(record));
        await writable.close();
      }
    }
    const manifestHandle = await directoryHandle.getFileHandle('manifest.yaml', { create: true });
    const writable = await manifestHandle.createWritable();
    await writable.write(yaml.dump({
      version: 'v1.0.0-dev1',
      registries: Array.from(stores.value.keys()),
    }));
    await writable.close();
  }

  const selectedRecord = computed<RegistryRecord | null>(() => {
    const store = activeStore();
    if (!store || !selectedRecordId.value) return null;
    return store.records.find(r => r.id === selectedRecordId.value) ?? null;
  });

  function reset() {
    stores.value.clear();
    activeRegistryId.value = null;
    selectedRecordId.value = null;
    dirHandle.value = null;
  }

  return {
    stores, activeRegistryId, selectedRecordId, selectedRecord,
    registriesInModel, activeStore, loadFromYamlRegistry,
    selectRegistry, selectRecord,
    addRecord, updateRecord, deleteRecord,
    saveToDirectory, reset,
  };
});
