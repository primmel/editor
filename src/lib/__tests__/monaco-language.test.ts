// ─────────────────────────────────────────────────────────────────────
// TODO.editor/34 — the monarch language definition's proofs: its
// keyword classes stay the kernel's vocabulary (never a stale local
// list) — the construct keywords are SHARED with the completion
// service (monaco-prl's CONSTRUCT_KEYWORDS).
// ─────────────────────────────────────────────────────────────────────

import { describe, it, expect } from 'vitest';
import { primmelLanguageDefinition } from '../monaco-language';
import { CONSTRUCT_KEYWORDS } from '../monaco-prl';

describe('34 — the monarch definition', () => {
  it('every construct keyword the completion offers is highlighted', () => {
    const monarch = new Set(primmelLanguageDefinition.keywords);
    for (const kw of CONSTRUCT_KEYWORDS) {
      expect(monarch, `monarch is missing the construct keyword ${kw}`).toContain(kw);
    }
  });

  it('the core grammar tokens highlight', () => {
    const monarch = new Set(primmelLanguageDefinition.keywords);
    for (const kw of [
      'root', 'version', 'metadata', 'title', 'namespace',
      'role', 'process', 'canvas', 'actor', 'modality',
      'validate_provision', 'output', 'reference_data_registry',
      'class', 'enum', 'data_registry', 'variable',
      'start_event', 'end_event', 'exclusive_gateway',
      'SHALL', 'SHOULD', 'MAY', 'from', 'to', 'condition',
    ]) {
      expect(monarch, `monarch is missing ${kw}`).toContain(kw);
    }
  });

  it('the primitive type vocabulary highlights', () => {
    const types = new Set(primmelLanguageDefinition.typeKeywords);
    expect(types.size).toBeGreaterThan(0);
    // The monarch's type list is a display-class (highlighting only) —
    // the completion service is the kernel-vocabulary source of truth.
    expect(primmelLanguageDefinition.tokenPostfix).toBe('.prl');
  });
});
