import puppeteer from 'puppeteer'

// ─────────────────────────────────────────────────────────────────────
// The v3 quantities leg (TODO.editor wave 03, window 2) — the quantity
// register + dual surfaces on the live app: the tree sections, the
// inspectors, edits through the command path, and the in-tree creates.
// ─────────────────────────────────────────────────────────────────────

const TEXT = `quantity_register si {
  kind mass {
    dimensions { M 1 }
    si_unit "kg"
    description "Mass"
  }
  unit kg {
    symbol "kg"
    label "kilogram"
    kind mass
  }
}

dual d_e_max {
  attribute e_max
  designed { value 500 unit "kg" tolerance "0" }
  exhibited { value 499.9 unit "kg" uncertainty "0.1" }
}
`

const browser = await puppeteer.launch({ headless: true, args: ['--no-sandbox'] })
const page = await browser.newPage()
await page.setViewport({ width: 1440, height: 950 })
page.on('pageerror', e => console.log('PAGEERROR:', String(e)))
await page.goto(process.env.E2E_BASE ?? 'http://localhost:5173/', { waitUntil: 'domcontentloaded' })
await new Promise(r => setTimeout(r, 2500))

const fail = async (why: string) => { console.log('V3-QUANTITIES FAILED:', why); await browser.close(); process.exit(1) }

// 1. The text loads; the tree shows both sections.
await page.evaluate(`(() => { window.__stores.model.loadText(${JSON.stringify(TEXT)}) })()`)
await new Promise(r => setTimeout(r, 700))
let state = await page.evaluate(`(() => ({
  registers: window.__stores.model.standard.quantityRegisters.length,
  duals: window.__stores.model.standard.duals.length,
  groups: Array.from(document.querySelectorAll('.tree-group .group-header')).map((g) => g.textContent.trim()).filter((g) => g.startsWith('Quantity Registers') || g.startsWith('Duals')),
}))()`)
console.log('tree:', JSON.stringify(state))
if (state.registers !== 1 || state.duals !== 1 || !state.groups.includes('Quantity Registers (1) +') || !state.groups.includes('Duals (1) +'))
  await fail('the tree sections did not render')

// 2. Selecting the register opens its inspector with kinds + units.
await page.evaluate(`(() => {
  const item = Array.from(document.querySelectorAll('.item-id')).find((el) => el.textContent === 'si')
  item.closest('li').click()
})()`)
await new Promise(r => setTimeout(r, 400))
state = await page.evaluate(`(() => ({
  inspector: !!document.querySelector('[data-testid="quantity-register-inspector"]'),
  kindSiUnit: document.querySelector('[data-testid="qr-kind-siunit-mass"]')?.value ?? null,
  unitSymbol: document.querySelector('[data-testid="qr-unit-symbol-kg"]')?.value ?? null,
}))()`)
console.log('register inspector:', JSON.stringify(state))
if (!state.inspector || state.kindSiUnit !== 'kg' || state.unitSymbol !== 'kg')
  await fail('the quantity register inspector did not open with kinds + units')

// 3. Adding a unit lands in the serialization.
await page.evaluate(`(() => {
  const input = document.querySelector('[data-testid="qr-unit-add"]')
  input.value = 'g'
  input.dispatchEvent(new Event('input', { bubbles: true }))
})()`)
await new Promise(r => setTimeout(r, 200)) // let the :disabled binding re-render before the click
await page.evaluate(`(() => { document.querySelector('[data-testid="qr-unit-add-btn"]').click() })()`)
await new Promise(r => setTimeout(r, 300))
state = await page.evaluate(`(() => ({
  units: window.__stores.model.standard.quantityRegisters[0]?.units.map((u) => u.id),
  serialized: window.__stores.model.serialize().includes('unit g {'),
}))()`)
console.log('unit added:', JSON.stringify(state))
if (!state.units?.includes('g') || !state.serialized) await fail('the unit add did not land')

// 4. Selecting the dual opens its inspector with both roles.
await page.evaluate(`(() => {
  const item = Array.from(document.querySelectorAll('.item-id')).find((el) => el.textContent === 'd_e_max')
  item.closest('li').click()
})()`)
await new Promise(r => setTimeout(r, 400))
state = await page.evaluate(`(() => ({
  inspector: !!document.querySelector('[data-testid="dual-inspector"]'),
  attribute: document.querySelector('[data-testid="dual-attribute"]')?.value ?? null,
  designedValue: document.querySelector('[data-testid="dual-designed-value"]')?.value ?? null,
  exhibitedSpread: document.querySelector('[data-testid="dual-exhibited-spread"]')?.value ?? null,
}))()`)
console.log('dual inspector:', JSON.stringify(state))
if (!state.inspector || state.attribute !== 'e_max' || state.designedValue !== '500' || state.exhibitedSpread !== '0.1')
  await fail('the dual inspector did not open with the roles')

// 5. An edit to the designed value lands through the command path.
await page.evaluate(`(() => {
  const el = document.querySelector('[data-testid="dual-designed-value"]')
  el.value = '600'
  el.dispatchEvent(new Event('change', { bubbles: true }))
})()`)
await new Promise(r => setTimeout(r, 300))
state = await page.evaluate(`(() => ({
  value: window.__stores.model.standard.duals.find((d) => d.id === 'd_e_max')?.designed?.value,
  serialized: window.__stores.model.serialize().includes('designed { value 600 unit "kg" tolerance "0" }'),
}))()`)
if (state.value !== 600 || !state.serialized) await fail('the dual edit did not land')

// 6. The in-tree creates mint a register and a dual.
await page.evaluate(`(() => { document.querySelector('[data-testid="tree-add-quantityRegister"]').click() })()`)
await new Promise(r => setTimeout(r, 300))
await page.evaluate(`(() => { document.querySelector('[data-testid="tree-add-dual"]').click() })()`)
await new Promise(r => setTimeout(r, 400))
state = await page.evaluate(`(() => ({
  registers: window.__stores.model.standard.quantityRegisters.map((q) => q.id),
  duals: window.__stores.model.standard.duals.map((d) => d.id),
  selection: JSON.parse(JSON.stringify(window.__stores.ui.selection ?? null)),
  inspector: !!document.querySelector('[data-testid="dual-inspector"]'),
}))()`)
console.log('created:', JSON.stringify(state))
if (!state.registers.includes('QR1') || !state.duals.includes('Dual1') || state.selection?.id !== 'Dual1' || !state.inspector)
  await fail('the in-tree creates did not mint + select')

console.log('V3-QUANTITIES OK')
await browser.close()
process.exit(0)
