import puppeteer from 'puppeteer'

// The OIML-CS demo, live in the Studio (TODO.editor/39): the scheme
// model opens with its 34 PD-05 requirements, the doc map resolves
// against the real PD-05 mirror, and the certification workflow
// simulates application → certificate → BIML registration.

const browser = await puppeteer.launch({ headless: true, args: ['--no-sandbox'] })
const page = await browser.newPage()
await page.setViewport({ width: 1440, height: 950 })
page.on('pageerror', e => console.log('PAGEERROR:', String(e)))
await page.goto('http://localhost:5173/', { waitUntil: 'domcontentloaded' })
await new Promise(r => setTimeout(r, 2500))

const fail = async (why) => {
  console.log(`OIML-CS FAILED (${why})`)
  await browser.close()
  process.exit(1)
}

// 1. The certification workflow opens and simulates to registration.
await page.evaluate(`(async () => {
  const res = await fetch('/demo/oiml-cs/certification.prl?raw')
  const text = await res.text()
  window.__stores.model.loadText(text)
})()`)
await new Promise(r => setTimeout(r, 800))

let state = await page.evaluate(`(() => ({
  processes: window.__stores.model.standard.processes.map((p) => p.id),
  view: (() => { const s = window.__stores; s.ui.view = 'model'; s.ui.rightPanel = 'simulation'; return true })(),
}))()`)
if (!state.processes.includes('RegisterCertificate')) await fail('model did not open')
await new Promise(r => setTimeout(r, 400))
await page.evaluate(`(() => { document.querySelector('[data-testid="sim-start"]').click() })()`)
await new Promise(r => setTimeout(r, 300))
await page.evaluate(`(() => {
  for (const [name, value] of [['application_complete', '1'], ['tests_passed', '1'], ['evaluation_approved', '1']]) {
    const el = document.querySelector('[data-testid="register-' + name + '"]')
    el.value = value
    el.dispatchEvent(new Event('change', { bubbles: true }))
  }
})()`)
await new Promise(r => setTimeout(r, 300))
await page.evaluate(`(() => { document.querySelector('[data-testid="sim-continue"]').click() })()`)
await new Promise(r => setTimeout(r, 500))
state = await page.evaluate(`(() => ({
  done: !!document.querySelector('[data-testid="sim-done"]'),
  steps: Array.from(document.querySelectorAll('.trajectory-node')).map((n) => n.textContent),
}))()`)
console.log('simulation:', JSON.stringify(state))
if (!state.done || !state.steps.includes('IssueCertificate') || !state.steps.includes('RegisterCertificate')) {
  await fail('workflow did not reach BIML registration')
}

// 2. The scheme model's doc map resolves against the real PD-05 mirror.
await page.evaluate(`(async () => {
  const res = await fetch('/demo/oiml-cs/model.prl?raw')
  const text = await res.text()
  window.__stores.model.loadText(text)
})()`)
await new Promise(r => setTimeout(r, 800))
state = await page.evaluate(`(() => ({
  requirements: window.__stores.model.standard.requirements.length,
  pluginPalette: !!document.querySelector('.palette-title.program'),
}))()`)
console.log('scheme model:', JSON.stringify(state))
if (state.requirements !== 34) await fail('the scheme model did not open')

await page.evaluate(`(async () => {
  const res = await fetch('/demo/oiml-cs/oiml-cs-pd-05.mirror.json?raw')
  const text = await res.text()
  const s = window.__stores
  s.ui.view = 'mapping'
  s.mapping.loadDocumentText(text)
})()`)
await new Promise(r => setTimeout(r, 900))
state = await page.evaluate(`(() => ({
  docMode: !!document.querySelector('[data-testid="document-view"]'),
  urn: document.querySelector('.doc-urn')?.textContent ?? null,
  mappedStatements: document.querySelectorAll('.doc-statement.mapped').length,
}))()`)
console.log('doc map:', JSON.stringify(state))
// (47 pairs land on 45 distinct PD-05 statements; the map sources are
// requirements — not canvas nodes — so no overlay edges are drawn.)
if (!(state.docMode && state.urn === 'urn:oiml:pub:cs:pd-05:2024' && state.mappedStatements >= 40)) {
  await fail('the doc map did not resolve')
}

// 3. The authoring surface (TODO.editor/40): the tree lists the
//    requirement class + the requirements; selecting one opens the
//    plugin's inspector; an edit lands through the command path.
await page.evaluate(`(() => { const s = window.__stores; s.ui.view = 'model'; s.ui.rightPanel = 'inspector' })()`)
await new Promise(r => setTimeout(r, 500))
state = await page.evaluate(`(() => {
  const groups = Array.from(document.querySelectorAll('.tree-group .group-header')).map((g) => g.textContent.trim())
  return { groups }
})()`)
console.log('tree groups:', JSON.stringify(state.groups))
if (!state.groups.some((g) => g.startsWith('Requirement Classes (1)')) || !state.groups.some((g) => g.startsWith('Requirements (34)'))) {
  await fail('the tree does not list the requirement constructs')
}
await page.evaluate(`(() => {
  const item = Array.from(document.querySelectorAll('.item-id')).find((el) => el.textContent === '/req/cs/sample-count')
  item.closest('li').click()
})()`)
await new Promise(r => setTimeout(r, 400))
state = await page.evaluate(`(() => ({
  inspector: !!document.querySelector('[data-testid="requirement-inspector"]'),
  statement: document.querySelector('[data-testid="req-statement"]')?.value?.slice(0, 220) ?? null,
  sourceDoc: document.querySelector('[data-testid="req-source-doc"]')?.value ?? null,
}))()`)
console.log('inspector:', JSON.stringify(state))
if (!state.inspector || !state.statement?.includes('number of samples') || !state.sourceDoc?.startsWith('PD-05')) {
  await fail('the requirement inspector did not open with the provenance facets')
}
await page.evaluate(`(() => {
  const el = document.querySelector('[data-testid="req-name"]')
  el.value = 'Sample count (edited live)'
  el.dispatchEvent(new Event('change', { bubbles: true }))
})()`)
await new Promise(r => setTimeout(r, 300))
state = await page.evaluate(`(() => ({
  name: window.__stores.model.standard.requirements.find((r) => r.id === '/req/cs/sample-count')?.name,
}))()`)
if (state.name !== 'Sample count (edited live)') await fail('the inspector edit did not land')
console.log('inspector edit: OK')

// 4. The package manifest panel renders the oiml-cs manifest.
await page.evaluate(`(async () => {
  const res = await fetch('/demo/oiml-cs/package.primmel?raw')
  const text = await res.text()
  window.__stores.model.loadText(text)
})()`)
await new Promise(r => setTimeout(r, 600))
await page.evaluate(`(() => { document.querySelector('[data-testid="open-panel-package-manifest"]').click() })()`)
await new Promise(r => setTimeout(r, 400))
state = await page.evaluate(`(() => ({
  panel: !!document.querySelector('[data-testid="package-manifest-panel"]'),
  id: document.querySelector('[data-testid="manifest-id"]')?.textContent ?? null,
  kind: document.querySelector('[data-testid="manifest-kind"]')?.textContent ?? null,
  uses: document.querySelectorAll('[data-testid="manifest-uses"] li').length,
}))()`)
console.log('manifest:', JSON.stringify(state))
await page.evaluate(`(() => { document.querySelector('.panel-modal-head button').click() })()`)
const ok = state.panel && state.id === 'oiml-cs' && state.kind === 'core' && state.uses === 4
console.log(ok ? 'OIML-CS OK' : 'OIML-CS FAILED')
await browser.close()
process.exit(ok ? 0 : 1)
