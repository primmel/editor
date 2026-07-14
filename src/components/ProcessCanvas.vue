<script setup lang="ts">
import { computed, ref } from 'vue';
import { load, dump } from '@primmel/primmel';
import type { Standard } from '@primmel/primmel';
import {
  extractCanvas, renderCanvas, bezierPath,
  nodeShape, nodeColor, NODE_SIZE,
  type RenderNode,
} from '../lib/render';
import { useModelStore } from '../stores/model';
import { useUiStore } from '../stores/ui';

const props = defineProps<{ model: Standard }>();
const ui = useUiStore();
const modelStore = useModelStore();

const isPanning = ref(false);
const panStart = ref({ x: 0, y: 0, panX: 0, panY: 0 });
const draggingNode = ref<RenderNode | null>(null);
const dragOffset = ref({ x: 0, y: 0 });

const canvas = computed(() => extractCanvas(props.model, ui.activeCanvasId));
const rendered = computed(() => renderCanvas(props.model, canvas.value));

const viewBox = computed(() => {
  const z = ui.zoom;
  return `${-ui.panX / z} ${-ui.panY / z} ${800 / z} ${600 / z}`;
});

function onCanvasMouseDown(e: MouseEvent) {
  const target = e.target as Element;
  if (target.tagName === 'svg' || target.getAttribute('data-bg')) {
    isPanning.value = true;
    panStart.value = { x: e.clientX, y: e.clientY, panX: ui.panX, panY: ui.panY };
  }
}

function onMouseMove(e: MouseEvent) {
  if (draggingNode.value) {
    const rect = (e.currentTarget as SVGElement).getBoundingClientRect();
    const z = ui.zoom;
    const worldX = (e.clientX - rect.left + ui.panX) / z - 400 / z;
    const worldY = (e.clientY - rect.top + ui.panY) / z - 300 / z;
    draggingNode.value.x = worldX - dragOffset.value.x;
    draggingNode.value.y = worldY - dragOffset.value.y;
  } else if (isPanning.value) {
    const dx = e.clientX - panStart.value.x;
    const dy = e.clientY - panStart.value.y;
    ui.panX = panStart.value.panX + dx;
    ui.panY = panStart.value.panY + dy;
  }
}

function onMouseUp() {
  if (draggingNode.value) {
    commitDrag();
  }
  isPanning.value = false;
  draggingNode.value = null;
}

function onWheel(e: WheelEvent) {
  e.preventDefault();
  const delta = e.deltaY > 0 ? 0.9 : 1.1;
  ui.setZoom(ui.zoom * delta);
}

function onNodeClick(node: RenderNode) {
  ui.select(node.id, node.kind === 'process' ? 'process' : 'event');
}

function onNodeMouseDown(e: MouseEvent, node: RenderNode) {
  e.stopPropagation();
  draggingNode.value = node;
  const rect = (e.currentTarget as SVGElement).closest('svg')!.getBoundingClientRect();
  const z = ui.zoom;
  const worldX = (e.clientX - rect.left + ui.panX) / z - 400 / z;
  const worldY = (e.clientY - rect.top + ui.panY) / z - 300 / z;
  dragOffset.value = { x: worldX - node.x, y: worldY - node.y };
  ui.select(node.id, node.kind === 'process' ? 'process' : 'event');
}

function commitDrag() {
  if (!draggingNode.value || !canvas.value) return;
  const node = draggingNode.value;
  const canvasObj = canvas.value;
  const comp = canvasObj.childs?.find(c => (c.element?.id ?? c.name) === node.id);
  if (comp) {
    comp.x = Math.round(node.x);
    comp.y = Math.round(node.y);
  }
  try {
    const newModel = load(modelStore.rawText);
    const targetCanvas = newModel.pages.find(p => p.id === canvasObj.id);
    if (targetCanvas) {
      const targetComp = targetCanvas.childs?.find(c => (c.element?.id ?? c.name) === node.id);
      if (targetComp) {
        targetComp.x = Math.round(node.x);
        targetComp.y = Math.round(node.y);
      }
    }
    modelStore.rawText = dump(newModel);
  } catch { /* ignore parse errors during drag */ }
}

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
  process: { fill: 'rgba(212, 148, 66, 0.08)', stroke: '#d49442' },
  exclusive_gateway: { fill: 'rgba(184, 85, 85, 0.12)', stroke: '#c47550' },
  parallel_gateway: { fill: 'rgba(122, 158, 94, 0.12)', stroke: '#8a7e5e' },
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
        @click="ui.setCanvas(page.id)"
      >
        {{ page.id }}
      </button>
    </div>
    <svg
      class="canvas-svg"
      :viewBox="viewBox"
      @mousedown="onCanvasMouseDown"
      @mousemove="onMouseMove"
      @mouseup="onMouseUp"
      @mouseleave="onMouseUp"
      @wheel.prevent="onWheel"
    >
      <defs>
        <pattern id="grid" width="24" height="24" patternUnits="userSpaceOnUse">
          <circle cx="0.5" cy="0.5" r="0.5" fill="var(--text-faint)" opacity="0.3" />
        </pattern>
        <marker id="arrowhead" markerWidth="8" markerHeight="6" refX="7" refY="3" orient="auto">
          <polygon points="0 0, 8 3, 0 6" fill="var(--text-muted)" />
        </marker>
        <filter id="node-glow">
          <feGaussianBlur stdDeviation="3" result="blur"/>
          <feMerge>
            <feMergeNode in="blur"/>
            <feMergeNode in="SourceGraphic"/>
          </feMerge>
        </filter>
      </defs>

      <rect data-bg="true" :x="-5000" :y="-5000" :width="10000" :height="10000" fill="url(#grid)" />

      <g v-for="edge in rendered.edges" :key="edge.id" class="edge-group">
        <path
          :d="bezierPath(edge.from, edge.to)"
          fill="none"
          stroke="var(--text-muted)"
          stroke-width="1.5"
          marker-end="url(#arrowhead)"
          opacity="0.6"
        />
      </g>

      <g
        v-for="node in rendered.nodes"
        :key="node.id"
        :transform="nodeTransform(node)"
        :class="{ selected: ui.isSelected(node.id), dragging: draggingNode?.id === node.id }"
        class="node-group"
        @click.stop="onNodeClick(node)"
        @mousedown="onNodeMouseDown($event, node)"
      >
        <rect
          v-if="nodeShape(node.kind) === 'rect'"
          :x="-NODE_SIZE/2" :y="-NODE_SIZE/2"
          :width="NODE_SIZE" :height="NODE_SIZE"
          rx="8"
          :fill="nodeColors[node.kind].fill"
          :stroke="nodeColors[node.kind].stroke"
          stroke-width="1.5"
        />
        <circle
          v-else-if="nodeShape(node.kind) === 'circle'"
          :r="NODE_SIZE / 2.5"
          :fill="nodeColors[node.kind].fill"
          :stroke="nodeColors[node.kind].stroke"
          :stroke-width="node.kind === 'end_event' ? 3 : 1.5"
        />
        <polygon
          v-else
          :points="`0,${-NODE_SIZE/2} ${NODE_SIZE/2},0 0,${NODE_SIZE/2} ${-NODE_SIZE/2},0`"
          :fill="nodeColors[node.kind].fill"
          :stroke="nodeColors[node.kind].stroke"
          stroke-width="1.5"
        />
        <text
          y="4"
          text-anchor="middle"
          class="node-label"
        >{{ labelText(node) }}</text>
      </g>
    </svg>

    <div class="canvas-controls">
      <button class="ctrl-btn" @click="ui.setZoom(ui.zoom * 1.2)" title="Zoom in">+</button>
      <span class="zoom-display">{{ Math.round(ui.zoom * 100) }}%</span>
      <button class="ctrl-btn" @click="ui.setZoom(ui.zoom / 1.2)" title="Zoom out">−</button>
      <button class="ctrl-btn reset" @click="ui.resetView()" title="Reset view">⟲</button>
    </div>

    <div class="canvas-hint" v-if="!draggingNode">
      <kbd>drag</kbd> nodes to reposition · <kbd>scroll</kbd> to zoom
    </div>

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
.node-group { cursor: pointer; transition: filter 150ms ease; }
.node-group:hover { filter: drop-shadow(0 0 8px var(--accent-glow)); }
.node-group.selected > * {
  filter: drop-shadow(0 0 10px var(--accent-glow));
}
.node-group.dragging { opacity: 0.8; cursor: grabbing; }
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
