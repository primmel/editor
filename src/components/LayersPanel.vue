<script setup lang="ts">
// ─────────────────────────────────────────────────────────────────────
// The layers panel (TODO.editor/05, slice 3) — the layer-overlay
// authoring view: the package session's composition made visible. The
// stack shows who contributes what (the root package on top — the
// overlay being authored; the layers beneath, nearest-winner first);
// the overlay table lists the terms marked `overlay true` against the
// upstream definition each supersedes. Authoring stays in the house
// pattern: click a row to select the term, the inspector edits the
// marker. Pure projection of the open payload (lib/layers.ts) — the
// layering is as composed at open, no live re-derivation.
//
// Q1 adds the copy-up verb: the upstream-terms section lists the terms
// a layer beneath authors that the root has not claimed; the row's
// button pulls one INTO the root (the marker flips, the save adopts it
// into the root's files) and selects it in the inspector — the panel
// never edits inline. This one list reads LIVE (the candidate drops
// out the moment the verb lands); the stack and the overlay table stay
// as-composed-at-open.
// ─────────────────────────────────────────────────────────────────────
import { computed } from 'vue';
import { copyUpTerm, kindCensus, layersView, upstreamTerms } from '../lib/layers';
import { useModelStore } from '../stores/model';
import { useUiStore } from '../stores/ui';

const modelStore = useModelStore();
const ui = useUiStore();

const view = computed(() => (modelStore.pkg ? layersView(modelStore.pkg) : null));

/** The copy-up candidates (Q1) — live off the model version: the verb's
 *  marker flip drops the row immediately. */
const upstream = computed(() => {
  void modelStore.version;
  return modelStore.pkg && modelStore.standard ? upstreamTerms(modelStore.pkg, modelStore.standard) : [];
});

function openTerm(id: string) {
  ui.select(id, 'term');
}

/** The copy-up verb: flip the marker (the command is exact-undoable),
 *  then select-to-inspect — the house pattern. */
function copyUp(id: string) {
  modelStore.execute(copyUpTerm(id));
  ui.select(id, 'term');
  ui.rightPanel = 'inspector';
}
</script>

<template>
  <div class="layers-panel" data-testid="layers-panel">
    <div v-if="!view" class="layers-wall" data-testid="layers-wall">
      the layers view needs a package session: the composition — which packages layer beneath yours, which
      terms overlay theirs — is the package's shape. Open a package directory (Open pkg); the loose buffer
      composes nothing.
    </div>

    <template v-else>
      <div class="layers-label">the composition stack — later layers win</div>
      <div
        v-for="l in view.stack"
        :key="l.package"
        class="layer-row"
        :class="{ root: l.root }"
        :data-testid="`layer-${l.package}`"
      >
        <div class="layer-head">
          <code class="layer-id">{{ l.package }}</code>
          <span v-if="l.root" class="layer-badge root" data-testid="layer-root-badge">the overlay — this package</span>
          <span v-else class="layer-badge">layer</span>
        </div>
        <div class="layer-census" :data-testid="`layer-census-${l.package}`">
          {{ kindCensus(l) || 'no constructs' }}
        </div>
      </div>
      <div v-if="!view.hasLayers" class="layers-note" data-testid="layers-note">
        this package composes no imports — nothing is layered beneath it
      </div>

      <div class="layers-label">overlay terms — intentional redefinitions (uses-no-redefine lifts for these)</div>
      <button
        v-for="o in view.overlays"
        :key="o.id"
        type="button"
        class="overlay-row"
        :data-testid="`overlay-row-${o.id}`"
        @click="openTerm(o.id)"
      >
        <div class="overlay-head">
          <code class="overlay-id">{{ o.id }}</code>
          <span v-if="o.overlaidPackage" class="overlay-target">overrides {{ o.overlaidPackage }}</span>
          <span v-else class="overlay-target none" :data-testid="`overlay-no-target-${o.id}`">no upstream target — the marker records intent</span>
        </div>
        <div class="overlay-side">
          <span class="overlay-who">yours · {{ o.package }} · {{ o.file }}</span>
          <span class="overlay-def" :data-testid="`overlay-yours-${o.id}`">{{ o.definition }}</span>
        </div>
        <div v-if="o.overlaid" class="overlay-side upstream">
          <span class="overlay-who">upstream · {{ o.overlaidPackage }}<template v-if="o.overlaid.source"> · {{ o.overlaid.source }}</template></span>
          <span class="overlay-def" :data-testid="`overlay-upstream-${o.id}`">{{ o.overlaid.definition }}</span>
        </div>
      </button>
      <div v-if="!view.overlays.length" class="layers-note" data-testid="overlays-empty">
        no overlay terms — the composition is pure inclusion (uses-no-redefine holds)
      </div>

      <template v-if="view.hasLayers">
        <div class="layers-label">upstream terms — copy one up to overlay it here</div>
        <div
          v-for="u in upstream"
          :key="u.id"
          class="upstream-row"
          :data-testid="`upstream-row-${u.id}`"
        >
          <div class="overlay-head">
            <code class="overlay-id">{{ u.id }}</code>
            <span class="overlay-target">from {{ u.package }}<template v-if="u.source"> · {{ u.source }}</template></span>
            <button
              type="button"
              class="copyup-btn"
              :data-testid="`copy-up-${u.id}`"
              @click="copyUp(u.id)"
            >copy up as overlay</button>
          </div>
          <div class="overlay-def upstream-def" :data-testid="`upstream-def-${u.id}`">{{ u.definition }}</div>
        </div>
        <div v-if="!upstream.length" class="layers-note" data-testid="upstream-empty">
          nothing to copy up — every upstream term is either adopted already or the layer composes no terms
        </div>
      </template>

      <div class="layers-foot">the layering as composed at open — reopen the package to refresh</div>
    </template>
  </div>
</template>

<style scoped>
.layers-panel { padding: 0.75rem; font-size: 0.78rem; }
.layers-wall {
  color: var(--text-faint);
  font-size: 0.7rem;
  font-style: italic;
  padding: 0.5rem 0;
  line-height: 1.5;
}
.layers-label {
  font-family: var(--font-mono);
  font-size: 0.6rem;
  text-transform: uppercase;
  letter-spacing: 0.1em;
  color: var(--text-faint);
  margin: 0.6rem 0 0.3rem;
}
.layers-label:first-child { margin-top: 0; }
.layer-row {
  border: 1px solid var(--border-soft);
  border-radius: var(--radius-sm);
  padding: 0.4rem 0.55rem;
  margin-bottom: 0.3rem;
}
.layer-row.root { border-color: var(--accent); }
.layer-head { display: flex; align-items: center; gap: 0.5rem; flex-wrap: wrap; }
.layer-id {
  font-family: var(--font-mono);
  font-size: 0.72rem;
  color: var(--accent);
  word-break: break-all;
}
.layer-badge {
  font-family: var(--font-mono);
  font-size: 0.58rem;
  text-transform: uppercase;
  letter-spacing: 0.08em;
  color: var(--text-muted);
  background: var(--bg-elevated);
  border: 1px solid var(--border);
  border-radius: var(--radius-sm);
  padding: 0.1rem 0.4rem;
}
.layer-badge.root {
  color: var(--accent);
  background: var(--accent-soft);
  border-color: var(--accent-glow);
}
.layer-census {
  font-size: 0.68rem;
  color: var(--text-soft);
  font-family: var(--font-mono);
  margin-top: 0.15rem;
}
.layers-note { color: var(--text-faint); font-size: 0.7rem; font-style: italic; padding: 0.2rem 0; }
.layers-foot {
  color: var(--text-faint);
  font-size: 0.64rem;
  font-style: italic;
  margin-top: 0.6rem;
}
.overlay-row {
  display: block;
  width: 100%;
  text-align: left;
  background: none;
  border: 1px solid var(--border-soft);
  border-radius: var(--radius-sm);
  padding: 0.4rem 0.55rem;
  margin-bottom: 0.3rem;
  color: var(--text);
  cursor: pointer;
}
.overlay-row:hover { background: var(--bg-elevated); }
.overlay-head { display: flex; align-items: center; gap: 0.5rem; flex-wrap: wrap; }
.overlay-id {
  font-family: var(--font-mono);
  font-size: 0.72rem;
  color: var(--accent);
  font-weight: 600;
}
.overlay-target {
  font-family: var(--font-mono);
  font-size: 0.6rem;
  color: var(--sage);
}
.overlay-target.none { color: var(--text-faint); }
.overlay-side {
  display: grid;
  gap: 0.05rem;
  margin-top: 0.25rem;
  border-left: 2px solid var(--accent);
  padding-left: 0.45rem;
}
.overlay-side.upstream { border-left-color: var(--border); }
.overlay-who {
  font-family: var(--font-mono);
  font-size: 0.58rem;
  color: var(--text-faint);
  text-transform: uppercase;
  letter-spacing: 0.06em;
}
.overlay-def { font-size: 0.7rem; color: var(--text); }
.overlay-side.upstream .overlay-def { color: var(--text-muted); }
.upstream-row {
  border: 1px solid var(--border-soft);
  border-radius: var(--radius-sm);
  padding: 0.4rem 0.55rem;
  margin-bottom: 0.3rem;
}
.upstream-def { color: var(--text-muted); margin-top: 0.2rem; }
.copyup-btn {
  margin-left: auto;
  padding: 0.12rem 0.5rem;
  border: 1px solid var(--accent);
  background: none;
  color: var(--accent);
  border-radius: var(--radius-sm);
  cursor: pointer;
  font-size: 0.64rem;
  font-family: var(--font-mono);
}
.copyup-btn:hover { background: var(--accent-soft); }
</style>
