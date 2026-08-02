// ─────────────────────────────────────────────────────────────────────
// The mapping store (TODO.editor/07, /09) — the REFERENCE side of the
// mapper: a REGISTRY of loaded reference models keyed by namespace
// (the multi-reference lens), the active one, the pending pick (click
// one side, then the other completes a pair), the pair-dialog draft,
// and the last seed's review list. The IMP side is the model store.
// ─────────────────────────────────────────────────────────────────────
import { defineStore } from 'pinia';
import { computed, ref, shallowRef } from 'vue';
import { load, type Standard } from '@primmel/primmel';
import type { SeedOutcome } from '../lib/multi-map';
import { loadDocument, type DocumentModel } from '../lib/document-model';

export interface PairDraft {
  impId: string;
  refId: string;
}

export const useMappingStore = defineStore('mapping', () => {
  /** The registered reference models, keyed by namespace. */
  const refs = shallowRef<Record<string, Standard>>({});
  const refTexts = ref<Record<string, string>>({});
  /** The active lens (the namespace the mapper shows). */
  const activeNs = ref<string | null>(null);
  const parseError = ref<string | null>(null);

  /** The document-mapping side (TODO.editor/10): the parsed document
   *  and whether the left pane shows IT (vs a reference model). */
  const document = shallowRef<DocumentModel | null>(null);
  const docMode = ref(false);

  /** The first half of a pair: the element clicked on one side. */
  const picked = ref<{ side: 'ref' | 'imp'; id: string } | null>(null);

  /** The open pair dialog's endpoints (null = closed). */
  const pairDraft = ref<PairDraft | null>(null);

  /** The last seed run's outcome (the review list's panel). */
  const lastSeed = ref<{ fromNs: string; toNs: string; outcome: SeedOutcome } | null>(null);

  /** Session-level automap rejections (`imp|ref`) — never re-suggested
   *  this session (TODO.editor/11). */
  const rejectedPairs = ref(new Set<string>());

  function rejectPair(impId: string, refId: string) {
    rejectedPairs.value.add(`${impId}|${refId}`);
  }

  /** The active reference model (null when nothing is registered). */
  const refModel = computed(() => (activeNs.value ? refs.value[activeNs.value] ?? null : null));

  /** The registered namespaces, sorted (the switcher's badges). */
  const namespaces = computed(() => Object.keys(refs.value).sort());

  function loadRefText(text: string) {
    try {
      const model = load(text, { strict: true });
      const ns = model.meta?.namespace?.trim();
      if (!ns) throw new Error('the reference model declares no namespace');
      refs.value = { ...refs.value, [ns]: model };
      refTexts.value = { ...refTexts.value, [ns]: text };
      parseError.value = null;
      docMode.value = false;
      activate(ns);
    } catch (e) {
      parseError.value = (e as Error).message;
    }
  }

  function loadDocumentText(text: string) {
    try {
      document.value = loadDocument(text);
      parseError.value = null;
      docMode.value = true;
      picked.value = null;
      pairDraft.value = null;
    } catch (e) {
      parseError.value = (e as Error).message;
    }
  }

  function clearDocument() {
    document.value = null;
    docMode.value = false;
    picked.value = null;
    pairDraft.value = null;
  }

  /** Swap the lens. */
  function activate(ns: string) {
    if (!refs.value[ns]) return;
    activeNs.value = ns;
    docMode.value = false;
    picked.value = null;
    pairDraft.value = null;
  }

  function removeRef(ns: string) {
    const rest = { ...refs.value };
    delete rest[ns];
    refs.value = rest;
    const restTexts = { ...refTexts.value };
    delete restTexts[ns];
    refTexts.value = restTexts;
    if (activeNs.value === ns) {
      activeNs.value = Object.keys(rest).sort()[0] ?? null;
    }
    picked.value = null;
    pairDraft.value = null;
  }

  /** The active mapping namespace: the document's URN base in doc
   *  mode, else the active reference namespace. */
  function refNamespace(): string | null {
    return docMode.value ? document.value?.urnBase ?? null : activeNs.value;
  }

  return {
    refs, refTexts, activeNs, parseError, picked, pairDraft, lastSeed,
    document, docMode, rejectedPairs,
    refModel, namespaces,
    loadRefText, loadDocumentText, clearDocument, activate, removeRef, refNamespace,
    rejectPair,
  };
});
