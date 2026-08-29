import puppeteer from 'puppeteer'

// ─────────────────────────────────────────────────────────────────────
// The v3 calculations leg (TODO.editor wave 03) — the calculation
// surface on the live app: the tree section, the inspector (inputs,
// output, expression), an edit through the command path, and the
// in-tree create. The corpus text travels from node.
// ─────────────────────────────────────────────────────────────────────

const TEXT = `calculation vMin {
  name "vMin"
  identifier /calc/v-min
  category metrological
  description "Computes verification interval v_min per R 60-1, 3.5.11"
  inputs {
    d_max : number { unit "g" description "Maximum test load D_max" }
    n_lc : integer { description "Number of verification intervals" }
  }
  output : number { unit "g" name "v_min" description "Minimum verification interval" }
  expression "ocl{(d_max - d_min) / n_lc}"
  ref derives-from "urn:oiml:pub:r:60-1:2021#clause-3.5.11"
}

calculation mpe {
  name "mpe"
  identifier /calc/mpe
  category metrological
  description "Looks up MPE for a given load in v units per R 60-1 Table 4"
  inputs {
    load : number { unit "v" description "Test load in verification units" }
  }
  output : number { unit "v" name "mpe" }
  expression "ocl{lookupMPE(load)}"
  ref derives-from "urn:oiml:pub:r:60-1:2021#table-4"
}
`

const browser = await puppeteer.launch({ headless: true, args: ['--no-sandbox'] })
const page = await browser.newPage()
await page.setViewport({ width: 1440, height: 950 })
page.on('pageerror', e => console.log('PAGEERROR:', String(e)))
await page.goto(process.env.E2E_BASE ?? 'http://localhost:5173/', { waitUntil: 'domcontentloaded' })
await new Promise(r => setTimeout(r, 2500))

const fail = async (why: string) => { console.log('V3-CALCULATIONS FAILED:', why); await browser.close(); process.exit(1) }

// 1. The text loads; the tree shows the Calculations section.
await page.evaluate(`(() => { window.__stores.model.loadText(${JSON.stringify(TEXT)}) })()`)
await new Promise(r => setTimeout(r, 700))
let state = await page.evaluate(`(() => ({
  calculations: window.__stores.model.standard.calculations.length,
  group: Array.from(document.querySelectorAll('.tree-group .group-header')).map((g) => g.textContent.trim()).find((g) => g.startsWith('Calculations')) ?? null,
}))()`)
console.log('tree:', JSON.stringify(state))
if (state.calculations !== 2 || state.group !== 'Calculations (2) +') await fail('the Calculations tree section did not render')

// 2. Selecting a calculation opens its inspector with the authored facets.
await page.evaluate(`(() => {
  const item = Array.from(document.querySelectorAll('.item-id')).find((el) => el.textContent === 'vMin')
  item.closest('li').click()
})()`)
await new Promise(r => setTimeout(r, 400))
state = await page.evaluate(`(() => ({
  inspector: !!document.querySelector('[data-testid="calculation-inspector"]'),
  name: document.querySelector('[data-testid="calc-name"]')?.value ?? null,
  identifier: document.querySelector('[data-testid="calc-identifier"]')?.value ?? null,
  expression: document.querySelector('[data-testid="calc-expression"]')?.value ?? null,
  inputs: Array.from(document.querySelectorAll('.input-row .input-name')).map((n) => n.textContent),
  inputUnit: document.querySelector('[data-testid="calc-input-unit-d_max"]')?.value ?? null,
  outputName: document.querySelector('[data-testid="calc-output-name"]')?.value ?? null,
  sourceClause: document.querySelector('[data-testid="calc-source-clause"]')?.value ?? null,
}))()`)
console.log('inspector:', JSON.stringify(state))
if (!state.inspector || state.name !== 'vMin' || state.identifier !== '/calc/v-min'
  || state.expression !== 'ocl{(d_max - d_min) / n_lc}'
  || JSON.stringify(state.inputs) !== JSON.stringify(['d_max', 'n_lc'])
  || state.inputUnit !== 'g' || state.outputName !== 'v_min' || state.sourceClause !== '3.5.11')
  await fail('the calculation inspector did not open with the facets')

// 3. An input edit lands through the command path and into the serialization.
await page.evaluate(`(() => {
  const el = document.querySelector('[data-testid="calc-input-unit-d_max"]')
  el.value = 'kg'
  el.dispatchEvent(new Event('change', { bubbles: true }))
})()`)
await new Promise(r => setTimeout(r, 300))
state = await page.evaluate(`(() => ({
  unit: window.__stores.model.standard.calculations.find((c) => c.id === 'vMin')?.inputs[0]?.unit,
  serialized: window.__stores.model.serialize().includes('d_max : number { unit "kg"'),
}))()`)
if (state.unit !== 'kg' || !state.serialized) await fail('the input edit did not land')

// 4. A new input adds through the row editor.
await page.evaluate(`(() => {
  const el = document.querySelector('[data-testid="calc-input-add"]')
  el.value = 'd_min'
  el.dispatchEvent(new Event('input', { bubbles: true }))
})()`)
await new Promise(r => setTimeout(r, 200))
await page.evaluate(`(() => { document.querySelector('[data-testid="calc-input-add-btn"]').click() })()`)
await new Promise(r => setTimeout(r, 300))
state = await page.evaluate(`(() => ({
  names: window.__stores.model.standard.calculations.find((c) => c.id === 'vMin')?.inputs.map((i) => i.name),
  serialized: window.__stores.model.serialize().includes('d_min : number'),
}))()`)
if (JSON.stringify(state.names) !== JSON.stringify(['d_max', 'n_lc', 'd_min']) || !state.serialized)
  await fail('the input add did not land')

// 5. The in-tree create mints a calculation and selects it for editing.
await page.evaluate(`(() => { document.querySelector('[data-testid="tree-add-calculation"]').click() })()`)
await new Promise(r => setTimeout(r, 400))
state = await page.evaluate(`(() => ({
  ids: window.__stores.model.standard.calculations.map((c) => c.id),
  selection: JSON.parse(JSON.stringify(window.__stores.ui.selection ?? null)),
  inspector: !!document.querySelector('[data-testid="calculation-inspector"]'),
}))()`)
console.log('created:', JSON.stringify(state))
if (!state.ids.includes('Calc1') || state.selection?.id !== 'Calc1' || !state.inspector)
  await fail('the in-tree create did not mint + select the calculation')

console.log('V3-CALCULATIONS OK')
await browser.close()
process.exit(0)
