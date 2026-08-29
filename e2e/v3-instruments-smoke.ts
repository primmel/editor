import puppeteer from 'puppeteer'

// ─────────────────────────────────────────────────────────────────────
// The v3 instruments leg (TODO.editor wave 03, window 2) — the
// subject-TYPE surface on the live app: the tree section, the inspector
// (variants, dimensions with values, the family block, the model
// group), an edit through the command path, and the in-tree create.
// ─────────────────────────────────────────────────────────────────────

const TEXT = `instrument LoadCell {
  extends MeasuringInstrument
  measurand_kind force
  definition "A load cell family"
  variant DigitalLoadCell {
    name "Digital load cell"
    definition "d"
  }
  dimension accuracy_class {
    label "Accuracy class"
    scope family
    cardinality single
    values {
      C { label "Class C" description "d" }
    }
  }
  model_group {
    definition "the inner family"
    group_by accuracy_class
  }
}
`

const browser = await puppeteer.launch({ headless: true, args: ['--no-sandbox'] })
const page = await browser.newPage()
await page.setViewport({ width: 1440, height: 950 })
page.on('pageerror', e => console.log('PAGEERROR:', String(e)))
await page.goto(process.env.E2E_BASE ?? 'http://localhost:5173/', { waitUntil: 'domcontentloaded' })
await new Promise(r => setTimeout(r, 2500))

const fail = async (why: string) => { console.log('V3-INSTRUMENTS FAILED:', why); await browser.close(); process.exit(1) }

// 1. The text loads; the tree shows the Instruments section.
await page.evaluate(`(() => { window.__stores.model.loadText(${JSON.stringify(TEXT)}) })()`)
await new Promise(r => setTimeout(r, 700))
let state = await page.evaluate(`(() => ({
  instruments: window.__stores.model.standard.instruments.length,
  group: Array.from(document.querySelectorAll('.tree-group .group-header')).map((g) => g.textContent.trim()).find((g) => g.startsWith('Instruments')) ?? null,
}))()`)
console.log('tree:', JSON.stringify(state))
if (state.instruments !== 1 || state.group !== 'Instruments (1) +') await fail('the tree section did not render')

// 2. Selecting the instrument opens its inspector with the anatomy.
await page.evaluate(`(() => {
  const item = Array.from(document.querySelectorAll('.item-id')).find((el) => el.textContent === 'LoadCell')
  item.closest('li').click()
})()`)
await new Promise(r => setTimeout(r, 400))
state = await page.evaluate(`(() => ({
  inspector: !!document.querySelector('[data-testid="instrument-inspector"]'),
  extends: document.querySelector('[data-testid="inst-extends"]')?.value ?? null,
  variantName: document.querySelector('[data-testid="inst-variant-name-DigitalLoadCell"]')?.value ?? null,
  dimLabel: document.querySelector('[data-testid="inst-dimension-label-accuracy_class"]')?.value ?? null,
  dimValueLabel: document.querySelector('[data-testid="inst-dimension-accuracy_class-value-label-C"]')?.value ?? null,
  modelGroup: !!document.querySelector('[data-testid="inst-model-group"]'),
}))()`)
console.log('inspector:', JSON.stringify(state))
if (!state.inspector || state.extends !== 'MeasuringInstrument' || state.variantName !== 'Digital load cell'
  || state.dimLabel !== 'Accuracy class' || state.dimValueLabel !== 'Class C' || !state.modelGroup)
  await fail('the instrument inspector did not open with the anatomy')

// 3. An edit lands through the command path and into the serialization.
await page.evaluate(`(() => {
  const el = document.querySelector('[data-testid="inst-variant-name-DigitalLoadCell"]')
  el.value = 'Digital load cell (edited live)'
  el.dispatchEvent(new Event('change', { bubbles: true }))
})()`)
await new Promise(r => setTimeout(r, 300))
state = await page.evaluate(`(() => ({
  name: window.__stores.model.standard.instruments[0]?.variants[0]?.name,
  serialized: window.__stores.model.serialize().includes('Digital load cell (edited live)'),
}))()`)
if (state.name !== 'Digital load cell (edited live)' || !state.serialized) await fail('the variant edit did not land')

// 4. Adding a dimension value lands (the nested editor).
await page.evaluate(`(() => {
  const el = document.querySelector('[data-testid="inst-dimension-accuracy_class-value-add"]')
  el.value = 'D'
  el.dispatchEvent(new Event('input', { bubbles: true }))
})()`)
await new Promise(r => setTimeout(r, 200)) // let the :disabled binding re-render before the click
await page.evaluate(`(() => { document.querySelector('[data-testid="inst-dimension-accuracy_class-value-add-btn"]').click() })()`)
await new Promise(r => setTimeout(r, 300))
state = await page.evaluate(`(() => ({
  values: window.__stores.model.standard.instruments[0]?.dimensions[0]?.values.map((v) => v.id),
  serialized: window.__stores.model.serialize().includes('D\\n') || window.__stores.model.serialize().includes('D {'),
}))()`)
console.log('value added:', JSON.stringify(state))
if (!state.values?.includes('D')) await fail('the dimension value add did not land')

// 5. The in-tree create mints an instrument and selects it.
await page.evaluate(`(() => { document.querySelector('[data-testid="tree-add-instrument"]').click() })()`)
await new Promise(r => setTimeout(r, 400))
state = await page.evaluate(`(() => ({
  ids: window.__stores.model.standard.instruments.map((i) => i.id),
  selection: JSON.parse(JSON.stringify(window.__stores.ui.selection ?? null)),
  inspector: !!document.querySelector('[data-testid="instrument-inspector"]'),
}))()`)
console.log('created:', JSON.stringify(state))
if (!state.ids.includes('MI1') || state.selection?.id !== 'MI1' || state.selection?.type !== 'instrument' || !state.inspector)
  await fail('the in-tree create did not mint + select the instrument')

console.log('V3-INSTRUMENTS OK')
await browser.close()
process.exit(0)
