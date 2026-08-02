import puppeteer from 'puppeteer'

// Leg 1 (TODO.editor/19): create a process on the canvas, edit its
// facets through the inspector, serialize — the PRL text contains
// every edit.

const browser = await puppeteer.launch({ headless: true, args: ['--no-sandbox'] })
const page = await browser.newPage()
await page.setViewport({ width: 1440, height: 950 })
page.on('pageerror', e => console.log('PAGEERROR:', String(e)))
await page.goto('http://localhost:5173/', { waitUntil: 'domcontentloaded' })
await new Promise(r => setTimeout(r, 2500))

// 1. Create a process via the palette (click-to-add).
await page.evaluate(`(() => {
  document.querySelector('[data-testid="palette-process"]').click()
})()`)
await new Promise(r => setTimeout(r, 500))
let state = await page.evaluate(`(() => ({
  node: !!document.querySelector('[data-node-id="P1"]'),
}))()`)
console.log('created:', JSON.stringify(state))
if (!state.node) { console.log('LEG1 FAILED'); await browser.close(); process.exit(1) }

// 2. Select it and edit its facets through the inspector.
await page.evaluate(`(() => {
  document.querySelector('[data-node-id="P1"]').dispatchEvent(new MouseEvent('click', { bubbles: true }))
})()`)
await new Promise(r => setTimeout(r, 400))
await page.evaluate(`(() => {
  const input = document.querySelector('[data-testid="inspector-name"]')
  input.value = 'Calibrate the cell'
  input.dispatchEvent(new Event('change', { bubbles: true }))
})()`)
await new Promise(r => setTimeout(r, 400))
await page.evaluate(`(() => {
  const sel = document.querySelector('[data-testid="inspector-actor"]')
  sel.value = 'QA'
  sel.dispatchEvent(new Event('change', { bubbles: true }))
  const mod = document.querySelector('[data-testid="inspector-modality"]')
  mod.value = 'SHOULD'
  mod.dispatchEvent(new Event('change', { bubbles: true }))
})()`)
await new Promise(r => setTimeout(r, 500))

// 3. Serialize — the PRL text contains every facet.
state = await page.evaluate(`(() => {
  const text = window.__stores.model.serialize()
  return {
    hasName: text.includes('name "Calibrate the cell"'),
    hasActor: text.includes('actor QA'),
    hasModality: text.includes('modality SHOULD'),
    hasProcess: text.includes('process P1'),
    placed: /P1 \\{\\n\\s+x -?\\d+\\n\\s+y -?\\d+/.test(text),
  }
})()`)
console.log('serialized:', JSON.stringify(state))

const ok = state.hasName && state.hasActor && state.hasModality && state.hasProcess && state.placed
console.log(ok ? 'LEG1 OK' : 'LEG1 FAILED')
await browser.close()
process.exit(ok ? 0 : 1)
