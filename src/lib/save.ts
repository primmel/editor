// ─────────────────────────────────────────────────────────────────────
// The save path (TODO.editor/18) — the honest save: serialize through
// the kernel's dump (byte-clean), preview the change against the
// loaded original (the kernel's model-diff, the review-before-commit
// discipline), and write (browser download, or the dev server's write
// API with a .bak backup).
// ─────────────────────────────────────────────────────────────────────

import { dump, load, type Standard } from '@primmel/primmel';
import { diffView, type DiffViewModel } from './diff-view';

export interface SavePreview {
  /** The bytes to write. */
  text: string;
  /** The change preview against the loaded original (null when the
   *  original no longer parses — the preview is best-effort, the save
   *  is never blocked by it). */
  diff: DiffViewModel | null;
}

/** Serialize for save: the dump + the diff against the original text. */
export function serializeForSave(ast: Standard, originalText: string): SavePreview {
  const text = dump(ast);
  let diff: DiffViewModel | null = null;
  try {
    const original = load(originalText, { strict: true });
    diff = diffView(original, ast, { aLabel: 'saved', bLabel: 'working' });
  } catch {
    diff = null;
  }
  return { text, diff };
}

/** The suggested file name from the model's namespace. */
export function suggestedFileName(ast: Standard): string {
  const ns = ast.meta?.namespace?.trim();
  const slug = ns ? ns.replace(/[^A-Za-z0-9._-]+/g, '-') : 'model';
  return `${slug}.prl`;
}

/** The dev server's write API (vite middleware — POST { path, text };
 *  constrained to .prl/.mmel under the project root, .bak backup). */
export async function writeToFile(path: string, text: string): Promise<{ ok: boolean; backup: boolean }> {
  const res = await fetch('/api/save', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ path, text }),
  });
  if (!res.ok) throw new Error(await res.text());
  return res.json() as Promise<{ ok: boolean; backup: boolean }>;
}

/** Probe the write API's availability (the middleware answers GET with
 *  a small status document; a static-file dev server 404s). */
export async function writeApiAvailable(): Promise<boolean> {
  try {
    const res = await fetch('/api/save', { method: 'GET' });
    return res.ok;
  } catch {
    return false;
  }
}

/** The browser-only write path (the honest fallback): a download with
 *  the exact bytes. */
export function downloadText(fileName: string, text: string): void {
  const blob = new Blob([text], { type: 'text/plain;charset=utf-8' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = fileName;
  a.click();
  URL.revokeObjectURL(a.href);
}
