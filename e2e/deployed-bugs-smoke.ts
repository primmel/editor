// The deployed owner-bugs leg (the eighth pass): yesterday's fixes —
// the centered canvas and the inert jitter-tap — proven against the
// PRODUCTION pages build, not just the dev server.
import puppeteer from 'puppeteer'

const URL = process.env.DEPLOY_URL ?? 'http://www.primmel.org/editor/'
const browser = await puppeteer.launch({ headless: true, args: ['--no-sandbox'] })
const page = await browser.newPage()
const errors: string[] = []
page.on('pageerror', (e) => errors.push(String(e)))
await page.setViewport({ width: 1440, height: 950 })
await page.goto(URL, { waitUntil: 'domcontentloaded' })
await new Promise((r) => setTimeout(r, 3000))

const fail = async (why: string) => { console.log('DEPLOYED-BUGS FAILED:', why); await browser.close(); process.exit(1) }

// 1. The boot diagram sits centered in the deployed build.
const center = await page.evaluate(`(() => {
  const svg = document.querySelector('.canvas-svg')
  if (!svg) return { n: 0 }
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
console.log('deployed center:', JSON.stringify(center))
if (center.n === 0) await fail('no nodes rendered in the deployed build')
if (center.offX > 200 || center.offY > 200) await fail(`off-center: ${Math.round(center.offX)},${Math.round(center.offY)}`)

// 2. A jittering tap never moves a node.
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
const after = await page.evaluate(`(() => {
  const n = document.querySelector('.node-group')
  const r = n.getBoundingClientRect()
  return { x: r.left + r.width / 2, y: r.top + r.height / 2 }
})()`)
console.log('deployed tap:', JSON.stringify({ before, after }))
if (Math.abs(after.x - before.x) > 2 || Math.abs(after.y - before.y) > 2) {
  await fail('the deployed build still moves nodes on tap jitter')
}
if (errors.length) { console.log('PAGE ERRORS:', errors.slice(0, 3)); await browser.close(); process.exit(1) }
console.log('DEPLOYED-BUGS OK')
await browser.close()
