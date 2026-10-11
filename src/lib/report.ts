// ─────────────────────────────────────────────────────────────────────
// The assessment report (G4's editor half): the model as a printable
// dossier — the title block, the Statement of Applicability (the
// provisions with their subject claims and citations), the registry
// annexes (the attribute forms), and the checklist results. A
// standalone HTML document: inline styles, print-ready, no external
// resources. Deterministic — the same model always yields the same
// report.
// ─────────────────────────────────────────────────────────────────────

import type { Standard } from '@primmel/primmel';
import { checklistOf, provisionSummaries, registrySummaries, type ChecklistMark } from './analysis';

export interface ReportOptions {
  /** The dossier's stated purpose (the title block's subtitle). */
  purpose?: string;
  /** The checklist marks (from the checklist store) when the report
   *  should carry the assessment results. */
  marks?: Record<string, { mark: ChecklistMark; evidence: string }>;
  /** The report date (ISO); defaults to today. */
  date?: string;
  /** A CUSTOM TEMPLATE (G4's template half): the dossier's HTML with
   *  the section placeholders — {{title}}, {{purpose}}, {{date}},
   *  {{namespace}}, {{soa}}, {{annexes}}, {{checklist}}. The built-in
   *  layout IS the default template; a custom one keeps the same
   *  placeholder contract and may reorder or restructure every
   *  section. */
  template?: string;
}

const esc = (v: string) => v
  .replaceAll('&', '&amp;')
  .replaceAll('<', '&lt;')
  .replaceAll('>', '&gt;')
  .replaceAll('"', '&quot;');

const MARK_CLASS: Record<string, string> = {
  satisfied: 'ok',
  partial: 'partial',
  'not-evidenced': 'missing',
};

export function buildAssessmentReport(model: Standard, opts: ReportOptions = {}): string {
  const meta = model.meta ?? ({} as Standard['meta']);
  const title = meta.title?.trim() || model.meta?.namespace?.trim() || 'Untitled model';
  const date = opts.date ?? new Date().toISOString().slice(0, 10);
  const purpose = opts.purpose ?? 'Assessment report';
  const regs = registrySummaries(model);
  const provisions = provisionSummaries(model);
  const checklist = checklistOf(model);

  const soaRows = provisions.map((p) => `
      <tr>
        <td class="id">${esc(p.id)}</td>
        <td><span class="mod">${esc(p.modality)}</span> ${esc(p.condition)}</td>
        <td>${esc(p.subjects.join('; '))}</td>
        <td class="cite">${esc(p.citations.join(' · '))}</td>
      </tr>`).join('');

  const annexes = regs.map((r) => `
    <section class="annex">
      <h3>${esc(r.id)}${r.title ? ` — ${esc(r.title)}` : ''}</h3>
      ${r.formless
        ? '<p class="formless">This registry declares no data class — its rows are formless.</p>'
        : `<p class="pairing">Data class <strong>${esc(r.classId ?? '')}</strong>${r.store ? ` · store <code>${esc(r.store)}</code>` : ''}</p>
      <table>
        <thead><tr><th>attribute</th><th>type</th><th>card.</th></tr></thead>
        <tbody>
          ${r.attributes.map((a) => `
          <tr><td class="id">${esc(a.id)}</td><td>${esc(a.type)}</td><td>${esc(a.cardinality)}</td></tr>`).join('')}
        </tbody>
      </table>`}
    </section>`).join('');

  const checkRows = checklist.map((c) => {
    const m = opts.marks?.[c.id];
    const cls = m ? MARK_CLASS[m.mark] ?? '' : 'unmarked';
    return `
      <tr>
        <td class="id">${esc(c.id)}</td>
        <td>${esc(c.statement)}</td>
        <td class="cite">${c.clause ? esc(c.clause) : ''}</td>
        <td class="mark ${cls}">${m ? esc(m.mark) : 'unmarked'}</td>
        <td>${m?.evidence ? esc(m.evidence) : ''}</td>
      </tr>`;
  }).join('');

  const soa = `
<h2>Statement of applicability</h2>
<table>
  <thead><tr><th>provision</th><th>condition</th><th>subject claims</th><th>citations</th></tr></thead>
  <tbody>${soaRows.length ? soaRows : '<tr><td colspan="4" class="formless">the model declares no provisions</td></tr>'}</tbody>
</table>`;

  const annexesHtml = `
<h2>Registry annexes</h2>
${annexes.length ? annexes : '<p class="formless">the model declares no registries</p>'}`;

  const checkHtml = `
<h2>Checklist results</h2>
<table>
  <thead><tr><th>requirement</th><th>statement</th><th>clause</th><th>mark</th><th>evidence</th></tr></thead>
  <tbody>${checkRows.length ? checkRows : '<tr><td colspan="5" class="formless">the model declares no requirements</td></tr>'}</tbody>
</table>`;

  // The template contract: the placeholders ARE the sections. The
  // built-in layout is itself the default template — a custom one
  // keeps the same contract and may reorder or restructure every
  // section.
  const placeholders: Record<string, string> = {
    title: esc(title),
    purpose: esc(purpose),
    date: esc(date),
    namespace: esc(model.meta?.namespace?.trim() ?? ''),
    soa,
    annexes: annexesHtml,
    checklist: checkHtml,
  };
  const layout = opts.template ?? `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>{{title}} — {{purpose}}</title>
<style>
  :root { color-scheme: light; }
  * { box-sizing: border-box; }
  body {
    margin: 0 auto; max-width: 46rem; padding: 3rem 2rem 4rem;
    font: 15px/1.55 Georgia, 'Times New Roman', serif; color: #1a1a18;
    background: #fffdf9;
  }
  header { border-bottom: 3px double #1a1a18; padding-bottom: 1rem; margin-bottom: 1.6rem; }
  h1 { font-size: 1.7rem; margin: 0 0 0.2rem; letter-spacing: 0.01em; }
  .purpose { font-style: italic; color: #55524a; margin: 0 0 0.5rem; }
  .meta { font-size: 0.78rem; color: #55524a; }
  h2 { font-size: 1.05rem; margin: 2.2rem 0 0.7rem; padding-bottom: 0.25rem; border-bottom: 1px solid #c9c4b8; }
  h3 { font-size: 0.95rem; margin: 1.2rem 0 0.4rem; }
  table { width: 100%; border-collapse: collapse; font-size: 0.82rem; }
  th { text-align: left; font-family: Georgia, serif; font-weight: 700; border-bottom: 1.5px solid #1a1a18; padding: 0.3rem 0.5rem 0.3rem 0; }
  td { border-bottom: 1px solid #ddd8cc; padding: 0.32rem 0.5rem 0.32rem 0; vertical-align: top; }
  td.id, .code { font-family: 'SFMono-Regular', Consolas, monospace; font-size: 0.74rem; }
  td.cite { color: #55524a; }
  .mod { font-variant: small-caps; letter-spacing: 0.04em; color: #55524a; }
  td.mark.ok { color: #3d6647; font-weight: 700; }
  td.mark.partial { color: #8a6116; font-weight: 700; }
  td.mark.missing { color: #8a2f2f; font-weight: 700; }
  td.mark.unmarked { color: #a09a8c; }
  .pairing { font-size: 0.82rem; color: #55524a; margin: 0.2rem 0 0.5rem; }
  .pairing code { font-size: 0.74rem; }
  .formless { color: #8a6116; font-style: italic; font-size: 0.84rem; }
  code { font-family: 'SFMono-Regular', Consolas, monospace; }
  footer { margin-top: 3rem; border-top: 1px solid #c9c4b8; padding-top: 0.6rem; font-size: 0.72rem; color: #a09a8c; }
  @media print {
    body { padding: 0; background: #fff; }
    h2 { break-after: avoid; }
    table { break-inside: auto; }
    tr { break-inside: avoid; }
  }
</style>
</head>
<body>
<header>
  <h1>{{title}}</h1>
  <p class="purpose">{{purpose}}</p>
  <p class="meta">{{namespace}}{{namespace ? " · " : ""}}{{date}} · generated from the model, unedited</p>
</header>

{{soa}}

{{annexes}}

{{checklist}}

<footer>Generated by Primmel Studio from the model as authored — no hand-edited content.</footer>
</body>
</html>`;
  return layout.replace(/{{title}}/g, placeholders.title)
    .replace(/{{purpose}}/g, placeholders.purpose)
    .replace(/{{date}}/g, placeholders.date)
    .replace(/{{namespace}}/g, placeholders.namespace)
    .replace(/{{soa}}/g, placeholders.soa)
    .replace(/{{annexes}}/g, placeholders.annexes)
    .replace(/{{checklist}}/g, placeholders.checklist);
}
