// ─────────────────────────────────────────────────────────────────────
// The edition diff/publish flow (TODO.editor wave 05, slice 2) — the
// pure derivation behind the Editions panel. The user picks a BASE
// package directory through the package intake (the dev server's
// provenance load, the same mechanism Open pkg uses); the kernel's
// diffStandards compares it (`a`, the old state) against the working
// package (`b`, the new one) — never a Studio-side reimplementation.
// This module owns what the kernel does not: the per-tier tally rows
// the summary header renders, the edition-label suggestion + guard,
// the declare-edition command (the manifest's `editions` set gains the
// new label, newest first), and the release-note DRAFT (markdown) the
// finalize action offers as a browser download — never written into
// the package directory (a downstream byte-contract guard walks those
// trees) and never an npm/git publish (the release act stays in git
// + CI, the SSOT doctrine).
// ─────────────────────────────────────────────────────────────────────

import {
  TIER_ORDER,
  type ModelDiff,
  type MoveEntry,
  type PackageManifest,
  type TierName,
} from '@primmel/primmel';
import type { Command } from './commands';

/** One tier's tally row in the summary header (quiet = all zero — the
 *  row renders dimmed, never dropped: the header reports the whole
 *  tier table). */
export interface EditionTierRow {
  tier: TierName;
  added: number;
  removed: number;
  changed: number;
  moved: number;
  unchanged: number;
  quiet: boolean;
}

export function editionTierRows(diff: ModelDiff): EditionTierRow[] {
  return TIER_ORDER.map((tier) => {
    const t = diff.byTier[tier];
    return {
      tier,
      ...t,
      quiet: t.added + t.removed + t.changed + t.moved + t.unchanged === 0,
    };
  });
}

/** The suggested edition label (a free string): the current year — the
 *  OIML edition convention (editions { 2021 2017 2000 1996 }). The
 *  prompt stays editable; the suggestion is only the prefill. */
export function suggestedEditionLabel(now: Date = new Date()): string {
  return String(now.getFullYear());
}

/** The label guard — null when the label may be declared. A duplicate
 *  is refused before any write (the editions set is newest-first and
 *  unique by convention). */
export function editionLabelError(
  manifest: PackageManifest | null | undefined,
  label: string,
): string | null {
  if (!manifest) return 'the working model carries no package manifest — open a package';
  if (!label.trim()) return 'the edition label is empty';
  if (manifest.editions.includes(label)) return `edition ${label} is already declared in the manifest's editions set`;
  return null;
}

/** The declare-edition command: the manifest's `editions` set gains the
 *  new label at the front (newest first). The manifest object is
 *  REPLACED, never mutated in place — the open session's payload shares
 *  the reference, and the package save's manifest-change detection
 *  (session baseline vs working, by value) must see the claim. Revert
 *  restores the exact prior reference, so an undone declare diffs clean.
 *  The write itself rides the comment-true save path (the manifest file
 *  rewrites canonically — the kernel attests no spans inside
 *  package.primmel, the known limit stated in package-save.ts). */
export function prependEdition(label: string): Command {
  let before: PackageManifest | null | undefined;
  return {
    label: `declare edition ${label}`,
    apply(ast) {
      before = ast.packageManifest;
      if (!before) throw new Error('the working model carries no package manifest — the loose buffer has no editions set');
      ast.packageManifest = { ...before, editions: [label, ...before.editions] };
    },
    revert(ast) {
      ast.packageManifest = before ?? null;
    },
  };
}

/** A moved entry's anchor transition, compact: one `field: a → b` per
 *  DIFFERING anchor field, never the whole-aspect dump. Falls back to
 *  the raw pair when the aspects are not the field-object form the
 *  kernel emits. */
export function movedAnchorSummary(entry: MoveEntry): string {
  try {
    const a = (entry.from ? JSON.parse(entry.from) : {}) as Record<string, unknown>;
    const b = (entry.to ? JSON.parse(entry.to) : {}) as Record<string, unknown>;
    const fields = [...new Set([...Object.keys(a), ...Object.keys(b)])].sort();
    const parts = fields
      .filter((f) => JSON.stringify(a[f] ?? null) !== JSON.stringify(b[f] ?? null))
      .map((f) => `${f}: ${JSON.stringify(a[f] ?? null)} → ${JSON.stringify(b[f] ?? null)}`);
    if (parts.length > 0) return parts.join(', ');
  } catch {
    // Not the field-object form — fall through to the raw rendering.
  }
  return `${entry.from} → ${entry.to}`;
}

/** The release-note draft's file name — package- and edition-scoped,
 *  filesystem-safe. */
export function releaseNoteFileName(packageId: string, edition: string): string {
  const slug = edition.replace(/[^A-Za-z0-9._-]+/g, '-') || 'edition';
  return `${packageId}-${slug}-release-notes.md`;
}

export interface ReleaseNoteOptions {
  /** The package being finalized (the working package's id). */
  packageId: string;
  /** The edition label just declared. */
  edition: string;
  /** The generation date (ISO yyyy-mm-dd); defaults to today. */
  date?: string;
}

function entryLine(e: { kind: string; id: string; tier: string }): string {
  return `- \`${e.kind}/${e.id}\` (${e.tier})`;
}

// ── the panel's grouped rows ─────────────────────────────────────────

/** One diff row as the panel renders it: the entry plus the sub-line
 *  (changed → the differing aspects + fields; moved → the anchor
 *  transition). */
export interface EditionDiffRow {
  key: string;
  id: string;
  kind: string;
  tier: TierName;
  sub: string | null;
}

export interface EditionDiffGroup {
  status: 'added' | 'removed' | 'changed' | 'moved';
  rows: EditionDiffRow[];
}

/** The ModelDiff grouped for the panel (added / removed / changed /
 *  moved — empty groups dropped). */
export function editionDiffGroups(diff: ModelDiff): EditionDiffGroup[] {
  const plain = (e: { key: string; id: string; kind: string; tier: TierName }): EditionDiffRow => ({
    key: e.key,
    id: e.id,
    kind: e.kind,
    tier: e.tier,
    sub: null,
  });
  const groups: EditionDiffGroup[] = [
    { status: 'added', rows: diff.added.map(plain) },
    { status: 'removed', rows: diff.removed.map(plain) },
    {
      status: 'changed',
      rows: diff.changed.map((e) => ({
        ...plain(e),
        sub: `${e.aspects.join(', ')} (fields: ${e.fields.join(', ')})`,
      })),
    },
    {
      status: 'moved',
      rows: diff.moved.map((e) => ({ ...plain(e), sub: movedAnchorSummary(e) })),
    },
  ];
  return groups.filter((g) => g.rows.length > 0);
}
/** The release-note DRAFT (markdown): the per-tier tallies, then the
 *  added/removed/changed/moved element lines (the panel's grouping
 *  order), with the mapping diff and the clause-drift table when the
 *  diff carries them. A draft for review — the release act (tagging,
 *  publishing) stays in git + CI. */
export function releaseNoteDraft(diff: ModelDiff, opts: ReleaseNoteOptions): string {
  const date = opts.date ?? new Date().toISOString().slice(0, 10);
  const lines: string[] = [];
  lines.push(`# ${opts.packageId} — edition ${opts.edition} release notes (draft)`);
  lines.push('');
  lines.push(
    `Generated by Primmel Studio on ${date} from the structural diff ` +
      `${diff.aLabel} → ${diff.bLabel}. Review before publishing: the ` +
      `release act stays in git + CI — this draft downloads to the ` +
      `browser, it is never written into the package.`,
  );
  lines.push('');
  lines.push('## Summary');
  lines.push('');
  lines.push('| tier | added | removed | changed | moved | unchanged |');
  lines.push('| --- | --: | --: | --: | --: | --: |');
  for (const row of editionTierRows(diff)) {
    lines.push(`| ${row.tier} | ${row.added} | ${row.removed} | ${row.changed} | ${row.moved} | ${row.unchanged} |`);
  }
  lines.push(
    `| **total** | **${diff.added.length}** | **${diff.removed.length}** | **${diff.changed.length}** | **${diff.moved.length}** | **${diff.unchanged}** |`,
  );
  lines.push('');

  if (diff.added.length === 0 && diff.removed.length === 0 && diff.changed.length === 0 && diff.moved.length === 0) {
    lines.push('_No element changes against the base._');
    lines.push('');
  }
  if (diff.added.length > 0) {
    lines.push('## Added', '');
    for (const e of diff.added) lines.push(entryLine(e));
    lines.push('');
  }
  if (diff.removed.length > 0) {
    lines.push('## Removed', '');
    for (const e of diff.removed) lines.push(entryLine(e));
    lines.push('');
  }
  if (diff.changed.length > 0) {
    lines.push('## Changed', '');
    for (const e of diff.changed) {
      lines.push(`- \`${e.kind}/${e.id}\` (${e.tier}) — ${e.aspects.join(', ')} (fields: ${e.fields.join(', ')})`);
    }
    lines.push('');
  }
  if (diff.moved.length > 0) {
    lines.push('## Moved (re-anchored)', '');
    for (const e of diff.moved) {
      lines.push(`- \`${e.kind}/${e.id}\` (${e.tier}) — ${movedAnchorSummary(e)}`);
    }
    lines.push('');
  }

  const m = diff.mappings;
  if (m.added.length + m.removed.length + m.changed.length + m.coverageDelta.length > 0) {
    lines.push('## Mappings', '');
    lines.push(`Pairs: +${m.added.length} −${m.removed.length} ~${m.changed.length}.`, '');
    for (const r of m.added) lines.push(`- added \`${r.sourceModel}#${r.source}\` ⇒ \`${r.target}\``);
    for (const r of m.removed) lines.push(`- removed \`${r.sourceModel}#${r.source}\` ⇒ \`${r.target}\``);
    for (const c of m.changed) lines.push(`- changed \`${c.sourceModel}#${c.source}\` ⇒ \`${c.target}\` — ${c.aspects.join(', ')}`);
    for (const d of m.coverageDelta) lines.push(`- coverage \`${d.namespace}#${d.component}\`: ${d.from} → ${d.to}`);
    lines.push('');
  }
  if (diff.clauseDrift.length > 0) {
    lines.push('## Clause drift', '');
    for (const r of diff.clauseDrift) {
      const move = r.kind === 'recited' ? `→ ${r.to} (re-cited)` : r.kind === 'decited' ? `${r.from} → (de-cited)` : `${r.from} → ${r.to} (renumbered)`;
      lines.push(`- \`${r.doc}\` ${move} — cited by ${r.citedBy.map((e) => `\`${e.id}\``).join(', ')}`);
    }
    lines.push('');
  }
  if (diff.warnings.length > 0) {
    lines.push('## Data-quality warnings', '');
    for (const w of diff.warnings) lines.push(`- ${w}`);
    lines.push('');
  }
  return lines.join('\n');
}
