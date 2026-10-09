// The WebKit leg (TODO.editor/52, the sixth pass) — the responsive
// layer under the REAL mobile engine (iOS Safari's WebKit, not
// emulated Chromium): the shell collapses, the drawers open/close,
// the twin panel renders, no horizontal overflow — same assertions
// as responsive-smoke, another engine.
import { webkit } from 'playwright'

const URL = process.env.E2E_BASE ?? 'http://localhost:5199/'
const browser = await webkit.launch({ headless: process.env.WEBKIT_HEADED ? false : false })
const context = await browser.newContext({
  viewport: { width: 390, height: 844 },
  isMobile: true,
  hasTouch: true,
  userAgent:
    'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1',
})
const page = await context.newPage()
const errors: string[] = []
page.on('pageerror', (e) => errors.push(String(e)))
await page.goto(URL, { waitUntil: 'domcontentloaded', timeout: 30000 })
await page.waitForTimeout(2500)

const fail = async (why: string) => { console.log('WEBKIT FAILED:', why); await browser.close(); process.exit(1) }

const shell = await page.evaluate(() => {
  const ws = document.querySelector('.workspace')
  const toggles = document.querySelector('.drawer-toggles')
  return {
    app: !!document.querySelector('.atelier'),
    cols: ws ? getComputedStyle(ws).gridTemplateColumns : null,
    toggles: toggles ? getComputedStyle(toggles).display : 'absent',
    overflow: document.documentElement.scrollWidth > document.documentElement.clientWidth,
  }
})
console.log('shell:', JSON.stringify(shell))
if (!shell.app) await fail('the app did not mount under WebKit')
if (!shell.cols || !shell.cols.startsWith('390')) await fail(`grid not collapsed: ${shell.cols}`)
if (shell.toggles !== 'flex') await fail('drawer toggles absent')
if (shell.overflow) await fail('horizontal overflow')

// The drawers open over the canvas.
await page.click('[data-testid="drawer-left-toggle"]', { force: true })
await page.waitForTimeout(300)
const left = await page.evaluate(() => {
  const el = document.querySelector('.panel-left')
  return el ? el.classList.contains('drawer-open') : false
})
if (!left) await fail('left drawer did not open under WebKit')
await page.click('[data-testid="drawer-backdrop"]', { force: true })
await page.waitForTimeout(250)

// The twin panel renders.
await page.evaluate(() => {
  const el = document.querySelector('[data-testid="tab-twin"]') as HTMLElement | null
  el?.scrollIntoView()
  el?.click()
})
await page.waitForTimeout(500)
const twin = await page.evaluate(() => !!document.querySelector('[data-testid="twin-panel"]'))
if (!twin) await fail('the twin panel did not render under WebKit')

if (errors.length) { console.log('PAGE ERRORS:', errors.slice(0, 3)); await browser.close(); process.exit(1) }
console.log('WEBKIT OK')
await browser.close()
