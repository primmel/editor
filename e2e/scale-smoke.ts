import puppeteer from 'puppeteer'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

// ─────────────────────────────────────────────────────────────────────
// The scale proof (TODO.editor/34) — the corpus's biggest model
// (ISO27001: 262 processes, 77 pages) through the app: the tree, a
// page render inside the frame budget (the viewport cull), the
// mapper, and the save preview — without a freeze.
// ─────────────────────────────────────────────────────────────────────

// Corpus files travel from node directly — fetching them through the
// dev server pulls them into vite's module graph and can reload the
// page mid-evaluate (the collected-promise artifact).
const ISO27001 = readFileSync(join('src/lib/__tests__/fixtures/corpus', 'iso27001.mmel'), 'utf8')
const PAS2060 = readFileSync(join('src/lib/__tests__/fixtures/corpus', 'pas2060.mmel'), 'utf8')

const browser = await puppeteer.launch({ headless: true, args: ['--no-sandbox'] })
const page = await browser.newPage()
await page.setViewport({ width: 1440, height: 950 })
page.on('pageerror', e => console.log('PAGEERROR:', String(e)))
await page.goto(process.env.E2E_BASE ?? 'http://localhost:5173/', { waitUntil: 'domcontentloaded' })
await new Promise(r => setTimeout(r, 2500))

// 1. Load the corpus's biggest model and measure the parse+render.
const t0 = Date.now()
await page.evaluate(`((text) => {
  window.__stores.model.loadText(text)
})(${JSON.stringify(ISO27001).replace(/`/g, '\\`')})`)
await new Promise(r => setTimeout(r, 3000))
const loadMs = Date.now() - t0

let state = await page.evaluate(`(() => {
  const s = window.__stores
  return {
    processes: s.model.standard.processes.length,
    pages: s.model.standard.pages.length,
    treeGroups: document.querySelectorAll('.tree-group').length,
    treeItems: document.querySelectorAll('.group-items li').length,
    nodesRendered: document.querySelectorAll('.node-group').length,
    parseError: s.model.parseError,
  }
})()`)
console.log('loaded:', JSON.stringify({ ...state, loadMs }))
if (state.processes !== 262 || state.pages !== 77 || state.parseError) {
  console.log('SCALE FAILED'); await browser.close(); process.exit(1)
}

// 2. The viewport cull keeps the rendered node count bounded at scale.
state = await page.evaluate(`(() => {
  const s = window.__stores
  const root = s.model.standard.pages.find((p) => p.id === s.model.standard.root?.id)
  const total = root?.childs?.length ?? 0
  return { total, rendered: document.querySelectorAll('.node-group').length }
})()`)
console.log('cull:', JSON.stringify(state))
if (state.rendered > state.total) {
  console.log('SCALE FAILED (rendered more than the page holds)')
  await browser.close(); process.exit(1)
}

// 3. A page switch at scale is fast (tab click → next frame).
const t1 = Date.now()
await page.evaluate(`(() => {
  const tabs = Array.from(document.querySelectorAll('.canvas-tab'))
  tabs[1]?.click()
})()`)
await new Promise(r => setTimeout(r, 400))
const switchMs = Date.now() - t1
state = await page.evaluate(`(() => ({
  active: document.querySelector('.canvas-tab.active')?.textContent ?? null,
  rendered: document.querySelectorAll('.node-group').length,
}))()`)
console.log('page switch:', JSON.stringify({ ...state, switchMs }))
if (!state.active || switchMs > 2000) {
  console.log('SCALE FAILED (slow page switch)')
  await browser.close(); process.exit(1)
}

// 4. The mapper opens with it as IMP; automap computes without freezing.
const t2 = Date.now()
await page.evaluate(`(() => { window.__stores.ui.view = 'mapping' })()`)
await new Promise(r => setTimeout(r, 800))
await page.evaluate(`((text) => {
  window.__stores.mapping.loadRefText(text)
})(${JSON.stringify(PAS2060).replace(/`/g, '\\`')})`)
await new Promise(r => setTimeout(r, 1500))
const mapMs = Date.now() - t2
state = await page.evaluate(`(() => ({
  pane: !!document.querySelector('[data-testid="imp-pane"]'),
  partyItems: document.querySelectorAll('.party-row').length,
}))()`)
console.log('mapper:', JSON.stringify({ ...state, mapMs }))
if (!state.pane || state.partyItems === 0 || mapMs > 10000) {
  console.log('SCALE FAILED (mapper at scale)')
  await browser.close(); process.exit(1)
}

// 5. The save preview computes at scale (diff of two big models).
const t3 = Date.now()
await page.evaluate(`(() => {
  document.querySelector('[data-testid="open-save"]').click()
})()`)
await new Promise(r => setTimeout(r, 2500))
const diffMs = Date.now() - t3
state = await page.evaluate(`(() => ({
  panel: !!document.querySelector('[data-testid="save-panel"]'),
  counts: document.querySelector('.diff-counts')?.textContent?.trim() ?? null,
}))()`)
console.log('save preview:', JSON.stringify({ ...state, diffMs }))

const ok = state.panel && diffMs < 10000 && loadMs < 15000
console.log(ok ? 'SCALE OK' : 'SCALE FAILED')
await browser.close()
process.exit(ok ? 0 : 1)
