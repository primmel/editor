// The responsive leg (TODO.editor/51) — the studio at 390×844 (an
// iPhone-class viewport): the shell collapses, both drawers open and
// close over the canvas, every tab is reachable in the scrolling
// topbar, the save overlay fits the viewport width, and the desktop
// probe (≥1025px) still finds the three-column grid.
import puppeteer from 'puppeteer'

const MODEL = `root Root

version "v1.0.0-dev1"

metadata {
  title "R"
  schema "Primmel 0.1"
  namespace "resp"
}

process p1 {
  name "One"
  modality shall
}

start_event S { }
end_event E { }
`

const browser = await puppeteer.launch({ headless: true, args: ['--no-sandbox'] })
const page = await browser.newPage()
const errors: string[] = []
page.on('pageerror', (e) => errors.push(String(e)))
await page.setViewport({ width: 390, height: 844, isMobile: true, hasTouch: true })
await page.goto(process.env.E2E_BASE ?? 'http://localhost:5199/', { waitUntil: 'domcontentloaded' })
await new Promise((r) => setTimeout(r, 2500))

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))
const fail = async (why: string) => { console.log('RESPONSIVE FAILED:', why); await browser.close(); process.exit(1) }

await page.evaluate(`(() => { window.__stores.model.loadText(${JSON.stringify(MODEL)}) })()`)
await sleep(700)

// 1. The shell collapses: no horizontal scroll, the canvas visible,
//    the grid is one column.
const shell = await page.evaluate(`(() => {
  const ws = document.querySelector('.workspace')
  const cols = getComputedStyle(ws).gridTemplateColumns
  const canvas = document.querySelector('.panel-center')
  return {
    cols,
    canvasVisible: !!canvas && canvas.getBoundingClientRect().width > 300,
    overflowX: document.documentElement.scrollWidth > document.documentElement.clientWidth,
  }
})()`)
console.log('shell:', JSON.stringify(shell))
if (!shell.cols.startsWith('390')) await fail(`grid not collapsed: ${shell.cols}`)
if (!shell.canvasVisible) await fail('canvas not visible')
if (shell.overflowX) await fail('horizontal scroll on the shell')

// 2. The left drawer opens over the canvas and closes via the backdrop.
await page.evaluate(`(() => { document.querySelector('[data-testid="drawer-left-toggle"]').click() })()`)
await sleep(300)
let drawer = await page.evaluate(`(() => {
  const left = document.querySelector('.panel-left')
  const r = left.getBoundingClientRect()
  return { open: left.classList.contains('drawer-open'), right: r.right, width: r.width }
})()`)
console.log('left drawer:', JSON.stringify(drawer))
if (!drawer.open || drawer.right <= 0) await fail('left drawer did not open')
await page.evaluate(`(() => { document.querySelector('[data-testid="drawer-backdrop"]').click() })()`)
await sleep(300)

// 3. The right drawer opens (the inspector slides from the right).
await page.evaluate(`(() => { document.querySelector('[data-testid="drawer-right-toggle"]').click() })()`)
await sleep(300)
drawer = await page.evaluate(`(() => {
  const right = document.querySelector('.panel-right')
  const r = right.getBoundingClientRect()
  return { open: right.classList.contains('drawer-open'), left: r.left }
})()`)
console.log('right drawer:', JSON.stringify(drawer))
if (!drawer.open || drawer.left >= 390) await fail('right drawer did not open')
await page.evaluate(`(() => { document.querySelector('[data-testid="drawer-backdrop"]').click() })()`)
await sleep(200)

// 4. Every tab is reachable in the scrolling topbar.
const tabs = await page.evaluate(`(() => {
  const reach = []
  for (const id of ['tab-workspace', 'tab-layers', 'tab-validation', 'tab-check', 'tab-twin']) {
    const el = document.querySelector('[data-testid="' + id + '"]')
    if (el) { el.scrollIntoView(); reach.push(id + ':' + (el.getBoundingClientRect().width > 0)) }
  }
  return reach
})()`)
console.log('tabs:', JSON.stringify(tabs))
if (tabs.some((t) => t.endsWith('false'))) await fail('a tab is unreachable at mobile width')

// 5. The twin runs at mobile width (the demo leg holds).
await page.evaluate(`(() => {
  const el = document.querySelector('[data-testid="tab-twin"]'); el.scrollIntoView(); el.click()
})()`)
await sleep(400)
const twin = await page.evaluate(`(() => !!document.querySelector('[data-testid="twin-panel"]'))()`)
if (!twin) await fail('the twin panel did not render at mobile width')
console.log('twin at mobile: ok')

// 6. Desktop is untouched: the three-column grid at ≥1025px.
await page.setViewport({ width: 1440, height: 950 })
await sleep(400)
const desktop = await page.evaluate(`(() => {
  const cols = getComputedStyle(document.querySelector('.workspace')).gridTemplateColumns
  return { cols, toggles: getComputedStyle(document.querySelector('.drawer-toggles')).display }
})()`)
console.log('desktop:', JSON.stringify(desktop))
if (desktop.cols.split(' ').length !== 3) await fail(`desktop grid changed: ${desktop.cols}`)
if (desktop.toggles !== 'none') await fail('drawer toggles visible on desktop')

if (errors.length) { console.log('PAGE ERRORS:', errors.slice(0, 3)); await browser.close(); process.exit(1) }
console.log('RESPONSIVE OK')
await browser.close()
