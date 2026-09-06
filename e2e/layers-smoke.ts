import puppeteer from 'puppeteer'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'

// ─────────────────────────────────────────────────────────────────────
// The layers leg (TODO.editor/05, slice 3) — the layer-overlay
// authoring view: the wall before any package is open, then the
// composition stack and the overlay pair for a package that layers a
// base (pkg-over over pkg-base: one overlay term), then the honest
// empty states for a package with no imports (pkg-base alone).
// Fixtures are temp-copied: the committed tree stays pristine.
// ─────────────────────────────────────────────────────────────────────

const FIXTURES = path.resolve(import.meta.dirname, '../src/lib/__tests__/fixtures')
const root = fs.mkdtempSync(path.join(os.tmpdir(), 'prl-layers-e2e-'))
process.on('exit', () => fs.rmSync(root, { recursive: true, force: true }))
for (const pkg of ['pkg-base', 'pkg-over']) {
  fs.cpSync(path.join(FIXTURES, pkg), path.join(root, pkg), { recursive: true })
}
const OVER_DIR = path.join(root, 'pkg-over')
const BASE_DIR = path.join(root, 'pkg-base')

const browser = await puppeteer.launch({ headless: true, args: ['--no-sandbox'] })
const page = await browser.newPage()
await page.setViewport({ width: 1440, height: 950 })
page.on('pageerror', e => console.log('PAGEERROR:', String(e)))
await page.goto(process.env.E2E_BASE ?? 'http://localhost:5173/', { waitUntil: 'domcontentloaded' })
await new Promise(r => setTimeout(r, 2500))

const fail = async (why: string) => { console.log('LAYERS FAILED:', why); await browser.close(); process.exit(1) }

const openPackage = async (dir: string) => {
  await page.evaluate(`(() => { document.querySelector('[data-testid="open-package"]').click() })()`)
  await new Promise(r => setTimeout(r, 400))
  await page.evaluate(`(() => {
    const input = document.querySelector('[data-testid="package-dir"]')
    input.value = ${JSON.stringify(dir)}
    input.dispatchEvent(new Event('input', { bubbles: true }))
  })()`)
  await new Promise(r => setTimeout(r, 200))
  await page.evaluate(`(() => { document.querySelector('[data-testid="package-open-confirm"]').click() })()`)
  await page.waitForSelector('[data-testid="package-opened"]', { timeout: 8000 }).catch(() => null)
  const probe = await page.evaluate(`(() => ({
    opened: !!document.querySelector('[data-testid="package-opened"]'),
    error: document.querySelector('[data-testid="package-error"]')?.textContent ?? null,
  }))()`)
  if (!probe.opened) await fail(`the package did not open: ${probe.error}`)
  await page.evaluate(`(() => { document.querySelector('[data-testid="package-done"]').click() })()`)
  await new Promise(r => setTimeout(r, 600))
}

// 1. Before any package is open, the Layers tab states the wall.
await page.evaluate(`(() => { document.querySelector('[data-testid="tab-layers"]').click() })()`)
await new Promise(r => setTimeout(r, 400))
let probe = await page.evaluate(`(() => ({
  wall: !!document.querySelector('[data-testid="layers-wall"]'),
  stack: document.querySelectorAll('[data-testid^="layer-"]').length,
}))()`)
console.log('wall:', JSON.stringify(probe))
if (!probe.wall) await fail('the no-package wall did not render')

// 2. Open pkg-over (over pkg-base): the stack and the overlay pair.
await openPackage(OVER_DIR)
probe = await page.evaluate(`(() => ({
  rootRow: !!document.querySelector('[data-testid="layer-pkg-over"]'),
  rootBadge: document.querySelector('[data-testid="layer-root-badge"]')?.textContent?.trim() ?? null,
  baseRow: !!document.querySelector('[data-testid="layer-pkg-base"]'),
  overCensus: document.querySelector('[data-testid="layer-census-pkg-over"]')?.textContent?.trim() ?? null,
  baseCensus: document.querySelector('[data-testid="layer-census-pkg-base"]')?.textContent?.trim() ?? null,
  overlayRow: !!document.querySelector('[data-testid="overlay-row-impartiality"]'),
  upstream: document.querySelector('[data-testid="overlay-upstream-impartiality"]')?.textContent ?? null,
}))()`)
console.log('stack:', JSON.stringify(probe))
if (!probe.rootRow || !probe.rootBadge?.includes('this package')) await fail('the root row/badge did not render')
if (!probe.baseRow) await fail('the layer row did not render')
if (!probe.overCensus?.includes('2 terms') || !probe.baseCensus?.includes('1 terms'))
  await fail(`the census is wrong (the winner takes the attribution): ${probe.overCensus} / ${probe.baseCensus}`)
if (!probe.overlayRow || !probe.upstream?.includes("the base layer's reading"))
  await fail('the overlay pair did not render with the upstream definition')

// 3. Clicking the overlay row selects the term (the inspector edits the
//    marker — the house pattern: panels select, the inspector edits).
await page.evaluate(`(() => { document.querySelector('[data-testid="overlay-row-impartiality"]').click() })()`)
await new Promise(r => setTimeout(r, 400))
probe = await page.evaluate(`(() => ({
  selection: (() => { const s = window.__stores.ui.selection; return s ? { id: s.id, type: s.type } : null })(),
}))()`)
console.log('selection:', JSON.stringify(probe))
if (probe.selection?.id !== 'impartiality' || probe.selection?.type !== 'term')
  await fail('the overlay row did not select the term')

// 4. pkg-base alone: the honest empty states (no layers beneath, no
//    overlay terms).
await openPackage(BASE_DIR)
probe = await page.evaluate(`(() => ({
  note: !!document.querySelector('[data-testid="layers-note"]'),
  empty: !!document.querySelector('[data-testid="overlays-empty"]'),
  loneRow: !!document.querySelector('[data-testid="layer-pkg-base"]'),
  staleOverlay: !!document.querySelector('[data-testid="overlay-row-impartiality"]'),
}))()`)
console.log('lone:', JSON.stringify(probe))
if (!probe.note || !probe.empty || !probe.loneRow || probe.staleOverlay)
  await fail('the lone-package states are wrong (or stale rows survived the reopen)')

console.log('LAYERS OK')
await browser.close()
process.exit(0)
