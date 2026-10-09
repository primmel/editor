// ─────────────────────────────────────────────────────────────────────
// The .sdc clause-document parser (G11's increment — the parity
// register): the simple document format the legacy corpus carries
// (dptm.sdc, test.sdc): a header (namespace#/title#/version#) then
// `###` and per-line `clause#text` — consecutive lines under the same
// clause number are one statement's continuation; a NEW number starts
// a new clause (headings carry no text after the number). Pure; the
// document plane consumes the parsed shape.
// ─────────────────────────────────────────────────────────────────────

export interface SdcClause {
  /** The clause number ('1', '1.1', '1.1.1', …). */
  id: string;
  /** The joined statement text ('' for headings). */
  text: string;
}

export interface SdcDocument {
  namespace: string;
  title: string;
  version: string;
  clauses: SdcClause[];
}

export function parseSdc(text: string): SdcDocument {
  const lines = text.split(/\r?\n/);
  const doc: SdcDocument = { namespace: '', title: '', version: '', clauses: [] };
  let current: SdcClause | null = null;
  let sawSeparator = false;
  for (const raw of lines) {
    const line = raw.trim();
    if (line === '') continue;
    if (line === '###') {
      sawSeparator = true;
      continue;
    }
    const hash = line.indexOf('#');
    if (hash < 0) {
      // A continuation line without a number belongs to the open clause.
      if (current && line !== '') current.text += ` ${line}`;
      continue;
    }
    const key = line.slice(0, hash).trim();
    const value = line.slice(hash + 1).trim();
    if (!sawSeparator) {
      // The header: namespace/title/version before the ###.
      if (key === 'namespace') doc.namespace = value;
      else if (key === 'title') doc.title = value;
      else if (key === 'version') doc.version = value;
      continue;
    }
    // A clause line: a repeated number continues the SAME statement
    // (the format wraps long statements as many same-number lines);
    // a new number opens the next clause.
    if (current && current.id === key) {
      current.text += (current.text ? ' ' : '') + value;
      continue;
    }
    current = { id: key, text: value };
    doc.clauses.push(current);
  }
  return doc;
}
