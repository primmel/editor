import puppeteer from 'puppeteer'

// ─────────────────────────────────────────────────────────────────────
// The v3 forms leg (TODO.editor wave 03, window 2) — the data-capture
// schema surface on the live app: the tree section (palette-created,
// no in-tree +), the plugin's FormInspector (the header facets, the
// fields with the read-only bind marker, the pass_fail block), an edit
// through the command path, and the palette create.
// ─────────────────────────────────────────────────────────────────────

const TEXT = `form test-report {
  name "Test report"
  description "The per-test report"
  section "results"
  field indication : number {
    label "Indication"
    unit "kg"
    required true
    bind run.indication
  }
  pass_fail {
    criteria "the error stays within MPE"
    pass_if "ocl{abs(e) <= mpe}"
  }
}
`

const browser = await puppeteer.launch({ headless: true, args: ['--no-sandbox'] })
const page = await browser.newPage()
await page.setViewport({ width: 1440, height: 950 })
page.on('pageerror', e => console.log('PAGEERROR:', String(e)))
await page.goto(process.env.E2E_BASE ?? 'http://localhost:5173/', { waitUntil: 'domcontentloaded' })
await new Promise(r => setTimeout(r, 2500))

const fail = async (why: string) => { console.log('V3-FORMS FAILED:', why); await browser.close(); process.exit(1) }

// 1. The text loads; the tree lists the form (palette-created — no +).
await page.evaluate(`(() => { window.__stores.model.loadText(${JSON.stringify(TEXT)}) })()`)
await new Promise(r => setTimeout(r, 700))
let state = await page.evaluate(`(() => ({
  forms: window.__stores.model.standard.forms.length,
  group: Array.from(document.querySelectorAll('.tree-group .group-header')).map((g) => g.textContent.trim()).find((g) => g.startsWith('Forms')) ?? null,
}))()`)
console.log('tree:', JSON.stringify(state))
if (state.forms !== 1 || state.group !== 'Forms (1)') await fail('the Forms tree section did not render (palette-created: no +)')

// 2. Selecting the form opens the plugin's FormInspector with the facets.
await page.evaluate(`(() => {
  const item = Array.from(document.querySelectorAll('.item-id')).find((el) => el.textContent === 'test-report')
  item.closest('li').click()
})()`)
await new Promise(r => setTimeout(r, 400))
state = await page.evaluate(`(() => ({
  inspector: !!document.querySelector('[data-testid="form-inspector"]'),
  name: document.querySelector('[data-testid="form-name"]')?.value ?? null,
  section: document.querySelector('[data-testid="form-section"]')?.value ?? null,
  fieldLabel: document.querySelector('[data-testid="form-field-label-indication"]')?.value ?? null,
  fieldRequired: document.querySelector('[data-testid="form-field-required-indication"]')?.checked ?? null,
  bindReadonly: document.querySelector('[data-testid="form-field-bind-indication"]')?.readOnly ?? null,
  passFail: !!document.querySelector('[data-testid="form-pass-fail"]'),
}))()`)
console.log('inspector:', JSON.stringify(state))
if (!state.inspector || state.name !== 'Test report' || state.section !== 'results'
  || state.fieldLabel !== 'Indication' || state.fieldRequired !== true
  || state.bindReadonly !== true || !state.passFail)
  await fail('the form inspector did not open with the facets')

// 3. A field edit lands through the command path and into the serialization.
await page.evaluate(`(() => {
  const el = document.querySelector('[data-testid="form-field-label-indication"]')
  el.value = 'Indication (edited live)'
  el.dispatchEvent(new Event('change', { bubbles: true }))
})()`)
await new Promise(r => setTimeout(r, 300))
state = await page.evaluate(`(() => ({
  label: window.__stores.model.standard.forms[0]?.fields[0]?.label,
  serialized: window.__stores.model.serialize().includes('Indication (edited live)'),
}))()`)
if (state.label !== 'Indication (edited live)' || !state.serialized) await fail('the field edit did not land')

// 4. Adding a field lands (the parse-default shape).
await page.evaluate(`(() => {
  const el = document.querySelector('[data-testid="form-field-add"]')
  el.value = 'ambient'
  el.dispatchEvent(new Event('input', { bubbles: true }))
})()`)
await new Promise(r => setTimeout(r, 200)) // let the :disabled binding re-render before the click
await page.evaluate(`(() => { document.querySelector('[data-testid="form-field-add-btn"]').click() })()`)
await new Promise(r => setTimeout(r, 300))
state = await page.evaluate(`(() => ({
  fields: window.__stores.model.standard.forms[0]?.fields.map((f) => f.name),
  serialized: window.__stores.model.serialize().includes('field ambient'),
}))()`)
console.log('field added:', JSON.stringify(state))
if (!state.fields?.includes('ambient') || !state.serialized) await fail('the field add did not land')

// 5. The palette creates a form; it lands in the tree + the AST.
await page.evaluate(`(() => { document.querySelector('[data-testid="palette-plugin-form"]').click() })()`)
await new Promise(r => setTimeout(r, 400))
state = await page.evaluate(`(() => ({
  forms: window.__stores.model.standard.forms.map((f) => f.id),
  group: Array.from(document.querySelectorAll('.tree-group .group-header')).map((g) => g.textContent.trim()).find((g) => g.startsWith('Forms')) ?? null,
}))()`)
console.log('palette create:', JSON.stringify(state))
if (!state.forms.includes('Form1') || state.group !== 'Forms (2)') await fail('the palette create did not land')

console.log('V3-FORMS OK')
await browser.close()
process.exit(0)
