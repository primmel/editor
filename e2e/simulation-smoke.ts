import puppeteer from 'puppeteer'

const browser = await puppeteer.launch({ headless: true, args: ['--no-sandbox'] })
const page = await browser.newPage()
await page.setViewport({ width: 1440, height: 950 })
page.on('pageerror', e => console.log('PAGEERROR:', String(e)))
await page.goto('http://localhost:5173/', { waitUntil: 'domcontentloaded' })
await new Promise(r => setTimeout(r, 2500))

// 1. Open the simulation panel.
await page.evaluate(`(() => { window.__stores.ui.rightPanel = 'simulation' })()`)
await new Promise(r => setTimeout(r, 400))
let state = await page.evaluate(`(() => ({
  panel: !!document.querySelector('[data-testid="sim-panel"]'),
  startBtn: !!document.querySelector('[data-testid="sim-start"]'),
}))()`)
console.log('panel:', JSON.stringify(state))
if (!state.panel || !state.startBtn) { console.log('SIM FAILED'); await browser.close(); process.exit(1) }

// 2. Start → the token sits on Start, tinted on the canvas.
await page.evaluate(`(() => { document.querySelector('[data-testid="sim-start"]').click() })()`)
await new Promise(r => setTimeout(r, 500))
state = await page.evaluate(`(() => ({
  current: document.querySelector('[data-testid="sim-current"]')?.textContent ?? null,
  startTint: document.querySelector('[data-node-id="Start"]')?.getAttribute('style') ?? null,
  rows: document.querySelectorAll('.trajectory-row').length,
}))()`)
console.log('started:', JSON.stringify(state))
if (state.current !== 'Start' || !state.startTint?.includes('91, 107, 192') || state.rows !== 1) {
  console.log('SIM FAILED'); await browser.close(); process.exit(1)
}

// 3. Step to Manufacturing (highlight moves), then to Done (completed).
await page.evaluate(`(() => { document.querySelector('[data-testid="sim-step"]').click() })()`)
await new Promise(r => setTimeout(r, 400))
const mid = await page.evaluate(`(() => ({
  current: document.querySelector('[data-testid="sim-current"]')?.textContent ?? null,
  mfgTint: document.querySelector('[data-node-id="Manufacturing"]')?.getAttribute('style') ?? null,
}))()`)
console.log('stepped:', JSON.stringify(mid))
await page.evaluate(`(() => { document.querySelector('[data-testid="sim-step"]').click() })()`)
await new Promise(r => setTimeout(r, 400))
state = await page.evaluate(`(() => ({
  done: !!document.querySelector('[data-testid="sim-done"]'),
  rows: document.querySelectorAll('.trajectory-row').length,
  wall: document.querySelector('.sim-wall')?.textContent ?? null,
}))()`)
console.log('completed:', JSON.stringify(state))
if (mid.current !== 'Manufacturing' || !mid.mfgTint?.includes('91, 107, 192')
  || !state.done || state.rows !== 4 || !state.wall?.includes('never persist')) {
  console.log('SIM FAILED'); await browser.close(); process.exit(1)
}

// 4. Reset → back at Start.
await page.evaluate(`(() => { document.querySelector('[data-testid="sim-reset"]').click() })()`)
await new Promise(r => setTimeout(r, 400))
state = await page.evaluate(`(() => ({
  current: document.querySelector('[data-testid="sim-current"]')?.textContent ?? null,
  done: !!document.querySelector('[data-testid="sim-done"]'),
}))()`)
console.log('reset:', JSON.stringify(state))

const ok = state.current === 'Start' && !state.done
console.log(ok ? 'SIM OK' : 'SIM FAILED')
await browser.close()
process.exit(ok ? 0 : 1)
