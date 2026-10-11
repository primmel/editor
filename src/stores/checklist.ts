// ─────────────────────────────────────────────────────────────────────
// The checklist store (G7) — the self-assessment marks: ephemeral run
// state (the honest wall — never the AST, never serialized into the
// model); the export carries them out.
// ─────────────────────────────────────────────────────────────────────
import { defineStore } from 'pinia';
import { shallowRef } from 'vue';
import type { ChecklistMark } from '../lib/analysis';
import { fetchPackageFile } from '../lib/workspace-data';
import { writePackageFiles } from '../lib/package';

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

  // G7's persistence (Paneron's per-dataset checklists): the marks
  // ride the package's workspace file — the same git-committing write
  // path as the instance rows. Recoverable by design: the log IS the
  // history.
  const CHECKLIST_PATH = 'workspace/checklist.json';
  let saving = false;

  async function save(dir: string): Promise<string> {
    saving = true;
    try {
      const r = await writePackageFiles(dir, [
        { path: CHECKLIST_PATH, text: `${JSON.stringify({ marks: marks.value }, null, 2)}\n` },
      ], 'workspace: the checklist marks');
      return r.commit.committed
        ? `committed ${r.commit.oid?.slice(0, 7)} — the marks are in the package's history`
        : (r.commit.reason ?? 'saved without a commit');
    } finally {
      saving = false;
    }
  }

  async function load(dir: string): Promise<number> {
    const text = await fetchPackageFile(dir, CHECKLIST_PATH);
    if (!text) {
      marks.value = {};
      return 0;
    }
    const doc = JSON.parse(text) as { marks?: Record<string, { mark: ChecklistMark; evidence: string }> };
    marks.value = doc.marks ?? {};
    return Object.keys(marks.value).length;
  }

  return { marks, setMark, setEvidence, clear, save, load, saving };
});
