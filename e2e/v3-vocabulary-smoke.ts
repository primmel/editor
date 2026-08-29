import puppeteer from 'puppeteer'

// ─────────────────────────────────────────────────────────────────────
// The v3 vocabulary leg (TODO.editor wave 03, window 2) — the symbol +
// attribute-definition surfaces on the live app: the tree sections, the
// inspectors, edits through the command path, and the in-tree creates.
// The corpus text travels from node (a fetched fixture can reload the
// page mid-evaluate).
// ─────────────────────────────────────────────────────────────────────

const TEXT = `symbol e {
  name "e"
  definition "Indication error"
  type number
  unit "kg"
  kind formula
  formula {
    display "e = I - m"
    expression "ocl{I - m}"
    inputs { I m }
  }
}

attribute_definition e_max {
  symbol "E_max"
  name "Maximum capacity"
  definition "Upper limit of the measuring range"
  quantity_kind mass
  unit "kg"
  scope model
  is_dimension false
  ref derives-from "urn:oiml:pub:r:60-1:2021#clause-3.5.3"
}
`

const browser = await puppeteer.launch({ headless: true, args: ['--no-sandbox'] })
const page = await browser.newPage()
await page.setViewport({ width: 1440, height: 950 })
page.on('pageerror', e => console.log('PAGEERROR:', String(e)))
await page.goto(process.env.E2E_BASE ?? 'http://localhost:5173/', { waitUntil: 'domcontentloaded' })
await new Promise(r => setTimeout(r, 2500))

const fail = async (why: string) => { console.log('V3-VOCABULARY FAILED:', why); await browser.close(); process.exit(1) }

// 1. The text loads; the tree shows both sections with their counts.
await page.evaluate(`(() => { window.__stores.model.loadText(${JSON.stringify(TEXT)}) })()`)
await new Promise(r => setTimeout(r, 700))
let state = await page.evaluate(`(() => ({
  symbols: window.__stores.model.standard.symbols.length,
  attrs: window.__stores.model.standard.attributeDefinitions.length,
  groups: Array.from(document.querySelectorAll('.tree-group .group-header')).map((g) => g.textContent.trim()).filter((g) => g.startsWith('Symbols') || g.startsWith('Attribute Definitions')),
}))()`)
console.log('tree:', JSON.stringify(state))
if (state.symbols !== 1 || state.attrs !== 1 || !state.groups.includes('Symbols (1) +') || !state.groups.includes('Attribute Definitions (1) +'))
  await fail('the tree sections did not render')

// 2. Selecting the symbol opens its inspector with the authored facets.
await page.evaluate(`(() => {
  const item = Array.from(document.querySelectorAll('.item-id')).find((el) => el.textContent === 'e')
  item.closest('li').click()
})()`)
await new Promise(r => setTimeout(r, 400))
state = await page.evaluate(`(() => ({
  inspector: !!document.querySelector('[data-testid="symbol-inspector"]'),
  name: document.querySelector('[data-testid="symbol-name"]')?.value ?? null,
  type: document.querySelector('[data-testid="symbol-type"]')?.value ?? null,
  formulaDisplay: document.querySelector('[data-testid="symbol-formula-display"]')?.value ?? null,
}))()`)
console.log('symbol inspector:', JSON.stringify(state))
if (!state.inspector || state.name !== 'e' || state.type !== 'number' || state.formulaDisplay !== 'e = I - m')
  await fail('the symbol inspector did not open with the facets')

// 3. Selecting the attribute definition opens its inspector.
await page.evaluate(`(() => {
  const item = Array.from(document.querySelectorAll('.item-id')).find((el) => el.textContent === 'e_max')
  item.closest('li').click()
})()`)
await new Promise(r => setTimeout(r, 400))
state = await page.evaluate(`(() => ({
  inspector: !!document.querySelector('[data-testid="attribute-definition-inspector"]'),
  name: document.querySelector('[data-testid="ad-name"]')?.value ?? null,
  scope: document.querySelector('[data-testid="ad-scope"]')?.value ?? null,
  isDimension: document.querySelector('[data-testid="ad-is-dimension"]')?.value ?? null,
}))()`)
console.log('attribute inspector:', JSON.stringify(state))
if (!state.inspector || state.name !== 'Maximum capacity' || state.scope !== 'model' || state.isDimension !== 'false')
  await fail('the attribute definition inspector did not open with the facets')

// 4. An edit lands through the command path and into the serialization.
await page.evaluate(`(() => {
  const el = document.querySelector('[data-testid="ad-name"]')
  el.value = 'Maximum capacity (edited live)'
  el.dispatchEvent(new Event('change', { bubbles: true }))
})()`)
await new Promise(r => setTimeout(r, 300))
state = await page.evaluate(`(() => ({
  name: window.__stores.model.standard.attributeDefinitions.find((a) => a.id === 'e_max')?.name,
  serialized: window.__stores.model.serialize().includes('Maximum capacity (edited live)'),
}))()`)
if (state.name !== 'Maximum capacity (edited live)' || !state.serialized) await fail('the inspector edit did not land')

// 5. The in-tree creates mint a symbol and an attribute definition.
await page.evaluate(`(() => { document.querySelector('[data-testid="tree-add-symbol"]').click() })()`)
await new Promise(r => setTimeout(r, 300))
await page.evaluate(`(() => { document.querySelector('[data-testid="tree-add-attributeDefinition"]').click() })()`)
await new Promise(r => setTimeout(r, 400))
state = await page.evaluate(`(() => ({
  symbols: window.__stores.model.standard.symbols.map((s) => s.id),
  attrs: window.__stores.model.standard.attributeDefinitions.map((a) => a.id),
  selection: JSON.parse(JSON.stringify(window.__stores.ui.selection ?? null)),
  inspector: !!document.querySelector('[data-testid="attribute-definition-inspector"]'),
}))()`)
console.log('created:', JSON.stringify(state))
if (!state.symbols.includes('Sym1') || !state.attrs.includes('Attr1') || state.selection?.id !== 'Attr1' || !state.inspector)
  await fail('the in-tree creates did not mint + select')

console.log('V3-VOCABULARY OK')
await browser.close()
process.exit(0)
