<script setup lang="ts">
import { computed, ref } from 'vue';
import type { Standard } from '@primmel/primmel';
import {
  extractCanvas, renderCanvas, bezierPath,
  nodeShape, nodeColor, NODE_SIZE,
  type RenderNode,
} from '../lib/render';
import { useUiStore } from '../stores/ui';

const props = defineProps<{ model: Standard }>();
const ui = useUiStore();

const isDragging = ref(false);
const dragStart = ref({ x: 0, y: 0, panX: 0, panY: 0 });

const canvas = computed(() => extractCanvas(props.model, ui.activeCanvasId));
const rendered = computed(() => renderCanvas(props.model, canvas.value));

const viewBox = computed(() => {
  const z = ui.zoom;
  return `${-ui.panX / z} ${-ui.panY / z} ${800 / z} ${600 / z}`;
});

function onMouseDown(e: MouseEvent) {
  if (e.target === e.currentTarget || (e.target as SVGElement).tagName === 'rect' && (e.target as SVGElement).dataset.bg) {
    isDragging.value = true;
    dragStart.value = { x: e.clientX, y: e.clientY, panX: ui.panX, panY: ui.panY };
  }
}

function onMouseMove(e: MouseEvent) {
  if (!isDragging.value) return;
  const dx = e.clientX - dragStart.value.x;
  const dy = e.clientY - dragStart.value.y;
  ui.panX = dragStart.value.panX + dx;
  ui.panY = dragStart.value.panY + dy;
}

function onMouseUp() {
  isDragging.value = false;
}

function onWheel(e: WheelEvent) {
  e.preventDefault();
  const delta = e.deltaY > 0 ? 0.9 : 1.1;
  ui.setZoom(ui.zoom * delta);
}

function onNodeClick(node: RenderNode) {
  ui.select(node.id, node.kind === 'process' ? 'process' : 'event');
}

function nodeTransform(node: RenderNode): string {
  const shape = nodeShape(node.kind);
  if (shape === 'rect') {
    return `translate(${node.x - NODE_SIZE / 2} ${node.y - NODE_SIZE / 2})`;
  }
  return `translate(${node.x} ${node.y})`;
}

function labelText(node: RenderNode): string {
  const maxLen = node.kind === 'process' ? 20 : 12;
  return node.label.length > maxLen ? node.label.slice(0, maxLen) + '…' : node.label;
}
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
      @mousedown="onMouseDown"
      @mousemove="onMouseMove"
      @mouseup="onMouseUp"
      @mouseleave="onMouseUp"
      @wheel.prevent="onWheel"
    >
      <rect data-bg="true" :x="-10000" :y="-10000" :width="20000" :height="20000" fill="transparent" />

      <g v-for="edge in rendered.edges" :key="edge.id">
        <path
          :d="bezierPath(edge.from, edge.to)"
          fill="none"
          stroke="#6b7280"
          stroke-width="1.5"
          marker-end="url(#arrowhead)"
        />
        <text
          v-if="edge.label"
          :x="(edge.from.x + edge.to.x) / 2"
          :y="(edge.from.y + edge.to.y) / 2 - 4"
          class="edge-label"
        >{{ edge.label }}</text>
      </g>

      <g
        v-for="node in rendered.nodes"
        :key="node.id"
        :transform="nodeTransform(node)"
        :class="{ selected: ui.isSelected(node.id) }"
        class="node-group"
        @click.stop="onNodeClick(node)"
      >
        <rect
          v-if="nodeShape(node.kind) === 'rect'"
          :width="NODE_SIZE"
          :height="NODE_SIZE"
          rx="8"
          :fill="nodeColor(node.kind).fill"
          :stroke="nodeColor(node.kind).stroke"
          stroke-width="2"
        />
        <circle
          v-else-if="nodeShape(node.kind) === 'circle'"
          :r="NODE_SIZE / 2.5"
          :fill="nodeColor(node.kind).fill"
          :stroke="nodeColor(node.kind).stroke"
          :stroke-width="node.kind === 'end_event' ? 4 : 2"
        />
        <polygon
          v-else
          :points="`0,${-NODE_SIZE / 2} ${NODE_SIZE / 2},0 0,${NODE_SIZE / 2} ${-NODE_SIZE / 2},0`"
          :fill="nodeColor(node.kind).fill"
          :stroke="nodeColor(node.kind).stroke"
          stroke-width="2"
        />
        <text
          y="4"
          text-anchor="middle"
          class="node-label"
        >{{ labelText(node) }}</text>
      </g>

      <defs>
        <marker id="arrowhead" markerWidth="8" markerHeight="6" refX="7" refY="3" orient="auto">
          <polygon points="0 0, 8 3, 0 6" fill="#6b7280" />
        </marker>
      </defs>
    </svg>

    <div class="canvas-controls">
      <button class="ctrl-btn" @click="ui.setZoom(ui.zoom * 1.2)">+</button>
      <button class="ctrl-btn" @click="ui.setZoom(ui.zoom / 1.2)">−</button>
      <button class="ctrl-btn" @click="ui.resetView()">⟲</button>
    </div>

    <div v-if="!canvas" class="canvas-empty">
      No canvas in this model. Add a <code>canvas Root { ... }</code> block.
    </div>
  </div>
</template>

<style scoped>
.canvas-container {
  position: relative;
  height: 100%;
  overflow: hidden;
  background: var(--bg-canvas, #fafafa);
  background-image:
    radial-gradient(circle, #e0e0e0 1px, transparent 1px);
  background-size: 20px 20px;
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
  background: rgba(255, 255, 255, 0.95);
  border-bottom: 1px solid #e0e0e0;
  z-index: 10;
}
.canvas-tab {
  padding: 0.4rem 0.8rem;
  border: none;
  background: none;
  cursor: pointer;
  font-size: 0.8rem;
  color: #666;
  border-bottom: 2px solid transparent;
}
.canvas-tab.active {
  color: var(--accent, #4a6fa5);
  border-bottom-color: var(--accent, #4a6fa5);
  font-weight: 600;
}
.node-group { cursor: pointer; }
.node-group:hover { opacity: 0.85; }
.node-group.selected > * {
  filter: drop-shadow(0 0 6px rgba(74, 111, 165, 0.5));
}
.node-label {
  font-size: 11px;
  fill: #333;
  pointer-events: none;
  user-select: none;
}
.edge-label {
  font-size: 9px;
  fill: #888;
  text-anchor: middle;
}
.canvas-controls {
  position: absolute;
  bottom: 1rem;
  right: 1rem;
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
}
.ctrl-btn {
  width: 32px;
  height: 32px;
  border: 1px solid #ccc;
  background: #fff;
  border-radius: 4px;
  cursor: pointer;
  font-size: 1rem;
  display: flex;
  align-items: center;
  justify-content: center;
}
.ctrl-btn:hover { background: #f0f0f0; }
.canvas-empty {
  position: absolute;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  color: #888;
  font-size: 0.9rem;
}
</style>
