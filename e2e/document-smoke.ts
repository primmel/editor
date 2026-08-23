import puppeteer from 'puppeteer'

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
    <p id="_p2">A single-sentence paragraph.</p>
  </clause>
</sections>
</metanorma>`

const browser = await puppeteer.launch({ headless: true, args: ['--no-sandbox'] })
const page = await browser.newPage()
await page.setViewport({ width: 1440, height: 950 })
page.on('pageerror', e => console.log('PAGEERROR:', String(e)))
await page.goto(process.env.E2E_BASE ?? 'http://localhost:5173/', { waitUntil: 'domcontentloaded' })
await new Promise(r => setTimeout(r, 2500))

// 1. The mapping view + the document.
await page.evaluate(`(() => {
  const s = window.__stores
  s.ui.view = 'mapping'
  s.mapping.loadDocumentText(${JSON.stringify(XML).replace(/`/g, '\\`')})
})()`)
await new Promise(r => setTimeout(r, 800))

let state = await page.evaluate(`(() => ({
  docView: !!document.querySelector('[data-testid="document-view"]'),
  ns: document.querySelector('[data-testid="ref-namespace"]')?.textContent ?? null,
  stmts: document.querySelectorAll('.doc-statement').length,
  s1: document.querySelector('[data-testid="stmt-2.10.1.p1.s1"] .stmt-text')?.textContent ?? null,
}))()`)
console.log('document:', JSON.stringify(state))
if (!state.docView || state.ns !== 'urn:oiml:pub:r:60-2:2021' || state.stmts !== 3
  || !state.s1?.includes('temperature effect shall be measured')) {
  console.log('DOC FAILED'); await browser.close(); process.exit(1)
}

// 2. Click a statement → an IMP node → dialog → confirm.
await page.evaluate(`(() => {
  document.querySelector('[data-testid="stmt-2.10.1.p1.s1"]').dispatchEvent(new MouseEvent('click', { bubbles: true }))
})()`)
await new Promise(r => setTimeout(r, 300))
await page.evaluate(`(() => {
  document.querySelector('[data-testid="imp-pane"] [data-node-id="Manufacturing"]')
    .dispatchEvent(new MouseEvent('click', { bubbles: true }))
})()`)
await new Promise(r => setTimeout(r, 400))
await page.evaluate(`(() => {
  const d = document.querySelector('[data-testid="pair-description"]')
  d.value = 'the measurement step'
  d.dispatchEvent(new Event('input', { bubbles: true }))
  document.querySelector('[data-testid="pair-confirm"]').click()
})()`)
await new Promise(r => setTimeout(r, 600))

state = await page.evaluate(`(() => {
  const s = window.__stores
  const profile = s.model.standard.mapProfiles.find((p) => p.namespace === 'urn:oiml:pub:r:60-2:2021')
  return {
    targets: profile?.mappings?.['Manufacturing']?.map((p) => p.target) ?? null,
    description: profile?.mappings?.['Manufacturing']?.[0]?.description ?? null,
    stmtMapped: document.querySelector('[data-testid="stmt-2.10.1.p1.s1"]')?.className.includes('mapped') ?? false,
    edge: !!document.querySelector('[data-testid="map-edge-Manufacturing"]'),
  }
})()`)
console.log('mapped:', JSON.stringify(state))

const ok = state.targets?.[0] === 'urn:oiml:pub:r:60-2:2021#2.10.1.p1.s1'
  && state.description === 'the measurement step'
  && state.stmtMapped && state.edge
console.log(ok ? 'DOC OK' : 'DOC FAILED')
await browser.close()
process.exit(ok ? 0 : 1)
