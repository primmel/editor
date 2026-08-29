import puppeteer from 'puppeteer'

// ─────────────────────────────────────────────────────────────────────
// The v3 conformance-classes leg (TODO.editor wave 03, window 2) — the
// test-scope surface on the live app: the tree section, the inspector
// (target/subject, the applicability entries with their match mode,
// the test-subject pairs), an edit through the command path, and the
// in-tree create.
// ─────────────────────────────────────────────────────────────────────

const TEXT = `conformance_class /conf/metrological {
  title "Metrological tests"
  name "Metrological"
  target /req/metrological
  subject "LoadCell"
  applicability {
    accuracy_class: [C, D] match any
  }
  test_subject {
    kind: "load cell"
  }
}
`

const browser = await puppeteer.launch({ headless: true, args: ['--no-sandbox'] })
const page = await browser.newPage()
await page.setViewport({ width: 1440, height: 950 })
page.on('pageerror', e => console.log('PAGEERROR:', String(e)))
await page.goto(process.env.E2E_BASE ?? 'http://localhost:5173/', { waitUntil: 'domcontentloaded' })
await new Promise(r => setTimeout(r, 2500))

const fail = async (why: string) => { console.log('V3-CONFORMANCE-CLASSES FAILED:', why); await browser.close(); process.exit(1) }

// 1. The text loads; the tree shows the section.
await page.evaluate(`(() => { window.__stores.model.loadText(${JSON.stringify(TEXT)}) })()`)
await new Promise(r => setTimeout(r, 700))
let state = await page.evaluate(`(() => ({
  classes: window.__stores.model.standard.conformanceClasses.length,
  group: Array.from(document.querySelectorAll('.tree-group .group-header')).map((g) => g.textContent.trim()).find((g) => g.startsWith('Conformance Classes')) ?? null,
}))()`)
console.log('tree:', JSON.stringify(state))
if (state.classes !== 1 || state.group !== 'Conformance Classes (1) +') await fail('the tree section did not render')

// 2. Selecting the class opens its inspector with the facets.
await page.evaluate(`(() => {
  const item = Array.from(document.querySelectorAll('.item-id')).find((el) => el.textContent === '/conf/metrological')
  item.closest('li').click()
})()`)
await new Promise(r => setTimeout(r, 400))
state = await page.evaluate(`(() => ({
  inspector: !!document.querySelector('[data-testid="conformance-class-inspector"]'),
  name: document.querySelector('[data-testid="cc-name"]')?.value ?? null,
  target: document.querySelector('[data-testid="cc-target"]')?.value ?? null,
  match: document.querySelector('[data-testid="cc-app-match-accuracy_class"]')?.value ?? null,
  testSubject: !!document.querySelector('[data-testid="cc-test-subject-value-kind"]'),
}))()`)
console.log('inspector:', JSON.stringify(state))
if (!state.inspector || state.name !== 'Metrological' || state.target !== '/req/metrological' || state.match !== 'any' || !state.testSubject)
  await fail('the inspector did not open with the facets')

// 3. An edit lands through the command path and into the serialization.
await page.evaluate(`(() => {
  const el = document.querySelector('[data-testid="cc-target"]')
  el.value = '/req/metrological-core'
  el.dispatchEvent(new Event('change', { bubbles: true }))
})()`)
await new Promise(r => setTimeout(r, 300))
state = await page.evaluate(`(() => ({
  target: window.__stores.model.standard.conformanceClasses[0]?.target,
  serialized: window.__stores.model.serialize().includes('target /req/metrological-core'),
}))()`)
if (state.target !== '/req/metrological-core' || !state.serialized) await fail('the target edit did not land')

// 4. The in-tree create mints a class and selects it.
await page.evaluate(`(() => { document.querySelector('[data-testid="tree-add-conformanceClass"]').click() })()`)
await new Promise(r => setTimeout(r, 400))
state = await page.evaluate(`(() => ({
  ids: window.__stores.model.standard.conformanceClasses.map((c) => c.id),
  selection: JSON.parse(JSON.stringify(window.__stores.ui.selection ?? null)),
  inspector: !!document.querySelector('[data-testid="conformance-class-inspector"]'),
}))()`)
console.log('created:', JSON.stringify(state))
if (!state.ids.includes('CC1') || state.selection?.id !== 'CC1' || state.selection?.type !== 'conformanceClass' || !state.inspector)
  await fail('the in-tree create did not mint + select the class')

console.log('V3-CONFORMANCE-CLASSES OK')
await browser.close()
process.exit(0)
