<script setup lang="ts">
import { computed, ref } from 'vue';
import type { Standard } from '@primmel/primmel';
import {
  extractCanvas, renderCanvas, bezierPath,
  nodeShape, nodeColor, NODE_SIZE,
  type RenderNode,
} from '../lib/render';
import { canConnect, mintEdgeId, pageForNode, type ConnectionError } from '../lib/edges';
import { pagePath } from '../lib/pages';
import {
  createEdge, removeEdge, updateComponentPosition,
} from '../lib/commands';
import { createFromPalette, type PaletteKind } from '../lib/factory';
import { useModelStore } from '../stores/model';
import { useUiStore } from '../stores/ui';

const props = withDefaults(defineProps<{
  model: Standard;
  /** edit = the model workspace; select = read+pick (the mapper). */
  mode?: 'edit' | 'select';
  /** The externally-driven selection highlight (select mode). */
  selectedId?: string | null;
  /** Per-node glow tint (the coverage overlay) — null = untinted. */
  tintOf?: ((id: string) => string | null) | null;
  /** Per-node tooltip (the coverage basis / conflict). */
  tooltipOf?: ((id: string) => string | null) | null;
}>(), { mode: 'edit', selectedId: null, tintOf: null, tooltipOf: null });

const emit = defineEmits<{
  /** Select mode: a node was picked (the mapper pairs on this). */
  (e: 'nodeSelect', id: string): void;
}>();

const ui = useUiStore();
const modelStore = useModelStore();

// ── The active page (select mode navigates LOCALLY — two mapper
//    canvases must not share the ui store's page) ─────────────────────
const localPage = ref<string | null>(null);
const activePageId = computed(() => props.mode === 'select' ? localPage.value : ui.activeCanvasId);

function gotoPage(id: string) {
  if (props.mode === 'select') localPage.value = id;
  else ui.setCanvas(id);
}

// ── View state ───────────────────────────────────────────────────────
const isPanning = ref(false);
const panStart = ref({ x: 0, y: 0, panX: 0, panY: 0 });
const draggingNode = ref<RenderNode | null>(null);
const dragOffset = ref({ x: 0, y: 0 });

// ── Edge connect state (port-to-port) ────────────────────────────────
const connectFrom = ref<RenderNode | null>(null);
const connectMouse = ref<{ x: number; y: number } | null>(null);

// ── Edge selection + condition editing ───────────────────────────────
const selectedEdgeId = ref<string | null>(null);
const edgeCondition = ref('');

const canvas = computed(() => {
  void modelStore.version;
  return extractCanvas(props.model, activePageId.value);
});
const rendered = computed(() => {
  void modelStore.version;
  const z = ui.zoom;
  return renderCanvas(props.model, canvas.value, {
    x: -ui.panX / z - 400 / z,
    y: -ui.panY / z - 300 / z,
    w: 800 / z,
    h: 600 / z,
  });
});

const viewBox = computed(() => {
  const z = ui.zoom;
  return `${-ui.panX / z} ${-ui.panY / z} ${800 / z} ${600 / z}`;
});

// ── The breadcrumb (root / … / current page — the page tree's path) ─
const breadcrumb = computed(() => {
  void modelStore.version;
  const current = canvas.value?.id;
  if (!current) return [];
  const path = pagePath(props.model, current) ?? [current];
  // At the root the path is the single crumb — no breadcrumb to show.
  return path.length > 1 ? path : [];
});

// ── Pan/zoom/drag ────────────────────────────────────────────────────
function onCanvasMouseDown(e: MouseEvent) {
  const target = e.target as Element;
  if (target.tagName === 'svg' || target.getAttribute('data-bg')) {
    if (selectedEdgeId.value) {
      selectedEdgeId.value = null;
      return;
    }
    isPanning.value = true;
    panStart.value = { x: e.clientX, y: e.clientY, panX: ui.panX, panY: ui.panY };
  }
}

function worldPoint(e: MouseEvent): { x: number; y: number } {
  const rect = (e.currentTarget as SVGElement).getBoundingClientRect();
  const z = ui.zoom;
  return {
    x: (e.clientX - rect.left + ui.panX) / z - 400 / z,
    y: (e.clientY - rect.top + ui.panY) / z - 300 / z,
  };
}

function onMouseMove(e: MouseEvent) {
  if (connectFrom.value) {
    connectMouse.value = worldPoint(e);
    return;
  }
  if (draggingNode.value) {
    const p = worldPoint(e);
    draggingNode.value.x = p.x - dragOffset.value.x;
    draggingNode.value.y = p.y - dragOffset.value.y;
  } else if (isPanning.value) {
    const dx = e.clientX - panStart.value.x;
    const dy = e.clientY - panStart.value.y;
    ui.panX = panStart.value.panX + dx;
    ui.panY = panStart.value.panY + dy;
  }
}

function onMouseUp() {
  if (connectFrom.value) {
    connectFrom.value = null;
    connectMouse.value = null;
  }
  if (draggingNode.value) commitDrag();
  isPanning.value = false;
  draggingNode.value = null;
}

function onWheel(e: WheelEvent) {
  e.preventDefault();
  const delta = e.deltaY > 0 ? 0.9 : 1.1;
  ui.setZoom(ui.zoom * delta);
}

// ── Node interactions ────────────────────────────────────────────────
function onNodeClick(node: RenderNode) {
  if (props.mode === 'select') {
    emit('nodeSelect', node.id);
    return;
  }
  if (connectFrom.value) {
    finishConnect(node);
    return;
  }
  ui.select(node.id, selectionTypeOf(node));
}

/** Release over a node completes the shift+drag connect. */
function onNodeMouseUp(node: RenderNode) {
  if (props.mode !== 'edit') return;
  if (connectFrom.value) finishConnect(node);
}

function onNodeDoubleClick(node: RenderNode) {
  // Descend into a subprocess page (the MMEL's drill-down).
  const pageId = pageForNode(props.model, node.id);
  if (pageId) gotoPage(pageId);
}

function onNodeMouseDown(e: MouseEvent, node: RenderNode) {
  e.stopPropagation();
  if (props.mode === 'select') return; // pick happens on click
  if (e.shiftKey) {
    // Shift+drag = connect (the port-to-port edge creation).
    connectFrom.value = node;
    connectMouse.value = worldPoint(e);
    return;
  }
  draggingNode.value = node;
  const p = worldPoint(e);
  dragOffset.value = { x: p.x - node.x, y: p.y - node.y };
  ui.select(node.id, selectionTypeOf(node));
}

function selectionTypeOf(node: RenderNode) {
  switch (node.kind) {
    case 'process': return 'process' as const;
    case 'approval': return 'approval' as const;
    case 'subprocess': return 'subprocess' as const;
    case 'dataclass': return 'dataclass' as const;
    case 'exclusive_gateway':
    case 'parallel_gateway': return 'gateway' as const;
    default: return 'event' as const;
  }
}

// ── Connect refusals (the discipline, said out loud) ─────────────────
const REFUSAL_TEXT: Record<ConnectionError, string> = {
  'same-node': 'A node cannot connect to itself.',
  'endpoint-missing': 'That element is not on this page.',
  'duplicate-edge': 'Those nodes are already connected.',
  'cross-page': 'Edges cannot cross pages — link through the subprocess node.',
};

const refusal = ref<string | null>(null);
let refusalTimer: ReturnType<typeof setTimeout> | undefined;

function refuse(reason: ConnectionError) {
  refusal.value = REFUSAL_TEXT[reason];
  clearTimeout(refusalTimer);
  refusalTimer = setTimeout(() => { refusal.value = null; }, 2600);
}

function finishConnect(target: RenderNode) {
  const from = connectFrom.value;
  connectFrom.value = null;
  connectMouse.value = null;
  if (!from || !canvas.value) return;
  const verdict = canConnect(canvas.value, from.id, target.id, '', props.model);
  if (!verdict.ok) {
    refuse(verdict.reason);
    return;
  }
  const pageId = canvas.value.id;
  modelStore.execute(createEdge(pageId, mintEdgeId(canvas.value), from.id, target.id));
}

function commitDrag() {
  if (!draggingNode.value || !canvas.value) return;
  const node = draggingNode.value;
  modelStore.execute(updateComponentPosition(canvas.value.id, node.id, node.x, node.y));
}

// ── Edge interactions ────────────────────────────────────────────────
function onEdgeClick(edgeId: string) {
  if (props.mode !== 'edit') return;
  selectedEdgeId.value = edgeId;
  const edge = canvas.value?.edges.find(e => e.id === edgeId);
  edgeCondition.value = edge?.condition ?? '';
}

function onEdgeDoubleClick(edgeId: string) {
  if (props.mode !== 'edit') return;
  if (!canvas.value) return;
  modelStore.execute(removeEdge(canvas.value.id, edgeId));
  selectedEdgeId.value = null;
}

function applyEdgeCondition() {
  const edge = canvas.value?.edges.find(e => e.id === selectedEdgeId.value);
  if (!edge || !canvas.value) return;
  edge.condition = edgeCondition.value;
  modelStore.version++;
}

// ── Palette drops (TODO.editor/03) ───────────────────────────────────
function onPaletteDrop(e: DragEvent) {
  e.preventDefault();
  if (props.mode !== 'edit') return;
  const payload = e.dataTransfer?.getData('application/x-primmel-palette');
  if (!payload || !canvas.value) return;
  const entry = JSON.parse(payload) as PaletteKind;
  const p = worldPoint(e as unknown as MouseEvent);
  modelStore.execute(createFromPalette(props.model, entry, p, canvas.value.id));
}

function onPaletteDragOver(e: DragEvent) {
  if (props.mode !== 'edit') return;
  if (e.dataTransfer?.types.includes('application/x-primmel-palette')) {
    e.preventDefault();
  }
}

/** Click-to-add (the palette's click path): create at the viewport
 *  center of the current page. */
function paletteAdd(entry: PaletteKind) {
  if (!canvas.value) return;
  const z = ui.zoom;
  const center = { x: (400 - ui.panX) / z - 400 / z + 300, y: (300 - ui.panY) / z - 300 / z + 200 };
  modelStore.execute(createFromPalette(props.model, entry, center, canvas.value.id));
}

defineExpose({ paletteAdd });

function nodeTransform(node: RenderNode): string {
  return `translate(${node.x} ${node.y})`;
}

function labelText(node: RenderNode): string {
  const maxLen = node.kind === 'process' ? 18 : 10;
  return node.label.length > maxLen ? node.label.slice(0, maxLen) + '…' : node.label;
}

const nodeColors: Record<string, { fill: string; stroke: string }> = {
  start_event: { fill: 'rgba(122, 158, 94, 0.15)', stroke: '#7a9e5e' },
  end_event: { fill: 'rgba(184, 85, 85, 0.15)', stroke: '#b85555' },
  timer_event: { fill: 'rgba(212, 148, 66, 0.15)', stroke: '#d49442' },
  signal_event: { fill: 'rgba(108, 99, 166, 0.15)', stroke: '#6c63a6' },
  process: { fill: 'rgba(212, 148, 66, 0.08)', stroke: '#d49442' },
  approval: { fill: 'rgba(184, 85, 85, 0.12)', stroke: '#b85555' },
  exclusive_gateway: { fill: 'rgba(184, 85, 85, 0.12)', stroke: '#c47550' },
  parallel_gateway: { fill: 'rgba(122, 158, 94, 0.12)', stroke: '#8a7e5e' },
  dataclass: { fill: 'rgba(47, 125, 107, 0.12)', stroke: '#2f7d6b' },
  subprocess: { fill: 'rgba(91, 107, 192, 0.10)', stroke: '#5b6bc0' },
};
</script>

<template>
  <div class="canvas-container">
    <div class="canvas-tabs" v-if="model.pages.length > 1">
      <button
        v-for="page in model.pages"
        :key="page.id"
        class="canvas-tab"
        :class="{ active: page.id === canvas?.id }"
        @click="gotoPage(page.id)"
      >
        {{ page.id }}
      </button>
    </div>

    <div v-if="breadcrumb.length" class="canvas-breadcrumb" data-testid="canvas-breadcrumb">
      <template v-for="(crumb, i) in breadcrumb" :key="crumb">
        <span v-if="i > 0" class="crumb-sep">/</span>
        <button v-if="i < breadcrumb.length - 1" class="crumb-link" @click="gotoPage(crumb)">{{ crumb }}</button>
        <span v-else class="crumb-current">{{ crumb }}</span>
      </template>
    </div>

    <svg
      class="canvas-svg"
      :viewBox="viewBox"
      @mousedown="onCanvasMouseDown"
      @mousemove="onMouseMove"
      @mouseup="onMouseUp"
      @mouseleave="onMouseUp"
      @wheel.prevent="onWheel"
      @drop="onPaletteDrop"
      @dragover="onPaletteDragOver"
    >
      <defs>
        <pattern id="grid" width="24" height="24" patternUnits="userSpaceOnUse">
          <circle cx="0.5" cy="0.5" r="0.5" fill="var(--text-faint)" opacity="0.3" />
        </pattern>
        <marker id="arrowhead" markerWidth="8" markerHeight="6" refX="7" refY="3" orient="auto">
          <polygon points="0 0, 8 3, 0 6" fill="var(--text-muted)" />
        </marker>
      </defs>

      <rect data-bg="true" :x="-5000" :y="-5000" :width="10000" :height="10000" fill="url(#grid)" />

      <g v-for="edge in rendered.edges" :key="edge.id" class="edge-group"
         :class="{ selected: selectedEdgeId === edge.id }"
         @click.stop="onEdgeClick(edge.id)"
         @dblclick.stop="onEdgeDoubleClick(edge.id)">
        <path
          :d="bezierPath(edge.from, edge.to)"
          fill="none"
          :stroke="selectedEdgeId === edge.id ? 'var(--accent)' : 'var(--text-muted)'"
          :stroke-width="selectedEdgeId === edge.id ? 2.5 : 1.5"
          :stroke-dasharray="edge.isDataLink ? '6 4' : undefined"
          marker-end="url(#arrowhead)"
          :opacity="selectedEdgeId === edge.id ? 1 : 0.6"
        />
        <text
          v-if="edge.condition"
          :x="(edge.from.x + edge.to.x) / 2"
          :y="(edge.from.y + edge.to.y) / 2 - 6"
          text-anchor="middle"
          class="edge-condition"
        >[{{ edge.condition }}]</text>
      </g>

      <!-- The in-flight connect line (shift+drag) -->
      <line
        v-if="connectFrom && connectMouse"
        :x1="connectFrom.x" :y1="connectFrom.y"
        :x2="connectMouse.x" :y2="connectMouse.y"
        stroke="var(--accent)" stroke-width="2" stroke-dasharray="5 4"
        marker-end="url(#arrowhead)"
      />

      <g
        v-for="node in rendered.nodes"
        :key="node.id + (node.isData ? ':data' : '')"
        :transform="nodeTransform(node)"
        :data-node-id="node.id"
        :style="tintOf?.(node.id) ? { filter: `drop-shadow(0 0 5px ${tintOf(node.id)})` } : undefined"
        :class="{ selected: mode === 'edit' ? ui.isSelected(node.id) : selectedId === node.id, dragging: draggingNode?.id === node.id, 'is-data': node.isData, 'connect-source': connectFrom?.id === node.id }"
        class="node-group"
        @click.stop="onNodeClick(node)"
        @dblclick.stop="onNodeDoubleClick(node)"
        @mousedown="onNodeMouseDown($event, node)"
        @mouseup.stop="onNodeMouseUp(node)"
      >
        <title v-if="tooltipOf?.(node.id)">{{ tooltipOf(node.id) }}</title>
        <rect
          v-if="nodeShape(node.kind) === 'rect'"
          :x="-NODE_SIZE/2" :y="-NODE_SIZE/2"
          :width="NODE_SIZE" :height="NODE_SIZE"
          rx="8"
          :fill="nodeColors[node.kind].fill"
          :stroke="nodeColors[node.kind].stroke"
          stroke-width="1.5"
        />
        <polygon
          v-else-if="nodeShape(node.kind) === 'diamond'"
          :points="`0,${-NODE_SIZE/2} ${NODE_SIZE/2},0 0,${NODE_SIZE/2} ${-NODE_SIZE/2},0`"
          :fill="nodeColors[node.kind].fill"
          :stroke="nodeColors[node.kind].stroke"
          stroke-width="1.5"
        />
        <g v-else-if="nodeShape(node.kind) === 'cylinder'">
          <ellipse :rx="NODE_SIZE/2" :ry="NODE_SIZE/5" :cy="-NODE_SIZE/2 + NODE_SIZE/10"
            :fill="nodeColors[node.kind].fill" :stroke="nodeColors[node.kind].stroke" stroke-width="1.5" />
          <path :d="`M ${-NODE_SIZE/2} ${-NODE_SIZE/2 + NODE_SIZE/10} v ${NODE_SIZE*0.8} a ${NODE_SIZE/2} ${NODE_SIZE/5} 0 0 0 ${NODE_SIZE} 0 v ${-NODE_SIZE*0.8}`"
            :fill="nodeColors[node.kind].fill" :stroke="nodeColors[node.kind].stroke" stroke-width="1.5" />
        </g>
        <rect
          v-else-if="nodeShape(node.kind) === 'frame'"
          :x="-NODE_SIZE/2" :y="-NODE_SIZE/2"
          :width="NODE_SIZE" :height="NODE_SIZE"
          rx="4"
          :fill="nodeColors[node.kind].fill"
          :stroke="nodeColors[node.kind].stroke"
          stroke-width="2"
          stroke-dasharray="8 3"
        />
        <circle
          v-else
          :r="NODE_SIZE / 2.5"
          :fill="nodeColors[node.kind].fill"
          :stroke="nodeColors[node.kind].stroke"
          :stroke-width="node.kind === 'end_event' ? 3 : 1.5"
        />
        <text y="4" text-anchor="middle" class="node-label">{{ labelText(node) }}</text>
      </g>
    </svg>

    <div class="canvas-controls">
      <button class="ctrl-btn" @click="ui.setZoom(ui.zoom * 1.2)" title="Zoom in">+</button>
      <span class="zoom-display">{{ Math.round(ui.zoom * 100) }}%</span>
      <button class="ctrl-btn" @click="ui.setZoom(ui.zoom / 1.2)" title="Zoom out">−</button>
      <button class="ctrl-btn reset" @click="ui.resetView()" title="Reset view">⟲</button>
    </div>

    <div v-if="selectedEdgeId" class="edge-editor" data-testid="edge-editor">
      <span class="edge-editor-title">{{ selectedEdgeId }}</span>
      <input
        v-model="edgeCondition"
        class="edge-condition-input"
        placeholder="condition (OCL, empty = default)"
        data-testid="edge-condition-input"
        @keyup.enter="applyEdgeCondition"
      />
      <button class="ctrl-btn" @click="applyEdgeCondition" title="Apply condition">✓</button>
      <button class="ctrl-btn" @click="onEdgeDoubleClick(selectedEdgeId)" title="Delete edge">✕</button>
    </div>

    <div class="canvas-hint" v-if="mode === 'edit' && !draggingNode && !connectFrom">
      <kbd>drag</kbd> nodes · <kbd>shift+drag</kbd> to connect · <kbd>dbl-click</kbd> to enter · <kbd>scroll</kbd> to zoom
    </div>

    <div v-if="refusal" class="canvas-refusal" data-testid="canvas-refusal">{{ refusal }}</div>

    <div v-if="!canvas" class="canvas-empty">
      No canvas in this model. Add a <code>canvas Root &#123; &#125;</code> block.
    </div>
  </div>
</template>

<style scoped>
.canvas-container {
  position: relative;
  height: 100%;
  overflow: hidden;
  background: var(--bg);
}
.canvas-svg {
  width: 100%;
  height: 100%;
  cursor: grab;
}
.canvas-svg:active { cursor: grabbing; }
.canvas-tabs {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  display: flex;
  gap: 0;
  background: var(--bg-surface);
  border-bottom: 1px solid var(--border);
  z-index: 10;
  overflow-x: auto;
}
.canvas-tab {
  padding: 0.5rem 0.9rem;
  border: none;
  background: none;
  cursor: pointer;
  font-family: var(--font-mono);
  font-size: 0.75rem;
  color: var(--text-muted);
  border-bottom: 2px solid transparent;
  white-space: nowrap;
  transition: var(--transition);
}
.canvas-tab:hover { color: var(--text-soft); background: var(--bg-elevated); }
.canvas-tab.active {
  color: var(--accent);
  border-bottom-color: var(--accent);
  font-weight: 500;
}
.canvas-breadcrumb {
  position: absolute;
  top: 2.4rem;
  left: 0.5rem;
  z-index: 10;
  display: flex;
  align-items: center;
  gap: 0.25rem;
  font-family: var(--font-mono);
  font-size: 0.72rem;
  color: var(--text-muted);
}
.crumb-link {
  background: none;
  border: none;
  color: var(--accent);
  cursor: pointer;
  font: inherit;
  padding: 0;
}
.crumb-link:hover { text-decoration: underline; }
.crumb-current { color: var(--text); }
.crumb-sep { opacity: 0.5; }
.node-group { cursor: pointer; transition: filter 150ms ease; }
.node-group:hover { filter: drop-shadow(0 0 8px var(--accent-glow)); }
.node-group.selected > * { filter: drop-shadow(0 0 10px var(--accent-glow)); }
.node-group.dragging { opacity: 0.8; cursor: grabbing; }
.node-group.is-data { opacity: 0.85; }
.node-group.connect-source > * { filter: drop-shadow(0 0 12px var(--accent)); }
.edge-group { cursor: pointer; }
.edge-group.selected path { pointer-events: stroke; }
.edge-condition {
  font-family: var(--font-mono);
  font-size: 9px;
  fill: var(--text-muted);
  pointer-events: none;
}
.edge-editor {
  position: absolute;
  bottom: 1rem;
  left: 50%;
  transform: translateX(-50%);
  display: flex;
  align-items: center;
  gap: 0.4rem;
  background: var(--bg-surface);
  border: 1px solid var(--border);
  border-radius: var(--radius);
  padding: 0.4rem 0.6rem;
  z-index: 10;
}
.edge-editor-title {
  font-family: var(--font-mono);
  font-size: 0.7rem;
  color: var(--text-muted);
}
.edge-condition-input {
  width: 220px;
  padding: 0.25rem 0.5rem;
  border: 1px solid var(--border);
  border-radius: var(--radius-sm);
  background: var(--bg);
  color: var(--text);
  font-family: var(--font-mono);
  font-size: 0.75rem;
}
.node-label {
  font-family: var(--font-mono);
  font-size: 10px;
  fill: var(--text);
  pointer-events: none;
  user-select: none;
}
.canvas-controls {
  position: absolute;
  bottom: 1rem;
  right: 1rem;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.25rem;
  background: var(--bg-surface);
  border: 1px solid var(--border);
  border-radius: var(--radius);
  padding: 0.4rem;
}
.ctrl-btn {
  width: 30px;
  height: 30px;
  border: 1px solid var(--border);
  background: var(--bg-elevated);
  color: var(--text-soft);
  border-radius: var(--radius-sm);
  cursor: pointer;
  font-size: 0.95rem;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: var(--transition);
}
.ctrl-btn:hover { background: var(--bg-hover); color: var(--accent); border-color: var(--accent); }
.ctrl-btn.reset { font-size: 0.8rem; }
.zoom-display {
  font-family: var(--font-mono);
  font-size: 0.65rem;
  color: var(--text-muted);
  padding: 0.15rem 0;
}
.canvas-hint {
  position: absolute;
  bottom: 1rem;
  left: 1rem;
  font-size: 0.72rem;
  color: var(--text-muted);
  background: var(--bg-surface);
  border: 1px solid var(--border);
  padding: 0.3rem 0.6rem;
  border-radius: var(--radius);
}
.canvas-hint kbd {
  font-family: var(--font-mono);
  font-size: 0.68rem;
  background: var(--bg-elevated);
  padding: 0.05rem 0.3rem;
  border-radius: 2px;
  border: 1px solid var(--border);
  color: var(--accent);
}
.canvas-refusal {
  position: absolute;
  bottom: 3.2rem;
  left: 1rem;
  font-size: 0.72rem;
  color: #b85555;
  background: var(--bg-surface);
  border: 1px solid #b85555;
  padding: 0.3rem 0.6rem;
  border-radius: var(--radius);
  animation: fadeIn 120ms ease;
}
.canvas-empty {
  position: absolute;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--text-muted);
  font-size: 0.9rem;
}
.canvas-empty code {
  font-family: var(--font-mono);
  color: var(--accent);
}
</style>
