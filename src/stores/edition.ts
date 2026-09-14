// ─────────────────────────────────────────────────────────────────────
// The edition store (TODO.editor wave 05, slice 2) — the edition
// diff's BASE pick: the previous-edition package directory the working
// session diffs against. The base arrives through the same package
// intake as Open pkg (the dev server's provenance load) — the merged
// dump parses here and the manifest re-attaches (the dump gap), so the
// kernel's diffStandards reads both sides with their edition labels.
// Session state, never the AST: a new pick replaces, clear() drops.
// ─────────────────────────────────────────────────────────────────────
import { defineStore } from 'pinia';
import { ref, shallowRef } from 'vue';
import { load, type Standard } from '@primmel/primmel';
import type { PackageOpenResult } from '../lib/package';

export interface EditionBase {
  dir: string;
  id: string;
  title: string;
  version: string;
  /** The base's merged model (the diff's `a` side). */
  standard: Standard;
  /** Load-time advisories (surfaced, never fatal). */
  issues: string[];
}

export const useEditionStore = defineStore('edition', () => {
  const base = shallowRef<EditionBase | null>(null);
  const parseError = ref('');

  /** Adopt an opened package payload as the diff base. Returns false
   *  when the merged dump fails to reparse (the base stays unchanged —
   *  a stale good base beats a failed new one). */
  function pick(result: PackageOpenResult): boolean {
    try {
      const standard = load(result.dump, { strict: true });
      standard.packageManifest = result.manifest;
      base.value = {
        dir: result.dir,
        id: result.id,
        title: result.title,
        version: result.manifest.version ?? '',
        standard,
        issues: result.issues,
      };
      parseError.value = '';
      return true;
    } catch (e) {
      parseError.value = (e as Error).message;
      return false;
    }
  }

  function clear() {
    base.value = null;
    parseError.value = '';
  }

  return { base, parseError, pick, clear };
});
