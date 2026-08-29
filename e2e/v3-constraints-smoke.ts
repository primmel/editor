import puppeteer from 'puppeteer'

// ─────────────────────────────────────────────────────────────────────
// The v3 constraints leg (TODO.editor wave 03) — the domain-constraint
// surface on the live app: the tree section, the inspector, an edit
// through the command path, and the in-tree create. The corpus text
// travels from node (a fetched fixture can reload the page
// mid-evaluate).
// ─────────────────────────────────────────────────────────────────────

const TEXT = `constraint dead_load_max_geometry {
  stereotype inv
  name "Dead-load maximum geometry"
  check "ocl{model.parameters.d_max >= 0.9 * model.parameters.e_max and model.parameters.d_max <= model.parameters.e_max}"
  violation_meaning "the test setup does not realize the upper end of the measuring range"
  on_violation invalid
  ref derives-from "urn:oiml:pub:r:60-1:2021#clause-3.6"
}

constraint dead_load_min_geometry {
  stereotype inv
  name "Dead-load minimum geometry"
  check "ocl{model.parameters.e_min <= model.parameters.d_min}"
  violation_meaning "the test setup does not realize the lower end of the measuring range"
  on_violation invalid
  ref derives-from "urn:oiml:pub:r:60-1:2021#clause-3.6"
}
`

const browser = await puppeteer.launch({ headless: true, args: ['--no-sandbox'] })
const page = await browser.newPage()
await page.setViewport({ width: 1440, height: 950 })
page.on('pageerror', e => console.log('PAGEERROR:', String(e)))
await page.goto(process.env.E2E_BASE ?? 'http://localhost:5173/', { waitUntil: 'domcontentloaded' })
await new Promise(r => setTimeout(r, 2500))

const fail = async (why: string) => { console.log('V3-CONSTRAINTS FAILED:', why); await browser.close(); process.exit(1) }

// 1. The text loads; the tree shows the Constraints section.
await page.evaluate(`(() => { window.__stores.model.loadText(${JSON.stringify(TEXT)}) })()`)
await new Promise(r => setTimeout(r, 700))
let state = await page.evaluate(`(() => ({
  constraints: window.__stores.model.standard.constraints.length,
  group: Array.from(document.querySelectorAll('.tree-group .group-header')).map((g) => g.textContent.trim()).find((g) => g.startsWith('Constraints')) ?? null,
}))()`)
console.log('tree:', JSON.stringify(state))
if (state.constraints !== 2 || state.group !== 'Constraints (2) +') await fail('the Constraints tree section did not render')

// 2. Selecting a constraint opens its inspector with the authored facets.
await page.evaluate(`(() => {
  const item = Array.from(document.querySelectorAll('.item-id')).find((el) => el.textContent === 'dead_load_max_geometry')
  item.closest('li').click()
})()`)
await new Promise(r => setTimeout(r, 400))
state = await page.evaluate(`(() => ({
  inspector: !!document.querySelector('[data-testid="constraint-inspector"]'),
  name: document.querySelector('[data-testid="constraint-name"]')?.value ?? null,
  check: document.querySelector('[data-testid="constraint-check"]')?.value?.startsWith('ocl{model.parameters.d_max') ?? false,
  onViolation: document.querySelector('[data-testid="constraint-on-violation"]')?.value ?? null,
  sourceClause: document.querySelector('[data-testid="constraint-source-clause"]')?.value ?? null,
}))()`)
console.log('inspector:', JSON.stringify(state))
if (!state.inspector || state.name !== 'Dead-load maximum geometry' || !state.check
  || state.onViolation !== 'invalid' || state.sourceClause !== '3.6') await fail('the constraint inspector did not open with the facets')

// 3. An edit lands through the command path and into the serialization.
await page.evaluate(`(() => {
  const el = document.querySelector('[data-testid="constraint-violation-meaning"]')
  el.value = 'the measurement is void (edited live)'
  el.dispatchEvent(new Event('change', { bubbles: true }))
})()`)
await new Promise(r => setTimeout(r, 300))
state = await page.evaluate(`(() => ({
  meaning: window.__stores.model.standard.constraints.find((c) => c.id === 'dead_load_max_geometry')?.violationMeaning,
  serialized: window.__stores.model.serialize().includes('the measurement is void (edited live)'),
}))()`)
if (state.meaning !== 'the measurement is void (edited live)' || !state.serialized) await fail('the inspector edit did not land')

// 4. The in-tree create mints a constraint and selects it for editing.
await page.evaluate(`(() => { document.querySelector('[data-testid="tree-add-constraint"]').click() })()`)
await new Promise(r => setTimeout(r, 400))
state = await page.evaluate(`(() => ({
  ids: window.__stores.model.standard.constraints.map((c) => c.id),
  selection: JSON.parse(JSON.stringify(window.__stores.ui.selection ?? null)),
  inspector: !!document.querySelector('[data-testid="constraint-inspector"]'),
}))()`)
console.log('created:', JSON.stringify(state))
if (!state.ids.includes('Constraint1') || state.selection?.id !== 'Constraint1' || !state.inspector)
  await fail('the in-tree create did not mint + select the constraint')

console.log('V3-CONSTRAINTS OK')
await browser.close()
process.exit(0)
