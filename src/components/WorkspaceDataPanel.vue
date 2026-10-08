<script setup lang="ts">
// ─────────────────────────────────────────────────────────────────────
// The registry data panel (G13 step 2) — the instance store: rows in
// the schema-driven form (the paired dataclass IS the form), persisted
// to the package's workspace file. Every save is a git commit (the
// substrate discipline); the commit line and the log are the history.
// ─────────────────────────────────────────────────────────────────────
import { computed, onMounted, ref } from 'vue';
import type { Standard } from '@primmel/primmel';
import {
  emptyWorkspace, fetchPackageFile, parseWorkspace, schemaOf,
  serializeWorkspace, WORKSPACE_PATH, type WorkspaceDoc, type WorkspaceRow,
} from '../lib/workspace-data';
import { fetchPackageHistory, writePackageFiles, type PackageHistoryEntry } from '../lib/package';
import { useModelStore } from '../stores/model';

const props = defineProps<{ model: Standard }>();
const modelStore = useModelStore();

const registryId = ref('');
const doc = ref<WorkspaceDoc>(emptyWorkspace());
const dirty = ref(false);
const error = ref('');
const commitNote = ref('');
const history = ref<PackageHistoryEntry[]>([]);

const registries = computed(() =>
  (props.model.regs ?? []).map((r) => ({ id: r.id, paired: !!r.data })),
);

const schema = computed(() => {
  void modelStore.version;
  if (!registryId.value) return null;
  try {
    return schemaOf(props.model, registryId.value);
  } catch {
    return null;
  }
});

const rows = computed<WorkspaceRow[]>(() => doc.value.registries[registryId.value] ?? []);

function loadAll() {
  const pkg = modelStore.pkg;
  if (!pkg) return;
  error.value = '';
  fetchPackageFile(pkg.dir, WORKSPACE_PATH)
    .then((text) => {
      doc.value = text ? parseWorkspace(text) : emptyWorkspace();
      dirty.value = false;
    })
    .catch((e: unknown) => { error.value = (e as Error).message; });
  fetchPackageHistory(pkg.dir)
    .then((h: PackageHistoryEntry[]) => { history.value = h.slice(0, 8); })
    .catch(() => { history.value = []; });
}

onMounted(() => {
  loadAll();
  if (!registryId.value) registryId.value = registries.value[0]?.id ?? '';
});

function switchRegistry(id: string) {
  registryId.value = id;
  commitNote.value = '';
}

function newRow() {
  const list = doc.value.registries[registryId.value] ?? [];
  const n = list.length + 1;
  list.push({ id: `${registryId.value}-row-${n}`, values: {} });
  doc.value = { registries: { ...doc.value.registries, [registryId.value]: list } };
  dirty.value = true;
}

function removeRow(rid: string) {
  const list = (doc.value.registries[registryId.value] ?? []).filter((r: WorkspaceRow) => r.id !== rid);
  doc.value = { registries: { ...doc.value.registries, [registryId.value]: list } };
  dirty.value = true;
}

async function save() {
  const pkg = modelStore.pkg;
  if (!pkg) {
    error.value = 'no package open — the instance store saves through the package session';
    return;
  }
  error.value = '';
  try {
    const r = await writePackageFiles(
      pkg.dir,
      [{ path: WORKSPACE_PATH, text: serializeWorkspace(doc.value) }],
      `workspace: ${registryId.value} at ${rows.value.length} rows`,
    );
    dirty.value = false;
    commitNote.value = r.commit.committed
      ? `committed ${r.commit.oid?.slice(0, 7)} — the instance data is in the package's history`
      : (r.commit.reason ?? 'saved without a commit');
    const h = await fetchPackageHistory(pkg.dir);
    history.value = h.slice(0, 8);
  } catch (e) {
    error.value = (e as Error).message;
  }
}
</script>

<template>
  <div class="wsdata" data-testid="workspace-data">
    <div class="wsdata-head">
      <span class="wsdata-label">registry data — the instance store</span>
      <select :value="registryId" data-testid="wsdata-registry" @change="switchRegistry(($event.target as HTMLSelectElement).value)">
        <option v-for="r in registries" :key="r.id" :value="r.id">
          {{ r.id }}{{ r.paired ? '' : ' (formless — no dataclass)' }}
        </option>
      </select>
    </div>

    <div v-if="!modelStore.pkg" class="wsdata-note">
      open a package — the rows persist into it (each save a commit)
    </div>
    <div v-else-if="!schema" class="wsdata-note" data-testid="wsdata-formless">
      this registry pairs no dataclass — the rows are formless (C157)
    </div>

    <template v-else>
      <div class="wsdata-schema">
        schema: <code>{{ schema.classId }}</code> · {{ schema.fields.length }} fields
      </div>
      <div v-for="row in rows" :key="row.id" class="wsdata-row" :data-testid="`wsdata-row-${row.id}`">
        <div class="wsdata-row-head">
          <input class="wsdata-id" :value="row.id" disabled />
          <button type="button" class="wsdata-del" :data-testid="`wsdata-del-${row.id}`" @click="removeRow(row.id)">✕</button>
        </div>
        <label v-for="f in schema.fields" :key="f.id" class="wsdata-field" :title="f.definition">
          <span>{{ f.id }} <em v-if="f.cardinality">{{ f.cardinality }}</em></span>
          <input
            :value="row.values[f.id] ?? ''"
            :data-testid="`wsdata-field-${row.id}-${f.id}`"
            @input="row.values[f.id] = ($event.target as HTMLInputElement).value; dirty = true"
          />
        </label>
      </div>
      <div class="wsdata-actions">
        <button type="button" class="wsdata-btn" data-testid="wsdata-add" @click="newRow">add row</button>
        <button type="button" class="wsdata-btn primary" :disabled="!dirty" data-testid="wsdata-save" @click="save">
          save {{ dirty ? '' : '(clean)' }}
        </button>
      </div>
      <div v-if="commitNote" class="wsdata-commit" data-testid="wsdata-commit">{{ commitNote }}</div>
      <div v-if="error" class="wsdata-error" data-testid="wsdata-error">{{ error }}</div>
      <div v-if="history.length" class="wsdata-history">
        <div class="wsdata-label">the log — the workspace history</div>
        <div v-for="h in history" :key="h.oid" class="wsdata-hist" :data-testid="`wsdata-hist-${h.oid.slice(0, 7)}`">
          <code>{{ h.oid.slice(0, 7) }}</code> {{ h.message }}
        </div>
      </div>
    </template>
  </div>
</template>

<style scoped>
.wsdata { margin-top: 0.6rem; border-top: 1px solid var(--border-soft); padding-top: 0.5rem; font-size: 0.75rem; }
.wsdata-head { display: flex; align-items: center; gap: 0.5rem; margin-bottom: 0.35rem; }
.wsdata-label {
  font-family: var(--font-mono); font-size: 0.6rem; text-transform: uppercase;
  letter-spacing: 0.1em; color: var(--text-faint);
}
.wsdata-note { color: var(--text-faint); font-size: 0.7rem; font-style: italic; padding: 0.2rem 0; }
.wsdata-schema { font-size: 0.66rem; color: var(--text-soft); margin-bottom: 0.35rem; }
.wsdata-row { border: 1px solid var(--border-soft); border-radius: var(--radius-sm); padding: 0.35rem 0.45rem; margin-bottom: 0.35rem; }
.wsdata-row-head { display: flex; justify-content: space-between; gap: 0.4rem; margin-bottom: 0.25rem; }
.wsdata-id { font-family: var(--font-mono); font-size: 0.66rem; background: none; border: none; color: var(--accent); }
.wsdata-del { background: none; border: none; cursor: pointer; color: var(--text-faint); }
.wsdata-field { display: flex; gap: 0.4rem; align-items: center; margin-bottom: 0.2rem; }
.wsdata-field span { min-width: 7rem; font-size: 0.66rem; color: var(--text-soft); }
.wsdata-field em { opacity: 0.5; font-style: normal; }
.wsdata-field input { flex: 1; font-size: 0.7rem; }
.wsdata-actions { display: flex; gap: 0.4rem; margin-top: 0.3rem; }
.wsdata-btn { cursor: pointer; font-size: 0.7rem; }
.wsdata-btn.primary { font-weight: 600; }
.wsdata-commit { color: var(--sage); font-family: var(--font-mono); font-size: 0.66rem; margin-top: 0.3rem; }
.wsdata-error { color: #b91c1c; font-size: 0.68rem; margin-top: 0.3rem; }
.wsdata-history { margin-top: 0.5rem; }
.wsdata-hist { font-size: 0.64rem; color: var(--text-soft); font-family: var(--font-mono); padding: 0.05rem 0; }
</style>
