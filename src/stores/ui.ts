import { defineStore } from 'pinia';
import { ref, computed } from 'vue';

export type SelectionType =
  | 'role' | 'process' | 'provision' | 'event' | 'gateway'
  | 'canvas' | 'dataclass' | 'registry' | 'measurement' | 'reference' | 'note';

export interface Selection {
  id: string;
  type: SelectionType;
}

export const useUiStore = defineStore('ui', () => {
  const selection = ref<Selection | null>(null);
  const activeCanvasId = ref<string | null>(null);
  const zoom = ref(1);
  const panX = ref(0);
  const panY = ref(0);
  const leftPanel = ref<'tree' | 'code'>('tree');
  const rightPanel = ref<'inspector' | 'compliance'>('inspector');
  const view = ref<'model' | 'registry' | 'mapping'>('model');

  function select(id: string, type: SelectionType) {
    selection.value = { id, type };
  }

  function clearSelection() {
    selection.value = null;
  }

  function setCanvas(id: string | null) {
    activeCanvasId.value = id;
  }

  function setZoom(z: number) {
    zoom.value = Math.max(0.2, Math.min(3, z));
  }

  function pan(dx: number, dy: number) {
    panX.value += dx;
    panY.value += dy;
  }

  function resetView() {
    zoom.value = 1;
    panX.value = 0;
    panY.value = 0;
  }

  const isSelected = computed(() => (id: string) => selection.value?.id === id);

  return {
    selection, activeCanvasId, zoom, panX, panY,
    leftPanel, rightPanel, view,
    select, clearSelection, setCanvas, setZoom, pan, resetView,
    isSelected,
  };
});
