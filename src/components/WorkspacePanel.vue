<script setup lang="ts">
// ─────────────────────────────────────────────────────────────────────
// The workspace panel (TODO.editor wave 05, audit G9 / the Paneron P-1
// row) — the session's typed items, Imp/Ref/Doc, as an index with
// per-item info. The open model card types the unit of work (the
// manifest tier, the file inventory, the uses closure, the editions);
// the reference rows drive the EXISTING lens (activate + the mapping
// view — never a second editable AST); the document card carries the
// doc-map mirror's counts. Derivation: lib/workspace.ts.
// ─────────────────────────────────────────────────────────────────────
import { computed } from 'vue';
import type { Standard } from '@primmel/primmel';
import { workspaceIndex } from '../lib/workspace';
import { useModelStore } from '../stores/model';
import { useMappingStore } from '../stores/mapping';
import { useUiStore } from '../stores/ui';

const props = defineProps<{ model: Standard }>();
const modelStore = useModelStore();
const mappingStore = useMappingStore();
const ui = useUiStore();

const index = computed(() => {
  void modelStore.version;
  return workspaceIndex(
    props.model,
    modelStore.pkg,
    mappingStore.refs,
    mappingStore.activeNs,
    mappingStore.document,
  );
});

function openRef(namespace: string) {
  mappingStore.activate(namespace);
  ui.view = 'mapping';
}

function openDoc() {
  ui.view = 'mapping';
}
</script>

<template>
  <div class="workspace-panel" data-testid="workspace-panel">
    <!-- IMP — the open model, the unit of work. -->
    <div class="ws-label">implementation — the open model</div>
    <div class="ws-card" data-testid="workspace-imp">
      <div class="ws-card-head">
        <code class="ws-id" data-testid="workspace-imp-id">{{ index.imp.id }}</code>
        <span class="ws-kind" data-testid="workspace-imp-kind">{{ index.imp.kind }}</span>
      </div>
      <div v-if="index.imp.title" class="ws-title">{{ index.imp.title }}</div>
      <div class="ws-row" data-testid="workspace-imp-counts">
        {{ index.imp.counts.processes }} processes · {{ index.imp.counts.requirements }} requirements · {{ index.imp.counts.terms }} terms
      </div>
      <div v-if="index.imp.files !== null" class="ws-row" data-testid="workspace-imp-files">
        {{ index.imp.files }} files (the package is the unit of work)
      </div>
      <div v-if="index.imp.imports.length" class="ws-row" data-testid="workspace-imp-imports">
        composes {{ index.imp.imports.map(i => `${i.id} (${i.constructs})`).join(', ') }}
      </div>
      <div v-if="index.imp.editions.length" class="ws-row" data-testid="workspace-imp-editions">
        editions: {{ index.imp.editions.join(', ') }}
      </div>
    </div>

    <!-- REF — the registered reference models (the lens registry). -->
    <div class="ws-label">reference models — the mapping lenses</div>
    <button
      v-for="r in index.refs"
      :key="r.namespace"
      type="button"
      class="ws-card ws-ref"
      :class="{ active: r.active }"
      :data-testid="`workspace-ref-${r.namespace}`"
      @click="openRef(r.namespace)"
    >
      <div class="ws-card-head">
        <code class="ws-id">{{ r.namespace }}</code>
        <span v-if="r.active" class="ws-active">active lens</span>
      </div>
      <div class="ws-row">
        {{ r.counts.processes }} processes · {{ r.counts.requirements }} requirements · {{ r.counts.terms }} terms
      </div>
    </button>
    <div v-if="!index.refs.length" class="ws-empty" data-testid="workspace-refs-empty">
      no reference models registered — the mapping view's seed/import adds them
    </div>

    <!-- DOC — the attached document (the doc-map mirror). -->
    <div class="ws-label">document — the doc-map mirror</div>
    <button
      v-if="index.doc"
      type="button"
      class="ws-card"
      data-testid="workspace-doc"
      @click="openDoc"
    >
      <div class="ws-card-head">
        <code class="ws-id">{{ index.doc.urnBase }}</code>
      </div>
      <div v-if="index.doc.title" class="ws-title">{{ index.doc.title }}</div>
      <div class="ws-row">{{ index.doc.clauses }} clauses · {{ index.doc.statements }} statements</div>
    </button>
    <div v-else class="ws-empty" data-testid="workspace-doc-empty">
      no document attached — the mapping view's document import adds one
    </div>
  </div>
</template>

<style scoped>
.workspace-panel { padding: 0.75rem; font-size: 0.78rem; }
.ws-label {
  font-family: var(--font-mono);
  font-size: 0.6rem;
  text-transform: uppercase;
  letter-spacing: 0.1em;
  color: var(--text-faint);
  margin: 0.6rem 0 0.3rem;
}
.ws-label:first-child { margin-top: 0; }
.ws-card {
  display: block;
  width: 100%;
  text-align: left;
  border: 1px solid var(--border-soft);
  border-radius: var(--radius-sm);
  background: none;
  padding: 0.4rem 0.55rem;
  margin-bottom: 0.3rem;
  color: var(--text);
}
button.ws-card { cursor: pointer; }
button.ws-card:hover { background: var(--bg-elevated); }
.ws-card.active { border-color: var(--accent); }
.ws-card-head { display: flex; align-items: center; gap: 0.5rem; }
.ws-id {
  font-family: var(--font-mono);
  font-size: 0.72rem;
  color: var(--accent);
  word-break: break-all;
}
.ws-kind {
  font-family: var(--font-mono);
  font-size: 0.58rem;
  text-transform: uppercase;
  letter-spacing: 0.08em;
  background: var(--accent-soft);
  color: var(--accent);
  padding: 0.1rem 0.4rem;
  border-radius: var(--radius-sm);
  border: 1px solid var(--accent-glow);
}
.ws-active {
  font-family: var(--font-mono);
  font-size: 0.58rem;
  text-transform: uppercase;
  letter-spacing: 0.08em;
  color: var(--sage);
}
.ws-title { font-size: 0.7rem; color: var(--text-muted); margin-top: 0.15rem; }
.ws-row { font-size: 0.68rem; color: var(--text-soft); font-family: var(--font-mono); margin-top: 0.15rem; }
.ws-empty { color: var(--text-faint); font-size: 0.7rem; font-style: italic; padding: 0.2rem 0; }
</style>
