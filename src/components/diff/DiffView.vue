<script setup lang="ts">
// ─────────────────────────────────────────────────────────────────────
// The model-diff view (TODO.editor/12) — the kernel's modelDiff
// between the working model and a loaded version: the summary per
// tier, the changed-element list (grouped by status) with facet-level
// before/after, the mapping diff, and the diff-tinted canvas.
// ─────────────────────────────────────────────────────────────────────
import { computed, ref } from 'vue';
import type { Standard } from '@primmel/primmel';
import ProcessCanvas from '../ProcessCanvas.vue';
import { DIFF_TINTS, diffView, type DiffRow, type DiffStatus } from '../../lib/diff-view';
import { useModelStore } from '../../stores/model';
import { useDiffStore } from '../../stores/diff';

const props = defineProps<{ model: Standard }>();
const modelStore = useModelStore();
const diffStore = useDiffStore();

const other = computed(() => diffStore.other);
const otherName = computed(() => diffStore.otherName);
const otherError = computed(() => diffStore.parseError);
const swapped = computed({
  get: () => diffStore.swapped,
  set: (v) => { diffStore.swapped = v; },
});

function loadOther() {
  const input = document.createElement('input');
  input.type = 'file';
  input.accept = '.prl,.txt';
  input.onchange = () => {
    const file = input.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => diffStore.loadOtherText(reader.result as string, file.name);
    reader.readAsText(file);
  };
  input.click();
}

const a = computed(() => (swapped.value && other.value ? other.value : props.model));
const b = computed(() => (swapped.value && other.value ? props.model : other.value));
const aLabel = computed(() => (swapped.value ? otherName.value : 'working model'));
const bLabel = computed(() => (swapped.value ? 'working model' : otherName.value || 'other'));

const view = computed(() => {
  void modelStore.version;
  if (!b.value) return null;
  return diffView(a.value, b.value, { aLabel: aLabel.value, bLabel: bLabel.value });
});

// ── The list UI ──────────────────────────────────────────────────────
const STATUS_ORDER: DiffStatus[] = ['added', 'removed', 'changed', 'moved'];
const expanded = ref(new Set<string>());

function toggle(key: string) {
  const next = new Set(expanded.value);
  if (next.has(key)) next.delete(key);
  else next.add(key);
  expanded.value = next;
}

// ── The diff canvas tint ─────────────────────────────────────────────
const statusById = computed(() => {
  const v = view.value;
  const map = new Map<string, DiffStatus>();
  if (!v) return map;
  for (const [key, status] of v.statusOf) {
    map.set(key.slice(key.indexOf(':') + 1), status);
  }
  return map;
});

function tintOf(id: string): string | null {
  const status = statusById.value.get(id);
  return status ? DIFF_TINTS[status] : null;
}

function tooltipOf(id: string): string | null {
  return statusById.value.get(id) ?? 'unchanged';
}

function rowTitle(row: DiffRow): string {
  return `${row.kind} ${row.id} (${row.tier})`;
}
</script>

<template>
  <div class="diff-view">
    <div class="diff-toolbar">
      <span class="diff-side" data-testid="diff-a">{{ aLabel }}</span>
      <button type="button" class="diff-btn" data-testid="diff-swap" :disabled="!other" @click="swapped = !swapped">⇄</button>
      <span class="diff-side" data-testid="diff-b">{{ bLabel }}</span>
      <button type="button" class="diff-btn" data-testid="diff-load" @click="loadOther">
        {{ other ? 'load another version' : 'load a version to compare' }}
      </button>
      <span v-if="otherError" class="diff-error">{{ otherError }}</span>
      <span v-if="view" class="diff-summary" data-testid="diff-summary">
        +{{ view.diff.added.length }} −{{ view.diff.removed.length }}
        ~{{ view.diff.changed.length }} ⇢{{ view.diff.moved.length }}
        <template v-if="view.mappings.added.length || view.mappings.removed.length">
          · mappings +{{ view.mappings.added.length }} −{{ view.mappings.removed.length }}
        </template>
      </span>
    </div>

    <div v-if="view" class="diff-body">
      <div class="diff-lists">
        <template v-for="status in STATUS_ORDER" :key="status">
          <div v-if="view.byStatus[status].length" class="diff-group">
            <div class="diff-group-header" :style="{ color: DIFF_TINTS[status] }">
              {{ status }} ({{ view.byStatus[status].length }})
            </div>
            <div v-for="row in view.byStatus[status]" :key="row.key" class="diff-row-wrap">
              <button
                type="button"
                class="diff-row"
                :data-testid="`diff-row-${status}-${row.id}`"
                @click="toggle(row.key)"
              >
                <span class="diff-status-dot" :style="{ background: DIFF_TINTS[status] }" />
                <span class="diff-row-title">{{ rowTitle(row) }}</span>
                <span class="diff-row-toggle">{{ expanded.has(row.key) ? '▾' : '▸' }}</span>
              </button>
              <div v-if="expanded.has(row.key)" class="diff-facets">
                <div v-if="row.move" class="diff-facet">
                  <span class="facet-aspect">anchor</span>
                  <span class="facet-before">{{ row.move.from }}</span>
                  <span class="facet-arrow">→</span>
                  <span class="facet-after">{{ row.move.to }}</span>
                </div>
                <div v-for="f in row.facets" :key="f.aspect" class="diff-facet">
                  <span class="facet-aspect">{{ f.aspect }}</span>
                  <span class="facet-before">{{ f.before ?? '—' }}</span>
                  <span class="facet-arrow">→</span>
                  <span class="facet-after">{{ f.after ?? '—' }}</span>
                </div>
              </div>
            </div>
          </div>
        </template>

        <div v-if="view.mappings.added.length || view.mappings.removed.length || view.mappings.changed.length" class="diff-group">
          <div class="diff-group-header">mappings</div>
          <div v-for="m in view.mappings.added" :key="`+${m.source}${m.target}`" class="diff-mapping added">
            + {{ m.source }} ⇒ {{ m.target }}
          </div>
          <div v-for="m in view.mappings.removed" :key="`-${m.source}${m.target}`" class="diff-mapping removed">
            − {{ m.source }} ⇒ {{ m.target }}
          </div>
          <div v-for="m in view.mappings.changed" :key="`~${m.source}${m.target}`" class="diff-mapping changed">
            ~ {{ m.source }} ⇒ {{ m.target }} ({{ m.aspects.join(', ') }})
          </div>
          <div v-for="c in view.mappings.coverageDelta" :key="`${c.namespace}${c.component}`" class="diff-mapping coverage">
            coverage {{ c.namespace }}#{{ c.component }}: {{ c.from }} → {{ c.to }}
          </div>
        </div>

        <div v-if="view.rows.length === 0 && !view.mappings.added.length && !view.mappings.removed.length" class="diff-identical">
          the two versions are identical
        </div>
      </div>

      <div class="diff-canvas">
        <div class="pane-label">the working model, tinted by status</div>
        <ProcessCanvas :model="props.model" mode="select" :tint-of="tintOf" :tooltip-of="tooltipOf" />
      </div>
    </div>

    <div v-else class="diff-empty">
      <p>Load a second version (.prl) to compare against the working model.</p>
      <p class="hint">The comparison is the kernel's model-diff: added / removed / changed / moved per element, facet-level before/after, plus the mapping diff.</p>
    </div>
  </div>
</template>

<style scoped>
.diff-view { height: 100%; display: flex; flex-direction: column; overflow: hidden; }
.diff-toolbar {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.5rem 0.75rem;
  border-bottom: 1px solid var(--border);
}
.diff-side {
  font-family: var(--font-mono);
  font-size: 0.72rem;
  color: var(--accent);
  border: 1px solid var(--accent-glow);
  background: var(--accent-soft);
  border-radius: var(--radius-sm);
  padding: 0.15rem 0.5rem;
  max-width: 16rem;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.diff-btn {
  padding: 0.25rem 0.65rem;
  background: var(--bg-elevated);
  border: 1px solid var(--border);
  color: var(--text-soft);
  border-radius: var(--radius-sm);
  cursor: pointer;
  font-size: 0.72rem;
}
.diff-btn:disabled { opacity: 0.4; }
.diff-error { color: #b85555; font-size: 0.72rem; }
.diff-summary {
  margin-left: auto;
  font-family: var(--font-mono);
  font-size: 0.68rem;
  color: var(--text-muted);
}
.diff-body {
  flex: 1;
  display: grid;
  grid-template-columns: 1fr 1fr;
  min-height: 0;
}
.diff-lists {
  overflow-y: auto;
  padding: 0.5rem 0.75rem;
  border-right: 1px solid var(--border);
}
.diff-group { margin-bottom: 0.8rem; }
.diff-group-header {
  font-family: var(--font-mono);
  font-size: 0.6rem;
  text-transform: uppercase;
  letter-spacing: 0.12em;
  padding: 0.2rem 0;
  border-bottom: 1px solid var(--border);
  margin-bottom: 0.25rem;
}
.diff-row {
  display: flex;
  align-items: center;
  gap: 0.45rem;
  width: 100%;
  text-align: left;
  background: none;
  border: 1px solid transparent;
  border-radius: var(--radius-sm);
  cursor: pointer;
  padding: 0.25rem 0.4rem;
}
.diff-row:hover { background: var(--bg-elevated); }
.diff-status-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  flex-shrink: 0;
}
.diff-row-title {
  font-family: var(--font-mono);
  font-size: 0.72rem;
  color: var(--text);
  flex: 1;
}
.diff-row-toggle { color: var(--text-faint); font-size: 0.62rem; }
.diff-facets {
  margin: 0.15rem 0 0.4rem 1.2rem;
  border-left: 2px solid var(--border);
  padding-left: 0.6rem;
}
.diff-facet {
  display: grid;
  grid-template-columns: 6rem 1fr auto 1fr;
  gap: 0.4rem;
  align-items: baseline;
  padding: 0.12rem 0;
  font-size: 0.66rem;
}
.facet-aspect {
  font-family: var(--font-mono);
  color: var(--text-faint);
}
.facet-before, .facet-after {
  font-family: var(--font-mono);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.facet-before { color: #b85555; }
.facet-after { color: var(--sage); }
.facet-arrow { color: var(--text-faint); }
.diff-mapping {
  font-family: var(--font-mono);
  font-size: 0.68rem;
  padding: 0.15rem 0;
}
.diff-mapping.added { color: var(--sage); }
.diff-mapping.removed { color: #b85555; }
.diff-mapping.changed { color: #d49442; }
.diff-mapping.coverage { color: var(--text-muted); }
.diff-identical {
  padding: 2rem;
  text-align: center;
  color: var(--text-muted);
  font-style: italic;
}
.diff-canvas {
  display: flex;
  flex-direction: column;
  min-height: 0;
}
.pane-label {
  padding: 0.35rem 0.65rem;
  font-family: var(--font-mono);
  font-size: 0.6rem;
  text-transform: uppercase;
  letter-spacing: 0.12em;
  color: var(--text-faint);
  border-bottom: 1px solid var(--border);
}
.diff-empty {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  color: var(--text-muted);
  text-align: center;
  padding: 2rem;
}
.diff-empty .hint { font-size: 0.78rem; font-style: italic; max-width: 34rem; }
</style>
