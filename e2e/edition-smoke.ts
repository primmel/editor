import puppeteer from 'puppeteer'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'

// ─────────────────────────────────────────────────────────────────────
// The edition diff/publish leg (TODO.editor wave 05, slice 2) — open
// the NEW edition of the fixture pair (temp-copied: the finalize write
// path is real, the committed fixtures stay pristine), pick the OLD
// edition as the diff base through the panel's package intake, read
// the grouped diff with its per-tier tallies, click a row through to
// the inspector selection, then finalize: the working copy saves
// comment-true, the manifest's editions set gains the new label, and
// the release-note draft downloads to the browser (stubbed) — never
// into the package directory.
// ─────────────────────────────────────────────────────────────────────

const FIXTURES = path.resolve(import.meta.dirname, '../src/lib/__tests__/fixtures')
const root = fs.mkdtempSync(path.join(os.tmpdir(), 'prl-edition-e2e-'))
process.on('exit', () => fs.rmSync(root, { recursive: true, force: true }))
for (const pkg of ['pkg-ed-old', 'pkg-ed-new']) {
  fs.cpSync(path.join(FIXTURES, pkg), path.join(root, pkg), { recursive: true })
}
const NEW_DIR = path.join(root, 'pkg-ed-new')
const OLD_DIR = path.join(root, 'pkg-ed-old')
const YEAR = String(new Date().getFullYear())

const browser = await puppeteer.launch({ headless: true, args: ['--no-sandbox'] })
const page = await browser.newPage()
await page.setViewport({ width: 1440, height: 950 })
page.on('pageerror', e => console.log('PAGEERROR:', String(e)))
await page.goto(process.env.E2E_BASE ?? 'http://localhost:5173/', { waitUntil: 'domcontentloaded' })
await new Promise(r => setTimeout(r, 2500))

const fail = async (why: string) => { console.log('EDITION FAILED:', why); await browser.close(); process.exit(1) }

// 1. Before any package is open, the Editions tab states the wall.
await page.evaluate(`(() => { document.querySelector('[data-testid="tab-editions"]').click() })()`)
await new Promise(r => setTimeout(r, 400))
let probe = await page.evaluate(`(() => ({
  wall: !!document.querySelector('[data-testid="edition-wall"]'),
  picker: !!document.querySelector('[data-testid="edition-base-dir"]'),
}))()`)
console.log('wall:', JSON.stringify(probe))
if (!probe.wall || probe.picker) await fail('the no-package wall did not render (or the picker leaked)')

// 2. Open the NEW edition through the package dialog (the package API idiom).
await page.evaluate(`(() => { document.querySelector('[data-testid="open-package"]').click() })()`)
await new Promise(r => setTimeout(r, 400))
await page.evaluate(`(() => {
  const input = document.querySelector('[data-testid="package-dir"]')
  input.value = ${JSON.stringify(NEW_DIR)}
  input.dispatchEvent(new Event('input', { bubbles: true }))
})()`)
await new Promise(r => setTimeout(r, 200))
await page.evaluate(`(() => { document.querySelector('[data-testid="package-open-confirm"]').click() })()`)
await page.waitForSelector('[data-testid="package-opened"]', { timeout: 8000 }).catch(() => null)
probe = await page.evaluate(`(() => ({
  opened: !!document.querySelector('[data-testid="package-opened"]'),
  error: document.querySelector('[data-testid="package-error"]')?.textContent ?? null,
}))()`)
console.log('open:', JSON.stringify(probe))
if (!probe.opened) await fail(`the working package did not open: ${probe.error}`)
await page.evaluate(`(() => { document.querySelector('[data-testid="package-done"]').click() })()`)
await new Promise(r => setTimeout(r, 600))

// 3. No base yet: the wall explains, and finalize stays unavailable.
probe = await page.evaluate(`(() => ({
  noBase: !!document.querySelector('[data-testid="edition-no-base"]'),
  finalize: !!document.querySelector('[data-testid="edition-finalize"]'),
  summary: !!document.querySelector('[data-testid="edition-summary"]'),
}))()`)
console.log('no-base:', JSON.stringify(probe))
if (!probe.noBase || probe.finalize || probe.summary)
  await fail('the no-base wall did not render (or finalize leaked without a base)')

// 4. Pick the OLD edition as the base through the panel's intake.
await page.evaluate(`(() => {
  const input = document.querySelector('[data-testid="edition-base-dir"]')
  input.value = ${JSON.stringify(OLD_DIR)}
  input.dispatchEvent(new Event('input', { bubbles: true }))
})()`)
await new Promise(r => setTimeout(r, 200))
await page.evaluate(`(() => { document.querySelector('[data-testid="edition-base-open"]').click() })()`)
await page.waitForSelector('[data-testid="edition-base"]', { timeout: 8000 }).catch(() => null)
probe = await page.evaluate(`(() => ({
  base: document.querySelector('[data-testid="edition-base"] .base-id')?.textContent?.trim() ?? null,
  baseError: document.querySelector('[data-testid="edition-base-error"]')?.textContent ?? null,
  storeBase: window.__stores.edition.base ? window.__stores.edition.base.id + '@' + window.__stores.edition.base.version : null,
}))()`)
console.log('base:', JSON.stringify(probe))
if (probe.base !== 'pkg-ed@1.0.0' || probe.baseError) await fail(`the base did not pick: ${JSON.stringify(probe)}`)
if (probe.storeBase !== 'pkg-ed@1.0.0') await fail('the edition store does not hold the base')

// 5. The diff renders: the totals line, the per-tier tallies, the four
//    groups with their rows.
probe = await page.evaluate(`(() => ({
  total: document.querySelector('[data-testid="edition-total"]')?.textContent?.replace(/\\s+/g, ' ').trim() ?? null,
  foundations: document.querySelector('[data-testid="edition-tier-foundations"]')?.textContent?.replace(/\\s+/g, ' ').trim() ?? null,
  secondary: document.querySelector('[data-testid="edition-tier-secondary"]')?.textContent?.replace(/\\s+/g, ' ').trim() ?? null,
  groups: [...document.querySelectorAll('[data-testid^="edition-group-"]')].map((el) => el.getAttribute('data-testid') + ':' + el.textContent.trim()),
  rows: [...document.querySelectorAll('[data-testid^="edition-row-"]')].map((el) => el.getAttribute('data-testid')),
}))()`)
console.log('diff:', JSON.stringify(probe))
if (probe.total !== '+2 added · −1 removed · ~1 changed · >1 moved · 0 unchanged')
  await fail(`the totals line is wrong: ${probe.total}`)
if (!probe.foundations?.includes('+1') || !probe.foundations?.includes('−1') || !probe.foundations?.includes('~1'))
  await fail(`the foundations tally is wrong: ${probe.foundations}`)
if (!probe.secondary?.includes('+1') || !probe.secondary?.includes('>1'))
  await fail(`the secondary tally is wrong: ${probe.secondary}`)
for (const g of ['edition-group-added:added (2)', 'edition-group-removed:removed (1)', 'edition-group-changed:changed (1)', 'edition-group-moved:moved (1)'])
  if (!probe.groups.includes(g)) await fail(`the group label is missing or wrong: ${g}`)
for (const r of ['edition-row-terms:gamma', 'edition-row-terms:beta', 'edition-row-terms:alpha', 'edition-row-requirements:/req/ed/stability', 'edition-row-requirements:/req/ed/resolution'])
  if (!probe.rows.includes(r)) await fail(`the diff row is missing: ${r}`)

// 6. The row sub-lines carry the changed fields / the moved anchor.
probe = await page.evaluate(`(() => ({
  changed: document.querySelector('[data-testid="edition-row-sub-terms:alpha"]')?.textContent?.trim() ?? null,
  moved: document.querySelector('[data-testid="edition-row-sub-requirements:/req/ed/stability"]')?.textContent?.trim() ?? null,
}))()`)
console.log('subs:', JSON.stringify(probe))
if (probe.changed !== 'statement (fields: definition)') await fail(`the changed sub-line is wrong: ${probe.changed}`)
if (!probe.moved?.includes('model.parameters.zero') || !probe.moved?.includes('model.parameters.span'))
  await fail(`the moved sub-line is wrong: ${probe.moved}`)

// 7. Click a row: the house select-to-inspect pattern (no inline edits).
await page.evaluate(`(() => { document.querySelector('[data-testid="edition-row-terms:alpha"]').click() })()`)
await new Promise(r => setTimeout(r, 300))
probe = await page.evaluate(`(() => ({
  selection: (() => { const s = window.__stores.ui.selection; return s ? { id: s.id, type: s.type } : null })(),
}))()`)
console.log('selection:', JSON.stringify(probe))
if (probe.selection?.id !== 'alpha' || probe.selection?.type !== 'term')
  await fail('the diff row did not select the term')

// 8. Edit the working copy so the finalize's first save has content to
//    persist (the comment-true splice).
await page.evaluate(`(() => {
  window.__stores.model.execute({
    label: 'probe reword gamma',
    apply(ast) { ast.terms.find((t) => t.id === 'gamma').definition = 'a term the new edition adds (tightened in review)' },
    revert(ast) { ast.terms.find((t) => t.id === 'gamma').definition = 'a term the new edition adds' },
  })
})()`)
await new Promise(r => setTimeout(r, 300))

// 9. Stub the download (the release-note draft travels as a blob).
await page.evaluate(`(() => {
  window.__dl = { names: [], blobs: [] };
  const origCreate = URL.createObjectURL.bind(URL);
  URL.createObjectURL = (blob) => { window.__dl.blobs.push(blob); return origCreate(blob); };
  HTMLAnchorElement.prototype.click = function () {
    if (this.download) { window.__dl.names.push(this.download); return; }
    this.dispatchEvent(new MouseEvent('click', { bubbles: true }));
  };
})()`)

// 10. Finalize: the label prompt prefills the current year; confirm.
await page.evaluate(`(() => { document.querySelector('[data-testid="edition-finalize"]').click() })()`)
await new Promise(r => setTimeout(r, 300))
probe = await page.evaluate(`(() => ({
  label: document.querySelector('[data-testid="edition-label"]')?.value ?? null,
}))()`)
console.log('prefill:', JSON.stringify(probe))
if (probe.label !== YEAR) await fail(`the label prefill is not the current year: ${probe.label}`)
await page.evaluate(`(() => { document.querySelector('[data-testid="edition-confirm"]').click() })()`)
await page.waitForSelector('[data-testid="edition-finalized"]', { timeout: 8000 }).catch(() => null)

// 11. The finalize landed: the confirmation, the draft preview, the
//     download, the cleared dirty flag, the store state.
probe = await page.evaluate(`(() => ({
  finalized: document.querySelector('[data-testid="edition-finalized"]')?.textContent?.replace(/\\s+/g, ' ').trim() ?? null,
  error: document.querySelector('[data-testid="edition-finalize-error"]')?.textContent ?? null,
  note: document.querySelector('[data-testid="edition-note-text"]')?.textContent ?? null,
  downloads: window.__dl.names,
  dirty: window.__stores.model.dirty,
  editions: window.__stores.model.standard.packageManifest.editions,
}))()`)
console.log('finalized:', JSON.stringify({ ...probe, note: probe.note ? probe.note.slice(0, 120) : null }))
if (probe.error) await fail(`the finalize errored: ${probe.error}`)
if (!probe.finalized?.includes(`edition ${YEAR} declared`)) await fail('the finalize confirmation did not render')
if (probe.dirty) await fail('the dirty flag survived the finalize')
if (JSON.stringify(probe.editions) !== JSON.stringify([YEAR, '2025']))
  await fail(`the manifest editions did not prepend: ${JSON.stringify(probe.editions)}`)
if (JSON.stringify(probe.downloads) !== JSON.stringify([`pkg-ed-${YEAR}-release-notes.md`]))
  await fail(`the release-note download is wrong: ${JSON.stringify(probe.downloads)}`)
if (!probe.note?.includes(`# pkg-ed — edition ${YEAR} release notes (draft)`)
  || !probe.note.includes('| foundations | 1 | 1 | 1 | 0 | 0 |')
  || !probe.note.includes('`terms/alpha` (foundations) — statement (fields: definition)')
  || !probe.note.includes('`requirements//req/ed/stability` (secondary) — bindsTo'))
  await fail('the release-note draft is missing the header, the tallies, or the element lines')

// The downloaded blob IS the previewed draft.
const blobText = await page.evaluate(`(() => window.__dl.blobs[0].text())()`)
const domNote = probe.note
if (blobText !== domNote) await fail('the downloaded draft differs from the previewed one')

// 12. The byte discipline on disk: the manifest carries the new
//     editions set; the terminology splice kept the comment banner;
//     the untouched requirements file never moved; NO draft file landed
//     in the package directory.
const manifest = fs.readFileSync(path.join(NEW_DIR, 'package.primmel'), 'utf8')
if (!manifest.includes(`editions { ${YEAR} 2025 }`))
  await fail(`the written manifest lacks the new editions set:\n${manifest}`)
const terminology = fs.readFileSync(path.join(NEW_DIR, 'terminology.prl'), 'utf8')
if (!terminology.includes('a term the new edition adds (tightened in review)'))
  await fail('the working-copy edit did not persist through the finalize')
if (!terminology.includes("// The editioned package's vocabulary — the NEW edition (the unit of work)."))
  await fail('the comment banner did not survive the finalize write')
const requirements = fs.readFileSync(path.join(NEW_DIR, 'requirements.prl'), 'utf8')
if (requirements !== fs.readFileSync(path.join(FIXTURES, 'pkg-ed-new/requirements.prl'), 'utf8'))
  await fail('the untouched requirements file changed bytes')
if (fs.readdirSync(NEW_DIR).some((f) => f.endsWith('.md')))
  await fail('a release-note draft was written into the package directory (the byte-contract guard would trip)')
console.log('on-disk: manifest editions + comment-true splice + no draft file: OK')

console.log('EDITION OK')
await browser.close()
process.exit(0)
