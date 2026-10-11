// ─────────────────────────────────────────────────────────────────────
// The checklist store (G7) — the self-assessment marks: ephemeral run
// state (the honest wall — never the AST, never serialized into the
// model); the export carries them out.
// ─────────────────────────────────────────────────────────────────────
import { defineStore } from 'pinia';
import { shallowRef } from 'vue';
import type { ChecklistMark } from '../lib/analysis';

export const useChecklistStore = defineStore('checklist', () => {
  const marks = shallowRef<Record<string, { mark: ChecklistMark; evidence: string }>>({});

  function setMark(id: string, mark: ChecklistMark) {
    const prev = marks.value[id] ?? { mark: mark as ChecklistMark, evidence: '' };
    marks.value = { ...marks.value, [id]: { ...prev, mark } };
  }

  function setEvidence(id: string, evidence: string) {
    const prev = marks.value[id] ?? { mark: 'not-evidenced' as ChecklistMark, evidence: '' };
    marks.value = { ...marks.value, [id]: { ...prev, evidence } };
  }

  function clear() {
    marks.value = {};
  }

  return { marks, setMark, setEvidence, clear };
});
