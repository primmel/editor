<script setup lang="ts">
// ─────────────────────────────────────────────────────────────────────
// The document pane (TODO.editor/10) — the parsed document's clauses
// → paragraphs → statements; a statement click is a mapping pick (its
// URN is the target). Rows carry data-node-id=<statement id> so the
// mapper's overlay measures them like canvas nodes.
// ─────────────────────────────────────────────────────────────────────
import { computed, ref } from 'vue';
import type { MapProfile } from '@primmel/primmel';
import type { DocumentModel } from '../../lib/document-model';
import { splitTargetRef } from '../../lib/mapper';
import { useModelStore } from '../../stores/model';

const props = defineProps<{
  document: DocumentModel;
  /** The active doc-map profile (pairs target statement URNs). */
  profile: MapProfile | null;
  /** The currently picked statement id. */
  pickedId?: string | null;
}>();

const emit = defineEmits<{
  (e: 'pick', id: string): void;
}>();

const modelStore = useModelStore();

const collapsed = ref(new Set<string>());

function toggle(clauseId: string) {
  const next = new Set(collapsed.value);
  if (next.has(clauseId)) next.delete(clauseId);
  else next.add(clauseId);
  collapsed.value = next;
}

/** The mapped statement ids (the pair targets' bare ids). */
const mappedIds = computed(() => {
  void modelStore.version;
  const out = new Set<string>();
  if (!props.profile) return out;
  for (const pairs of Object.values(props.profile.mappings)) {
    for (const pair of pairs) {
      const t = splitTargetRef(pair.target);
      if (t) out.add(t.id);
    }
  }
  return out;
});

const totalStatements = computed(() => props.document.statements.size);
</script>

<template>
  <div class="document-view" data-testid="document-view">
    <div class="doc-header">
      <span class="doc-title">{{ document.title }}</span>
      <span class="doc-urn">{{ document.urnBase }}</span>
      <span class="doc-count">{{ totalStatements }} statements</span>
    </div>

    <div class="doc-body">
      <div v-for="clause in document.clauses" :key="clause.id" class="doc-clause">
        <button
          v-if="clause.paragraphs.length"
          type="button"
          class="clause-header"
          @click="toggle(clause.id)"
        >
          <span class="clause-toggle">{{ collapsed.has(clause.id) ? '▸' : '▾' }}</span>
          <span class="clause-number">{{ clause.number }}</span>
          <span class="clause-title">{{ clause.title }}</span>
        </button>
        <div v-if="!collapsed.has(clause.id)" class="clause-body">
          <div
            v-for="para in clause.paragraphs"
            :key="para.id"
            class="doc-paragraph"
          >
            <button
              v-for="stmt in para.statements"
              :key="stmt.id"
              type="button"
              class="doc-statement"
              :class="{ mapped: mappedIds.has(stmt.id), picked: pickedId === stmt.id }"
              :data-node-id="stmt.id"
              :data-testid="`stmt-${stmt.id}`"
              :title="stmt.urn"
              @click="emit('pick', stmt.id)"
            >
              <span class="stmt-id">{{ stmt.id }}</span>
              <span class="stmt-text">{{ stmt.text }}</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.document-view {
  height: 100%;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}
.doc-header {
  display: flex;
  align-items: baseline;
  gap: 0.6rem;
  padding: 0.45rem 0.75rem;
  border-bottom: 1px solid var(--border);
}
.doc-title {
  font-size: 0.78rem;
  font-weight: 600;
  color: var(--text);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.doc-urn {
  font-family: var(--font-mono);
  font-size: 0.62rem;
  color: var(--accent);
}
.doc-count {
  margin-left: auto;
  font-family: var(--font-mono);
  font-size: 0.62rem;
  color: var(--text-faint);
}
.doc-body {
  flex: 1;
  overflow-y: auto;
  padding: 0.4rem 0.5rem;
}
.clause-header {
  display: flex;
  align-items: baseline;
  gap: 0.4rem;
  width: 100%;
  text-align: left;
  background: none;
  border: none;
  cursor: pointer;
  padding: 0.3rem 0.35rem;
  border-radius: var(--radius-sm);
}
.clause-header:hover { background: var(--bg-elevated); }
.clause-toggle { color: var(--text-faint); font-size: 0.62rem; width: 0.7rem; }
.clause-number {
  font-family: var(--font-mono);
  font-size: 0.7rem;
  color: var(--accent);
  font-weight: 600;
}
.clause-title {
  font-size: 0.74rem;
  color: var(--text);
  font-weight: 600;
}
.clause-body { padding-left: 1.1rem; }
.doc-statement {
  display: flex;
  align-items: baseline;
  gap: 0.5rem;
  width: 100%;
  text-align: left;
  background: none;
  border: 1px solid transparent;
  border-radius: var(--radius-sm);
  cursor: pointer;
  padding: 0.22rem 0.4rem;
  margin-bottom: 1px;
}
.doc-statement:hover { background: var(--bg-elevated); }
.doc-statement.mapped .stmt-id { color: var(--sage); }
.doc-statement.picked { border-color: var(--accent); }
.stmt-id {
  font-family: var(--font-mono);
  font-size: 0.6rem;
  color: var(--text-faint);
  flex-shrink: 0;
  min-width: 4.5rem;
}
.stmt-text {
  font-size: 0.72rem;
  color: var(--text-muted);
  line-height: 1.35;
}
</style>
