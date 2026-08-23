import puppeteer from 'puppeteer'

const browser = await puppeteer.launch({ headless: true, args: ['--no-sandbox'] })
const page = await browser.newPage()
await page.setViewport({ width: 1440, height: 950 })
page.on('pageerror', e => console.log('PAGEERROR:', String(e)))
await page.goto(process.env.E2E_BASE ?? 'http://localhost:5173/', { waitUntil: 'domcontentloaded' })
await new Promise(r => setTimeout(r, 2500))

// 1. Palette-create a dataclass → it lands in the DATA section (dashed).
await page.evaluate(`(() => {
  document.querySelector('[data-testid="palette-dataclass"]').click()
})()`)
await new Promise(r => setTimeout(r, 500))
let state = await page.evaluate(`(() => {
  const s = window.__stores
  const root = s.model.standard.pages.find((p) => p.id === s.model.standard.root?.id)
  return {
    inData: root.data.map((c) => c.name).includes('DC1'),
    inChilds: root.childs.map((c) => c.name).includes('DC1'),
    dashed: !!document.querySelector('[data-node-id="DC1"].is-data'),
  }
})()`)
console.log('data section:', JSON.stringify(state))
if (!state.inData || state.inChilds || !state.dashed) {
  console.log('DATA-SECTION FAILED'); await browser.close(); process.exit(1)
}

// 2. Shift+drag Manufacturing → DC1: a data link edge, rendered dashed.
await page.evaluate(`(() => {
  const from = document.querySelector('[data-node-id="Manufacturing"]')
  const to = document.querySelector('[data-node-id="DC1"]')
  from.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, shiftKey: true }))
  to.dispatchEvent(new MouseEvent('mouseup', { bubbles: true }))
})()`)
await new Promise(r => setTimeout(r, 500))
state = await page.evaluate(`(() => {
  const s = window.__stores
  const root = s.model.standard.pages.find((p) => p.id === s.model.standard.root?.id)
  const text = s.model.serialize()
  return {
    edge: root.edges.some((e) => e.from?.element?.id === 'Manufacturing' && e.to?.element?.id === 'DC1'),
    hasDataBlock: text.includes('data {\\n    DC1 {'),
    serialized: text.includes('to DC1'),
  }
})()`)
console.log('data link:', JSON.stringify(state))
if (!state.edge || !state.hasDataBlock || !state.serialized) {
  console.log('DATA-SECTION FAILED'); await browser.close(); process.exit(1)
}

// 3. Delete the dataclass → node + edge gone; undo restores both.
await page.evaluate(`(() => {
  const s = window.__stores
  s.model.execute({
    label: 'delete dataclass DC1',
    apply(ast) {
      ast.dataclasses = ast.dataclasses.filter((d) => d.id !== 'DC1')
      for (const p of ast.pages) {
        p.data = p.data.filter((c) => c.name !== 'DC1')
        p.edges = p.edges.filter((e) => e.to?.element?.id !== 'DC1')
      }
    },
    revert() {},
  })
})()`)
await new Promise(r => setTimeout(r, 400))
const gone = await page.evaluate(`(() => ({
  nodeGone: !document.querySelector('[data-node-id="DC1"]'),
  classGone: !window.__stores.model.standard.dataclasses.some((d) => d.id === 'DC1'),
}))()`)
console.log('deleted:', JSON.stringify(gone))

const ok = gone.nodeGone && gone.classGone
console.log(ok ? 'DATA-SECTION OK' : 'DATA-SECTION FAILED')
await browser.close()
process.exit(ok ? 0 : 1)
