import puppeteer from 'puppeteer'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { loadPackageWithProvenance, dump, load } from '@primmel/primmel'

// ─────────────────────────────────────────────────────────────────────
// The copy-up leg (TODO.editor Q1) — the "overlay this upstream term"
// verb: the Layers panel's upstream-terms section offers the candidates
// (terms a layer beneath authors, not yet claimed here); the button
// flips the marker and selects the term in the inspector (the house
// pattern — the panel never edits inline); the term inspector's banner
// offers the same verb from the other surface. Undo reverts exactly;
// the save adopts the claimed term into the root's file — the upstream
// bytes are never touched. Fixtures are temp-copied: the committed tree
// stays pristine.
// ─────────────────────────────────────────────────────────────────────

const FIXTURES = path.resolve(import.meta.dirname, '../src/lib/__tests__/fixtures')
const root = fs.mkdtempSync(path.join(os.tmpdir(), 'prl-copyup-e2e-'))
process.on('exit', () => fs.rmSync(root, { recursive: true, force: true }))
for (const pkg of ['pkg-base', 'pkg-over']) {
  fs.cpSync(path.join(FIXTURES, pkg), path.join(root, pkg), { recursive: true })
}
const OVER_DIR = path.join(root, 'pkg-over')

const browser = await puppeteer.launch({ headless: true, args: ['--no-sandbox'] })
const page = await browser.newPage()
await page.setViewport({ width: 1440, height: 950 })
page.on('pageerror', e => console.log('PAGEERROR:', String(e)))
await page.goto(process.env.E2E_BASE ?? 'http://localhost:5173/', { waitUntil: 'domcontentloaded' })
await new Promise(r => setTimeout(r, 2500))

const fail = async (why: string) => { console.log('COPY-UP FAILED:', why); await browser.close(); process.exit(1) }

// Open pkg-over (over pkg-base: `traceability` is the copy-up candidate).
await page.evaluate(`(() => { document.querySelector('[data-testid="open-package"]').click() })()`)
await new Promise(r => setTimeout(r, 400))
await page.evaluate(`(() => {
  const input = document.querySelector('[data-testid="package-dir"]')
  input.value = ${JSON.stringify(OVER_DIR)}
  input.dispatchEvent(new Event('input', { bubbles: true }))
})()`)
await new Promise(r => setTimeout(r, 200))
await page.evaluate(`(() => { document.querySelector('[data-testid="package-open-confirm"]').click() })()`)
await page.waitForSelector('[data-testid="package-opened"]', { timeout: 8000 }).catch(() => null)
await page.evaluate(`(() => { document.querySelector('[data-testid="package-done"]').click() })()`)
await new Promise(r => setTimeout(r, 600))

// 1. The Layers tab: the upstream-terms section names the candidate
//    (the authoring layer attested); the local overlay and the root's
//    own term are not candidates.
await page.evaluate(`(() => { document.querySelector('[data-testid="tab-layers"]').click() })()`)
await new Promise(r => setTimeout(r, 400))
let probe = await page.evaluate(`(() => ({
  row: !!document.querySelector('[data-testid="upstream-row-traceability"]'),
  who: document.querySelector('[data-testid="upstream-row-traceability"] .overlay-target')?.textContent?.trim() ?? null,
  def: document.querySelector('[data-testid="upstream-def-traceability"]')?.textContent ?? null,
  btn: !!document.querySelector('[data-testid="copy-up-traceability"]'),
  noOverlay: !document.querySelector('[data-testid="upstream-row-impartiality"]'),
  noOwn: !document.querySelector('[data-testid="upstream-row-own-scope"]'),
}))()`)
console.log('candidates:', JSON.stringify(probe))
if (!probe.row || !probe.btn) await fail('the upstream candidate row/button did not render')
if (!probe.who?.includes('from pkg-base') || !probe.who?.includes('BASE, 4.2')) await fail('the authoring layer is not attested')
if (!probe.def?.includes('related to references')) await fail('the upstream definition did not render')
if (!probe.noOverlay || !probe.noOwn) await fail('a non-candidate is listed (the local overlay or the root-owned term)')

// 2. The copy-up verb from the panel: the marker flips, the selection
//    lands in the inspector (select-to-inspect), the candidate row
//    drops out (the live read).
await page.evaluate(`(() => { document.querySelector('[data-testid="copy-up-traceability"]').click() })()`)
await new Promise(r => setTimeout(r, 400))
probe = await page.evaluate(`(() => ({
  selection: (() => { const s = window.__stores.ui.selection; return s ? { id: s.id, type: s.type } : null })(),
  panel: window.__stores.ui.rightPanel,
  overlay: window.__stores.model.standard.terms.find(t => t.id === 'traceability')?.overlay === true,
  inspector: !!document.querySelector('[data-testid="term-inspector"]'),
  selectValue: document.querySelector('[data-testid="term-overlay"]')?.value ?? null,
  bannerGone: !document.querySelector('[data-testid="term-upstream-banner"]'),
}))()`)
console.log('copied up:', JSON.stringify(probe))
if (probe.selection?.id !== 'traceability' || probe.selection?.type !== 'term')
  await fail('the verb did not select the term')
if (probe.panel !== 'inspector' || !probe.inspector) await fail('the verb did not land in the inspector')
if (!probe.overlay || probe.selectValue !== 'true') await fail('the marker did not flip (AST or the inspector select)')
if (!probe.bannerGone) await fail('the upstream banner should lift once the term is claimed')

// 3. Undo is exact: the marker key drops out, the candidate returns.
await page.evaluate(`(() => { window.__stores.model.undo() })()`)
await new Promise(r => setTimeout(r, 300))
probe = await page.evaluate(`(() => ({
  reverted: !('overlay' in window.__stores.model.standard.terms.find(t => t.id === 'traceability')),
  bannerBack: !!document.querySelector('[data-testid="term-upstream-banner"]'),
  bannerSays: document.querySelector('[data-testid="term-upstream-banner"]')?.textContent?.includes('pkg-base') ?? false,
}))()`)
console.log('undone:', JSON.stringify(probe))
if (!probe.reverted) await fail('undo did not revert the marker exactly')
if (!probe.bannerBack || !probe.bannerSays) await fail('the inspector banner did not return on undo')

// 4. The verb from the inspector surface (the banner's button).
await page.evaluate(`(() => { document.querySelector('[data-testid="term-copy-up"]').click() })()`)
await new Promise(r => setTimeout(r, 300))
probe = await page.evaluate(`(() => ({
  overlay: window.__stores.model.standard.terms.find(t => t.id === 'traceability')?.overlay === true,
  bannerGone: !document.querySelector('[data-testid="term-upstream-banner"]'),
}))()`)
console.log('copied up from the inspector:', JSON.stringify(probe))
if (!probe.overlay || !probe.bannerGone) await fail('the inspector copy-up did not flip the marker')

// 5. The save adopts the claimed term: the plan appends it to the
//    root's terminology file (+1), nothing reads as foreign.
await page.evaluate(`(() => { document.querySelector('[data-testid="open-save"]').click() })()`)
await new Promise(r => setTimeout(r, 600))
probe = await page.evaluate(`(() => ({
  row: document.querySelector('[data-testid="pkg-save-row-terminology.prl"]')?.textContent?.trim() ?? null,
  onlyRow: document.querySelectorAll('[data-testid^="pkg-save-row-"]').length,
  foreign: document.querySelectorAll('[data-testid="pkg-save-foreign"]').length,
}))()`)
console.log('plan:', JSON.stringify(probe))
if (!probe.row?.includes('terminology.prl') || !probe.row?.includes('+1') || probe.onlyRow !== 1)
  await fail('the plan should append exactly one term to terminology.prl')
if (probe.foreign !== 0) await fail('the claimed term still reads as foreign')

// 6. Write. The bytes on disk: the root file carries the marker and the
//    seeded content; the upstream package is byte-identical.
await page.evaluate(`(() => { document.querySelector('[data-testid="pkg-save-write"]').click() })()`)
await new Promise(r => setTimeout(r, 800))
probe = await page.evaluate(`(() => ({
  done: document.querySelector('[data-testid="save-done"]')?.textContent ?? null,
}))()`)
if (!probe.done?.includes('written to the package')) await fail('the write did not complete')

const overText = fs.readFileSync(path.join(OVER_DIR, 'terminology.prl'), 'utf8')
const baseText = fs.readFileSync(path.join(root, 'pkg-base/terminology.prl'), 'utf8')
if (!overText.includes('overlay true') || !overText.includes('related to references'))
  await fail('the adopted term is not on disk (marker or seed missing)')
if (!overText.includes("the rec's tighter reading"))
  await fail('the authored bytes above the append did not survive')
if (baseText !== fs.readFileSync(path.join(FIXTURES, 'pkg-base/terminology.prl'), 'utf8'))
  await fail('the upstream package was written — it is never the unit of work')

// 7. The written package reloads to the working model exactly, and the
//    reload's provenance names the ROOT for the adopted term.
const reloaded = loadPackageWithProvenance(OVER_DIR, {
  resolvePackage: (id) => {
    const p = path.join(root, id)
    return fs.existsSync(path.join(p, 'package.primmel')) ? p : undefined
  },
})
const workingText = await page.evaluate(`window.__stores.model.serialize()`)
if (dump(reloaded.standard) !== dump(load(workingText, { strict: true })))
  await fail('the reloaded package differs from the editor model')
if (reloaded.provenance.constructs['terms']?.['traceability']?.package !== 'pkg-over')
  await fail('the reload does not attribute the adopted term to the root')

console.log('COPY-UP OK')
await browser.close()
process.exit(0)
