<script setup lang="ts">
// ─────────────────────────────────────────────────────────────────────
// The mapper (TODO.editor/07) — the MMEL extension's MappingsCanvus,
// on the v3 MapProfile: REF model left, IMP model right, click-pair
// to map, the overlay edges between them, the pair dialog for meta,
// the party lists below. Every pair is a command on the IMP model's
// mapProfiles — undo/redo works, the dump serializes the profile.
// ─────────────────────────────────────────────────────────────────────
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue';
import type { Standard } from '@primmel/primmel';
import ProcessCanvas from '../ProcessCanvas.vue';
import MapPairDialog from './MapPairDialog.vue';
import MapPartyList from './MapPartyList.vue';
import CoverageLegend from './CoverageLegend.vue';
import ProfileSwitcher from './ProfileSwitcher.vue';
import DocumentView from './DocumentView.vue';
import AutoMapPanel from './AutoMapPanel.vue';
import { allPairs, profileFor, splitTargetRef, targetRef } from '../../lib/mapper';
import { badgeMap } from '../../lib/multi-map';
import { COVERAGE_TINTS, coverageTooltip, coverageView, type CoverageView } from '../../lib/coverage';
import {
  createMappingPair, deleteMappingPair, updateMappingMeta,
} from '../../lib/commands';
import { useModelStore } from '../../stores/model';
import { useMappingStore } from '../../stores/mapping';
import { useUiStore } from '../../stores/ui';

const props = defineProps<{ implementationModel: Standard }>();
const modelStore = useModelStore();
const mapping = useMappingStore();
const ui = useUiStore();

// ── The reference side ───────────────────────────────────────────────
const refModel = computed(() => mapping.refModel);
const namespace = computed(() => mapping.refNamespace());
const profile = computed(() => {
  void modelStore.version;
  return namespace.value ? profileFor(props.implementationModel, namespace.value) : null;
});

// ── The coverage overlay (the KERNEL's calculus, bridged) ────────────
const coverage = computed<CoverageView | null>(() => {
  void modelStore.version;
  if (mapping.docMode) return null; // a document has no process tree
  if (!refModel.value || !namespace.value) return null;
  return coverageView(props.implementationModel, refModel.value, namespace.value);
});

const CONFLICT_TINT = '#b85555';

function refTint(id: string): string | null {
  const row = coverage.value?.ref.get(id);
  if (!row) return null;
  return row.conflict ? CONFLICT_TINT : COVERAGE_TINTS[row.computed];
}

function refTooltip(id: string): string | null {
  const row = coverage.value?.ref.get(id);
  return row ? coverageTooltip(row) : null;
}

function impTint(id: string): string | null {
  const mapped = coverage.value?.impMapped.get(id);
  if (mapped === undefined) return null;
  return mapped ? COVERAGE_TINTS.full : COVERAGE_TINTS.none;
}

function impTooltip(id: string): string | null {
  const mapped = coverage.value?.impMapped.get(id);
  if (mapped === undefined) return null;
  return mapped ? 'mapped (a resolving pair exists)' : 'unmapped';
}

/** The cross-profile badges: every namespace an IMP element maps into. */
const impBadges = computed(() => {
  void modelStore.version;
  const map = badgeMap(props.implementationModel);
  return (id: string) => map.get(id) ?? [];
});

function loadReference() {
  const input = document.createElement('input');
  input.type = 'file';
  input.accept = '.prl,.txt';
  input.onchange = () => {
    const file = input.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => mapping.loadRefText(reader.result as string);
    reader.readAsText(file);
  };
  input.click();
}

function loadDocumentFile() {
  const input = document.createElement('input');
  input.type = 'file';
  input.accept = '.xml,.txt,.md';
  input.onchange = () => {
    const file = input.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => mapping.loadDocumentText(reader.result as string);
    reader.readAsText(file);
  };
  input.click();
}

// ── The pick flow (click one side, then the other) ───────────────────
function onPick(side: 'ref' | 'imp', id: string) {
  const prev = mapping.picked;
  if (!prev || prev.side === side) {
    mapping.picked = { side, id };
    return;
  }
  const impId = side === 'imp' ? id : prev.id;
  const refId = side === 'ref' ? id : prev.id;
  mapping.picked = null;
  // A pair that already exists opens for editing, never a duplicate.
  const existing = profile.value?.mappings[impId]?.find(
    p => p.target === targetRef(namespace.value!, refId),
  );
  editing.value = existing
    ? { description: existing.description, justification: existing.justification, coverage: existing.coverage }
    : null;
  mapping.pairDraft = { impId, refId };
}

function onEditPair(impId: string, refId: string) {
  const existing = profile.value?.mappings[impId]?.find(
    p => p.target === targetRef(namespace.value!, refId),
  );
  if (!existing) return;
  editing.value = {
    description: existing.description,
    justification: existing.justification,
    coverage: existing.coverage,
  };
  mapping.pairDraft = { impId, refId };
}

// ── The pair dialog ──────────────────────────────────────────────────
const editing = ref<{ description: string; justification: string; coverage: '' | 'full' | 'minimal' | 'partial' | 'none' } | null>(null);

function onPairConfirm(meta: { description: string; justification: string; coverage: '' | 'full' | 'minimal' | 'partial' | 'none' }) {
  const draft = mapping.pairDraft;
  const ns = namespace.value;
  if (!draft || !ns) return;
  const target = targetRef(ns, draft.refId);
  if (editing.value) {
    modelStore.execute(updateMappingMeta(ns, draft.impId, target, meta));
  } else {
    modelStore.execute(createMappingPair(ns, draft.impId, target, meta));
  }
  mapping.pairDraft = null;
  editing.value = null;
}

function onPairDelete() {
  const draft = mapping.pairDraft;
  const ns = namespace.value;
  if (!draft || !ns) return;
  modelStore.execute(deleteMappingPair(ns, draft.impId, targetRef(ns, draft.refId)));
  mapping.pairDraft = null;
  editing.value = null;
}

// ── The overlay edges (measured from the rendered node DOM) ──────────
interface OverlayEdge {
  key: string;
  impId: string;
  refId: string;
  x1: number; y1: number; x2: number; y2: number;
}

const container = ref<HTMLElement | null>(null);
const refPane = ref<HTMLElement | null>(null);
const impPane = ref<HTMLElement | null>(null);
const overlayEdges = ref<OverlayEdge[]>([]);

function centerOf(pane: HTMLElement | null, nodeId: string, base: DOMRect): { x: number; y: number } | null {
  const el = pane?.querySelector(`[data-node-id="${CSS.escape(nodeId)}"]`);
  if (!el) return null;
  const r = el.getBoundingClientRect();
  return { x: r.left + r.width / 2 - base.left, y: r.top + r.height / 2 - base.top };
}

async function measure() {
  await nextTick();
  const base = container.value?.getBoundingClientRect();
  if (!base || !profile.value) {
    overlayEdges.value = [];
    return;
  }
  const out: OverlayEdge[] = [];
  for (const { source, pair } of allPairs(profile.value)) {
    const refId = splitTargetRef(pair.target)?.id;
    if (!refId) continue;
    const a = centerOf(refPane.value, refId, base);
    const b = centerOf(impPane.value, source, base);
    if (!a || !b) continue; // one end is on another page — the edge sleeps
    out.push({ key: `${source}⇒${pair.target}`, impId: source, refId, x1: a.x, y1: a.y, x2: b.x, y2: b.y });
  }
  overlayEdges.value = out;
}

watch(
  () => [modelStore.version, ui.panX, ui.panY, ui.zoom, mapping.refModel, mapping.document, mapping.docMode, ui.activeCanvasId],
  measure,
  { deep: false },
);
onMounted(() => {
  measure();
  window.addEventListener('resize', measure);
});
onBeforeUnmount(() => window.removeEventListener('resize', measure));

function edgePath(e: OverlayEdge): string {
  const mx = (e.x1 + e.x2) / 2;
  return `M ${e.x1} ${e.y1} C ${mx} ${e.y1}, ${mx} ${e.y2}, ${e.x2} ${e.y2}`;
}

const hoveredEdge = ref<string | null>(null);
</script>

<template>
  <div class="mapper" ref="container">
    <ProfileSwitcher />

    <div class="mapper-toolbar">
      <button class="mapper-btn" data-testid="load-ref" @click="loadReference">
        {{ refModel ? 'load another reference' : 'load reference model' }}
      </button>
      <button class="mapper-btn" data-testid="load-doc" @click="loadDocumentFile">load document</button>
      <span v-if="namespace" class="mapper-ns" data-testid="ref-namespace">{{ namespace }}</span>
      <button
        v-if="mapping.docMode"
        class="mapper-btn"
        data-testid="clear-doc"
        @click="mapping.clearDocument()"
      >close document</button>
      <span class="mapper-hint" v-if="namespace">
        click an element on one side, then its partner on the other
      </span>
      <span v-if="mapping.picked" class="mapper-picked" data-testid="picked">
        picked: {{ mapping.picked.id }} ({{ mapping.picked.side }})
      </span>
    </div>

    <div v-if="mapping.lastSeed" class="seed-review" data-testid="seed-review">
      <span class="seed-review-title">
        seeded {{ mapping.lastSeed.toNs }} from {{ mapping.lastSeed.fromNs }}:
        {{ mapping.lastSeed.outcome.carried }} carried,
        {{ mapping.lastSeed.outcome.review.length }} to review
      </span>
      <ul v-if="mapping.lastSeed.outcome.review.length" class="seed-review-list">
        <li v-for="r in mapping.lastSeed.outcome.review" :key="r">{{ r }}</li>
      </ul>
      <button class="seed-review-dismiss" data-testid="seed-review-dismiss" @click="mapping.lastSeed = null">dismiss</button>
    </div>

    <div v-if="mapping.parseError" class="mapper-error" data-testid="ref-parse-error">{{ mapping.parseError }}</div>

    <CoverageLegend v-if="refModel && !mapping.docMode" />

    <AutoMapPanel
      v-if="refModel && !mapping.docMode && namespace"
      :implementation-model="implementationModel"
      :reference-model="refModel"
      :namespace="namespace"
    />

    <div v-if="mapping.docMode && mapping.document" class="mapper-body">
      <div class="mapper-pane" ref="refPane" data-testid="ref-pane">
        <div class="pane-label">document — {{ namespace }}</div>
        <DocumentView
          :document="mapping.document"
          :profile="profile"
          :picked-id="mapping.picked?.side === 'ref' ? mapping.picked.id : null"
          @pick="onPick('ref', $event)"
        />
      </div>

      <div class="mapper-pane" ref="impPane" data-testid="imp-pane">
        <div class="pane-label">implementation — {{ implementationModel.meta.namespace }}</div>
        <ProcessCanvas
          :model="implementationModel"
          mode="select"
          :selected-id="mapping.picked?.side === 'imp' ? mapping.picked.id : null"
          :tint-of="impTint"
          :tooltip-of="impTooltip"
          @node-select="onPick('imp', $event)"
        />
      </div>

      <svg class="mapper-overlay" data-testid="map-overlay">
        <path
          v-for="e in overlayEdges"
          :key="e.key"
          :d="edgePath(e)"
          class="map-edge"
          :class="{ hovered: hoveredEdge === e.key }"
          :data-testid="`map-edge-${e.impId}`"
          fill="none"
          @mouseenter="hoveredEdge = e.key"
          @mouseleave="hoveredEdge = null"
          @click="onEditPair(e.impId, e.refId)"
        />
      </svg>
    </div>

    <div v-else-if="refModel" class="mapper-body">
      <div class="mapper-pane" ref="refPane" data-testid="ref-pane">
        <div class="pane-label">reference — {{ namespace }}</div>
        <ProcessCanvas
          :model="refModel"
          mode="select"
          :selected-id="mapping.picked?.side === 'ref' ? mapping.picked.id : null"
          :tint-of="refTint"
          :tooltip-of="refTooltip"
          @node-select="onPick('ref', $event)"
        />
      </div>

      <div class="mapper-pane" ref="impPane" data-testid="imp-pane">
        <div class="pane-label">implementation — {{ implementationModel.meta.namespace }}</div>
        <ProcessCanvas
          :model="implementationModel"
          mode="select"
          :selected-id="mapping.picked?.side === 'imp' ? mapping.picked.id : null"
          :tint-of="impTint"
          :tooltip-of="impTooltip"
          @node-select="onPick('imp', $event)"
        />
      </div>

      <svg class="mapper-overlay" data-testid="map-overlay">
        <path
          v-for="e in overlayEdges"
          :key="e.key"
          :d="edgePath(e)"
          class="map-edge"
          :class="{ hovered: hoveredEdge === e.key }"
          :data-testid="`map-edge-${e.impId}`"
          fill="none"
          @mouseenter="hoveredEdge = e.key"
          @mouseleave="hoveredEdge = null"
          @click="onEditPair(e.impId, e.refId)"
        />
      </svg>
    </div>

    <div v-if="refModel || (mapping.docMode && mapping.document)" class="mapper-parties">
      <div class="party-col" v-if="!mapping.docMode && refModel">
        <div class="party-col-label">reference</div>
        <MapPartyList
          side="target"
          :model="refModel"
          :profile="profile"
          @pick="onPick('ref', $event)"
          @edit-pair="onEditPair"
        />
      </div>
      <div class="party-col" :class="{ 'party-col-wide': mapping.docMode }">
        <div class="party-col-label">implementation</div>
        <MapPartyList
          side="source"
          :model="implementationModel"
          :profile="profile"
          :badges-of="impBadges"
          @pick="onPick('imp', $event)"
          @edit-pair="onEditPair"
        />
      </div>
    </div>

    <div v-else class="mapper-empty">
      <p>Load a reference model (.prl) or a document (.xml) to start mapping.</p>
      <p class="hint">The reference is the standard being adopted; the implementation is the working model. Pairs land in the implementation's <code>map_profile</code>.</p>
    </div>

    <MapPairDialog
      v-if="mapping.pairDraft"
      :imp-id="mapping.pairDraft.impId"
      :ref-id="mapping.pairDraft.refId"
      :existing="editing"
      @confirm="onPairConfirm"
      @delete="onPairDelete"
      @cancel="mapping.pairDraft = null; editing = null"
    />
  </div>
</template>

<style scoped>
.mapper {
  position: relative;
  height: 100%;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}
.mapper-toolbar {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.5rem 0.75rem;
  border-bottom: 1px solid var(--border);
}
.mapper-btn {
  padding: 0.25rem 0.65rem;
  background: var(--bg-elevated);
  border: 1px solid var(--border);
  color: var(--text-soft);
  border-radius: var(--radius-sm);
  cursor: pointer;
  font-size: 0.72rem;
}
.mapper-btn:hover { border-color: var(--accent); color: var(--accent); }
.mapper-ns {
  font-family: var(--font-mono);
  font-size: 0.72rem;
  color: var(--accent);
  border: 1px solid var(--accent-glow);
  background: var(--accent-soft);
  border-radius: var(--radius-sm);
  padding: 0.15rem 0.5rem;
}
.mapper-hint {
  font-size: 0.7rem;
  color: var(--text-faint);
  font-style: italic;
  margin-left: auto;
}
.mapper-picked {
  font-family: var(--font-mono);
  font-size: 0.7rem;
  color: var(--accent);
}
.mapper-error {
  padding: 0.4rem 0.75rem;
  color: #b85555;
  font-family: var(--font-mono);
  font-size: 0.72rem;
}
.mapper-body {
  flex: 1;
  display: grid;
  grid-template-columns: 1fr 1fr;
  min-height: 0;
  position: relative;
}
.mapper-pane {
  display: flex;
  flex-direction: column;
  min-height: 0;
  border-right: 1px solid var(--border);
}
.mapper-pane:last-child { border-right: none; }
.pane-label {
  padding: 0.35rem 0.65rem;
  font-family: var(--font-mono);
  font-size: 0.6rem;
  text-transform: uppercase;
  letter-spacing: 0.12em;
  color: var(--text-faint);
  border-bottom: 1px solid var(--border);
}
.mapper-overlay {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  pointer-events: none;
  z-index: 10;
}
.map-edge {
  stroke: var(--accent);
  stroke-width: 2;
  opacity: 0.55;
  pointer-events: stroke;
  cursor: pointer;
}
.map-edge.hovered { opacity: 1; stroke-width: 3; }
.mapper-parties {
  height: 180px;
  display: grid;
  grid-template-columns: 1fr 1fr;
  border-top: 1px solid var(--border);
  min-height: 0;
}
.party-col {
  display: flex;
  flex-direction: column;
  min-height: 0;
  border-right: 1px solid var(--border);
}
.party-col:last-child { border-right: none; }
.party-col-wide { grid-column: span 2; }
.party-col-label {
  padding: 0.3rem 0.65rem;
  font-family: var(--font-mono);
  font-size: 0.58rem;
  text-transform: uppercase;
  letter-spacing: 0.12em;
  color: var(--text-faint);
  border-bottom: 1px solid var(--border);
}
.mapper-empty {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  color: var(--text-muted);
  text-align: center;
  padding: 2rem;
}
.mapper-empty .hint { font-size: 0.78rem; font-style: italic; max-width: 34rem; }
.seed-review {
  padding: 0.4rem 0.75rem;
  border-bottom: 1px solid var(--border);
  font-size: 0.72rem;
  color: var(--text-muted);
  display: flex;
  align-items: flex-start;
  gap: 0.6rem;
}
.seed-review-title { font-weight: 600; white-space: nowrap; }
.seed-review-list {
  margin: 0;
  padding-left: 1rem;
  font-family: var(--font-mono);
  font-size: 0.66rem;
  color: var(--text-faint);
  max-height: 5rem;
  overflow-y: auto;
  flex: 1;
}
.seed-review-dismiss {
  border: 1px solid var(--border);
  background: var(--bg-elevated);
  color: var(--text-muted);
  border-radius: var(--radius-sm);
  cursor: pointer;
  font-size: 0.64rem;
  padding: 0.15rem 0.5rem;
}
</style>
