// ─────────────────────────────────────────────────────────────────────
// The document model (TODO.editor/10) — a document (a Metanorma
// presentation XML from the corpus, or a pasted plain-text document)
// parsed into clauses → paragraphs → statements with STABLE ids —
// the mapping targets of the doc-map profile.
//
// The URN discipline: a statement's URN is `<base>#<id>` where base
// is the document's own identifier (`urn:oiml:pub:r:60-2:2021`-shaped
// when the docidentifier resolves to a known form, else a doc-local
// slug) — the same `ns#id` target shape the model mapper uses, so the
// pair/overlay/party machinery works unchanged.
// ─────────────────────────────────────────────────────────────────────

export interface DocStatement {
  /** The doc-local id (`2.10.1.p1.s2`), stable for the document. */
  id: string;
  /** The full mapping target (`<base>#<id>`). */
  urn: string;
  text: string;
  clauseNumber: string;
}

export interface DocParagraph {
  id: string;
  statements: DocStatement[];
}

export interface DocClause {
  id: string;
  number: string;
  title: string;
  paragraphs: DocParagraph[];
}

export interface DocumentModel {
  docid: string;
  title: string;
  urnBase: string;
  clauses: DocClause[];
  /** Every statement, by id (the overlay/party lookup). */
  statements: Map<string, DocStatement>;
}

/** The sentence splitter (statement splitting): boundaries at a full
 *  stop followed by whitespace + a capital/digit/list marker. Quotes
 *  and decimals do not split (the decimal point is not followed by
 *  whitespace). */
export function splitStatements(text: string): string[] {
  const clean = text.replace(/\s+/g, ' ').trim();
  if (!clean) return [];
  const parts = clean.split(/(?<=[.!?])\s+(?=[A-Z0-9("(])/);
  return parts.map(p => p.trim()).filter(p => p.length > 0);
}

/** Slugify a docidentifier for the doc-local URN base. */
function slugify(s: string): string {
  return s.trim().replace(/[^A-Za-z0-9]+/g, '-').replace(/^-+|-+$/g, '') || 'document';
}

/** The URN base for a docidentifier: the OIML publication form when
 *  resolvable (`OIML R 60-2:2021` or `OIML R 7 1979` →
 *  `urn:oiml:pub:r:60-2:2021` / `urn:oiml:pub:r:7:1979`), else the
 *  document-local slug. */
export function urnBaseFor(docid: string): string {
  const m = /OIML\s+R\s*(\d+)(?:-(\d+))?(?:[:\s](\d{4}))?/i.exec(docid);
  if (m) {
    const [, part, sub, year] = m;
    return `urn:oiml:pub:r:${part}${sub ? '-' + sub : ''}${year ? ':' + year : ''}`;
  }
  return `doc:${slugify(docid)}`;
}

/** The XML parser seam: the browser's DOMParser in the app, linkedom's
 *  in tests. Typed loosely — the two DOM typings conflict (and the
 *  interface used here is tiny). */
export interface XmlParserLike {
  parseFromString(text: string, mime: string): unknown;
}

/** Parse a Metanorma presentation XML into the document model. */
export function parsePresentationXml(xmlText: string, dom?: XmlParserLike): DocumentModel {
  const parser = dom ?? (new DOMParser() as XmlParserLike);
  const doc = parser.parseFromString(xmlText, 'text/xml') as Document;
  const parserError = doc.querySelector('parsererror');
  if (parserError) throw new Error('not a well-formed XML document');

  const docid = doc.querySelector('bibdata docidentifier')?.textContent?.trim()
    || doc.querySelector('docidentifier')?.textContent?.trim()
    || 'document';
  const title = doc.querySelector('bibdata title')?.textContent?.trim() ?? docid;
  let urnBase = urnBaseFor(docid);
  // The edition year: when the docidentifier carries none, take the
  // bibdata's published/issued year (the OIML URN convention is
  // year-qualified — `urn:oiml:pub:r:7:1979`).
  if (urnBase.startsWith('urn:oiml:') && !/:\d{4}$/.test(urnBase)) {
    const year = doc.querySelector('bibdata date on')?.textContent?.trim().slice(0, 4)
      ?? doc.querySelector('bibdata date')?.textContent?.trim().slice(0, 4);
    if (year && /^\d{4}$/.test(year)) urnBase = `${urnBase}:${year}`;
  }

  const statements = new Map<string, DocStatement>();
  const clauses: DocClause[] = [];

  // Only TOP-LEVEL content clauses (direct children of sections/annex —
  // a nested subclause's content belongs to its parent at this grain);
  // the ToC and boilerplate are skipped. Documents whose clause titles
  // carry no numbers (the R 7 form) get ordinal ids (s1, s2, …) in
  // document order — stable for the document, and the tutorial names
  // the caveat: the semantic clause numbers live in the model's
  // `source { clause }` facets.
  const clauseEls = [...doc.querySelectorAll('sections > clause, annex > clause')]
    .filter(el => el.getAttribute('type') !== 'toc');

  for (const el of clauseEls) {
    const titleEl = [...el.children].find(c => c.tagName === 'title');
    const rawTitle = titleEl?.textContent?.replace(/\s+/g, ' ').trim() ?? '';
    // The clause number: the title's leading numeric token, else the
    // clause's position among the top-level clauses.
    const numMatch = /^(\d+(?:\.\d+)*)\s*/.exec(rawTitle);
    const number = numMatch ? numMatch[1]! : `s${clauses.length + 1}`;
    const clauseId = el.getAttribute('id') ?? number;

    const paragraphs: DocParagraph[] = [];
    let pCount = 0;
    let liCount = 0;
    // Every descendant paragraph and list item, in document order.
    for (const child of el.querySelectorAll('p, ol, ul')) {
      if (child.tagName === 'p') {
        pCount++;
        const pid = `${number}.p${pCount}`;
        const text = child.textContent?.replace(/\s+/g, ' ').trim() ?? '';
        if (!text) continue;
        const sentences = splitStatements(text);
        const stmts: DocStatement[] = sentences.map((s, i) => {
          const id = sentences.length > 1 ? `${pid}.s${i + 1}` : pid;
          const stmt: DocStatement = { id, urn: `${urnBase}#${id}`, text: s, clauseNumber: number };
          statements.set(id, stmt);
          return stmt;
        });
        paragraphs.push({ id: pid, statements: stmts });
      } else {
        for (const li of [...child.children].filter(c => c.tagName === 'li')) {
          liCount++;
          const id = `${number}.li${liCount}`;
          const text = li.textContent?.replace(/\s+/g, ' ').trim() ?? '';
          if (!text) continue;
          const stmt: DocStatement = { id, urn: `${urnBase}#${id}`, text, clauseNumber: number };
          statements.set(id, stmt);
          paragraphs.push({ id, statements: [stmt] });
        }
      }
    }
    clauses.push({ id: clauseId, number, title: rawTitle, paragraphs });
  }

  return { docid, title, urnBase, clauses, statements };
}

/** Parse a pasted plain-text document: each non-empty line is a
 *  paragraph under the synthetic clause `doc`; sentences split as
 *  usual. */
export function parsePlainText(text: string, docid = 'pasted document'): DocumentModel {
  const urnBase = `doc:${slugify(docid)}`;
  const statements = new Map<string, DocStatement>();
  const paragraphs: DocParagraph[] = [];
  let pCount = 0;
  for (const line of text.split(/\r?\n/)) {
    const clean = line.replace(/\s+/g, ' ').trim();
    if (!clean) continue;
    pCount++;
    const pid = `doc.p${pCount}`;
    const sentences = splitStatements(clean);
    const stmts: DocStatement[] = sentences.map((s, i) => {
      const id = sentences.length > 1 ? `${pid}.s${i + 1}` : pid;
      const stmt: DocStatement = { id, urn: `${urnBase}#${id}`, text: s, clauseNumber: 'doc' };
      statements.set(id, stmt);
      return stmt;
    });
    paragraphs.push({ id: pid, statements: stmts });
  }
  return {
    docid,
    title: docid,
    urnBase,
    clauses: [{ id: 'doc', number: 'doc', title: docid, paragraphs }],
    statements,
  };
}

/** The load entry: XML when the text parses as XML, else plain text.
 *  `dom` is the browser's native parser by default; tests inject one. */
export function loadDocument(text: string, docid?: string, dom?: XmlParserLike): DocumentModel {
  return text.trimStart().startsWith('<')
    ? parsePresentationXml(text, dom)
    : parsePlainText(text, docid);
}
