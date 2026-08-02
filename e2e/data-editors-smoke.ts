import puppeteer from 'puppeteer'

const browser = await puppeteer.launch({ headless: true, args: ['--no-sandbox'] })
const page = await browser.newPage()
await page.setViewport({ width: 1280, height: 900 })
await page.goto('http://localhost:5173/', { waitUntil: 'domcontentloaded' })
await new Promise(r => setTimeout(r, 2500))

function click(selector: string) {
  return page.evaluate((s: string) => {
    const el = document.querySelector(s) as HTMLElement | null
    if (!el) throw new Error(`no element ${s}`)
    el.click()
  }, selector)
}

// 1. Create a dataclass from the tree → its inspector opens.
await click('[data-testid="tree-add-dataclass"]')
await new Promise(r => setTimeout(r, 400))
let state = await page.evaluate(() => ({
  inspector: !!document.querySelector('[data-testid="dataclass-inspector"]'),
  id: document.querySelector('.inspector-header .element-id')?.textContent ?? null,
}))
console.log('dataclass:', JSON.stringify(state))
if (!state.inspector || state.id !== 'DC1') { console.log('DATA FAILED'); await browser.close(); process.exit(1) }

// 2. Add an attribute.
await page.evaluate(() => {
  const input = document.querySelector('[data-testid="attr-add-input"]') as HTMLInputElement
  input.value = 'capacity'
  input.dispatchEvent(new Event('input', { bubbles: true }))
})
await new Promise(r => setTimeout(r, 200))
await click('[data-testid="attr-add-btn"]')
await new Promise(r => setTimeout(r, 400))
state = await page.evaluate(() => ({
  attr: !!document.querySelector('[data-testid="attribute-capacity"]'),
  id: document.querySelector('.inspector-header .element-id')?.textContent ?? null,
}))
console.log('attribute:', JSON.stringify(state))
if (!state.attr) { console.log('DATA FAILED'); await browser.close(); process.exit(1) }

// 3. Create an enum + a value.
await click('[data-testid="tree-add-enum"]')
await new Promise(r => setTimeout(r, 400))
await page.evaluate(() => {
  const id = document.querySelector('[data-testid="enum-add-id"]') as HTMLInputElement
  const val = document.querySelector('[data-testid="enum-add-value"]') as HTMLInputElement
  id.value = 'A'
  id.dispatchEvent(new Event('input', { bubbles: true }))
  val.value = 'Class A'
  val.dispatchEvent(new Event('input', { bubbles: true }))
})
await new Promise(r => setTimeout(r, 200))
await click('[data-testid="enum-add-btn"]')
await new Promise(r => setTimeout(r, 400))
const enumState = await page.evaluate(() => ({
  inspector: !!document.querySelector('[data-testid="enum-inspector"]'),
  valueRow: !!document.querySelector('[data-testid="enum-value-A"]'),
}))
console.log('enum:', JSON.stringify(enumState))

// 4. Create a registry → the data_class picker lists DC1.
await click('[data-testid="tree-add-registry"]')
await new Promise(r => setTimeout(r, 400))
const regState = await page.evaluate(() => ({
  inspector: !!document.querySelector('[data-testid="registry-inspector"]'),
  options: Array.from(document.querySelectorAll('[data-testid="registry-data-class"] option')).map(o => o.textContent),
}))
console.log('registry:', JSON.stringify(regState))

const ok = enumState.inspector && enumState.valueRow
  && regState.inspector && regState.options.includes('DC1')
console.log(ok ? 'DATA OK' : 'DATA FAILED')
await browser.close()
process.exit(ok ? 0 : 1)
