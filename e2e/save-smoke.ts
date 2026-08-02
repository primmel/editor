import puppeteer from 'puppeteer'

const browser = await puppeteer.launch({ headless: true, args: ['--no-sandbox'] })
const page = await browser.newPage()
await page.setViewport({ width: 1440, height: 950 })
page.on('pageerror', e => console.log('PAGEERROR:', String(e)))
await page.goto('http://localhost:5173/', { waitUntil: 'domcontentloaded' })
await new Promise(r => setTimeout(r, 2500))

// 1. An edit dirties the model (the dot appears).
await page.evaluate(`(() => {
  const s = window.__stores
  s.model.execute({
    label: 'probe rename',
    apply(ast) { ast.processes.find((p) => p.id === 'Manufacturing').name = 'Manufacture v2' },
    revert(ast) { ast.processes.find((p) => p.id === 'Manufacturing').name = 'Manufacture product' },
  })
})()`)
await new Promise(r => setTimeout(r, 400))
let state = await page.evaluate(`(() => ({
  dirty: !!document.querySelector('[data-testid="dirty-dot"]'),
}))()`)
console.log('dirty:', JSON.stringify(state))
if (!state.dirty) { console.log('SAVE FAILED'); await browser.close(); process.exit(1) }

// 2. The save panel previews exactly the one change.
await page.evaluate(`(() => { document.querySelector('[data-testid="open-save"]').click() })()`)
await new Promise(r => setTimeout(r, 500))
state = await page.evaluate(`(() => ({
  panel: !!document.querySelector('[data-testid="save-panel"]'),
  changed: document.querySelector('[data-testid="save-count-changed"]')?.textContent?.trim() ?? null,
  added: document.querySelector('[data-testid="save-count-added"]')?.textContent?.trim() ?? null,
  row: document.querySelector('.save-row-text')?.textContent ?? null,
}))()`)
console.log('preview:', JSON.stringify(state))
if (!state.panel || state.changed !== 'changed 1' || state.added !== 'added 0'
  || !state.row?.includes('Manufacturing')) {
  console.log('SAVE FAILED'); await browser.close(); process.exit(1)
}

// 3. Write to a project-relative path — saved, dirty clears.
await page.evaluate(`(() => {
  const input = document.querySelector('[data-testid="save-path"]')
  input.value = 'tmp-save-smoke.prl'
  input.dispatchEvent(new Event('input', { bubbles: true }))
})()`)
await new Promise(r => setTimeout(r, 300))
await page.evaluate(`(() => { document.querySelector('[data-testid="save-write"]').click() })()`)
await new Promise(r => setTimeout(r, 700))
state = await page.evaluate(`(() => ({
  done: document.querySelector('[data-testid="save-done"]')?.textContent ?? null,
  dirtyGone: !document.querySelector('[data-testid="dirty-dot"]'),
}))()`)
console.log('written:', JSON.stringify(state))

const ok = !!state.done?.includes('written to file') && state.dirtyGone
console.log(ok ? 'SAVE OK' : 'SAVE FAILED')
await browser.close()
process.exit(ok ? 0 : 1)
