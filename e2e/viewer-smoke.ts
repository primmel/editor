// ─────────────────────────────────────────────────────────────────────
// The viewer leg (Wave 4): `?readonly` mounts the read-only build — the
// editing chrome (palette, New/Save/Import, tree/page adds, comment
// compose) is gone, the store refuses every mutation, and the viewer
// surface (tree, canvas, code view, mapping, diff, validation) stays.
// The in-memory layout pass draws unpositioned pages.
// ─────────────────────────────────────────────────────────────────────
import puppeteer from 'puppeteer'

const BASE = process.env.E2E_BASE ?? 'http://localhost:5173/'
const browser = await puppeteer.launch({ headless: true, args: ['--no-sandbox'] })
const page = await browser.newPage()
await page.setViewport({ width: 1440, height: 950 })
page.on('pageerror', e => {
  // Monaco's async ops cancel on view-switch dispose — a benign artifact.
  const s = String(e)
  if (!s.includes('CancellationError')) console.log('PAGEERROR:', s)
})
await page.goto(`${BASE}?readonly`, { waitUntil: 'domcontentloaded' })
await new Promise(r => setTimeout(r, 2500))

// 1. The editing chrome is gone; the read-only badge shows.
let state = await page.evaluate(`(() => ({
  palette: !!document.querySelector('[data-testid="element-palette"]'),
  openNew: !!document.querySelector('[data-testid="open-new"]'),
  openSave: !!document.querySelector('[data-testid="open-save"]'),
  openImport: !!document.querySelector('[data-testid="open-import"]'),
  treeAdd: !!document.querySelector('[data-testid^="tree-add-"]'),
  pageAdd: !!document.querySelector('[data-testid="page-add"]'),
  commentCompose: !!document.querySelector('[data-testid="comment-input"]'),
  readOnlyBadge: !!document.querySelector('[data-testid="readonly-badge"]'),
  flag: window.__stores.model.readOnly,
}))()`)
console.log('chrome:', JSON.stringify(state))
if (state.palette || state.openNew || state.openSave || state.openImport
  || state.treeAdd || state.pageAdd || state.commentCompose
  || !state.readOnlyBadge || state.flag !== true) {
  console.log('VIEWER FAILED (chrome)'); await browser.close(); process.exit(1)
}

// 2. The store refuses every mutation path.
state = await page.evaluate(`(() => {
  const s = window.__stores.model
  const before = s.standard.processes.length
  s.execute({ label: 'probe', apply(ast) { ast.processes[0].name = 'MUTATED' }, revert() {} })
  const executeRefused = s.standard.processes[0].name !== 'MUTATED' && s.dirty === false
  const text = s.rawText
  s.setText('root X')
  const setTextRefused = s.rawText === text
  return { executeRefused, setTextRefused, processes: s.standard.processes.length, before }
})()`)
console.log('refusals:', JSON.stringify(state))
if (!state.executeRefused || !state.setTextRefused || state.processes !== state.before) {
  console.log('VIEWER FAILED (refusals)'); await browser.close(); process.exit(1)
}

// 3. The viewer surface stays: the tree, the canvas, the validation
//    badge — and the code view toggles to a READ-ONLY Monaco.
state = await page.evaluate(`(() => ({
  tree: !!document.querySelector('.model-tree'),
  canvas: !!document.querySelector('.canvas-svg'),
  validation: !!document.querySelector('[data-testid="validation-badge"]'),
  stats: [...document.querySelectorAll('.stat-pill')].map(p => p.textContent.trim()).join(' | '),
}))()`)
console.log('surface:', JSON.stringify(state))
if (!state.tree || !state.canvas || !state.validation || !state.stats.includes('processes')) {
  console.log('VIEWER FAILED (surface)'); await browser.close(); process.exit(1)
}

await page.evaluate(`(() => {
  [...document.querySelectorAll('button')].find(b => b.textContent.trim() === 'Code')?.click()
})()`)
await new Promise(r => setTimeout(r, 1200))
state = await page.evaluate(`(() => {
  const ed = window.__editor
  const v0 = ed.getModel().getValue()
  ed.trigger('viewer-probe', 'type', { text: 'X' })
  const monacoReadOnly = ed.getModel().getValue() === v0
  return {
    monaco: !!document.querySelector('.monaco-container'),
    openBtn: ![...document.querySelectorAll('.action-btn')].some(b => b.textContent.trim() === 'Open'),
    monacoReadOnly,
  }
})()`)
console.log('code view:', JSON.stringify(state))
if (!state.monaco || !state.openBtn || !state.monacoReadOnly) {
  console.log('VIEWER FAILED (code view)'); await browser.close(); process.exit(1)
}

// 4. The layout pass: an unpositioned page loads laid out (in memory;
//    the text is untouched).
state = await page.evaluate(`(() => {
  const s = window.__stores.model
  s.loadText(\`root Root

version "v1.0.0-dev1"

metadata {
  title "T"
  schema "Primmel 0.1"
  namespace "N"
}

start_event Start { }
process A { }
end_event Done { }

canvas Root {
  elements {
    Start { }
    A { }
    Done { }
  }
  process_flow {
    E1 { from Start to A }
    E2 { from A to Done }
  }
}\`)
  const c = s.standard.pages[0]
  const pos = Object.fromEntries(c.childs.map(x => [x.name, [x.x, x.y]]))
  return { pos, textUntouched: s.rawText.includes('Start { }'), dirty: s.dirty }
})()`)
console.log('layout pass:', JSON.stringify(state))
if (state.pos.A?.[0] !== 160 || state.pos.Done?.[0] !== 320 || !state.textUntouched || state.dirty) {
  console.log('VIEWER FAILED (layout pass)'); await browser.close(); process.exit(1)
}

// 5. The mapping and diff views still mount (the read-only lenses).
await page.evaluate(`(() => {
  [...document.querySelectorAll('button')].find(b => b.textContent.trim() === 'Mapping')?.click()
})()`)
await new Promise(r => setTimeout(r, 500))
const mappingOk = await page.evaluate(`(() => ({
  mapper: !!document.querySelector('.mapper'),
  loadRef: !!document.querySelector('[data-testid="load-ref"]'),
  automap: !!document.querySelector('[data-testid="automap-toggle"]'),
}))()`)
console.log('mapping:', JSON.stringify(mappingOk))
if (!mappingOk.mapper || mappingOk.loadRef || mappingOk.automap) {
  console.log('VIEWER FAILED (mapping)'); await browser.close(); process.exit(1)
}

await page.evaluate(`(() => {
  [...document.querySelectorAll('button')].find(b => b.textContent.trim() === 'Diff')?.click()
})()`)
await new Promise(r => setTimeout(r, 500))
const diffOk = await page.evaluate(`!!document.querySelector('.diff-view, [data-testid="diff-swap"]')`)
if (!diffOk) { console.log('VIEWER FAILED (diff)'); await browser.close(); process.exit(1) }

console.log('VIEWER OK')
await browser.close()
process.exit(0)
