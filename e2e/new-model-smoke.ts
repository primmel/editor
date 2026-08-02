import puppeteer from 'puppeteer'

const browser = await puppeteer.launch({ headless: true, args: ['--no-sandbox'] })
const page = await browser.newPage()
await page.setViewport({ width: 1440, height: 950 })
page.on('pageerror', e => console.log('PAGEERROR:', String(e)))
await page.goto('http://localhost:5173/', { waitUntil: 'domcontentloaded' })
await new Promise(r => setTimeout(r, 2500))

// 1. Open the New dialog, pick implementation, fill in, create.
await page.evaluate(`(() => { document.querySelector('[data-testid="open-new"]').click() })()`)
await new Promise(r => setTimeout(r, 400))
let state = await page.evaluate(`(() => ({
  dialog: !!document.querySelector('[data-testid="new-model-dialog"]'),
  cards: document.querySelectorAll('.kind-card').length,
}))()`)
console.log('dialog:', JSON.stringify(state))
if (!state.dialog || state.cards !== 3) { console.log('NEW FAILED'); await browser.close(); process.exit(1) }

await page.evaluate(`(() => {
  document.querySelector('[data-testid="kind-implementation"]').click()
})()`)
await new Promise(r => setTimeout(r, 200))
await page.evaluate(`(() => {
  const t = document.querySelector('[data-testid="new-title"]')
  t.value = 'Acme Ops'
  t.dispatchEvent(new Event('input', { bubbles: true }))
  const n = document.querySelector('[data-testid="new-namespace"]')
  n.value = 'AcmeOps'
  n.dispatchEvent(new Event('input', { bubbles: true }))
})()`)
await new Promise(r => setTimeout(r, 200))
await page.evaluate(`(() => { document.querySelector('[data-testid="new-create"]').click() })()`)
await new Promise(r => setTimeout(r, 700))
state = await page.evaluate(`(() => ({
  ns: window.__stores.model.standard.meta.namespace,
  processes: window.__stores.model.standard.processes.map((p) => p.id),
  notes: window.__stores.model.standard.notes.map((n) => n.id),
  nodes: document.querySelectorAll('.node-group').length,
  dirty: window.__stores.model.dirty,
}))()`)
console.log('created implementation:', JSON.stringify(state))
if (state.ns !== 'AcmeOps' || !state.processes.includes('FirstProcess')
  || !state.notes.includes('MappingGuide') || state.nodes !== 3 || state.dirty) {
  console.log('NEW FAILED'); await browser.close(); process.exit(1)
}

// 2. A reference model the same way.
await page.evaluate(`(() => { document.querySelector('[data-testid="open-new"]').click() })()`)
await new Promise(r => setTimeout(r, 300))
await page.evaluate(`(() => {
  document.querySelector('[data-testid="kind-reference"]').click()
  const t = document.querySelector('[data-testid="new-title"]')
  t.value = 'Clinical thermometers'
  t.dispatchEvent(new Event('input', { bubbles: true }))
  const n = document.querySelector('[data-testid="new-namespace"]')
  n.value = 'OIML.R7'
  n.dispatchEvent(new Event('input', { bubbles: true }))
})()`)
await new Promise(r => setTimeout(r, 200))
await page.evaluate(`(() => { document.querySelector('[data-testid="new-create"]').click() })()`)
await new Promise(r => setTimeout(r, 700))
state = await page.evaluate(`(() => ({
  ns: window.__stores.model.standard.meta.namespace,
  title: window.__stores.model.standard.meta.title,
  roles: window.__stores.model.standard.roles.map((r) => r.id),
  nodes: document.querySelectorAll('.node-group').length,
}))()`)
console.log('created reference:', JSON.stringify(state))

const ok = state.ns === 'OIML.R7' && state.title === 'Clinical thermometers'
  && state.roles.includes('OIMLR7') && state.nodes === 3
console.log(ok ? 'NEW OK' : 'NEW FAILED')
await browser.close()
process.exit(ok ? 0 : 1)
