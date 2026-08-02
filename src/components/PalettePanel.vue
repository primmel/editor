<script setup lang="ts">
// ─────────────────────────────────────────────────────────────────────
// The element palette (TODO.editor/03) — drag (or click) an element
// kind onto the canvas: the create command with minted id and defaults.
// ─────────────────────────────────────────────────────────────────────
import { PALETTE, type PaletteKind } from '../lib/factory';
import { nodeColor, nodeShape, NODE_SIZE } from '../lib/render';

const emit = defineEmits<{
  (e: 'pick', entry: PaletteKind): void;
  (e: 'dragstart', entry: PaletteKind, ev: DragEvent): void;
}>();

function glyphColor(entry: PaletteKind): { fill: string; stroke: string } {
  if (entry.kind === 'event') {
    const kind = entry.eventType === 'start' ? 'start_event'
      : entry.eventType === 'end' ? 'end_event'
      : entry.eventType === 'timer' ? 'timer_event' : 'signal_event';
    return nodeColor(kind as never);
  }
  if (entry.kind === 'gateway') return nodeColor('exclusive_gateway');
  return nodeColor(entry.kind as never);
}

function glyphShape(entry: PaletteKind): string {
  if (entry.kind === 'event') return 'circle';
  if (entry.kind === 'subprocess') return 'frame';
  if (entry.kind === 'gateway') return 'diamond';
  return nodeShape(entry.kind as never);
}
</script>

<template>
  <div class="palette" data-testid="element-palette">
    <h3 class="palette-title">Elements</h3>
    <p class="palette-hint">drag to the canvas, or click to add at center</p>
    <ul class="palette-list">
      <li
        v-for="entry in PALETTE"
        :key="entry.label"
        class="palette-item"
        :data-testid="`palette-${entry.kind}${entry.eventType ? '-' + entry.eventType : ''}`"
        draggable="true"
        @dragstart="emit('dragstart', entry, $event)"
        @click="emit('pick', entry)"
      >
        <svg class="palette-glyph" viewBox="-32 -32 64 64" width="26" height="26">
          <rect
            v-if="glyphShape(entry) === 'rect'"
            :x="-NODE_SIZE/2" :y="-NODE_SIZE/2" :width="NODE_SIZE" :height="NODE_SIZE" rx="8"
            :fill="glyphColor(entry).fill" :stroke="glyphColor(entry).stroke" stroke-width="3"
          />
          <polygon
            v-else-if="glyphShape(entry) === 'diamond'"
            points="0,-28 28,0 0,28 -28,0"
            :fill="glyphColor(entry).fill" :stroke="glyphColor(entry).stroke" stroke-width="3"
          />
          <g v-else-if="glyphShape(entry) === 'cylinder'">
            <ellipse rx="24" ry="9" cy="-14"
              :fill="glyphColor(entry).fill" :stroke="glyphColor(entry).stroke" stroke-width="3" />
            <path d="M -24 -14 v 28 a 24 9 0 0 0 48 0 v -28"
              :fill="glyphColor(entry).fill" :stroke="glyphColor(entry).stroke" stroke-width="3" />
          </g>
          <rect
            v-else-if="glyphShape(entry) === 'frame'"
            :x="-NODE_SIZE/2" :y="-NODE_SIZE/2" :width="NODE_SIZE" :height="NODE_SIZE" rx="4"
            :fill="glyphColor(entry).fill" :stroke="glyphColor(entry).stroke" stroke-width="3"
            stroke-dasharray="8 4"
          />
          <circle
            v-else
            r="20"
            :fill="glyphColor(entry).fill" :stroke="glyphColor(entry).stroke"
            :stroke-width="entry.eventType === 'end' ? 5 : 3"
          />
        </svg>
        <span class="palette-label">{{ entry.label }}</span>
      </li>
    </ul>
  </div>
</template>

<style scoped>
.palette {
  padding: 0.6rem 0.5rem;
  border-bottom: 1px solid var(--border);
}
.palette-title {
  font-size: 0.78rem;
  font-weight: 600;
  color: var(--text-soft);
  margin: 0 0 0.15rem;
  padding: 0 0.25rem;
}
.palette-hint {
  font-size: 0.66rem;
  color: var(--text-muted);
  margin: 0 0 0.5rem;
  padding: 0 0.25rem;
}
.palette-list {
  list-style: none;
  margin: 0;
  padding: 0;
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 2px;
}
.palette-item {
  display: flex;
  align-items: center;
  gap: 0.45rem;
  padding: 0.3rem 0.35rem;
  border-radius: var(--radius-sm);
  cursor: grab;
  transition: var(--transition);
}
.palette-item:hover {
  background: var(--bg-elevated);
}
.palette-item:active { cursor: grabbing; }
.palette-label {
  font-size: 0.72rem;
  color: var(--text-soft);
  white-space: nowrap;
}
</style>
