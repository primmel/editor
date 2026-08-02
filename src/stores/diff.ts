// ─────────────────────────────────────────────────────────────────────
// The diff store (TODO.editor/12) — the "other" version of the
// model-diff comparison (the working model is the model store's).
// ─────────────────────────────────────────────────────────────────────
import { defineStore } from 'pinia';
import { ref, shallowRef } from 'vue';
import { load, type Standard } from '@primmel/primmel';

export const useDiffStore = defineStore('diff', () => {
  const other = shallowRef<Standard | null>(null);
  const otherName = ref('');
  const parseError = ref('');
  const swapped = ref(false);

  function loadOtherText(text: string, name = 'loaded version') {
    try {
      other.value = load(text, { strict: true });
      otherName.value = name;
      parseError.value = '';
    } catch (e) {
      parseError.value = (e as Error).message;
      other.value = null;
    }
  }

  function clear() {
    other.value = null;
    otherName.value = '';
    parseError.value = '';
    swapped.value = false;
  }

  return { other, otherName, parseError, swapped, loadOtherText, clear };
});
