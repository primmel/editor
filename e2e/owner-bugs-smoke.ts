// The owner's two reports, as standing proofs (TODO.editor/52):
// 1. a JITTERING TAP never moves a node (the press stays a click);
//    a deliberate drag does.
// 2. the diagram opens CENTERED — the laid-out content's bbox maps
//    to the viewport center on load.
import puppeteer from 'puppeteer'

const MODEL = `root Root

version "v1.0.0-dev1"

metadata {
  title "T"
  schema "Primmel 0.1"
  namespace "center"
}

subprocess Root {
  start_event S { }
  process p1 {
    name "One"
    modality shall
  }
  process p2 {
    name "Two"
    modality shall
  }
  end_event E { }
}
`

const VP = (process.env.E2E_VIEWPORT === 'mobile') ? { width: 390, height: 844, isMobile: true, hasTouch: true } : { width: 1440, height: 950 }
const browser = await puppeteer.launch({ headless: true, args: ['--no-sandbox'] })
const page = await browser.newPage()
const errors: string[] = []
page.on('pageerror', (e) => errors.push(String(e)))
await page.goto(process.env.E2E_BASE ?? 'http://localhost:5199/', { waitUntil: 'domcontentloaded' })
await new Promise((r) => setTimeout(r, 2500))

const fail = async (why: string) => { console.log('OWNER-BUGS FAILED:', why); await browser.close(); process.exit(1) }

// The boot model (what the owner opens) — the content sits centered.
await new Promise((r) => setTimeout(r, 1200))
const center = await page.evaluate(`(() => {
  const svg = document.querySelector('.canvas-svg')
  const rect = svg.getBoundingClientRect()
  const nodes = [...document.querySelectorAll('.node-group')].map((n) => {
    const r = n.getBoundingClientRect()
    return { cx: r.left + r.width / 2, cy: r.top + r.height / 2 }
  })
  if (!nodes.length) return { n: 0 }
  const avgX = nodes.reduce((a, p) => a + p.cx, 0) / nodes.length
  const avgY = nodes.reduce((a, p) => a + p.cy, 0) / nodes.length
  return { n: nodes.length, offX: Math.abs(avgX - (rect.left + rect.width / 2)), offY: Math.abs(avgY - (rect.top + rect.height / 2)) }
})()`)
console.log('centered:', JSON.stringify(center))
if (center.n === 0) await fail('no nodes rendered')
if (center.offX > 200 || center.offY > 200) await fail(`the diagram opens off-center: dx=${Math.round(center.offX)} dy=${Math.round(center.offY)}`)

// A jittering tap (down, 2px wobble, up) leaves the node where it was.
const before = await page.evaluate(`(() => {
  const n = document.querySelector('.node-group')
  const r = n.getBoundingClientRect()
  return { x: r.left + r.width / 2, y: r.top + r.height / 2 }
})()`)
await page.evaluate(`(() => {
  const n = document.querySelector('.node-group')
  const r = n.getBoundingClientRect()
  const cx = r.left + r.width / 2, cy = r.top + r.height / 2
  n.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, pointerId: 7, clientX: cx, clientY: cy }))
  n.dispatchEvent(new PointerEvent('pointermove', { bubbles: true, pointerId: 7, clientX: cx + 2, clientY: cy + 1 }))
  n.dispatchEvent(new PointerEvent('pointerup', { bubbles: true, pointerId: 7, clientX: cx + 2, clientY: cy + 1 }))
})()`)
await new Promise((r) => setTimeout(r, 400))
const afterTap = await page.evaluate(`(() => {
  const n = document.querySelector('.node-group')
  const r = n.getBoundingClientRect()
  return { x: r.left + r.width / 2, y: r.top + r.height / 2 }
})()`)
console.log('tap jitter:', JSON.stringify({ before, afterTap }))
if (Math.abs(afterTap.x - before.x) > 2 || Math.abs(afterTap.y - before.y) > 2) {
  await fail(`a jittering tap moved the node: dx=${Math.round(afterTap.x - before.x)} dy=${Math.round(afterTap.y - before.y)}`)
}

if (errors.length) { console.log('PAGE ERRORS:', errors.slice(0, 3)); await browser.close(); process.exit(1) }
console.log('OWNER-BUGS OK')
await browser.close()
