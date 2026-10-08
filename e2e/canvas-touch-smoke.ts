// The canvas touch leg (TODO.editor/51's R4, the third pass): a
// TOUCH drag pans the canvas — pointer events + touch-action: none
// give the app the gesture; the pan state moves with the finger.
import puppeteer from 'puppeteer'

const MODEL = `root Root

version "v1.0.0-dev1"

metadata {
  title "T"
  schema "Primmel 0.1"
  namespace "touch"
}

subprocess Root {
  start_event S { }
  process p1 {
    name "One"
    modality shall
  }
  end_event E { }
}
`

const browser = await puppeteer.launch({ headless: true, args: ['--no-sandbox'] })
const page = await browser.newPage()
const errors: string[] = []
page.on('pageerror', (e) => errors.push(String(e)))
await page.setViewport({ width: 390, height: 844, isMobile: true, hasTouch: true })
await page.goto(process.env.E2E_BASE ?? 'http://localhost:5199/', { waitUntil: 'domcontentloaded' })
await new Promise((r) => setTimeout(r, 2500))

const fail = async (why: string) => { console.log('TOUCH FAILED:', why); await browser.close(); process.exit(1) }

await page.evaluate(`(() => { window.__stores.model.loadText(${JSON.stringify(MODEL)}) })()`)
await new Promise((r) => setTimeout(r, 800))

const before = await page.evaluate(`(() => {
  const s = window.__stores.ui
  return { panX: s.panX, panY: s.panY, touchAction: getComputedStyle(document.querySelector('.canvas-svg')).touchAction }
})()`)
console.log('before:', JSON.stringify(before))
if (before.touchAction !== 'none') await fail('touch-action is not none — the browser owns the gesture')

// The touch drag: find a canvas-background point (a node tap is a
// select, not a pan), then finger down there, move, up.
const origin = await page.evaluate(`(() => {
  const ok = (el) => el && (el.getAttribute && el.getAttribute('data-bg')) || (el && el.tagName === 'svg')
  for (let x = 20; x < 380; x += 40) {
    for (let y = 120; y < 820; y += 40) {
      const el = document.elementFromPoint(x, y)
      if (ok(el)) return { x, y }
    }
  }
  return null
})()`)
if (!origin) { console.log('TOUCH FAILED: no background point found'); await browser.close(); process.exit(1) }
await page.touchscreen.touchStart(origin.x, origin.y)
await page.touchscreen.touchMove(origin.x - 80, origin.y - 60)
await page.touchscreen.touchMove(origin.x - 110, origin.y - 80)
await page.touchscreen.touchEnd()

const after = await page.evaluate(`(() => {
  const s = window.__stores.ui
  return { panX: s.panX, panY: s.panY }
})()`)
console.log('after:', JSON.stringify(after))
if (after.panX === before.panX && after.panY === before.panY) {
  await fail('the touch drag did not pan the canvas')
}
if (errors.length) { console.log('PAGE ERRORS:', errors.slice(0, 3)); await browser.close(); process.exit(1) }
console.log('TOUCH OK')
await browser.close()
