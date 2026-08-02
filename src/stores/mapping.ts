// ─────────────────────────────────────────────────────────────────────
// The mapping store (TODO.editor/07) — the REFERENCE side of the
// mapper: the loaded ref model (read-only), the pending pick (click
// one side, then the other completes a pair), and the pair-dialog
// draft. The IMP side is the model store (the working model).
// ─────────────────────────────────────────────────────────────────────
import { defineStore } from 'pinia';
import { ref, shallowRef } from 'vue';
import { load, type Standard } from '@primmel/primmel';

export interface PairDraft {
  impId: string;
  refId: string;
}

export const useMappingStore = defineStore('mapping', () => {
  const refModel = shallowRef<Standard | null>(null);
  const refText = ref('');
  const parseError = ref<string | null>(null);

  /** The first half of a pair: the element clicked on one side. */
  const picked = ref<{ side: 'ref' | 'imp'; id: string } | null>(null);

  /** The open pair dialog's endpoints (null = closed). */
  const pairDraft = ref<PairDraft | null>(null);

  function loadRefText(text: string) {
    try {
      refModel.value = load(text, { strict: true });
      refText.value = text;
      parseError.value = null;
      picked.value = null;
      pairDraft.value = null;
    } catch (e) {
      parseError.value = (e as Error).message;
      refModel.value = null;
    }
  }

  function clearRef() {
    refModel.value = null;
    refText.value = '';
    parseError.value = null;
    picked.value = null;
    pairDraft.value = null;
  }

  /** The reference namespace (the profile's key). */
  function refNamespace(): string | null {
    const ns = refModel.value?.meta?.namespace;
    return ns && ns.trim() ? ns : null;
  }

  return {
    refModel, refText, parseError, picked, pairDraft,
    loadRefText, clearRef, refNamespace,
  };
});
