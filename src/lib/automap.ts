// ─────────────────────────────────────────────────────────────────────
// Automap (TODO.editor/11) — mapping SUGGESTIONS, never assertions:
// name similarity (token overlap + normalized edit distance) and
// structural similarity (process input/output overlap, dataclass
// attribute overlap), ranked with the reason shown. The closure
// proposals come from the KERNEL's computeCoverage report (never
// reimplemented here).
// ─────────────────────────────────────────────────────────────────────

import type { Standard } from '@primmel/primmel';
import { pairsOf, profileFor, splitTargetRef } from './mapper';

export interface AutomapSuggestion {
  impId: string;
  refId: string;
  /** 0..1 — the blend of name and structural similarity. */
  score: number;
  /** The why, human-readable (the panel shows it; the confirm seeds
   *  the pair's description with it). */
  reasons: string[];
}

// ── Name similarity ──────────────────────────────────────────────────

/** Tokenize a label: camelCase and snake/kebab split, lowercased,
 *  stop-words kept (they carry signal in standards text). */
function tokens(s: string): Set<string> {
  const spaced = s
    .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
    .replace(/[_\-/.:]+/g, ' ')
    .toLowerCase();
  return new Set(spaced.split(/\s+/).filter(t => t.length > 0));
}

/** Plain Jaccard (the structural overlap — true set semantics there). */
function jaccard(a: Set<string>, b: Set<string>): number {
  if (a.size === 0 || b.size === 0) return 0;
  let inter = 0;
  for (const t of a) if (b.has(t)) inter++;
  return inter / (a.size + b.size - inter);
}

/** Token match: equal, or one is a 4+-char prefix of the other (the
 *  cheap stemmer — inspect/inspection, measure/measurement). */
function tokenMatch(a: string, b: string): boolean {
  if (a === b) return true;
  if (a.length >= 4 && b.startsWith(a)) return true;
  if (b.length >= 4 && a.startsWith(b)) return true;
  return false;
}

/** The overlap coefficient (inter / min size) with prefix matching —
 *  a shared significant token scores even when the sets differ in
 *  size ("manufacture product" vs "make product" ⇒ 0.5). */
function tokenOverlap(a: Set<string>, b: Set<string>): number {
  if (a.size === 0 || b.size === 0) return 0;
  const [small, large] = a.size <= b.size ? [a, b] : [b, a];
  let inter = 0;
  for (const t of small) {
    for (const u of large) {
      if (tokenMatch(t, u)) {
        inter++;
        break;
      }
    }
  }
  return inter / small.size;
}

/** Levenshtein distance, normalized to a 0..1 similarity. */
function editSimilarity(a: string, b: string): number {
  const s = a.toLowerCase();
  const t = b.toLowerCase();
  if (s === t) return 1;
  const m = s.length;
  const n = t.length;
  if (m === 0 || n === 0) return 0;
  let prev = Array.from({ length: n + 1 }, (_, j) => j);
  for (let i = 1; i <= m; i++) {
    const cur = [i];
    for (let j = 1; j <= n; j++) {
      cur[j] = Math.min(
        prev[j]! + 1,
        cur[j - 1]! + 1,
        prev[j - 1]! + (s[i - 1] === t[j - 1] ? 0 : 1),
      );
    }
    prev = cur;
  }
  return 1 - prev[n]! / Math.max(m, n);
}

/** The name similarity of two labels (id + display name both tried —
 *  the better score wins). */
export function nameSimilarity(
  a: { id: string; name?: string },
  b: { id: string; name?: string },
): number {
  const pairs: [string, string][] = [
    [a.id, b.id],
    ...(a.name && b.name ? [[a.name, b.name] as [string, string]] : []),
    ...(a.name ? [[a.name, b.id] as [string, string]] : []),
    ...(b.name ? [[a.id, b.name] as [string, string]] : []),
  ];
  let best = 0;
  for (const [x, y] of pairs) {
    const tokenScore = tokenOverlap(tokens(x), tokens(y));
    const editScore = editSimilarity(x, y);
    best = Math.max(best, tokenScore * 0.6 + editScore * 0.4);
  }
  return best;
}

/** The cheap pre-score (no edit distance — the scale budget's first
 *  pass): the best token overlap across the label pairs. */
function preScore(
  a: { id: string; name?: string },
  b: { id: string; name?: string },
): number {
  let best = tokenOverlap(tokens(a.id), tokens(b.id));
  if (a.name && b.name) best = Math.max(best, tokenOverlap(tokens(a.name), tokens(b.name)));
  if (a.name) best = Math.max(best, tokenOverlap(tokens(a.name), tokens(b.id)));
  if (b.name) best = Math.max(best, tokenOverlap(tokens(a.id), tokens(b.name)));
  return best;
}

// ── Structural similarity ────────────────────────────────────────────

/** Processes: the input/output registry id overlap. Dataclasses: the
 *  attribute id overlap. Anything else: 0. */
export function structuralSimilarity(
  imp: Standard,
  ref: Standard,
  impId: string,
  refId: string,
): number {
  const impProc = imp.processes.find(p => p.id === impId);
  const refProc = ref.processes.find(p => p.id === refId);
  if (impProc && refProc) {
    const io = (p: typeof impProc) =>
      new Set([...p.input.map(r => r.id), ...p.output.map(r => r.id)]);
    return jaccard(io(impProc), io(refProc));
  }
  const impClass = imp.dataclasses.find(d => d.id === impId);
  const refClass = ref.dataclasses.find(d => d.id === refId);
  if (impClass && refClass) {
    const attrs = (d: typeof impClass) => new Set(d.attributes.map(a => a.id));
    return jaccard(attrs(impClass), attrs(refClass));
  }
  return 0;
}

// ── The suggestions ──────────────────────────────────────────────────

/** The compared kinds, in order (like-kind matching only). */
const KINDS: { list: (m: Standard) => { id: string; name?: string }[] }[] = [
  { list: m => m.processes },
  { list: m => m.approvals },
  { list: m => m.dataclasses },
];

/** Rank mapping suggestions for one (IMP, REF, namespace) triple:
 *  like-kind pairs above the threshold, best first. Already-mapped
 *  targets stay suggestible for OTHER sources (multi-target), but an
 *  exact existing pair is never re-suggested, and rejected pairs
 *  (the session set, `imp|ref`) are skipped.
 *
 *  The blend: the NAME decides; the structure is a bonus (a good
 *  name with no structural overlap must still rank — the structure
 *  can only help, never dilute). */
export function suggestMappings(
  imp: Standard,
  ref: Standard,
  namespace: string,
  opts: { threshold?: number; limit?: number; skip?: Set<string> } = {},
): AutomapSuggestion[] {
  const threshold = opts.threshold ?? 0.4;
  const limit = opts.limit ?? 20;
  const profile = profileFor(imp, namespace);
  const out: AutomapSuggestion[] = [];

  for (const kind of KINDS) {
    const impEls = kind.list(imp);
    const refEls = kind.list(ref);
    for (const ie of impEls) {
      const existing = new Set(
        pairsOf(profile, ie.id)
          .map(p => splitTargetRef(p.target)?.id)
          .filter((x): x is string => !!x),
      );
      // The scale budget (TODO.editor/34): the O(m·n) edit distance
      // runs only for token-competitive candidates — a 262×56-process
      // scan stays interactive. A pair can only rank on edit alone
      // when its token overlap is non-trivial.
      const candidates = refEls
        .filter(re => !existing.has(re.id) && !opts.skip?.has(`${ie.id}|${re.id}`))
        .map(re => ({ re, cheap: preScore(ie, re) }))
        .filter(c => c.cheap >= 0.15);
      for (const { re } of candidates) {
        const name = nameSimilarity(ie, re);
        const structural = structuralSimilarity(imp, ref, ie.id, re.id);
        const score = Math.min(1, name + structural * 0.15);
        if (score < threshold) continue;
        const reasons = [`name ${name.toFixed(2)}`];
        if (structural > 0) reasons.push(`structure ${structural.toFixed(2)}`);
        out.push({ impId: ie.id, refId: re.id, score, reasons });
      }
    }
  }
  out.sort((a, b) => b.score - a.score || a.impId.localeCompare(b.impId));
  return out.slice(0, limit);
}

/** The honesty line (the claim's provenance is never hidden). */
export function automapJustification(s: AutomapSuggestion): string {
  return `auto-suggested (score ${s.score.toFixed(2)}: ${s.reasons.join(', ')}), confirmed by operator`;
}
