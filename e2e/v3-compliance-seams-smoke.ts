import puppeteer from 'puppeteer'

// ─────────────────────────────────────────────────────────────────────
// The v3 compliance-seams leg (TODO.editor wave 03, window 2 — the G6
// tail): on a v3 package (zero provisions, real requirements) the
// ProcessInspector's validate_provision picker offers the requirement
// ids, and the Monaco completion inside validate_provision { … } lists
// them (the provision-era surfaces read real requirements).
// ─────────────────────────────────────────────────────────────────────

const TEXT = `role TL { name "Test laboratory" }

requirement /req/cs/sample-count {
  name "Sample count"
  statement "The applicant provides the number of samples."
  obligation shall
}

process PerformTesting {
  name "Perform the testing"
  actor TL
  validate_provision {
  }
}
`

const browser = await puppeteer.launch({ headless: true, args: ['--no-sandbox'] })
const page = await browser.newPage()
await page.setViewport({ width: 1440, height: 950 })
page.on('pageerror', e => console.log('PAGEERROR:', String(e)))
await page.goto(process.env.E2E_BASE ?? 'http://localhost:5173/', { waitUntil: 'domcontentloaded' })
await new Promise(r => setTimeout(r, 2500))

const fail = async (why: string) => { console.log('V3-COMPLIANCE-SEAMS FAILED:', why); await browser.close(); process.exit(1) }

// 1. The model loads; select the process — the picker offers the requirement id.
await page.evaluate(`(() => { window.__stores.model.loadText(${JSON.stringify(TEXT)}) })()`)
await new Promise(r => setTimeout(r, 700))
await page.evaluate(`(() => {
  const item = Array.from(document.querySelectorAll('.item-id')).find((el) => el.textContent === 'PerformTesting')
  item.closest('li').click()
})()`)
await new Promise(r => setTimeout(r, 500))
let state = await page.evaluate(`(() => ({
  inspector: !!document.querySelector('[data-testid="process-inspector"]'),
  options: Array.from(document.querySelectorAll('[data-testid="picker-select-add provision…"] option, [data-testid^="picker-select"] option')).map((o) => o.value),
}))()`)
console.log('picker:', JSON.stringify(state))
if (!state.inspector) await fail('the process inspector did not open')
if (!state.options.includes('/req/cs/sample-count')) await fail('the provision picker does not offer the requirement id')

// 2. Picking the requirement binds it (provisionRefs is the lossless carrier).
await page.evaluate(`(() => {
  const sel = document.querySelector('[data-testid^="picker-select"]')
  sel.value = '/req/cs/sample-count'
  sel.dispatchEvent(new Event('change', { bubbles: true }))
})()`)
await new Promise(r => setTimeout(r, 200))
await page.evaluate(`(() => {
  const btns = Array.from(document.querySelectorAll('.picker-add-btn'))
  btns.find((b) => !b.disabled)?.click()
})()`)
await new Promise(r => setTimeout(r, 300))
state = await page.evaluate(`(() => ({
  refs: window.__stores.model.standard.processes[0]?.provisionRefs,
  serialized: window.__stores.model.serialize().includes('/req/cs/sample-count'),
}))()`)
console.log('bound:', JSON.stringify(state))
if (!state.refs?.includes('/req/cs/sample-count') || !state.serialized) await fail('the requirement pick did not land')

// 3. The Monaco completion inside validate_provision { … } offers the requirement.
await page.evaluate(`(() => {
  const btns = Array.from(document.querySelectorAll('button'))
  btns.find((b) => b.textContent.trim() === 'Code')?.click()
})()`)
await new Promise(r => setTimeout(r, 2500))
// The cursor goes inside the validate_provision block (the line after its head).
await page.evaluate(`(() => {
  const ed = window.__editor
  const model = ed.getModel()
  const lines = model.getLinesContent()
  const head = lines.findIndex((l) => l.includes('validate_provision'))
  ed.setPosition({ lineNumber: head + 1, column: model.getLineMaxColumn(head + 1) })
  ed.focus()
  ed.trigger('probe', 'editor.action.triggerSuggest', {})
})()`)
await new Promise(r => setTimeout(r, 900))
state = await page.evaluate(`(() => ({
  suggest: !!document.querySelector('.suggest-widget.visible'),
  items: Array.from(document.querySelectorAll('.suggest-widget .monaco-list-row .label-name')).map((r) => r.textContent),
}))()`)
console.log('completion:', JSON.stringify(state))
if (!state.suggest || !state.items.includes('/req/cs/sample-count'))
  await fail('the Monaco completion did not offer the requirement id')

console.log('V3-COMPLIANCE-SEAMS OK')
await browser.close()
process.exit(0)
