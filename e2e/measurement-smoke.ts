import puppeteer from 'puppeteer'

const browser = await puppeteer.launch({ headless: true, args: ['--no-sandbox'] })
const page = await browser.newPage()
await page.setViewport({ width: 1440, height: 950 })
page.on('pageerror', e => console.log('PAGEERROR:', String(e)))
await page.goto(process.env.E2E_BASE ?? 'http://localhost:5173/', { waitUntil: 'domcontentloaded' })
await new Promise(r => setTimeout(r, 2500))

// 1. Declare measurement points + a typed variable on Manufacturing,
//    then select it.
await page.evaluate(`(() => {
  const s = window.__stores
  s.model.execute({
    label: 'declare measurements',
    apply(ast) {
      const p = ast.processes.find((x) => x.id === 'Manufacturing')
      p.measure = ['temperature', 'note']
      ast.variables.push({ id: 'temperature', type: 'float', definition: 'Chamber temperature', description: '' })
    },
    revert(ast) {
      const p = ast.processes.find((x) => x.id === 'Manufacturing')
      p.measure = []
      ast.variables = ast.variables.filter((v) => v.id !== 'temperature')
    },
  })
  const nodes = Array.from(document.querySelectorAll('.node-group'))
  const target = nodes.find((n) => n.textContent.includes('Manufacture'))
  target.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }))
  target.dispatchEvent(new MouseEvent('mouseup', { bubbles: true }))
  target.dispatchEvent(new MouseEvent('click', { bubbles: true }))
})()`)
await new Promise(r => setTimeout(r, 500))

let state = await page.evaluate(`(() => ({
  panel: !!document.querySelector('[data-testid="measurement-panel"]'),
  rows: document.querySelectorAll('.measurement-row').length,
  tempVerdict: document.querySelector('[data-testid="verdict-temperature"]')?.textContent ?? null,
  type: document.querySelector('.measure-type')?.textContent ?? null,
}))()`)
console.log('rows:', JSON.stringify(state))
if (!state.panel || state.rows !== 2 || state.tempVerdict !== 'missing' || state.type !== 'float') {
  console.log('MEASURE FAILED'); await browser.close(); process.exit(1)
}

// 2. A bad value flags; a good one validates; the preview formats.
await page.evaluate(`(() => {
  const input = document.querySelector('[data-testid="value-temperature"]')
  input.value = 'abc'
  input.dispatchEvent(new Event('change', { bubbles: true }))
})()`)
await new Promise(r => setTimeout(r, 400))
state = await page.evaluate(`(() => ({
  verdict: document.querySelector('[data-testid="verdict-temperature"]')?.textContent ?? null,
}))()`)
console.log('flagged:', JSON.stringify(state))
if (state.verdict !== 'type mismatch') { console.log('MEASURE FAILED'); await browser.close(); process.exit(1) }

await page.evaluate(`(() => {
  const input = document.querySelector('[data-testid="value-temperature"]')
  input.value = '20.5'
  input.dispatchEvent(new Event('change', { bubbles: true }))
  const unit = document.querySelector('[data-testid="unit-temperature"]')
  unit.value = '°C'
  unit.dispatchEvent(new Event('change', { bubbles: true }))
  const unc = document.querySelector('[data-testid="unc-temperature"]')
  unc.value = '0.2'
  unc.dispatchEvent(new Event('change', { bubbles: true }))
})()`)
await new Promise(r => setTimeout(r, 400))
state = await page.evaluate(`(() => ({
  verdict: document.querySelector('[data-testid="verdict-temperature"]')?.textContent ?? null,
  preview: document.querySelector('[data-testid="measure-preview"]')?.textContent ?? null,
}))()`)
console.log('valid:', JSON.stringify(state))

const ok = state.verdict === 'valid'
  && state.preview?.includes('temperature: 20.5 ±0.2 °C [float]')
  && state.preview?.includes('note: —')
console.log(ok ? 'MEASURE OK' : 'MEASURE FAILED')
await browser.close()
process.exit(ok ? 0 : 1)
