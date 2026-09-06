import puppeteer from 'puppeteer'

// ─────────────────────────────────────────────────────────────────────
// The workspace leg (TODO.editor wave 05, audit G9) — the typed-model
// index on the live app: the open model as the IMP item, a registered
// reference model as the REF item (clicking it drives the lens + the
// mapping view), and the doc-map mirror as the DOC item.
// ─────────────────────────────────────────────────────────────────────

const MODEL = `metadata {
  title "The open model"
  schema ""
  edition ""
  author ""
  namespace "urn:example:imp"
}

process P1 {
  name "Do the thing"
}

term widget {
  label "widget"
  definition "a measurable thing"
}
`

const REF = `metadata {
  title "Reference"
  schema ""
  edition ""
  author ""
  namespace "urn:example:ref"
}

requirement /req/r1 {
  name "R1"
  statement "shall r"
}
`

const XML = `<?xml version="1.0" encoding="UTF-8"?>
<metanorma xmlns="https://www.metanorma.org/ns/standoc" type="presentation">
<bibdata type="standard">
  <title language="en" type="main">Metrology — Load cells</title>
  <docidentifier primary="true" type="ISO">OIML R 60-2:2021</docidentifier>
</bibdata>
<sections>
  <clause id="_bbb" obligation="normative" inline-header="false">
    <title>2.10.1 Temperature effect</title>
    <p id="_p1">The temperature effect shall be measured. The measurement uses the reference temperature.</p>
  </clause>
</sections>
</metanorma>`

const browser = await puppeteer.launch({ headless: true, args: ['--no-sandbox'] })
const page = await browser.newPage()
await page.setViewport({ width: 1440, height: 950 })
page.on('pageerror', e => console.log('PAGEERROR:', String(e)))
await page.goto(process.env.E2E_BASE ?? 'http://localhost:5173/', { waitUntil: 'domcontentloaded' })
await new Promise(r => setTimeout(r, 2500))

const fail = async (why: string) => { console.log('WORKSPACE FAILED:', why); await browser.close(); process.exit(1) }

// 1. The model loads; the Workspace tab opens the index with the IMP card.
await page.evaluate(`(() => { window.__stores.model.loadText(${JSON.stringify(MODEL)}) })()`)
await new Promise(r => setTimeout(r, 700))
await page.evaluate(`(() => { document.querySelector('[data-testid="tab-workspace"]').click() })()`)
await new Promise(r => setTimeout(r, 400))
let state = await page.evaluate(`(() => ({
  panel: !!document.querySelector('[data-testid="workspace-panel"]'),
  id: document.querySelector('[data-testid="workspace-imp-id"]')?.textContent ?? null,
  kind: document.querySelector('[data-testid="workspace-imp-kind"]')?.textContent ?? null,
  counts: document.querySelector('[data-testid="workspace-imp-counts"]')?.textContent?.trim() ?? null,
  refsEmpty: !!document.querySelector('[data-testid="workspace-refs-empty"]'),
  docEmpty: !!document.querySelector('[data-testid="workspace-doc-empty"]'),
}))()`)
console.log('imp:', JSON.stringify(state))
if (!state.panel || state.id !== 'urn:example:imp' || state.kind !== 'model'
  || !state.counts?.includes('1 processes') || !state.refsEmpty || !state.docEmpty)
  await fail('the IMP card did not render the loose session')

// 2. A registered reference model appears as a REF item; clicking it
//    drives the existing lens and jumps to the mapping view.
await page.evaluate(`(() => { window.__stores.mapping.loadRefText(${JSON.stringify(REF)}) })()`)
await new Promise(r => setTimeout(r, 400))
state = await page.evaluate(`(() => ({
  ref: !!document.querySelector('[data-testid="workspace-ref-urn:example:ref"]'),
  active: document.querySelector('[data-testid="workspace-ref-urn:example:ref"] .ws-active')?.textContent ?? null,
}))()`)
console.log('ref:', JSON.stringify(state))
if (!state.ref || state.active !== 'active lens') await fail('the REF item did not render as the active lens')
await page.evaluate(`(() => { document.querySelector('[data-testid="workspace-ref-urn:example:ref"]').click() })()`)
await new Promise(r => setTimeout(r, 500))
state = await page.evaluate(`(() => ({
  view: window.__stores.ui.view,
  activeNs: window.__stores.mapping.activeNs,
}))()`)
if (state.view !== 'mapping' || state.activeNs !== 'urn:example:ref') await fail('the REF click did not drive the lens')

// 3. Back on the model view, the attached document renders as the DOC item.
await page.evaluate(`(() => {
  window.__stores.ui.view = 'model'
  window.__stores.mapping.loadDocumentText(${JSON.stringify(XML).replace(/`/g, '\\`')})
})()`)
await new Promise(r => setTimeout(r, 500))
state = await page.evaluate(`(() => ({
  doc: !!document.querySelector('[data-testid="workspace-doc"]'),
  urn: document.querySelector('[data-testid="workspace-doc"] .ws-id')?.textContent ?? null,
  row: document.querySelector('[data-testid="workspace-doc"] .ws-row')?.textContent?.trim() ?? null,
  refStill: !!document.querySelector('[data-testid="workspace-ref-urn:example:ref"]'),
}))()`)
console.log('doc:', JSON.stringify(state))
if (!state.doc || state.urn !== 'urn:oiml:pub:r:60-2:2021' || !state.row?.includes('1 clauses') || !state.refStill)
  await fail('the DOC item did not render alongside the REF item')

console.log('WORKSPACE OK')
await browser.close()
process.exit(0)
