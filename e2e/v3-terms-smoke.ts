import puppeteer from 'puppeteer'

// ─────────────────────────────────────────────────────────────────────
// The v3 terms leg (TODO.editor wave 03) — the terminology surface on
// the live app: the tree section, the inspector, an edit through the
// command path, and the in-tree create. The corpus text travels from
// node (a fetched fixture can reload the page mid-evaluate).
// ─────────────────────────────────────────────────────────────────────

const TEXT = `term load-cell {
  label "load cell"
  definition "measuring transducer that will produce an output in response to an applied load"
  section "3.1"
  source "urn:oiml:pub:r:60-1:2021#clause-3.1.3"
  language "en"
  form_type "fullForm"
  part_of_speech "noun"
}

term durability {
  overlay true
  label "durability"
  definition "ability of a measuring instrument to maintain its performance characteristics over a period of use"
  section "3.1"
  language "en"
}

term widget {
  label "widget"
  definition "a measurable thing"
  language "en"
}
`

const browser = await puppeteer.launch({ headless: true, args: ['--no-sandbox'] })
const page = await browser.newPage()
await page.setViewport({ width: 1440, height: 950 })
page.on('pageerror', e => console.log('PAGEERROR:', String(e)))
await page.goto(process.env.E2E_BASE ?? 'http://localhost:5173/', { waitUntil: 'domcontentloaded' })
await new Promise(r => setTimeout(r, 2500))

const fail = async (why: string) => { console.log('V3-TERMS FAILED:', why); await browser.close(); process.exit(1) }

// 1. The text loads; the tree shows the Terms section with its count.
await page.evaluate(`(() => { window.__stores.model.loadText(${JSON.stringify(TEXT)}) })()`)
await new Promise(r => setTimeout(r, 700))
let state = await page.evaluate(`(() => ({
  terms: window.__stores.model.standard.terms.length,
  group: Array.from(document.querySelectorAll('.tree-group .group-header')).map((g) => g.textContent.trim()).find((g) => g.startsWith('Terms')) ?? null,
}))()`)
console.log('tree:', JSON.stringify(state))
if (state.terms !== 3 || state.group !== 'Terms (3) +') await fail('the Terms tree section did not render')

// 2. Selecting a term opens its inspector with the authored facets.
await page.evaluate(`(() => {
  const item = Array.from(document.querySelectorAll('.item-id')).find((el) => el.textContent === 'load-cell')
  item.closest('li').click()
})()`)
await new Promise(r => setTimeout(r, 400))
state = await page.evaluate(`(() => ({
  inspector: !!document.querySelector('[data-testid="term-inspector"]'),
  label: document.querySelector('[data-testid="term-label"]')?.value ?? null,
  definition: document.querySelector('[data-testid="term-definition"]')?.value?.slice(0, 40) ?? null,
  section: document.querySelector('[data-testid="term-section"]')?.value ?? null,
  formType: document.querySelector('[data-testid="term-form-type"]')?.value ?? null,
}))()`)
console.log('inspector:', JSON.stringify(state))
if (!state.inspector || state.label !== 'load cell' || !state.definition?.startsWith('measuring transducer')
  || state.section !== '3.1' || state.formType !== 'fullForm') await fail('the term inspector did not open with the facets')

// 3. The overlay marker shows read-only on the marked term.
await page.evaluate(`(() => {
  const item = Array.from(document.querySelectorAll('.item-id')).find((el) => el.textContent === 'durability')
  item.closest('li').click()
})()`)
await new Promise(r => setTimeout(r, 400))
state = await page.evaluate(`(() => ({
  overlay: document.querySelector('[data-testid="term-overlay"]')?.textContent ?? null,
}))()`)
console.log('overlay:', JSON.stringify(state))
if (state.overlay !== 'overlay true') await fail('the overlay marker did not render read-only')

// 4. An edit lands through the command path and into the serialization.
await page.evaluate(`(() => {
  const el = document.querySelector('[data-testid="term-label"]')
  el.value = 'durability (edited live)'
  el.dispatchEvent(new Event('change', { bubbles: true }))
})()`)
await new Promise(r => setTimeout(r, 300))
state = await page.evaluate(`(() => ({
  label: window.__stores.model.standard.terms.find((t) => t.id === 'durability')?.label,
  serialized: window.__stores.model.serialize().includes('durability (edited live)'),
}))()`)
if (state.label !== 'durability (edited live)' || !state.serialized) await fail('the inspector edit did not land')

// 5. The in-tree create mints a term and selects it for editing.
await page.evaluate(`(() => { document.querySelector('[data-testid="tree-add-term"]').click() })()`)
await new Promise(r => setTimeout(r, 400))
state = await page.evaluate(`(() => ({
  ids: window.__stores.model.standard.terms.map((t) => t.id),
  selection: JSON.parse(JSON.stringify(window.__stores.ui.selection ?? null)),
  inspector: !!document.querySelector('[data-testid="term-inspector"]'),
}))()`)
console.log('created:', JSON.stringify(state))
if (!state.ids.includes('Term1') || state.selection?.id !== 'Term1' || state.selection?.type !== 'term' || !state.inspector)
  await fail('the in-tree create did not mint + select the term')

console.log('V3-TERMS OK')
await browser.close()
process.exit(0)
